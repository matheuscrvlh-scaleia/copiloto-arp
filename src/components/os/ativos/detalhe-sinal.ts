import type { Detalhe } from "@/components/modal-detalhe";
import { formatarNumero, formatarPct } from "@/lib/formato";
import { listaEmTexto } from "@/lib/os/ativos";
import type { FaixasSinal, ResultadoSinal } from "@/lib/os/sinal";
import { SINAIS } from "@/lib/os/sinal";
import { CRITERIOS } from "./selos";

// "Por que este sinal": os três critérios lado a lado, com as faixas de
// Parâmetros. Abre no modal padrão ao clicar no cartão do sinal.

export function detalheDoSinal({
  nome,
  sinal,
  faixas,
  corretivas12m,
  idadeAnos,
  vidaUtilAnos,
  faltas,
}: {
  nome: string;
  sinal: ResultadoSinal;
  faixas: FaixasSinal;
  corretivas12m: number;
  idadeAnos: number | null;
  vidaUtilAnos: number | null;
  faltas: string[];
}): Detalhe {
  const pct = (v: number) => formatarPct(v, 0);
  const idade =
    sinal.idadePct === null
      ? "Sem dado"
      : `${formatarPct(sinal.idadePct, 0)} (${formatarNumero(idadeAnos ?? 0, 1)} de ${formatarNumero(vidaUtilAnos ?? 0, 1)} anos)`;
  const faltando = faltas.filter((f) =>
    ["valor de reposição", "vida útil", "data de compra"].includes(f),
  );
  return {
    secao: "Sinal de troca",
    titulo: `${SINAIS[sinal.sinal]} · ${nome}`,
    subtitulo:
      sinal.sinal === "incompleto"
        ? `Falta ${listaEmTexto(faltando)} no cadastro: sem eles o sistema não chuta o sinal.`
        : "Vale o pior dos três critérios.",
    resumo: [
      {
        rotulo: "Peso da manutenção",
        valor: sinal.pesoPct === null ? "Sem dado" : pct(sinal.pesoPct),
      },
      { rotulo: "Corretivas em 12 meses", valor: String(corretivas12m) },
      {
        rotulo: "Idade / vida útil",
        valor: sinal.idadePct === null ? "Sem dado" : pct(sinal.idadePct),
      },
    ],
    fontes: [
      {
        rotulo: "Peso",
        valor:
          "custo de manutenção dos últimos 12 meses ÷ valor de reposição atual",
      },
      {
        rotulo: "Corretivas",
        valor: "OS não preventivas e não canceladas dos últimos 12 meses",
      },
      { rotulo: "Idade", valor: "hoje − data de compra, em % da vida útil" },
      { rotulo: "Faixas", valor: "Configurações › Parâmetros" },
    ],
    tabelas: [
      {
        titulo: "Critérios",
        colunas: [
          { titulo: "Critério" },
          { titulo: "Valor", numero: true },
          { titulo: "Avaliar", numero: true },
          { titulo: "Trocar", numero: true },
          { titulo: "Resultado" },
        ],
        linhas: [
          {
            chave: "peso",
            celulas: [
              "Peso da manutenção",
              sinal.pesoPct === null ? "Sem dado" : pct(sinal.pesoPct),
              `a partir de ${pct(faixas.pesoAvaliar)}`,
              `acima de ${pct(faixas.pesoTrocar)}`,
              CRITERIOS[sinal.criterios.peso],
            ],
          },
          {
            chave: "corretivas",
            celulas: [
              "Corretivas em 12 meses",
              String(corretivas12m),
              `a partir de ${faixas.corretivasAvaliar}`,
              `a partir de ${faixas.corretivasTrocar}`,
              CRITERIOS[sinal.criterios.corretivas],
            ],
          },
          {
            chave: "idade",
            celulas: [
              "Idade",
              idade,
              `a partir de ${pct(faixas.idadeAvaliarPct)}`,
              `acima de ${pct(faixas.idadeTrocarPct)}`,
              CRITERIOS[sinal.criterios.idade],
            ],
          },
        ],
      },
    ],
  };
}
