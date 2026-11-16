import { randomUUID } from "node:crypto";
import { tipoDoComprovante } from "@arp/shared/operacoes/agua-conta";
import type { LeituraEditada } from "@arp/shared/operacoes/agua-edicao";
import { rotuloMes } from "@arp/shared/operacoes/agua-formato";
import type { Contexto } from "@/contexto";
import { ErroDeConflito, ErroDeNegocio, ErroDePermissao } from "@/erros";
import { gravarArquivo, removerArquivos } from "@/infra/arquivos";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import { BUCKET, logOperacoes, podeAgora } from "./apoio";

// Corrigir o que a importação da água trouxe, uma leitura por vez: os
// campos, o valor (só quem vê reais), a foto do visor, ou excluir a
// leitura. Com a sessão: o RLS só deixa mexer na leitura que vale e para
// quem importa a água; cada mudança fica na auditoria (gatilho) e no
// histórico do sistema.

const SEM_PERMISSAO = "Você não tem permissão para corrigir a água.";
export const FOTO_MAX = 10 * 1024 * 1024;

async function exigirImportar(ctx: Contexto) {
  if (!(await podeAgora(ctx, "operacoes.agua.importar")))
    throw new ErroDePermissao(SEM_PERMISSAO);
}

const naSessao = <T>(ctx: Contexto, fn: (tx: Tx) => Promise<T>) =>
  banco.comoUsuario(ctx.usuario.id, fn);

async function leituraQueVale(tx: Tx, id: string) {
  const l = await tx
    .selectFrom("operacoes.agua_leituras")
    .select([
      "id",
      "referencia",
      "bloco",
      "sala",
      "hidrometro",
      "importacao_id",
      "vigente",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
  return l?.vigente ? l : null;
}
type LeituraQueVale = NonNullable<Awaited<ReturnType<typeof leituraQueVale>>>;

const descrever = (l: {
  referencia: string;
  hidrometro: string;
  bloco: string;
}) =>
  `hidrômetro ${l.hidrometro} (bloco ${l.bloco}) de ${rotuloMes(l.referencia)}`;

export async function salvarLeitura(
  ctx: Contexto,
  e: LeituraEditada,
): Promise<string> {
  await exigirImportar(ctx);
  const { id, valor, ...lidos } = e;
  const campos = {
    ...lidos,
    consumo: lidos.consumo ?? 0,
    volume_faturado: lidos.volume_faturado ?? 0,
  };
  const atual = await naSessao(ctx, (tx) => leituraQueVale(tx, id)).catch(
    () => null,
  );
  if (!atual)
    throw new ErroDeNegocio(
      "Leitura não encontrada ou não vale mais (o mês foi desfeito ou substituído).",
    );
  let gravadas: { id: string }[];
  try {
    gravadas = await naSessao(ctx, (tx) =>
      tx
        .updateTable("operacoes.agua_leituras")
        .set(campos)
        .where("id", "=", id)
        .returning("id")
        .execute(),
    );
  } catch (erro) {
    if (erro instanceof ErroDeConflito)
      throw new ErroDeConflito(
        "Já há esse hidrômetro na mesma sala e bloco deste mês.",
      );
    log.error({ err: erro }, "corrigir leitura da água");
    throw new ErroDeNegocio("Não foi possível salvar a correção.");
  }
  if (!gravadas.length) throw new ErroDePermissao(SEM_PERMISSAO);

  let aviso = "";
  if (valor !== null) {
    if (await podeAgora(ctx, "operacoes.agua.valores")) {
      const v = await naSessao(ctx, (tx) =>
        tx
          .updateTable("operacoes.agua_valores")
          .set({ valor })
          .where("leitura_id", "=", id)
          .returning("leitura_id")
          .execute(),
      ).catch((err: unknown) => {
        log.error({ err }, "corrigir valor da água");
        return [];
      });
      if (!v.length) aviso = " O valor não foi alterado.";
    } else aviso = " O valor só muda com a permissão de ver reais.";
  }
  logOperacoes(
    ctx,
    "operacoes_importacao_corrigida",
    `Corrigiu a leitura do ${descrever({ ...atual, ...campos })}`,
    { importacao: atual.importacao_id, leitura: id },
  );
  return `Leitura corrigida.${aviso}`;
}

export async function excluirLeitura(ctx: Contexto, id: string) {
  await exigirImportar(ctx);
  const atual = await naSessao(ctx, (tx) => leituraQueVale(tx, id)).catch(
    () => null,
  );
  if (!atual) throw new ErroDeNegocio("Leitura não encontrada ou já excluída.");
  const apagadas = await naSessao(ctx, (tx) =>
    tx
      .deleteFrom("operacoes.agua_leituras")
      .where("id", "=", id)
      .returning("id")
      .execute(),
  ).catch((err: unknown) => {
    log.error({ err }, "excluir leitura da água");
    return [];
  });
  if (!apagadas.length)
    throw new ErroDeNegocio("Não foi possível excluir a leitura.");
  logOperacoes(
    ctx,
    "operacoes_importacao_corrigida",
    `Excluiu a leitura do ${descrever(atual)}`,
    { importacao: atual.importacao_id, leitura: id, excluida: true },
  );
  return "Leitura excluída.";
}

type Foto = { bytes: Uint8Array; tipo: string };

/** Confere a foto enviada (vazia, grande demais, não é imagem). */
async function fotoDoEnvio(
  ctx: Contexto,
  arquivo: Uint8Array | null,
): Promise<Foto> {
  if (!arquivo || arquivo.length === 0)
    throw new ErroDeNegocio("Escolha a foto.");
  if (arquivo.length > FOTO_MAX)
    throw new ErroDeNegocio("A foto passa de 10 MB.");
  await exigirImportar(ctx);
  const tipo = tipoDoComprovante(arquivo);
  if (!tipo?.startsWith("image/"))
    throw new ErroDeNegocio("O arquivo não é foto (.jpg, .png ou .webp).");
  return { bytes: arquivo, tipo };
}

export async function trocarFoto(
  ctx: Contexto,
  id: string,
  arquivo: Uint8Array | null,
) {
  const foto = await fotoDoEnvio(ctx, arquivo);
  const atual = await naSessao(ctx, (tx) => leituraQueVale(tx, id)).catch(
    () => null,
  );
  if (!atual)
    throw new ErroDeNegocio("Leitura não encontrada ou não vale mais.");
  return ligarFoto(ctx, atual, foto, "Trocou");
}

/**
 * Foto do visor escolhendo o hidrômetro do cadastro e o mês (sem depender do
 * nome do arquivo). Liga à leitura que vale daquele hidrômetro no mês.
 */
export async function fotoDoHidrometro(
  ctx: Contexto,
  pedido: { hidrometro: string; mes: string },
  arquivo: Uint8Array | null,
) {
  const foto = await fotoDoEnvio(ctx, arquivo);
  const achado = await naSessao(ctx, async (tx) => {
    const h = await tx
      .selectFrom("operacoes.hidrometros")
      .select(["numero", "bloco", "sala"])
      .where("id", "=", pedido.hidrometro)
      .executeTakeFirst();
    if (!h) return null;
    const leituras = await tx
      .selectFrom("operacoes.agua_leituras")
      .select([
        "id",
        "referencia",
        "bloco",
        "sala",
        "hidrometro",
        "importacao_id",
        "vigente",
      ])
      .where("hidrometro", "=", h.numero)
      .where("referencia", "=", pedido.mes)
      .where("vigente", "=", true)
      .execute();
    return { h, leituras };
  }).catch((err: unknown) => {
    log.error({ err }, "leitura do hidrômetro");
    throw new ErroDeNegocio("Não foi possível achar a leitura. Tente de novo.");
  });
  if (!achado)
    throw new ErroDeNegocio("Hidrômetro não encontrado no cadastro.");
  const { h, leituras } = achado;
  // O mesmo número em duas salas no mês: vale a do cadastro.
  const atual =
    leituras.length === 1
      ? leituras[0]
      : leituras.find((l) => l.bloco === h.bloco && l.sala === h.sala);
  if (!atual)
    throw new ErroDeNegocio(
      leituras.length
        ? `O hidrômetro ${h.numero} aparece em mais de uma sala em ${rotuloMes(pedido.mes)}. Abra a importação do mês e troque a foto na leitura certa.`
        : `Não há leitura do hidrômetro ${h.numero} em ${rotuloMes(pedido.mes)}. Importe antes a planilha do mês.`,
    );
  return ligarFoto(ctx, atual, foto, "Ligou");
}

/**
 * Troca (ou põe) a foto do visor de uma leitura. A foto anterior fica no
 * disco: o mesmo arquivo pode estar ligado à leitura de outra versão do mês.
 */
async function ligarFoto(
  ctx: Contexto,
  atual: LeituraQueVale,
  { bytes, tipo }: Foto,
  verbo: "Trocou" | "Ligou",
): Promise<string> {
  const ext = tipo === "image/jpeg" ? "jpg" : tipo.slice(6);
  const caminho = `agua/fotos/corrigidas/${atual.referencia.slice(0, 7)}/${randomUUID()}.${ext}`;
  try {
    await gravarArquivo(BUCKET, caminho, bytes, tipo);
  } catch (err) {
    log.error({ err }, "gravar foto da leitura");
    throw new ErroDeNegocio("Não foi possível guardar a foto. Tente de novo.");
  }
  const ligadas = await naSessao(ctx, (tx) =>
    tx
      .updateTable("operacoes.agua_leituras")
      .set({ foto: caminho })
      .where("id", "=", atual.id)
      .returning("id")
      .execute(),
  ).catch((err: unknown) => {
    log.error({ err }, "ligar foto da leitura");
    return [];
  });
  if (!ligadas.length) {
    await removerArquivos(BUCKET, [caminho]).catch(() => {});
    throw new ErroDeNegocio("Não foi possível ligar a foto.");
  }
  logOperacoes(
    ctx,
    "operacoes_importacao_corrigida",
    `${verbo} a foto do ${descrever(atual)}`,
    { importacao: atual.importacao_id, leitura: atual.id, foto: caminho },
  );
  return verbo === "Ligou"
    ? `Foto ligada ao ${descrever(atual)}.`
    : "Foto atualizada.";
}

export async function tirarFoto(ctx: Contexto, id: string) {
  await exigirImportar(ctx);
  const atual = await naSessao(ctx, (tx) => leituraQueVale(tx, id)).catch(
    () => null,
  );
  if (!atual)
    throw new ErroDeNegocio("Leitura não encontrada ou não vale mais.");
  const tiradas = await naSessao(ctx, (tx) =>
    tx
      .updateTable("operacoes.agua_leituras")
      .set({ foto: null })
      .where("id", "=", id)
      .returning("id")
      .execute(),
  ).catch((err: unknown) => {
    log.error({ err }, "tirar foto da leitura");
    return [];
  });
  if (!tiradas.length)
    throw new ErroDeNegocio("Não foi possível tirar a foto.");
  logOperacoes(
    ctx,
    "operacoes_importacao_corrigida",
    `Tirou a foto do ${descrever(atual)}`,
    { importacao: atual.importacao_id, leitura: id },
  );
  return "Foto retirada da leitura.";
}
