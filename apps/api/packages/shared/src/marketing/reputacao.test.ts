import { describe, expect, it } from "vitest";
import type { Estrelas, GoogleAvaliacao } from "./fontes";
import { somarDias } from "./periodo";
import {
  type FontesReputacao,
  type LocatarioMonitorado,
  linhasDeLocatarios,
  mapaDeTemas,
  medir,
  type ParametrosReputacao,
  resumoReputacao,
  situacaoDoLocatario,
} from "./reputacao";

// Plano de testes do spec (seção 8, Reputação): uma linha por locatário,
// situação pelos limites de Configurações (mudar o limite muda a situação sem
// mexer no código), estrelas de reclamação do parâmetro e tema só da lista
// cadastrada.

const HOJE = "2026-10-29";
const TEMAS = ["Atendimento", "Limpeza", "Estacionamento"];
const P: ParametrosReputacao = {
  estrelas_reclamacao: [1, 2],
  janela_reputacao_dias: 30,
  reclamacoes_atencao: 1,
  reclamacoes_alerta: 3,
  nota_atencao: 3.5,
};
const ESTRELAS: Estrelas[] = ["ONE", "TWO", "THREE", "FOUR", "FIVE"];

let seq = 0;
function avaliacao(
  localId: string,
  diasAtras: number,
  estrelas: number,
  respondida = true,
): GoogleAvaliacao {
  const data = somarDias(HOJE, -diasAtras);
  seq += 1;
  return {
    reviewId: `r${seq}`,
    localId,
    reviewer: { displayName: "Fulano" },
    starRating: ESTRELAS[estrelas - 1] as Estrelas,
    comment: "",
    createTime: `${data}T10:00:00-03:00`,
    updateTime: `${data}T10:00:00-03:00`,
    reviewReply: respondida
      ? {
          comment: "Obrigado",
          updateTime: `${somarDias(data, 2)}T10:00:00-03:00`,
        }
      : null,
  };
}

const loc = (id: string, forma = "gerente"): LocatarioMonitorado => ({
  id,
  nome: `Loja ${id}`,
  categoria: "Gastronomia",
  forma_acesso: forma,
  perfil_url: null,
});

/** Locatário com `n` reclamações (1 estrela) nos últimos 30 dias e 5 boas. */
function fontesCom(reclamacoes: Record<string, number>): FontesReputacao {
  const avaliacoes: GoogleAvaliacao[] = [];
  for (const [id, n] of Object.entries(reclamacoes)) {
    for (let k = 0; k < n; k++) avaliacoes.push(avaliacao(id, 2 + k * 5, 1));
    for (let k = 0; k < 5; k++) avaliacoes.push(avaliacao(id, 1 + k * 4, 5));
  }
  return {
    locais: Object.keys(reclamacoes).map((id) => ({
      id,
      title: `Perfil ${id}`,
      averageRating: 4.5,
      totalReviewCount: 100,
      mapsUri: "https://maps.google.com",
    })),
    avaliacoes,
    temas: avaliacoes.map((a) => ({
      reviewId: a.reviewId,
      tema: "Atendimento",
    })),
  };
}

const ULTIMOS_30 = { de: somarDias(HOJE, -29), ate: HOJE };

describe("reputação", () => {
  it("uma linha por locatário: 12 avaliações no período → 1 linha, 12 no detalhe", () => {
    const avaliacoes = Array.from({ length: 12 }, (_, k) =>
      avaliacao("a", k * 2, 5),
    );
    const linhas = linhasDeLocatarios(
      {
        locais: [
          {
            id: "a",
            title: "A",
            averageRating: 4.8,
            totalReviewCount: 300,
            mapsUri: "x",
          },
        ],
        avaliacoes,
        temas: [],
      },
      [loc("a")],
      P,
      TEMAS,
      ULTIMOS_30,
      HOJE,
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.periodo.novas).toBe(12);
    expect(linhas[0]?.avaliacoes).toHaveLength(12);
  });

  it("situação: 0, 2 e 4 reclamações em 30 dias → Normal, Atenção e Alerta", () => {
    const linhas = linhasDeLocatarios(
      fontesCom({ zero: 0, duas: 2, quatro: 4 }),
      [loc("zero"), loc("duas"), loc("quatro")],
      P,
      TEMAS,
      ULTIMOS_30,
      HOJE,
    );
    const sit = Object.fromEntries(linhas.map((l) => [l.id, l.situacao]));
    expect(sit).toEqual({ zero: "normal", duas: "atencao", quatro: "alerta" });
    // Ordem da lista: situação, depois reclamações.
    expect(linhas.map((l) => l.id)).toEqual(["quatro", "duas", "zero"]);
  });

  it("limite configurável: Alerta de 3 para 5 → o de 4 cai para Atenção", () => {
    const fontes = fontesCom({ quatro: 4 });
    const com = (p: ParametrosReputacao) =>
      linhasDeLocatarios(fontes, [loc("quatro")], p, TEMAS, ULTIMOS_30, HOJE)[0]
        ?.situacao;
    expect(com(P)).toBe("alerta");
    expect(com({ ...P, reclamacoes_alerta: 5 })).toBe("atencao");
  });

  it("nota das novas abaixo da nota de atenção → Atenção, mesmo sem reclamação", () => {
    expect(situacaoDoLocatario({ reclamacoes: 0, notaDasNovas: 3.2 }, P)).toBe(
      "atencao",
    );
    expect(situacaoDoLocatario({ reclamacoes: 0, notaDasNovas: null }, P)).toBe(
      "normal",
    );
  });

  it("estrelas de reclamação vêm do parâmetro ({1,2,3} conta a de 3)", () => {
    const fontes: FontesReputacao = {
      locais: [
        {
          id: "a",
          title: "A",
          averageRating: 4,
          totalReviewCount: 3,
          mapsUri: "x",
        },
      ],
      avaliacoes: [
        avaliacao("a", 1, 3),
        avaliacao("a", 2, 2),
        avaliacao("a", 3, 4),
      ],
      temas: [],
    };
    const recl = (estrelas: number[]) =>
      linhasDeLocatarios(
        fontes,
        [loc("a")],
        { ...P, estrelas_reclamacao: estrelas },
        TEMAS,
        ULTIMOS_30,
        HOJE,
      )[0]?.periodo.reclamacoes;
    expect(recl([1, 2])).toBe(1);
    expect(recl([1, 2, 3])).toBe(2);
  });

  it("não cria tema fora da lista cadastrada", () => {
    const temas = mapaDeTemas(
      [
        { reviewId: "1", tema: "atendimento" },
        { reviewId: "2", tema: "Preço" },
      ],
      TEMAS,
    );
    expect(temas.get("1")).toBe("Atendimento");
    expect(temas.has("2")).toBe(false);
  });

  it("sem acesso: aparece na lista com 'sem dados', sem nota", () => {
    const linhas = linhasDeLocatarios(
      fontesCom({ a: 1 }),
      [loc("a", "sem_acesso"), loc("b", "gerente")],
      P,
      TEMAS,
      ULTIMOS_30,
      HOJE,
    );
    expect(linhas).toHaveLength(2);
    for (const l of linhas) {
      expect(l.situacao).toBe("sem_dados");
      expect(l.nota).toBeNull();
    }
  });

  it("tempo de resposta, taxa e distribuição de estrelas", () => {
    const m = medir(
      linhasDeLocatarios(
        fontesCom({ a: 2 }),
        [loc("a")],
        P,
        TEMAS,
        ULTIMOS_30,
        HOJE,
      )[0]?.avaliacoes ?? [],
      ULTIMOS_30,
    );
    expect(m.distribuicao).toEqual([5, 0, 0, 0, 2]);
    expect(m.taxaResposta).toBe(100);
    expect(m.tempoMedianoResposta).toBe(2);
    expect(m.temaMaisCitado).toBe("Atendimento");
  });

  it("resumo para o Painel: lojas em alerta e reclamação da ARP sem resposta", () => {
    const fontes = fontesCom({ quatro: 4 });
    fontes.locais.push({
      id: "arp",
      title: "Espaço ARP",
      averageRating: 4.6,
      totalReviewCount: 2900,
      mapsUri: "x",
    });
    fontes.avaliacoes.push(
      avaliacao("arp", 4, 1, false),
      avaliacao("arp", 1, 2, false),
      avaliacao("arp", 6, 5, false),
      avaliacao("arp", 60, 1, false),
    );
    const r = resumoReputacao({
      fontes,
      locatarios: [loc("quatro")],
      parametros: P,
      temasCadastrados: TEMAS,
      hoje: HOJE,
      limiteSemRespostaDias: 2,
    });
    expect(r.notaArp).toBe(4.6);
    expect(r.lojasEmAlerta).toEqual([
      {
        id: "quatro",
        nome: "Loja quatro",
        reclamacoes: 4,
        temaMaisCitado: "Atendimento",
      },
    ]);
    // Só a de 1 estrela há 4 dias: a de 1 dia está no prazo, a de 5 não é
    // reclamação e a de 60 dias está fora da janela.
    expect(r.semResposta.map((s) => s.dias)).toEqual([4]);
    expect(r.novasNoMes).toBe(3);
  });
});
