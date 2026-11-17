import type {
  EntradaMetas,
  RespostaMetas,
  RespostaPainel,
} from "@arp/shared/comercial/contratos/painel";
import {
  type CarenciaContrato,
  COM_META,
  campoMeta,
  carenciaDoContrato,
  chaveMeta,
  competencia,
  INDICADORES_PAINEL,
  MESES_CURTOS,
  type MetaNova,
  metaValida,
  montarPainel,
  mudancasDeMetas,
} from "@arp/shared/comercial/painel";
import { lerValorBr } from "@arp/shared/formato";
import { paraBrasilia } from "@arp/shared/os/tempo";
import { type Contexto, exigir } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao } from "@/erros";
import { banco } from "@/infra/banco";
import { contextoCom, metasCom, parametros, tiposLuc } from "./base";
import { dadosEnet, dadosRd } from "./fontes";
import * as repo from "./painel.repository";

// Painel de indicadores (spec 4.10): Real do ENET e do RD, Plan das metas
// (core.metas comercial.*), ocupação pelas fotos do fim do mês e o
// faturamento em carência dos contratos feitos no assistente. Sem
// comercial.valores.ver, as linhas em reais nem saem da API.

/**
 * Visitas e notas do Relacionamento. A tabela de contatos pede
 * comercial.relacionamento.ver; o painel só conta, então lê pela service role
 * depois de conferir comercial.painel.ver, e só data, canal e nota.
 */
async function contatosDoPainel(
  ctx: Contexto,
  ano: number,
  canalVisita: string,
) {
  await exigir(ctx, "comercial.painel.ver");
  const linhas = await banco.comoServico((tx) => repo.contatosDoAno(tx, ano));
  return linhas.map((c) => ({
    data: c.data,
    visita: c.canal === canalVisita,
    nps: c.nps,
  }));
}

/**
 * Carências dos contratos feitos no assistente. A tabela de contratos pede
 * comercial.contratos.ver; o painel só precisa da soma, então lê pela
 * service role depois de conferir comercial.painel.ver no banco, e só o
 * aluguel e as condições (nada do locatário).
 */
async function carencias(ctx: Contexto): Promise<CarenciaContrato[]> {
  await exigir(ctx, "comercial.painel.ver");
  const linhas = await banco.comoServico((tx) => repo.carencias(tx));
  return linhas
    .map((c) => carenciaDoContrato(c.aluguel, c.condicoes))
    .filter((c): c is CarenciaContrato => c !== null);
}

function anosComDado(competencias: string[], criacoes: string[], hoje: string) {
  const atual = Number(hoje.slice(0, 4));
  const primeiro = Math.min(
    atual,
    ...[...competencias, ...criacoes].map((d) => Number(d.slice(0, 4))),
  );
  return Array.from({ length: atual + 2 - primeiro }, (_, i) => atual + 1 - i);
}

export async function dadosDoPainel(
  ctx: Contexto,
  anoPedido: number | undefined,
): Promise<RespostaPainel> {
  const { pode, hoje, dadosDe } = contextoCom(ctx);
  const ano = anoPedido ?? Number(hoje.slice(0, 4));
  const comValores = pode("comercial.valores.ver");
  const enet = dadosEnet(hoje);
  const rd = await dadosRd(ctx);
  const tipos = await tiposLuc(ctx);
  const metas = await metasCom(ctx);
  const params = await parametros(ctx);
  const fotos = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.fotosDoAno(tx, ano),
  );
  const comCarencia = comValores ? await carencias(ctx) : [];
  const contatos = await contatosDoPainel(
    ctx,
    ano,
    params.relacionamento_canal_visita,
  );
  const criacoes = (funil: string) =>
    rd.oportunidades
      .filter((o) => o.deal_pipeline.name === funil)
      .map((o) => paraBrasilia(new Date(o.created_at)).data);
  const doAno = (m: string) => m.startsWith(`${ano}-`);
  const tiposCom = (f: (t: (typeof tipos)[number]) => boolean) =>
    new Set(tipos.filter(f).map((t) => t.tipo));
  const todas = montarPainel({
    ano,
    hoje,
    contas: enet.contasReceber.filter((x) => doAno(x.competencia)),
    contratos: enet.contratos,
    lucs: enet.lucs,
    tiposOcupacao: tiposCom((t) => t.conta_ocupacao),
    tiposMidia: tiposCom((t) => t.receita === "midia"),
    tiposEventos: tiposCom((t) => t.receita === "eventos"),
    leads: criacoes(params.funil_padrao),
    leadsMidia: criacoes(params.funil_midia),
    contatos,
    fotos,
    carencias: comCarencia,
    exemplo: enet.exemplo,
    metas: metas.filter((m) => doAno(m.vigente_desde)),
  });
  // Sem a permissão de valores: fica leads, % ocupação, % churn e clientes.
  const linhas = comValores
    ? todas
    : todas.filter((l) => INDICADORES_PAINEL[l.indicador].formato !== "moeda");
  const ocupacao = linhas.find((l) => l.indicador === "ocupacao");
  return {
    hoje,
    dadosDe,
    ano,
    linhas,
    exemplo: enet.exemplo,
    avisoRd: rd.aviso,
    comValores,
    semFoto: !!ocupacao?.marcas.some(
      (m) => m === "calculado" || m === "sem_historico",
    ),
    contratosComCarencia: comCarencia.length,
    anos: anosComDado(
      enet.contasReceber.map((x) => x.competencia),
      rd.oportunidades.map((o) => o.created_at),
      hoje,
    ),
  };
}

/** Metas do Comercial (Configurações › Metas). */
export async function metas(ctx: Contexto): Promise<RespostaMetas> {
  const { hoje, dadosDe } = contextoCom(ctx);
  return { hoje, dadosDe, metas: await metasCom(ctx) };
}

const SEM_PERMISSAO_METAS =
  "Você não tem permissão para alterar as metas do painel.";

/**
 * Metas do Painel comercial (spec 4.10): a grade indicador × mês do ano,
 * gravada em core.metas (comercial.<indicador>, uma linha por mês). Confere
 * comercial.painel.metas no banco e grava com a sessão (o RLS confere de
 * novo e core.auditoria guarda quem, quando, antes e depois).
 */
export async function salvarMetas(
  ctx: Contexto,
  form: EntradaMetas,
): Promise<string> {
  const { ano } = form;
  const novas: MetaNova[] = [];
  for (const i of COM_META)
    for (let m = 1; m <= 12; m++) {
      const bruto = form[campoMeta(i, m)];
      if (typeof bruto !== "string") continue;
      const v = lerValorBr(bruto);
      if (v !== null) {
        const erro = metaValida(i, v);
        if (erro)
          throw new ErroDeNegocio(
            `${INDICADORES_PAINEL[i].nome}, ${MESES_CURTOS[m - 1]}: ${erro}.`,
          );
      }
      novas.push({
        indicador: chaveMeta(i),
        vigente_desde: competencia(ano, m),
        meta: v,
      });
    }

  try {
    await exigir(ctx, "comercial.painel.metas");
  } catch (e) {
    if (e instanceof ErroDePermissao)
      throw new ErroDePermissao(SEM_PERMISSAO_METAS);
    throw e;
  }
  const direcao = new Map(
    COM_META.map((i) => [chaveMeta(i), INDICADORES_PAINEL[i].direcao]),
  );
  const n = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const atuais = await repo.metasDoAno(
      tx,
      competencia(ano, 1),
      competencia(ano, 12),
    );
    const { gravar, apagar } = mudancasDeMetas(atuais, novas);
    await repo.gravarMetas(
      tx,
      gravar.map((g) => ({
        ...g,
        direcao: direcao.get(g.indicador) ?? "maior_melhor",
      })),
    );
    await repo.apagarMetas(tx, apagar);
    return gravar.length + apagar.length;
  });
  if (!n) return "Nada mudou.";
  return `Salvo: ${n} ${n === 1 ? "meta alterada" : "metas alteradas"}.`;
}
