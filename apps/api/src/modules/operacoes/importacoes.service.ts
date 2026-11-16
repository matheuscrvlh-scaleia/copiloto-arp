import { TIPOS_AGUA } from "@arp/shared/operacoes/agua-formato";
import type {
  ArquivoComLink,
  ImportacaoNaLista,
  LeituraImportada,
  RespostaImportacao,
} from "@arp/shared/operacoes/contratos/importacoes";
import {
  contarAvisos,
  ehStatus,
  ehTipo,
  lerArquivos,
  lerAvisos,
  lerFiltroImportacoes,
  linhasDoResumo,
  POR_PAGINA,
  TIPOS,
  TIPOS_IMPORTACAO,
} from "@arp/shared/operacoes/importacoes";
import type { Permissao } from "@arp/shared/permissions";
import { type Contexto, pode } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao, ErroNaoEncontrado } from "@/erros";
import { linkDeLeitura, linksDeLeitura } from "@/infra/arquivos";
import { banco } from "@/infra/banco";
import {
  BUCKET,
  exigirModulo,
  logImportacaoOp,
  nomesDeUsuarios,
} from "./apoio";
import * as repo from "./importacoes.repository";

// Histórico de importações de Operações (spec 4.11), com a sessão: o RLS
// (operacoes.ve_importacao) mostra a cada pessoa só os tipos que ela vê ou
// importa. Os arquivos enviados ficam no bucket "operacoes"; o link só sai
// para a importação que o RLS já deixou ler. E o "Desfazer" do histórico.

/** Quem vê o histórico (mesma regra de operacoes.ve_importacao). */
const VEEM_IMPORTACOES: Permissao[] = [
  ...Object.values(TIPOS_IMPORTACAO).map((t) => t.permissao),
  "operacoes.agua.ver",
  "operacoes.obras.ver",
  "operacoes.limpeza.ver",
];

type Linha = Awaited<
  ReturnType<typeof repo.paginaDeImportacoes>
>["linhas"][number];

async function paraTela(
  ctx: Contexto,
  linhas: Linha[],
): Promise<ImportacaoNaLista[]> {
  const nomes = await nomesDeUsuarios(
    ctx,
    linhas.flatMap((l) => [l.criado_por, l.confirmado_por, l.desfeito_por]),
    VEEM_IMPORTACOES,
  );
  const nome = (id: string | null) => (id ? (nomes.get(id) ?? null) : null);
  return linhas.flatMap((l) =>
    ehTipo(l.tipo) && ehStatus(l.status)
      ? [
          {
            id: l.id,
            tipo: l.tipo,
            status: l.status,
            referencia: l.referencia,
            arquivos: lerArquivos(l.arquivos),
            avisos: contarAvisos(lerAvisos(l.avisos)),
            bate: l.bate,
            incompleta: l.incompleta,
            motivo: l.motivo,
            exemplo: l.exemplo,
            substitui: l.substitui,
            criadoPor: nome(l.criado_por),
            criadoEm: l.criado_em,
            confirmadoPor: nome(l.confirmado_por),
            confirmadoEm: l.confirmado_em,
            desfeitoPor: nome(l.desfeito_por),
            desfeitoEm: l.desfeito_em,
          },
        ]
      : [],
  );
}

type Busca = Record<string, string | string[] | undefined>;

/** Uma página do histórico (os filtros da URL da tela), da mais nova à mais antiga. */
export async function paginaDeImportacoes(ctx: Contexto, busca: Busca) {
  exigirModulo(ctx);
  const f = lerFiltroImportacoes(busca);
  const { linhas, total } = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.paginaDeImportacoes(tx, {
      tipo: f.tipo,
      status: f.status,
      de: f.de ? new Date(`${f.de}T00:00:00-03:00`).toISOString() : null,
      ate: f.ate ? new Date(`${f.ate}T23:59:59.999-03:00`).toISOString() : null,
      limite: POR_PAGINA,
      deslocamento: (f.pagina - 1) * POR_PAGINA,
    }),
  );
  return { linhas: await paraTela(ctx, linhas), total };
}

/** Tipo pelo nome do arquivo (o servidor de arquivos confere o conteúdo). */
function tipoDoArquivo(nome: string): ArquivoComLink["tipo"] {
  if (/\.(jpe?g|png|webp|gif)$/i.test(nome)) return "foto";
  if (/\.pdf$/i.test(nome)) return "pdf";
  if (/\.(xlsx|xls|csv)$/i.test(nome)) return "planilha";
  return "outro";
}

const numero = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const num = (v: number | null) => (v === null ? null : Number(v));
const tipoAgua = (t: string) => TIPOS_AGUA.find((x) => x === t) ?? "FATURADO";

/**
 * Uma importação com avisos, resumo, links dos arquivos e o que ela gravou
 * (leituras, conta, faturas, meses, revisão). Não encontrada: o RLS esconde.
 */
export async function importacao(
  ctx: Contexto,
  id: string,
): Promise<RespostaImportacao> {
  exigirModulo(ctx);
  const comValores = pode(ctx, "operacoes.agua.valores");
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const imp = await repo.importacaoComResumo(tx, id);
    if (!imp) return null;
    return {
      imp,
      valores: comValores ? await repo.valoresDaImportacao(tx, id) : null,
      depois: await repo.substituidaPor(tx, id),
      leituras: await repo.leiturasDaImportacao(tx, id),
      conta: await repo.contaDaImportacao(tx, id),
      faturas: await repo.faturasDaImportacao(tx, id),
      meses: await repo.mesesDaImportacao(tx, id),
      revisao: await repo.revisaoDaImportacao(tx, id),
    };
  });
  if (!lido) throw new ErroNaoEncontrado("Importação não encontrada.");
  const [base] = await paraTela(ctx, [lido.imp]);
  if (!base) throw new ErroNaoEncontrado("Importação não encontrada.");
  const arquivosComLink = await Promise.all(
    base.arquivos.map(async (a): Promise<ArquivoComLink> => {
      const tipo = tipoDoArquivo(a.nome);
      const [url, urlVer] = a.caminho
        ? await Promise.all([
            linkDeLeitura(BUCKET, a.caminho, {
              segundos: 600,
              baixarComo: a.nome,
            }),
            tipo === "foto" || tipo === "pdf"
              ? linkDeLeitura(BUCKET, a.caminho, { segundos: 600 })
              : null,
          ])
        : [null, null];
      return { ...a, tipo, url, urlVer };
    }),
  );
  const v = lido.valores;
  const porBloco =
    v?.por_bloco &&
    typeof v.por_bloco === "object" &&
    !Array.isArray(v.por_bloco)
      ? Object.entries(v.por_bloco).map(([bloco, x]) => {
          const o = x && typeof x === "object" && !Array.isArray(x) ? x : {};
          return {
            bloco,
            arquivo: numero("arquivo" in o ? o.arquivo : null),
            lido: numero("lido" in o ? o.lido : null),
          };
        })
      : [];
  const links = await linksDeLeitura(
    BUCKET,
    lido.leituras.flatMap((l) => (l.foto ? [l.foto] : [])),
    600,
  );
  const leituras: LeituraImportada[] = lido.leituras.map((l) => ({
    id: l.id,
    bloco: l.bloco,
    sala: l.sala,
    cliente: l.cliente,
    hidrometro: l.hidrometro,
    dataAnterior: l.data_anterior,
    leituraAnterior: num(l.leitura_anterior),
    dataAtual: l.data_atual,
    leituraAtual: num(l.leitura_atual),
    dias: l.dias,
    consumo: Number(l.consumo),
    volumeFaturado: Number(l.volume_faturado),
    tipo: tipoAgua(l.tipo),
    valor: comValores && l.valor !== null ? Number(l.valor) : null,
    linhaArquivo: l.linha_arquivo,
    foto: l.foto,
    fotoUrl: l.foto ? (links.get(l.foto) ?? null) : null,
    vigente: l.vigente,
  }));
  const c = lido.conta;
  return {
    importacao: {
      ...base,
      listaDeAvisos: lerAvisos(lido.imp.avisos),
      resumo: linhasDoResumo(lido.imp.resumo),
      arquivosComLink,
      valores: v
        ? {
            arquivo: num(v.valor_arquivo),
            lido: num(v.valor_lido),
            porBloco: porBloco.sort((a, b) => a.bloco.localeCompare(b.bloco)),
          }
        : null,
      substituidaPor: lido.depois,
    },
    leituras,
    conta: c
      ? {
          id: c.id,
          vigente: c.vigente,
          referencia: c.referencia,
          matricula: c.matricula,
          vencimento: c.vencimento,
          dataAnterior: c.data_anterior,
          dataAtual: c.data_atual,
          leituraAnterior: num(c.leitura_anterior),
          leituraAtual: num(c.leitura_atual),
          consumoM3: num(c.consumo_m3),
          valorAgua: num(c.valor_agua),
          valorEsgoto: num(c.valor_esgoto),
          total: Number(c.total),
          observacao: c.observacao,
          atualizadoEm: c.atualizado_em,
        }
      : null,
    faturas: lido.faturas.map((f) => ({
      id: f.id,
      matricula: f.matricula,
      referencia: f.referencia,
      vencimento: f.vencimento,
      consumoKwh: num(f.consumo_kwh),
      total: num(f.total),
      vigente: f.vigente,
    })),
    meses: lido.meses.map((m) => ({
      referencia: m.referencia,
      status: m.status,
      valorBase: num(m.valor_base),
    })),
    revisao: lido.revisao
      ? {
          obraId: lido.revisao.obra_id,
          obra: lido.revisao.obra ?? "Obra",
          codigo: lido.revisao.codigo,
          vigente: lido.revisao.vigente,
          etapas: Number(lido.revisao.etapas ?? 0),
        }
      : null,
  };
}

/** A última importação confirmada e as prévias abertas de cada tipo visível. */
export async function situacaoPorTipo(ctx: Contexto) {
  exigirModulo(ctx);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const situacao: Record<
      string,
      {
        ultima: {
          id: string;
          referencia: string;
          confirmadoEm: string | null;
          incompleta: boolean;
        } | null;
        previas: number;
      }
    > = {};
    for (const tipo of TIPOS) {
      const { ultima, previas } = await repo.situacaoDoTipo(tx, tipo);
      situacao[tipo] = {
        ultima: ultima
          ? {
              id: ultima.id,
              referencia: ultima.referencia,
              confirmadoEm: ultima.confirmado_em,
              incompleta: ultima.incompleta,
            }
          : null,
        previas,
      };
    }
    return situacao;
  });
}

/**
 * Desfazer do histórico, para todos os tipos: operacoes.desfazer_importacao
 * confere a permissão do tipo (pode_importar), apaga o que a importação
 * trouxe e, na água, devolve o mês que ela tinha substituído; numa prévia,
 * só a descarta.
 */
export async function desfazer(ctx: Contexto, id: string): Promise<string> {
  exigirModulo(ctx);
  const { imp, n } = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const imp = await repo.importacao(tx, id);
    if (!imp || !ehTipo(imp.tipo))
      throw new ErroDeNegocio("Importação não encontrada.");
    if (!pode(ctx, TIPOS_IMPORTACAO[imp.tipo].permissao))
      throw new ErroDePermissao(
        "Você não tem permissão para desfazer esta importação.",
      );
    return { imp: { ...imp, tipo: imp.tipo }, n: await repo.desfazer(tx, id) };
  });
  const registros = `${n} ${n === 1 ? "registro removido" : "registros removidos"}`;
  logImportacaoOp(
    ctx,
    imp.status === "previa" ? "descartou" : "desfez",
    { id, tipo: imp.tipo, referencia: imp.referencia },
    imp.status === "previa" ? undefined : registros,
    { registros: n },
  );
  return imp.status === "previa"
    ? "Prévia descartada."
    : `Importação desfeita: ${registros}.${imp.tipo === "agua" ? " Se ela substituía outra, o mês anterior voltou a valer." : ""}`;
}
