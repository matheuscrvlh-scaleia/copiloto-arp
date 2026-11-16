import { randomUUID } from "node:crypto";
import { nomeSeguro } from "@arp/shared/arquivos/nome";
import { formatarMoeda, lerValorBr } from "@arp/shared/formato";
import {
  centavosDe,
  type Mes,
  mesDoDia,
  normalizar,
  periodoDe,
  proximaRevisao,
  reaisDe,
  rotuloMesLongo,
  somar,
} from "@arp/shared/operacoes/obras";
import {
  type AvisoOrcamento,
  type EstadoOrcamento,
  lerOrcamento,
  type OrcamentoLido,
  type PreviaOrcamento,
} from "@arp/shared/operacoes/orcamento";
import { abasDoXlsx } from "@arp/shared/operacoes/orcamento-planilha";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import pg from "pg";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import { ErroDeConflito, ErroDeNegocio, ErroDePermissao } from "@/erros";
import { gravarArquivo, removerArquivos } from "@/infra/arquivos";
import { banco, type Tx } from "@/infra/banco";
import { erroDoBanco } from "@/infra/banco/erros";
import { log } from "@/infra/log";
import { TIPO_XLSX } from "@/infra/planilha";
import { tentar } from "../os/tentar";
import { BUCKET, logImportacaoOp, podeAgora, validarFormulario } from "./apoio";
import * as imps from "./importacoes.repository";
import * as repo from "./obras.repository";
import { sha256 } from "./planilha";

// Ações das Obras — previsto e realizado (spec 4.9 e 4.11):
//   * orçamento: ler a planilha → prévia gravada (importação "previa",
//     revisão com vigente = false, etapas, previsto e, na primeira
//     importação da obra, o realizado da planilha) → confirmar
//     (operacoes.confirmar_importacao torna a revisão vigente) ou descartar;
//   * realizado lançado na tela (etapa, mês, valor, descrição e anexo);
//   * dados da obra (nome, responsável, vínculo com o Diário de Obra).
// Gravação com a sessão (o RLS confere operacoes.obras.importar de novo);
// arquivos e a limpeza de obra criada por prévia descartada só depois de
// conferir no banco. O registro de quem fez o quê fica na auditoria do
// banco; confirmar e descartar a prévia também vão para o histórico do
// sistema (core.logs).

const PERMISSAO = "operacoes.obras.importar" as const;
export const LIMITE_MB = 8;
export const LIMITE_BYTES = LIMITE_MB * 1024 * 1024;
const SEM_PERMISSAO =
  "Você não tem permissão para importar o orçamento nem lançar o realizado.";

const reais = (centavos: number) => reaisDe(centavos);
const moeda = (centavos: number) => formatarMoeda(reaisDe(centavos));
const mesAtual = () => mesDoDia(hojeEmBrasilia(new Date()));

const comeca = (b: Uint8Array, ...assinatura: number[]) =>
  assinatura.every((x, i) => b[i] === x);
const ehXlsx = (b: Uint8Array) => comeca(b, 0x50, 0x4b, 0x03, 0x04);

/** Tipo do anexo pelo conteúdo (não pelo nome): PDF, JPEG, PNG ou WebP. */
function tipoDoAnexo(b: Uint8Array): string | null {
  if (comeca(b, 0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  if (comeca(b, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (comeca(b, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (
    comeca(b, 0x52, 0x49, 0x46, 0x46) &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return "image/webp";
  return null;
}

const naSessao = <T>(ctx: Contexto, fn: (tx: Tx) => Promise<T>) =>
  banco.comoUsuario(ctx.usuario.id, fn);

async function exigirImportar(ctx: Contexto) {
  if (!(await podeAgora(ctx, PERMISSAO)))
    throw new ErroDePermissao(SEM_PERMISSAO);
}

type Campos = Record<string, string | string[]>;
const campo = (c: Campos, k: string) => {
  const v = c[k];
  return Array.isArray(v) ? v[0] : v;
};

// ---------------------------------------------------------------------------
// Orçamento: ler a planilha e gravar a prévia
// ---------------------------------------------------------------------------

const escolhas = z.object({
  obra: z.union([z.literal(""), z.literal("nova"), z.uuid()]),
  nome_obra: z.preprocess(
    (v) => String(v ?? "").trim(),
    z.string().max(120, "máximo de 120 caracteres"),
  ),
});

/** "mes_H" = "2027-01" → { H: "2027-01-01" }. */
function mesesEscolhidos(c: Campos): Record<string, Mes> {
  const meses: Record<string, Mes> = {};
  for (const [k, v] of Object.entries(c)) {
    const m = /^mes_([A-Z]{1,3})$/.exec(k);
    const valor = Array.isArray(v) ? v[0] : v;
    if (m?.[1] && valor && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor))
      meses[m[1]] = `${valor}-01`;
  }
  return meses;
}

function previaDe(
  lido: OrcamentoLido,
  e: {
    importacaoId: string;
    obra: { id: string; nome: string };
    obraNova: boolean;
    codigo: string;
    revisaoVigente: string | null;
    arquivo: string;
    realizadoImportado: boolean;
    avisos: AvisoOrcamento[];
  },
): PreviaOrcamento {
  return {
    importacaoId: e.importacaoId,
    obraId: e.obra.id,
    obraNome: e.obra.nome,
    obraNova: e.obraNova,
    codigo: e.codigo,
    revisaoVigente: e.revisaoVigente,
    data: lido.data,
    titulo: lido.titulo,
    arquivo: e.arquivo,
    etapas: lido.etapas.map((et) => {
      const p = periodoDe(et.previsto);
      return {
        nome: et.nome,
        observacao: et.observacao,
        de: p?.de ?? null,
        ate: p?.ate ?? null,
        previsto: somar(et.previsto),
        realizado: somar(et.realizado),
      };
    }),
    totalArquivo: lido.totalArquivo,
    totalEtapas: lido.totalEtapas,
    diferenca: lido.diferenca,
    totalRealizado: lido.totalRealizado,
    realizadoAte: lido.realizadoAte,
    realizadoImportado: e.realizadoImportado,
    colunasEscolhidas: lido.colunas.flatMap((c) =>
      c.escolhido && c.mes
        ? [{ coluna: c.coluna, texto: c.texto, mes: c.mes }]
        : [],
    ),
    avisos: e.avisos,
  };
}

/**
 * Lê a planilha de orçamento. Se falta decidir a obra ou o mês de alguma
 * coluna, devolve o que precisa ser escolhido (nada é gravado). Senão grava
 * a prévia: a planilha no disco, a importação, a revisão (ainda não
 * vigente), as etapas, o previsto e, se a obra ainda não tem realizado, o
 * realizado da planilha.
 */
export async function lerPlanilhaOrcamento(
  ctx: Contexto,
  campos: Campos,
  arquivo: { nome: string; bytes: Uint8Array } | null,
): Promise<EstadoOrcamento> {
  await exigirImportar(ctx);
  if (!arquivo || arquivo.bytes.byteLength === 0)
    throw new ErroDeNegocio("Escolha a planilha de orçamento (.xlsx).");
  if (arquivo.bytes.byteLength > LIMITE_BYTES)
    throw new ErroDeNegocio(`A planilha passa de ${LIMITE_MB} MB.`);
  const nome = arquivo.nome.slice(0, 200) || "orcamento.xlsx";
  if (!/\.xlsx$/i.test(nome))
    throw new ErroDeNegocio(
      "Envie a planilha em Excel (.xlsx). Se ela estiver em .xls, abra no Excel e salve como .xlsx.",
    );
  const escolha = validarFormulario(
    escolhas,
    {
      obra: campo(campos, "obra") ?? "",
      nome_obra: campo(campos, "nome_obra"),
    },
    { obra: "Obra", nome_obra: "Nome da obra" },
  );
  const bytes = arquivo.bytes;
  if (!ehXlsx(bytes))
    throw new ErroDeNegocio("O arquivo não é uma planilha .xlsx válida.");

  let lido: OrcamentoLido;
  try {
    const r = lerOrcamento(await abasDoXlsx(bytes), {
      arquivo: nome,
      meses: mesesEscolhidos(campos),
    });
    if ("erro" in r) throw new ErroDeNegocio(r.erro);
    lido = r.ok;
  } catch (e) {
    if (e instanceof ErroDeNegocio) throw e;
    log.error({ err: e }, "leitura do orçamento");
    throw new ErroDeNegocio(
      "Não consegui abrir a planilha. Confira se é o arquivo do orçamento, sem senha.",
    );
  }

  const hash = sha256(bytes);
  let repetida:
    | Awaited<ReturnType<typeof imps.importacaoDoArquivo>>[number]
    | undefined;
  try {
    [repetida] = await naSessao(ctx, (tx) =>
      imps.importacaoDoArquivo(tx, "orcamento", hash),
    );
  } catch (e) {
    log.error({ err: e }, "conferência de arquivo repetido");
    throw new ErroDeNegocio(
      "Não foi possível conferir o arquivo. Tente de novo.",
    );
  }
  if (repetida)
    throw new ErroDeNegocio(
      repetida.status === "previa"
        ? `Esta planilha já está numa prévia esperando confirmação (${repetida.referencia}). Confirme ou descarte essa prévia em Operações › Importações.`
        : `Esta planilha já foi importada (${repetida.referencia}). Para uma nova revisão, envie o arquivo novo.`,
    );

  // Obra: a escolhida, uma nova, ou a do título da planilha.
  const obras = await naSessao(ctx, repo.obras);
  const pelaNome = (n: string) =>
    obras.find((o) => normalizar(o.nome) === normalizar(n));
  const { obra: escolhida, nome_obra } = escolha;
  let obra: { id: string; nome: string } | null = null;
  let nomeNova: string | null = null;
  if (escolhida === "nova") {
    nomeNova = nome_obra || lido.obra;
    if (!nomeNova)
      throw new ErroDeNegocio("Nome da obra: informe o nome da obra nova.");
    const ja = pelaNome(nomeNova);
    if (ja)
      throw new ErroDeNegocio(
        `Já existe a obra “${ja.nome}”: escolha-a na lista.`,
      );
  } else if (escolhida) {
    obra = obras.find((o) => o.id === escolhida) ?? null;
    if (!obra) throw new ErroDeNegocio("Obra: escolha uma da lista.");
  } else {
    // Identificar: o nome digitado (quando a planilha não diz) ou o do título.
    const nomeLido = nome_obra || lido.obra;
    if (nomeLido) {
      obra = pelaNome(nomeLido) ?? null;
      if (!obra) nomeNova = nomeLido;
    }
  }

  if (lido.pendentes.length || (!obra && !nomeNova))
    return {
      escolher: {
        arquivo: nome,
        obraLida: lido.obra,
        precisaObra: !obra && !nomeNova,
        revisao: lido.revisao,
        etapas: lido.etapas.length,
        colunas: lido.pendentes,
      },
    };

  // Revisão: uma prévia por obra de cada vez; o código nunca se repete.
  let revisaoVigente: string | null = null;
  let codigos: string[] = [];
  let temRealizado = false;
  let realizadoAteMes = 0;
  if (obra) {
    const obraId = obra.id;
    const { revs, real } = await naSessao(ctx, async (tx) => ({
      revs: await repo.revisoesComStatus(tx, obraId),
      real: await repo.realizadoComStatus(tx, obraId),
    }));
    const pendente = revs.find((r) => r.importacao_status === "previa");
    if (pendente)
      throw new ErroDeNegocio(
        `Já há uma prévia da revisão ${pendente.codigo} desta obra esperando confirmação. Confirme ou descarte essa prévia antes de enviar outra.`,
      );
    codigos = revs.map((r) => r.codigo);
    revisaoVigente = revs.find((r) => r.vigente)?.codigo ?? null;
    const validos = real.filter(
      (r) => !r.importacao_id || r.importacao_status === "confirmada",
    );
    temRealizado = validos.length > 0;
    if (lido.realizadoAte)
      realizadoAteMes = validos
        .filter((r) => r.mes <= (lido.realizadoAte ?? ""))
        .reduce((s, r) => s + centavosDe(Number(r.valor)), 0);
  }
  const rev = proximaRevisao(codigos, lido.revisao);
  if (!rev)
    throw new ErroDeNegocio(
      "Esta obra já tem 100 revisões (R00 a R99): fale com o suporte.",
    );

  const avisos: AvisoOrcamento[] = [...lido.avisos];
  if (rev.aviso) avisos.unshift({ nivel: "aviso", mensagem: rev.aviso });
  const importarRealizado = lido.totalRealizado !== 0 && !temRealizado;
  if (lido.totalRealizado !== 0 && temRealizado) {
    const ate = lido.realizadoAte ? rotuloMesLongo(lido.realizadoAte) : "";
    const dif = lido.totalRealizado - realizadoAteMes;
    avisos.push({
      nivel: dif === 0 ? "info" : "aviso",
      mensagem: `O realizado da planilha (${moeda(lido.totalRealizado)} até ${ate}) não foi importado: a obra já tem realizado lançado (${moeda(realizadoAteMes)} até ${ate}${dif === 0 ? ", igual" : `, diferença de ${moeda(dif)}`}).`,
    });
  }

  // Gravação. Ids gerados aqui: o insert não precisa ler de volta (quem
  // importa pode não ter operacoes.obras.ver, que é o que o RLS pede para ler).
  let obraNova = false;
  if (!obra && nomeNova) {
    const nova = { id: randomUUID(), nome: nomeNova };
    try {
      await naSessao(ctx, (tx) => repo.inserirObra(tx, nova));
    } catch (e) {
      if (e instanceof ErroDeConflito)
        throw new ErroDeConflito(
          `Já existe a obra “${nomeNova}”: escolha-a na lista.`,
        );
      throw e;
    }
    obra = nova;
    obraNova = true;
  }
  if (!obra) throw new ErroDeNegocio("Obra: escolha uma da lista.");
  const daObra = obra;

  const id = randomUUID();
  const caminho = `importacoes/orcamento/${id}/${nomeSeguro(nome)}`;
  try {
    await gravarArquivo(BUCKET, caminho, bytes, TIPO_XLSX);
  } catch (e) {
    log.error({ err: e }, "planilha do orçamento no disco");
    if (obraNova) await apagarObraVazia(daObra.id);
    throw new ErroDeNegocio(
      "Não foi possível guardar a planilha. Tente de novo.",
    );
  }

  const resumo = {
    obra_id: daObra.id,
    obra: daObra.nome,
    obra_nova: obraNova,
    revisao: rev.codigo,
    data: lido.data,
    aba: lido.aba,
    etapas: lido.etapas.length,
    total_arquivo: lido.totalArquivo === null ? null : reais(lido.totalArquivo),
    total_etapas: reais(lido.totalEtapas),
    diferenca: lido.diferenca === null ? null : reais(lido.diferenca),
    realizado_planilha: reais(lido.totalRealizado),
    realizado_ate: lido.realizadoAte,
    realizado_importado: importarRealizado,
    meses: lido.periodo,
    colunas_escolhidas: lido.colunas
      .filter((c) => c.escolhido)
      .map((c) => ({ coluna: c.coluna, texto: c.texto, mes: c.mes })),
  };

  // Tudo numa transação: se algo falha no meio, nada fica (o que no antigo
  // era o desfazer da prévia).
  let etapa = "importação";
  try {
    await naSessao(ctx, async (tx) => {
      await tx
        .insertInto("operacoes.importacoes")
        .values({
          id,
          tipo: "orcamento",
          referencia: `${daObra.nome} ${rev.codigo}`.slice(0, 200),
          arquivos: JSON.stringify([
            { nome, caminho, sha256: hash, bytes: bytes.byteLength },
          ]),
          resumo: JSON.stringify(resumo),
          avisos: JSON.stringify(avisos),
          // A diferença de centavos entre a soma e o total só avisa (spec
          // 4.11): não exige motivo para confirmar.
          bate: lido.diferenca === null || lido.diferenca === 0 ? true : null,
          criado_por: ctx.usuario.id,
        })
        .execute();
      etapa = "revisão";
      const revisaoId = randomUUID();
      await repo.inserirRevisao(tx, {
        id: revisaoId,
        obra_id: daObra.id,
        importacao_id: id,
        codigo: rev.codigo,
        data: lido.data,
        titulo: lido.titulo,
        total: reais(lido.totalEtapas),
        total_arquivo:
          lido.totalArquivo === null ? null : reais(lido.totalArquivo),
      });
      etapa = "etapas";
      const idDaOrdem = new Map(
        lido.etapas.map((e) => [e.ordem, randomUUID()]),
      );
      if (lido.etapas.length)
        await repo.inserirEtapas(
          tx,
          lido.etapas.map((e) => ({
            id: idDaOrdem.get(e.ordem),
            revisao_id: revisaoId,
            ordem: e.ordem,
            nome: e.nome,
            observacao: e.observacao,
          })),
        );
      etapa = "previsto";
      const previsto = lido.etapas.flatMap((e) =>
        e.previsto.map((v) => ({
          etapa_id: idDaOrdem.get(e.ordem) ?? "",
          mes: v.mes,
          valor: reais(v.centavos),
        })),
      );
      if (previsto.length) await repo.inserirPrevisto(tx, previsto);
      etapa = "realizado";
      const realizado = importarRealizado
        ? lido.etapas.flatMap((e) =>
            e.realizado.map((v) => ({
              obra_id: daObra.id,
              etapa: e.nome,
              mes: v.mes,
              valor: reais(v.centavos),
              descricao: `Realizado até ${rotuloMesLongo(v.mes)} (planilha ${rev.codigo})`,
              origem: "planilha",
              importacao_id: id,
              lancado_por: ctx.usuario.id,
            })),
          )
        : [];
      if (realizado.length) await repo.inserirRealizado(tx, realizado);
    });
  } catch (e) {
    log.error({ err: e, etapa }, "prévia do orçamento");
    await removerArquivos(BUCKET, [caminho]);
    if (obraNova) await apagarObraVazia(daObra.id);
    throw new ErroDeNegocio(
      etapa === "revisão" && e instanceof ErroDeConflito
        ? "Outra pessoa importou uma revisão desta obra agora. Envie a planilha de novo."
        : `Não foi possível gravar a prévia (${etapa}). Nada foi alterado; tente de novo.`,
    );
  }

  return {
    previa: previaDe(lido, {
      importacaoId: id,
      obra: daObra,
      obraNova,
      codigo: rev.codigo,
      revisaoVigente,
      arquivo: nome,
      realizadoImportado: importarRealizado,
      avisos,
    }),
  };
}

/** Apaga a obra se ela não tem revisão nem realizado (obra criada por uma prévia). */
async function apagarObraVazia(obraId: string): Promise<void> {
  // Service role: o RLS não deixa apagar obra. A permissão de importar já
  // foi conferida no banco por quem chamou.
  try {
    await banco.comoServico(async (tx) => {
      if (!(await repo.temDados(tx, obraId))) await repo.apagarObra(tx, obraId);
    });
  } catch (e) {
    log.error({ err: e }, "apagar obra vazia");
  }
}

// ---------------------------------------------------------------------------
// Orçamento: confirmar ou descartar a prévia
// ---------------------------------------------------------------------------

const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v))
    : {};

/** "Obra X, revisão R02" para o histórico do sistema. */
function revisaoDaObra(resumo: unknown): string | undefined {
  const { obra, revisao } = objeto(resumo);
  return (
    [
      typeof obra === "string" && obra ? obra : null,
      typeof revisao === "string" && revisao ? `revisão ${revisao}` : null,
    ]
      .filter(Boolean)
      .join(", ") || undefined
  );
}

async function previaDoOrcamento(
  ctx: Contexto,
  id: string,
  encontrada: string,
) {
  const imp = await naSessao(ctx, (tx) =>
    repo.importacaoDoOrcamento(tx, id),
  ).catch(() => undefined);
  if (!imp || imp.tipo !== "orcamento") throw new ErroDeNegocio(encontrada);
  if (imp.status !== "previa")
    throw new ErroDeNegocio("Esta prévia já foi confirmada ou descartada.");
  return imp;
}

export async function confirmarOrcamento(
  ctx: Contexto,
  id: string,
): Promise<EstadoOrcamento> {
  await exigirImportar(ctx);
  const imp = await previaDoOrcamento(
    ctx,
    id,
    "Prévia não encontrada. Envie a planilha de novo.",
  );
  await naSessao(ctx, (tx) => imps.confirmar(tx, imp.id));
  const { obra_id, obra, revisao } = objeto(imp.resumo);
  logImportacaoOp(
    ctx,
    "confirmou",
    { id: imp.id, tipo: "orcamento" },
    revisaoDaObra(imp.resumo),
  );
  return {
    confirmado: {
      obraId: typeof obra_id === "string" ? obra_id : "",
      obraNome: typeof obra === "string" ? obra : "",
      codigo: typeof revisao === "string" ? revisao : "",
    },
  };
}

export async function descartarOrcamento(
  ctx: Contexto,
  id: string,
): Promise<EstadoOrcamento> {
  await exigirImportar(ctx);
  const imp = await previaDoOrcamento(ctx, id, "Prévia não encontrada.");
  await naSessao(ctx, (tx) => imps.desfazer(tx, imp.id));
  const caminhos = Array.isArray(imp.arquivos)
    ? imp.arquivos.flatMap((a: unknown) => {
        const c = objeto(a).caminho;
        return typeof c === "string" ? [c] : [];
      })
    : [];
  await removerArquivos(BUCKET, caminhos);
  const resumo = objeto(imp.resumo);
  if (resumo.obra_nova === true && typeof resumo.obra_id === "string")
    await apagarObraVazia(resumo.obra_id);
  logImportacaoOp(
    ctx,
    "descartou",
    { id: imp.id, tipo: "orcamento" },
    revisaoDaObra(imp.resumo),
  );
  return { descartado: true };
}

// ---------------------------------------------------------------------------
// Realizado lançado na tela
// ---------------------------------------------------------------------------

const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : String(v).trim()),
    z.string().max(max, `máximo de ${max} caracteres`).nullable(),
  );

const realizado = z.object({
  id: z.preprocess((v) => (v ? v : undefined), z.uuid().optional()),
  obra_id: z.uuid("obra inválida"),
  etapa: z.string().trim().min(1, "escolha a etapa").max(200),
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "escolha o mês"),
  valor: z.string().trim().min(1, "informe o valor"),
  descricao: textoOpcional(500),
  remover_anexo: z.preprocess((v) => v === "on", z.boolean()),
});

const ROTULOS_REALIZADO = {
  obra_id: "Obra",
  etapa: "Etapa",
  mes: "Mês",
  valor: "Valor",
  descricao: "Descrição",
};

/** Lança ou altera um realizado (só os lançados pela tela se alteram). */
export async function salvarRealizado(
  ctx: Contexto,
  campos: Campos,
  arquivo: { nome: string; bytes: Uint8Array } | null,
): Promise<string> {
  await exigirImportar(ctx);
  const v = validarFormulario(
    realizado,
    {
      id: campo(campos, "id"),
      obra_id: campo(campos, "obra_id"),
      etapa: campo(campos, "etapa") ?? "",
      mes: campo(campos, "mes") ?? "",
      valor: campo(campos, "valor") ?? "",
      descricao: campo(campos, "descricao"),
      remover_anexo: campo(campos, "remover_anexo"),
    },
    ROTULOS_REALIZADO,
  );
  const reaisLidos = lerValorBr(v.valor);
  if (reaisLidos === null || !Number.isFinite(reaisLidos))
    throw new ErroDeNegocio("Valor: escreva em reais, ex.: 12.345,67.");
  const centavos = centavosDe(reaisLidos);
  if (centavos === 0) throw new ErroDeNegocio("Valor: não pode ser zero.");
  if (Math.abs(centavos) >= 1e15)
    throw new ErroDeNegocio("Valor: alto demais. Confira o número.");
  const mes: Mes = `${v.mes}-01`;
  if (mes > mesAtual())
    throw new ErroDeNegocio(
      "Mês: o realizado é o que já foi pago. Escolha até o mês atual.",
    );
  if (mes < "2000-01-01") throw new ErroDeNegocio("Mês: confira o ano.");

  // A etapa tem de existir numa revisão da obra (o realizado casa pelo nome).
  const { etapas, anterior } = await naSessao(ctx, async (tx) => ({
    etapas: await repo.nomesDasEtapas(tx, v.obra_id),
    anterior: v.id ? await repo.lancamento(tx, v.id) : undefined,
  }));
  const etapa = etapas.find((e) => normalizar(e.nome) === normalizar(v.etapa));
  if (!etapa) throw new ErroDeNegocio("Etapa: escolha uma da lista.");
  if (v.id) {
    if (!anterior || anterior.obra_id !== v.obra_id)
      throw new ErroDeNegocio("Lançamento não encontrado.");
    if (anterior.origem !== "tela")
      throw new ErroDeNegocio(
        "Este valor veio da planilha: para mudar, importe uma nova revisão ou desfaça a importação.",
      );
  }

  // Anexo (nota ou medição): PDF ou imagem, conferido pelo conteúdo.
  let anexo: string | null | undefined;
  if (arquivo && arquivo.bytes.byteLength > 0) {
    if (arquivo.bytes.byteLength > LIMITE_BYTES)
      throw new ErroDeNegocio(`Anexo: passa de ${LIMITE_MB} MB.`);
    const tipo = tipoDoAnexo(arquivo.bytes);
    if (!tipo) throw new ErroDeNegocio("Anexo: envie PDF, JPG, PNG ou WebP.");
    anexo = `obras/${v.obra_id}/realizado/${randomUUID()}-${nomeSeguro(arquivo.nome)}`;
    try {
      await gravarArquivo(BUCKET, anexo, arquivo.bytes, tipo);
    } catch (e) {
      log.error({ err: e }, "anexo do realizado");
      throw new ErroDeNegocio(
        "Não foi possível guardar o anexo. Tente de novo.",
      );
    }
  } else if (v.remover_anexo) anexo = null;

  const linha = {
    etapa: etapa.nome,
    mes,
    valor: reais(centavos),
    descricao: v.descricao,
    ...(anexo !== undefined ? { anexo } : {}),
  };
  const id = v.id;
  try {
    await naSessao(ctx, async (tx) => {
      if (id) await repo.alterarRealizado(tx, id, linha);
      else
        await repo.inserirRealizado(tx, [
          {
            ...linha,
            obra_id: v.obra_id,
            origem: "tela",
            lancado_por: ctx.usuario.id,
          },
        ]);
    });
  } catch (e) {
    if (anexo) await removerArquivos(BUCKET, [anexo]);
    throw e;
  }
  if (anexo !== undefined && anterior?.anexo)
    await removerArquivos(BUCKET, [anterior.anexo]);
  return id ? "Lançamento alterado." : "Realizado lançado.";
}

export async function excluirRealizado(
  ctx: Contexto,
  id: string,
): Promise<string> {
  await exigirImportar(ctx);
  const linhas = await naSessao(ctx, (tx) => repo.excluirRealizado(tx, id));
  if (!linhas.length)
    throw new ErroDeNegocio(
      "Lançamento não encontrado (o que veio da planilha só sai desfazendo a importação).",
    );
  const anexos = linhas.flatMap((r) => (r.anexo ? [r.anexo] : []));
  if (anexos.length) await removerArquivos(BUCKET, anexos);
  return "Lançamento excluído.";
}

// ---------------------------------------------------------------------------
// Dados da obra e vínculo com o Diário de Obra
// ---------------------------------------------------------------------------

const dadosObra = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "informe o nome")
    .max(120, "máximo de 120 caracteres"),
  responsavel: textoOpcional(120),
  diario_obra_id: textoOpcional(64),
  ativa: z.preprocess((v) => v === "on", z.boolean()),
});

export async function salvarObra(
  ctx: Contexto,
  id: string,
  campos: Record<string, unknown>,
): Promise<string> {
  await exigirImportar(ctx);
  const v = validarFormulario(dadosObra, campos, {
    nome: "Nome",
    responsavel: "Responsável",
    diario_obra_id: "Obra no Diário de Obra",
  });
  const atual = await naSessao(ctx, (tx) => repo.vinculoDaObra(tx, id));
  if (!atual) throw new ErroDeNegocio("Obra não encontrada.");
  // O vínculo que já existe fica, mesmo se a obra saiu do Diário.
  if (v.diario_obra_id && v.diario_obra_id !== atual.diario_obra_id) {
    // A permissão de importar já foi conferida no banco.
    const diarioId = v.diario_obra_id;
    if (!(await banco.comoServico((tx) => repo.existeNoDiario(tx, diarioId))))
      throw new ErroDeNegocio("Obra no Diário de Obra: escolha uma da lista.");
  }
  const r = await naSessao(ctx, (tx) =>
    tentar(tx, () =>
      repo.alterarObra(tx, id, {
        nome: v.nome,
        responsavel: v.responsavel,
        diario_obra_id: v.diario_obra_id,
        ativa: v.ativa,
      }),
    ),
  );
  if (!r.ok) {
    if (r.codigo === "23505")
      throw new ErroDeConflito(
        r.erro instanceof pg.DatabaseError &&
          `${r.erro.constraint ?? ""} ${r.erro.message}`.includes(
            "obras_diario_obra",
          )
          ? "Essa obra do Diário de Obra já está ligada a outra obra."
          : "Já existe outra obra com esse nome.",
      );
    throw erroDoBanco(r.erro) ?? r.erro;
  }
  if (!r.valor.length) throw new ErroDeNegocio("Obra não encontrada.");
  return "Obra salva.";
}
