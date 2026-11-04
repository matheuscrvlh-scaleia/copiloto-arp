import "server-only";
import { cache } from "react";
import {
  type CarenciaContrato,
  carenciaDoContrato,
  INDICADORES_PAINEL,
  type LinhaPainel,
  montarPainel,
} from "@/lib/comercial/painel";
import { paraBrasilia } from "@/lib/os/tempo";
import { podeAgora } from "@/server/auth";
import { lerTudo } from "@/server/supabase-paginas";
import {
  com,
  comAdmin,
  contextoCom,
  metasCom,
  parametros,
  tiposLuc,
} from "./base";
import { dadosEnet, dadosRd } from "./fontes";

// Leitura do Painel de indicadores (spec 4.10): Real do ENET e do RD, Plan
// das metas (core.metas comercial.*), ocupação pelas fotos do fim do mês e o
// faturamento em carência dos contratos feitos no assistente. Sem
// comercial.valores.ver, as linhas em reais nem saem do servidor.

export interface DadosPainel {
  linhas: LinhaPainel[];
  exemplo: boolean;
  /** false: sem comercial.valores.ver, só as linhas que não são em reais. */
  comValores: boolean;
  /** Algum mês sem foto de ocupação (calculado ou sem histórico). */
  semFoto: boolean;
  /** Contratos do sistema com carência (o número é parcial). */
  contratosComCarencia: number;
  /** Anos com dado no ENET ou no RD, e o próximo (para ver as metas). */
  anos: number[];
}

function falhar(erro: { message: string } | null) {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

/** Fotos de ocupação do ano (RLS: comercial.painel.ver). */
async function fotosDoAno(ano: number) {
  const { data, error } = await (await com())
    .from("ocupacao_fotos")
    .select("mes, abl_total, abl_locada, clientes_ativos")
    .gte("mes", `${ano}-01-01`)
    .lte("mes", `${ano}-12-01`);
  falhar(error);
  return data ?? [];
}

/**
 * Carências dos contratos feitos no assistente. A tabela de contratos pede
 * comercial.contratos.ver; o painel só precisa da soma, então lê pela
 * service role depois de conferir comercial.painel.ver no banco, e só o
 * aluguel e as condições (nada do locatário).
 */
async function carencias(): Promise<CarenciaContrato[]> {
  if (!(await podeAgora("comercial.painel.ver")))
    throw new Error("Sem acesso ao Painel comercial.");
  const db = comAdmin();
  const linhas = await lerTudo(() =>
    db
      .from("contratos")
      .select("id, aluguel, condicoes:dados->condicoes")
      .eq("tipo", "contrato")
      .neq("status", "rascunho")
      .order("id"),
  );
  return linhas
    .map((c) => carenciaDoContrato(c.aluguel, c.condicoes))
    .filter((c): c is CarenciaContrato => c !== null);
}

export const dadosDoPainel = cache(
  async (ano: number): Promise<DadosPainel> => {
    const { pode, hoje } = await contextoCom();
    if (!pode("comercial.painel.ver"))
      throw new Error("Sem acesso ao Painel comercial.");
    const comValores = pode("comercial.valores.ver");
    const [enet, rd, tipos, metas, params, fotos, comCarencia] =
      await Promise.all([
        dadosEnet(),
        dadosRd(),
        tiposLuc(),
        metasCom(),
        parametros(),
        fotosDoAno(ano),
        comValores ? carencias() : [],
      ]);
    const doAno = (m: string) => m.startsWith(`${ano}-`);
    const tiposCom = (f: (t: (typeof tipos)[number]) => boolean) =>
      new Set(tipos.filter(f).map((t) => t.tipo));
    const todas = montarPainel({
      ano,
      hoje,
      contas: enet.contasReceber.filter((c) => doAno(c.competencia)),
      contratos: enet.contratos,
      lucs: enet.lucs,
      tiposOcupacao: tiposCom((t) => t.conta_ocupacao),
      tiposMidia: tiposCom((t) => t.receita === "midia"),
      tiposEventos: tiposCom((t) => t.receita === "eventos"),
      leads: rd.oportunidades
        .filter((o) => o.deal_pipeline.name === params.funil_padrao)
        .map((o) => paraBrasilia(new Date(o.created_at)).data),
      fotos: fotos.map((f) => ({
        mes: f.mes,
        abl_total: Number(f.abl_total),
        abl_locada: Number(f.abl_locada),
        clientes_ativos: f.clientes_ativos,
      })),
      carencias: comCarencia,
      exemplo: enet.exemplo,
      metas: metas.filter((m) => doAno(m.vigente_desde)),
    });
    // Sem a permissão de valores: fica leads, % ocupação, % churn e clientes.
    const linhas = comValores
      ? todas
      : todas.filter(
          (l) => INDICADORES_PAINEL[l.indicador].formato !== "moeda",
        );
    const ocupacao = linhas.find((l) => l.indicador === "ocupacao");
    return {
      linhas,
      exemplo: enet.exemplo || rd.exemplo,
      comValores,
      semFoto: !!ocupacao?.marcas.some(
        (m) => m === "calculado" || m === "sem_historico",
      ),
      contratosComCarencia: comCarencia.length,
      anos: anosComDado(
        enet.contasReceber.map((c) => c.competencia),
        rd.oportunidades.map((o) => o.created_at),
        hoje,
      ),
    };
  },
);

function anosComDado(competencias: string[], criacoes: string[], hoje: string) {
  const atual = Number(hoje.slice(0, 4));
  const primeiro = Math.min(
    atual,
    ...[...competencias, ...criacoes].map((d) => Number(d.slice(0, 4))),
  );
  return Array.from({ length: atual + 2 - primeiro }, (_, i) => atual + 1 - i);
}
