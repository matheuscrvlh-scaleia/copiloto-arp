import { describe, expect, it } from "vitest";
import type { Totais } from "./anuncios";
import { type EntradaResumo, linhasDoResumo } from "./painel";

const totais = (investimento: number, leadsRd: number): Totais => ({
  investimento,
  impressoes: 0,
  cliques: 0,
  conversoesPlataforma: 0,
  leadsRd,
  custoPorLead: leadsRd ? investimento / leadsRd : null,
  ctr: null,
  cpc: null,
});
const fmt = { moeda: (v: number) => `R$ ${v}`, numero: (v: number) => `${v}` };
const base: EntradaResumo = {
  anuncios: {
    atual: totais(3000, 50),
    anterior: totais(2000, 50),
    semCampanha: 4,
  },
  metas: {
    custoPorLead: { meta: 45, limiteAtencao: 55, direcao: "menor_melhor" },
    leadsMes: null,
    avaliacoesNovas: { meta: 30, limiteAtencao: 24, direcao: "maior_melhor" },
    notaMedia: null,
  },
  hoje: "2026-10-15",
  query: "periodo=semana_passada",
};
const tudo = () => true;

describe("resumo por frente do Painel", () => {
  it("variação contra a semana anterior e status pela meta", () => {
    const ls = linhasDoResumo(base, tudo, fmt);
    const inv = ls.find((l) => l.chave === "investimento");
    expect(inv?.variacao).toBeCloseTo(50);
    const cpl = ls.find((l) => l.chave === "custo_por_lead");
    // 3000 ÷ 50 = 60, acima do limite de atenção de 55.
    expect(cpl?.atual).toBe(60);
    expect(cpl?.status).toBe("fora");
    expect(cpl?.meta?.texto).toBe("até R$ 45");
    expect(cpl?.href).toBe("/marketing/anuncios?periodo=semana_passada");
  });

  it("avaliações do mês comparadas com a meta no ritmo", () => {
    const reputacao = {
      notaArp: 4.7,
      totalArp: 900,
      novasNoMes: 12,
      fracaoDoMes: 0.5,
      reclamacoesNoMes: 1,
      lojasEmAlerta: [],
      semResposta: [],
    };
    // Dia 15 de 31: ritmo de 30 é ~14,5; 12 fica entre o limite (~11,6) e ele.
    const ls = linhasDoResumo({ ...base, reputacao }, tudo, fmt);
    const novas = ls.find((l) => l.chave === "avaliacoes_novas");
    expect(novas?.status).toBe("atencao");
    expect(novas?.meta?.texto).toBe("30 no mês");
    expect(novas?.anterior).toBeNull();
  });

  it("só entram as frentes das telas liberadas", () => {
    const ls = linhasDoResumo(base, (p) => p === "marketing.reputacao", fmt);
    expect(ls).toHaveLength(0);
  });
});
