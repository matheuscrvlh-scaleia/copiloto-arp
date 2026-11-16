import { randomUUID } from "node:crypto";
import { nomeSeguro } from "@arp/shared/arquivos/nome";
import {
  type ContaAgua,
  conferirConta,
  type SugestaoConta,
  sugerirDoTexto,
  tipoDoComprovante,
} from "@arp/shared/operacoes/agua-conta";
import { rotuloMes } from "@arp/shared/operacoes/agua-formato";
import type { PreviaConta } from "@arp/shared/operacoes/contratos/importacoes";
import { textosDoPdf } from "@arp/shared/operacoes/energisa-pdf";
import { lerArquivos } from "@arp/shared/operacoes/importacoes";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import { ErroDeConflito, ErroDeNegocio, ErroDePermissao } from "@/erros";
import {
  gravarArquivo,
  linkDeLeitura,
  removerArquivos,
} from "@/infra/arquivos";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import { BUCKET, logImportacaoOp, logOperacoes, podeAgora } from "./apoio";
import * as imps from "./importacoes.repository";
import { sha256 } from "./planilha";

// Conta da concessionária de água (tipo "agua_conta"), uma conta por
// importação:
//   1. ler: guarda o PDF ou a foto (comprovante), sugere os campos lidos do
//      texto do PDF e grava a importação "prévia".
//   2. confirmar: grava os campos conferidos em agua_contas e confirma
//      (operacoes.confirmar_importacao). A conta da mesma matrícula e mês
//      que valia é substituída e volta se esta for desfeita.
//   3. corrigir: corrige um campo da conta que já vale.
//   Descartar e desfazer: o "Desfazer" do histórico (desfazer_importacao).
// Tudo com a sessão (RLS e funções conferem operacoes.agua.importar); o
// arquivo vai para o disco só depois de conferir a permissão no banco.

const SEM_PERMISSAO = "Você não tem permissão para importar a água.";

async function exigirImportar(ctx: Contexto) {
  if (!(await podeAgora(ctx, "operacoes.agua.importar")))
    throw new ErroDePermissao(SEM_PERMISSAO);
}

const naSessao = <T>(ctx: Contexto, fn: (tx: Tx) => Promise<T>) =>
  banco.comoUsuario(ctx.usuario.id, fn);

interface ResumoConta {
  versao: 1;
  arquivo: string;
  tipo: string;
  sugestao: SugestaoConta;
}

const resumoSchema = z.object({
  versao: z.literal(1),
  arquivo: z.string(),
  tipo: z.string(),
  sugestao: z.record(z.string(), z.string()).catch({}),
});

const mesPassado = () => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
};

async function montar(
  id: string,
  resumo: ResumoConta,
  caminho: string | undefined,
  referencia: string,
): Promise<PreviaConta> {
  return {
    id,
    arquivo: {
      nome: resumo.arquivo,
      tipo: resumo.tipo,
      url: caminho
        ? await linkDeLeitura(BUCKET, caminho, { segundos: 3600 })
        : null,
    },
    sugestao: resumo.sugestao,
    mes: /^\d{4}-\d{2}-01$/.test(referencia)
      ? referencia.slice(0, 7)
      : mesPassado(),
  };
}

const caminhosDe = (arquivos: unknown) =>
  lerArquivos(arquivos).flatMap((a) => (a.caminho ? [a.caminho] : []));

/** Lê a conta enviada, guarda o comprovante e abre a prévia. */
export async function ler(
  ctx: Contexto,
  arquivo: { nome: string; bytes: Uint8Array } | null,
): Promise<PreviaConta> {
  await exigirImportar(ctx);
  if (!arquivo || arquivo.bytes.length === 0)
    throw new ErroDeNegocio("Escolha o PDF ou a foto da conta.");
  const { bytes } = arquivo;
  const tipo = tipoDoComprovante(bytes);
  if (!tipo)
    throw new ErroDeNegocio(
      "Envie a conta em PDF ou foto (.jpg, .png ou .webp).",
    );
  const nome = arquivo.nome.slice(0, 200) || "conta";
  const hash = sha256(bytes);

  try {
    const [ja] = await naSessao(ctx, (tx) =>
      imps.importacaoDoArquivo(tx, "agua_conta", hash, ["confirmada"]),
    );
    if (ja)
      throw new ErroDeNegocio(
        `Este arquivo já foi importado (conta de ${rotuloMes(ja.referencia)}). Para corrigir, abra a importação no histórico.`,
      );
    // Reenvio: a prévia aberta da própria pessoa dá lugar à nova.
    await descartarAbertas(ctx);
  } catch (e) {
    if (e instanceof ErroDeNegocio) throw e;
    log.error({ err: e }, "conferir conta de água repetida");
    throw new ErroDeNegocio(
      "Não foi possível conferir o arquivo. Tente de novo.",
    );
  }

  let sugestao: SugestaoConta = {};
  if (tipo === "application/pdf") {
    try {
      const paginas = await textosDoPdf(bytes);
      sugestao = sugerirDoTexto(
        paginas.map((p) => p.map((i) => i.str).join(" ")).join(" "),
      );
    } catch (err) {
      // PDF só com imagem ou protegido: a pessoa digita os campos.
      log.warn({ err }, "texto da conta de água");
    }
  }

  const ext = tipo === "application/pdf" ? "conta.pdf" : "conta.jpg";
  const caminho = `agua/contas/${randomUUID()}/${nomeSeguro(nome, ext)}`;
  try {
    await gravarArquivo(BUCKET, caminho, bytes, tipo);
  } catch (err) {
    log.error({ err }, "gravar conta de água");
    throw new ErroDeNegocio(
      "Não foi possível guardar o arquivo. Tente de novo.",
    );
  }
  const referencia = `${sugestao.referencia ?? mesPassado()}-01`;
  const resumo: ResumoConta = { versao: 1, arquivo: nome, tipo, sugestao };
  let id: string;
  try {
    ({ id } = await naSessao(ctx, (tx) =>
      imps.inserirImportacao(tx, {
        tipo: "agua_conta",
        referencia,
        arquivos: [{ nome, caminho, sha256: hash, bytes: bytes.length }],
        resumo,
        avisos: [],
        bate: null,
        criado_por: ctx.usuario.id,
      }),
    ));
  } catch (e) {
    await removerArquivos(BUCKET, [caminho]).catch(() => {});
    if (e instanceof ErroDePermissao) throw new ErroDePermissao(SEM_PERMISSAO);
    log.error({ err: e }, "registrar importação da conta de água");
    throw new ErroDeNegocio(
      "Não foi possível registrar a importação. Tente de novo.",
    );
  }
  return montar(id, resumo, caminho, referencia);
}

async function descartarAbertas(ctx: Contexto) {
  const abertas = await naSessao(ctx, (tx) =>
    imps.previasDaPessoa(tx, "agua_conta", ctx.usuario.id),
  );
  for (const p of abertas) {
    await naSessao(ctx, (tx) => imps.desfazer(tx, p.id));
    await removerArquivos(BUCKET, caminhosDe(p.arquivos)).catch(() => {});
  }
}

/** A prévia que a pessoa deixou aberta (fechou a aba no meio). */
export async function previaAberta(ctx: Contexto): Promise<PreviaConta | null> {
  try {
    if (!(await podeAgora(ctx, "operacoes.agua.importar"))) return null;
    const [aberta] = await naSessao(ctx, (tx) =>
      imps.previasDaPessoa(tx, "agua_conta", ctx.usuario.id),
    );
    if (!aberta) return null;
    const r = resumoSchema.safeParse(aberta.resumo);
    if (!r.success) return null;
    return await montar(
      aberta.id,
      r.data,
      lerArquivos(aberta.arquivos)[0]?.caminho,
      aberta.referencia,
    );
  } catch (err) {
    log.error({ err }, "prévia aberta da conta de água");
    return null;
  }
}

export async function confirmar(
  ctx: Contexto,
  id: string,
  conta: ContaAgua,
): Promise<{ mensagem: string; avisos: string[] }> {
  await exigirImportar(ctx);
  const imp = await naSessao(ctx, (tx) => imps.importacao(tx, id));
  if (!imp || imp.tipo !== "agua_conta")
    throw new ErroDeNegocio("Prévia não encontrada.");
  if (imp.status !== "previa")
    throw new ErroDeNegocio("Esta prévia já foi confirmada ou descartada.");

  const avisos = conferirConta(conta);
  const anterior =
    imp.resumo && typeof imp.resumo === "object" && !Array.isArray(imp.resumo)
      ? imp.resumo
      : {};
  const resumo = {
    ...anterior,
    conta: {
      matricula: conta.matricula,
      referencia: conta.referencia,
      consumo_m3: conta.consumo_m3,
    },
  };
  let substitui: string | null;
  try {
    // Uma transação: os campos, a conta e a confirmação entram juntos.
    substitui = await naSessao(ctx, async (tx) => {
      await imps.ajustarImportacao(tx, id, {
        referencia: conta.referencia,
        resumo,
        avisos: avisos.map((mensagem) => ({ nivel: "aviso", mensagem })),
      });
      const existente = await tx
        .selectFrom("operacoes.agua_contas")
        .select("id")
        .where("importacao_id", "=", id)
        .executeTakeFirst();
      if (existente)
        await tx
          .updateTable("operacoes.agua_contas")
          .set(conta)
          .where("id", "=", existente.id)
          .execute();
      else
        await tx
          .insertInto("operacoes.agua_contas")
          .values({ ...conta, importacao_id: id })
          .execute();
      await imps.confirmar(tx, id);
      return (await imps.importacao(tx, id))?.substitui ?? null;
    });
  } catch (e) {
    if (e instanceof ErroDePermissao) throw new ErroDePermissao(SEM_PERMISSAO);
    if (e instanceof ErroDeConflito)
      throw new ErroDeConflito(
        "Já há outra conta dessa matrícula e mês valendo. Tente de novo.",
      );
    if (e instanceof ErroDeNegocio) throw e;
    log.error({ err: e }, "confirmar conta de água");
    throw new ErroDeNegocio("Não foi possível confirmar. Nada foi alterado.");
  }
  logImportacaoOp(
    ctx,
    "confirmou",
    { id, tipo: "agua_conta", referencia: conta.referencia },
    substitui ? "substituiu a anterior" : undefined,
  );
  return {
    mensagem: `Conta de ${rotuloMes(conta.referencia)} (matrícula ${conta.matricula}) importada${substitui ? "; a conta anterior da mesma matrícula e mês ficou guardada no histórico" : ""}.`,
    avisos,
  };
}

export async function descartar(ctx: Contexto, id: string): Promise<string> {
  await exigirImportar(ctx);
  const imp = await naSessao(ctx, (tx) => imps.importacao(tx, id));
  if (!imp || imp.tipo !== "agua_conta" || imp.status !== "previa")
    throw new ErroDeNegocio("Prévia não encontrada ou já confirmada.");
  try {
    await naSessao(ctx, (tx) => imps.desfazer(tx, id));
  } catch (err) {
    log.error({ err }, "descartar conta de água");
    throw new ErroDeNegocio("Não foi possível descartar. Tente de novo.");
  }
  await removerArquivos(BUCKET, caminhosDe(imp.arquivos)).catch(() => {});
  logImportacaoOp(ctx, "descartou", { id, tipo: "agua_conta" });
  return "Prévia descartada.";
}

/** Corrige a conta que já vale (tela da importação). O mês não muda aqui. */
export async function corrigir(
  ctx: Contexto,
  id: string,
  conta: ContaAgua,
): Promise<string> {
  await exigirImportar(ctx);
  const { referencia, ...campos } = conta;
  let gravadas: { referencia: string }[];
  try {
    gravadas = await naSessao(ctx, (tx) =>
      tx
        .updateTable("operacoes.agua_contas")
        .set(campos)
        .where("importacao_id", "=", id)
        .where("vigente", "=", true)
        .returning(["id", "referencia"])
        .execute(),
    );
  } catch (e) {
    if (e instanceof ErroDeConflito)
      throw new ErroDeConflito(
        "Já há outra conta dessa matrícula no mesmo mês valendo.",
      );
    log.error({ err: e }, "corrigir conta de água");
    throw new ErroDeNegocio("Não foi possível salvar a correção.");
  }
  if (!gravadas.length)
    throw new ErroDeNegocio(
      "Conta não encontrada ou não vale mais (desfeita ou substituída).",
    );
  const avisos = conferirConta(conta);
  logOperacoes(
    ctx,
    "operacoes_importacao_corrigida",
    `Corrigiu a conta de água de ${rotuloMes(gravadas[0]?.referencia ?? referencia)} (matrícula ${campos.matricula})`,
    { importacao: id },
  );
  return `Conta corrigida.${avisos.length ? ` Confira: ${avisos.join(" ")}` : ""}`;
}
