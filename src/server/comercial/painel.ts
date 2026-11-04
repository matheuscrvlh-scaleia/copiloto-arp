import "server-only";
import { cache } from "react";
import {
  type CarenciaContrato,
  carenciaDoContrato,
  type LinhaPainel,
  montarPainel,
} from "@/lib/comercial/painel";
import { paraBrasilia } from "@/lib/os/tempo";
import { podeAgora } from "@/server/auth";
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
// faturamento em carência dos contratos feitos no assistente.

export interface DadosPainel {
  linhas: LinhaPainel[];
  exemplo: boolean;
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
  const { data, error } = await comAdmin()
    .from("contratos")
    .select("aluguel, condicoes:dados->condicoes")
    .eq("tipo", "contrato")
    .neq("status", "rascunho");
  falhar(error);
  return (data ?? [])
    .map((c) => carenciaDoContrato(c.aluguel, c.condicoes))
    .filter((c): c is CarenciaContrato => c !== null);
}

export const dadosDoPainel = cache(
  async (ano: number): Promise<DadosPainel> => {
    const { pode, hoje } = await contextoCom();
    if (!pode("comercial.painel.ver"))
      throw new Error("Sem acesso ao Painel comercial.");
    const [enet, rd, tipos, metas, params, fotos, comCarencia] =
      await Promise.all([
        dadosEnet(),
        dadosRd(),
        tiposLuc(),
        metasCom(),
        parametros(),
        fotosDoAno(ano),
        carencias(),
      ]);
    const doAno = (m: string) => m.startsWith(`${ano}-`);
    const linhas = montarPainel({
      ano,
      hoje,
      contas: enet.contasReceber.filter((c) => doAno(c.competencia)),
      contratos: enet.contratos,
      lucs: enet.lucs,
      tiposOcupacao: new Set(
        tipos.filter((t) => t.conta_ocupacao).map((t) => t.tipo),
      ),
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
    const ocupacao = linhas.find((l) => l.indicador === "ocupacao");
    return {
      linhas,
      exemplo: enet.exemplo || rd.exemplo,
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
