import { dadosDe } from "@arp/shared/comercial/formato";
import { codigoHidrometro } from "@arp/shared/operacoes/agua";
import {
  alertasDaLeitura,
  type ConsumoDoMes,
  type ContratoEnet,
  indiceDoEnet,
  locatariosDaSala,
  mesesAntes,
  sumidos,
  vinculoDoMes,
} from "@arp/shared/operacoes/agua-alertas";
import {
  filtroDoExtrato,
  mesesEntre,
  noExtrato,
} from "@arp/shared/operacoes/agua-extrato";
import { rotuloMes, TIPOS_AGUA } from "@arp/shared/operacoes/agua-formato";
import type {
  EntradaVinculo,
  Leitura,
  LeituraComAlertas,
  MesImportado,
  RespostaExtratoDaAgua,
  RespostaHidrometroDaAgua,
  RespostaMesDaAgua,
} from "@arp/shared/operacoes/contratos/agua";
import { type Contexto, pode } from "@/contexto";
import {
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
  ErroDeValidacao,
  ErroNaoEncontrado,
} from "@/erros";
import { lerArquivo, linksDeLeitura } from "@/infra/arquivos";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import * as repo from "./agua.repository";
import { gerarExtratoAgua } from "./agua-extrato-pdf";
import {
  BUCKET,
  type LinhaDeParametros,
  nomesDeUsuarios,
  parametrosDoModulo,
  podeAgora,
} from "./apoio";

// Leituras da água (spec 4.4): o mês importado com os alertas, os
// hidrômetros, o extrato e a galeria. Tudo com a sessão (RLS): sem
// operacoes.agua.valores o valor vem null (agua_valores escondida). O
// locatário vigente vem do ENET (os.lojas), lido pela service role depois de
// conferir a permissão de ver a água.

const PODE_VER_NOMES = [
  "operacoes.agua.ver",
  "operacoes.agua.importar",
] as const;

type Vinculo = Awaited<ReturnType<typeof repo.vinculos>>[number];

const numero = (v: number | null) => (v === null ? null : Number(v));

function paraLeitura(l: repo.LinhaDeLeitura, correcoes: Vinculo[]): Leitura {
  const v = vinculoDoMes(correcoes, l.hidrometro, l.referencia);
  const mudou = v !== null && (v.bloco !== l.bloco || v.sala !== l.sala);
  const tipo = TIPOS_AGUA.find((t) => t === l.tipo) ?? "FATURADO";
  return {
    id: l.id,
    importacaoId: l.importacao_id,
    referencia: l.referencia,
    bloco: v?.bloco ?? l.bloco,
    sala: v?.sala ?? l.sala,
    noArquivo: mudou ? { bloco: l.bloco, sala: l.sala } : null,
    cliente: l.cliente,
    hidrometro: l.hidrometro,
    dataAnterior: l.data_anterior,
    leituraAnterior: numero(l.leitura_anterior),
    dataAtual: l.data_atual,
    leituraAtual: numero(l.leitura_atual),
    dias: l.dias,
    consumo: Number(l.consumo),
    volume: Number(l.volume_faturado),
    valor: l.valor === null ? null : Number(l.valor),
    tipo,
    foto: l.foto,
    exemplo: l.exemplo,
  };
}

/** Leituras vigentes (com a correção de vínculo aplicada), pela sessão. */
export function lerLeituras(
  ctx: Contexto,
  f: repo.FiltroDeLeituras,
): Promise<Leitura[]> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const correcoes = await repo.vinculos(tx);
    return (await repo.leituras(tx, f)).map((l) => paraLeitura(l, correcoes));
  });
}

/** Meses com importação confirmada, com o nome de quem confirmou. */
export async function mesesImportados(ctx: Contexto): Promise<MesImportado[]> {
  const meses = await banco.comoUsuario(ctx.usuario.id, repo.mesesImportados);
  const nomes = await nomesDeUsuarios(
    ctx,
    meses.map((m) => m.confirmado_por),
    [...PODE_VER_NOMES],
  );
  return meses.map((m) => ({
    ...m,
    confirmadoPorNome: m.confirmado_por
      ? (nomes.get(m.confirmado_por) ?? null)
      : null,
  }));
}

// ---------------------------------------------------------------------------
// ENET: locatário vigente de cada sala
// ---------------------------------------------------------------------------

/**
 * Locatários vigentes por "bloco|sala"; null sem contratos ou quando não deu
 * para ler (a tela segue sem a comparação). os.lojas só abre pelo RLS para
 * quem usa os Tickets: service role depois de conferir a permissão.
 */
export async function indiceEnet(ctx: Contexto) {
  if (!(await podeAgora(ctx, "operacoes.agua.ver"))) return null;
  try {
    const c: ContratoEnet[] = await banco.comoServico(repo.contratosEnet);
    return c.length ? indiceDoEnet(c) : null;
  } catch (err) {
    log.error({ err }, "contratos do ENET para a água");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mês com alertas
// ---------------------------------------------------------------------------

const parametrosDoAlerta = (p: LinhaDeParametros) => ({
  limiteM3: Number(p.agua_limite_m3),
  variacaoPct: Number(p.agua_variacao_pct),
  variacaoMeses: p.agua_variacao_meses,
  variacaoMinM3: Number(p.agua_variacao_min_m3),
});

function historicoPorHidrometro(anteriores: Leitura[]) {
  const mapa = new Map<string, ConsumoDoMes[]>();
  for (const l of anteriores) {
    const lista = mapa.get(l.hidrometro) ?? [];
    lista.push({ referencia: l.referencia, consumo: l.consumo });
    mapa.set(l.hidrometro, lista);
  }
  return mapa;
}

/** O mês com os alertas de cada leitura e os hidrômetros que sumiram. */
export async function lerMesDaAgua(
  ctx: Contexto,
  referencia: string,
  p: LinhaDeParametros,
): Promise<Omit<RespostaMesDaAgua, "links">> {
  const meses = Math.max(p.agua_variacao_meses, 1);
  const [atuais, anteriores] = await banco.comoUsuario(
    ctx.usuario.id,
    async (tx) => {
      const correcoes = await repo.vinculos(tx);
      const ler = async (f: repo.FiltroDeLeituras) =>
        (await repo.leituras(tx, f)).map((l) => paraLeitura(l, correcoes));
      return [
        await ler({ referencia }),
        await ler({
          de: mesesAntes(referencia, meses),
          ate: mesesAntes(referencia, 1),
        }),
      ] as const;
    },
  );
  const indice = await indiceEnet(ctx);
  const historico = historicoPorHidrometro(anteriores);
  const parametrosAlerta = parametrosDoAlerta(p);
  const leituras = atuais.map((l): LeituraComAlertas => {
    const locatarios = indice
      ? locatariosDaSala(indice, l.bloco, l.sala)
      : null;
    return {
      ...l,
      locatarios,
      alertas: alertasDaLeitura(
        {
          hidrometro: l.hidrometro,
          referencia: l.referencia,
          cliente: l.cliente,
          leituraAnterior: l.leituraAnterior,
          leituraAtual: l.leituraAtual,
          consumo: l.consumo,
          temFoto: l.foto !== null,
        },
        {
          parametros: parametrosAlerta,
          historico: historico.get(l.hidrometro) ?? [],
          enet: locatarios ? { locatarios } : null,
        },
      ),
    };
  });
  const mesAnterior = mesesAntes(referencia, 1);
  return {
    referencia,
    leituras,
    sumidos: sumidos(
      anteriores.filter((l) => l.referencia === mesAnterior),
      atuais.map((l) => l.hidrometro),
    ).map(({ hidrometro, bloco, sala, cliente }) => ({
      hidrometro,
      bloco,
      sala,
      cliente,
    })),
    enet: indice !== null,
  };
}

const UMA_HORA = 3600;

/**
 * Links das fotos (só as gravadas de verdade; exemplo não tem arquivo).
 * Confere a permissão no banco antes: o disco não tem RLS.
 */
export async function linksDasFotos(
  ctx: Contexto,
  leituras: Pick<Leitura, "foto" | "exemplo">[],
): Promise<Record<string, string>> {
  const caminhos = leituras.flatMap((l) =>
    l.foto && !l.exemplo ? [l.foto] : [],
  );
  if (!caminhos.length || !(await podeAgora(ctx, "operacoes.agua.ver")))
    return {};
  return Object.fromEntries(await linksDeLeitura(BUCKET, caminhos, UMA_HORA));
}

const REFERENCIA = /^\d{4}-(0[1-9]|1[0-2])-01$/;

export async function mesDaAgua(
  ctx: Contexto,
  referencia: string,
): Promise<RespostaMesDaAgua> {
  if (!REFERENCIA.test(referencia)) throw new ErroNaoEncontrado();
  const p = await parametrosDoModulo(ctx);
  const mes = await lerMesDaAgua(ctx, referencia, p);
  return { ...mes, links: await linksDasFotos(ctx, mes.leituras) };
}

// ---------------------------------------------------------------------------
// Extrato
// ---------------------------------------------------------------------------

type Busca = Record<string, string | string[] | undefined>;

async function lerExtrato(ctx: Contexto, busca: Busca) {
  const meses = await banco.comoUsuario(ctx.usuario.id, repo.mesesImportados);
  const f = filtroDoExtrato(
    busca,
    meses.map((m) => m.referencia),
  );
  if (!f) return null;
  const [leituras, indice] = [
    await lerLeituras(ctx, { de: f.de, ate: f.ate }),
    await indiceEnet(ctx),
  ];
  const lista = leituras.filter((l) => noExtrato(l, f));
  const salas = [...new Set(lista.map((l) => `${l.bloco}|${l.sala}`))];
  const locatarios = indice
    ? [
        ...new Set(
          salas.flatMap((s) => {
            const [bloco = "", sala = ""] = s.split("|");
            return locatariosDaSala(indice, bloco, sala);
          }),
        ),
      ]
    : null;
  return { filtro: f, leituras: lista, locatarios };
}

/**
 * Leituras do extrato (sala, cliente ou hidrômetro, no período), da mais
 * antiga para a mais nova, com o locatário vigente de cada sala no ENET.
 */
export async function extrato(
  ctx: Contexto,
  busca: Busca,
): Promise<RespostaExtratoDaAgua> {
  const r = await lerExtrato(ctx, busca);
  if (!r || (!r.filtro.texto && !r.filtro.bloco))
    return { leituras: [], locatarios: null, links: {} };
  return {
    leituras: r.leituras,
    locatarios: r.locatarios,
    links: await linksDasFotos(ctx, r.leituras),
  };
}

// ---------------------------------------------------------------------------
// Hidrômetro
// ---------------------------------------------------------------------------

const CODIGO = /^[A-Z0-9-]{1,40}$/;

export async function hidrometro(
  ctx: Contexto,
  bruto: string,
): Promise<RespostaHidrometroDaAgua> {
  const codigo = codigoHidrometro(bruto);
  if (!CODIGO.test(codigo)) throw new ErroNaoEncontrado();
  const [leituras, todas] = await banco.comoUsuario(
    ctx.usuario.id,
    async (tx) => {
      const correcoes = await repo.vinculos(tx);
      const linhas = await repo.leituras(tx, { hidrometro: codigo });
      return [linhas.map((l) => paraLeitura(l, correcoes)), correcoes] as const;
    },
  );
  const ultima = leituras.at(-1);
  if (!ultima) throw new ErroNaoEncontrado();
  const correcoes = todas.filter((v) => v.hidrometro === codigo);
  const indice = await indiceEnet(ctx);
  const nomes = await nomesDeUsuarios(
    ctx,
    correcoes.map((c) => c.criado_por),
    [...PODE_VER_NOMES],
  );
  return {
    leituras,
    correcoes: correcoes.map((c) => ({
      ...c,
      criadoPorNome: (c.criado_por && nomes.get(c.criado_por)) || "—",
    })),
    locatarios: indice
      ? locatariosDaSala(indice, ultima.bloco, ultima.sala)
      : null,
    links: await linksDasFotos(ctx, leituras),
  };
}

// ---------------------------------------------------------------------------
// Extrato em PDF (papel timbrado)
// ---------------------------------------------------------------------------

const MAX_FOTOS = 12;

/**
 * "Imprimir extrato em PDF A4, no papel timbrado" (spec 4.4, Tela 3), com os
 * filtros da tela (?h= hidrômetro, ou ?bloco=&q= sala/cliente, e ?de=&ate=).
 * Lê as leituras com a sessão (RLS: sem a permissão, sem os reais) e as
 * fotos do disco depois de conferir a permissão no banco.
 */
export async function extratoEmPdf(
  ctx: Contexto,
  busca: Busca,
): Promise<{ pdf: Uint8Array; nome: string }> {
  const [ver, exportar] = [
    await podeAgora(ctx, "operacoes.agua.ver"),
    await podeAgora(ctx, "operacoes.exportar"),
  ];
  if (!ver || !exportar)
    throw new ErroDePermissao(
      "Você não tem permissão para imprimir o extrato da água.",
    );
  const r = await lerExtrato(ctx, busca);
  if (!r) throw new ErroNaoEncontrado("Nenhum mês de água importado.");
  const f = r.filtro;
  if (!f.texto && !f.bloco)
    throw new ErroDeValidacao("Escolha a sala, o cliente ou o hidrômetro.");
  const { leituras, locatarios } = r;
  const comValores = pode(ctx, "operacoes.agua.valores");
  const comFoto = leituras.filter((l) => l.foto).slice(-MAX_FOTOS);
  const fotos = await Promise.all(
    comFoto.map(async (l) => ({
      referencia: l.referencia,
      leitura: l.leituraAtual,
      consumo: l.consumo,
      bytes: l.exemplo || !l.foto ? null : await lerArquivo(BUCKET, l.foto),
    })),
  );
  const unicos = (xs: string[]) => [...new Set(xs.filter(Boolean))].join(", ");
  const h = typeof busca.h === "string" ? busca.h : "";
  const pdf = await gerarExtratoAgua({
    emissao: dadosDe(new Date()).replace("Dados de ", ""),
    locatario:
      locatarios?.join(" · ") ||
      unicos(leituras.slice(-1).map((l) => l.cliente)),
    bloco: unicos(leituras.map((l) => l.bloco)),
    sala: unicos(leituras.map((l) => l.sala)),
    hidrometro: unicos(leituras.map((l) => l.hidrometro)),
    filtros: `Período: ${rotuloMes(f.de)} a ${rotuloMes(f.ate)}${f.texto && !h ? ` · busca: ${f.texto}` : ""}${comValores ? "" : " · valores em reais não incluídos (sem permissão)"}`,
    leituras,
    meses: mesesEntre(f.de, f.ate),
    comValores,
    fotos,
  });
  const nome = (h || f.texto || `bloco-${f.bloco}`)
    .normalize("NFD")
    .replace(/[^\w]+/g, "-")
    .toLowerCase();
  return { pdf, nome: `extrato-agua-${nome}.pdf` };
}

// ---------------------------------------------------------------------------
// Vínculo do hidrômetro (sala e bloco a partir de um mês)
// ---------------------------------------------------------------------------

/** Grava com a sessão: o RLS confere operacoes.agua.vinculo. */
export async function corrigirVinculo(
  ctx: Contexto,
  e: EntradaVinculo,
): Promise<string> {
  try {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.inserirVinculo(tx, {
        hidrometro: e.hidrometro.toUpperCase(),
        desde: `${e.desde}-01`,
        bloco: e.bloco,
        sala: e.sala,
        motivo: e.motivo,
        criado_por: ctx.usuario.id,
      }),
    );
  } catch (erro) {
    if (erro instanceof ErroDePermissao)
      throw new ErroDePermissao(
        "Você não tem permissão para corrigir o vínculo.",
      );
    if (erro instanceof ErroDeConflito)
      throw new ErroDeConflito(
        "Já há uma correção deste hidrômetro a partir desse mês. Remova a outra antes.",
      );
    throw erro;
  }
  return `Vínculo corrigido a partir de ${rotuloMes(`${e.desde}-01`)}.`;
}

export async function removerVinculo(ctx: Contexto, id: string) {
  const r = await banco
    .comoUsuario(ctx.usuario.id, (tx) => repo.removerVinculo(tx, id))
    .catch((err: unknown) => {
      log.error({ err }, "remover correção de vínculo");
      return [];
    });
  if (!r.length)
    throw new ErroDeNegocio(
      "Não foi possível remover (sem permissão ou já removida).",
    );
  return "Correção removida: vale de novo o que veio no arquivo.";
}
