import type { DadosContrato, Garantia } from "./contrato-esquema";

// ---------------------------------------------------------------------------
// Como o sistema monta o contrato (V2): bloco a bloco
// ---------------------------------------------------------------------------

export interface BlocoDoModelo {
  bloco: string;
  texto: string;
  modelo: string;
}

const GARANTIA_MODELO: Record<Garantia, [string, string]> = {
  fiador: ["Cláusula XX — Da garantia — Fiança", "EX 1, EX 5 (PF), EX 6 (PJ)"],
  capitalizacao: [
    "Cláusula XX — Título de capitalização, com 7 parágrafos",
    "EX 2",
  ],
  seguro_fianca: ["Cláusula XX — Do seguro fiança", "EX 3"],
  caucao: ["Cláusula de caução", "Sem modelo recebido"],
  sem_garantia: [
    "Cláusula “Da ausência de garantia”, com despejo liminar",
    "EX 4",
  ],
};

/** Os blocos que mudam conforme as escolhas do assistente (spec 4.11). */
export function blocosDoModelo(d: DadosContrato): BlocoDoModelo[] {
  const c = d.condicoes;
  const out: BlocoDoModelo[] = [];
  out.push(
    d.partes.tipo === "pj"
      ? {
          bloco: "Partes",
          texto: "Qualificação PJ com o sócio administrador, “a LOCATÁRIA”",
          modelo: "EX 2, EX 4, EX 5, EX 6",
        }
      : {
          bloco: "Partes",
          texto: "Qualificação PF, “o LOCATÁRIO”",
          modelo: "EX 1, EX 3",
        },
  );
  out.push(
    c.tipo_prazo === "dias"
      ? {
          bloco: "Prazo",
          texto:
            "Temporário em dias, aluguel em parcela única, cláusulas extras",
          modelo: "EX 4",
        }
      : c.inicio === "data_fixa"
        ? {
            bloco: "Prazo",
            texto: "Cláusula II com início e término",
            modelo: "EX 3, EX 5",
          }
        : {
            bloco: "Prazo",
            texto:
              "Cláusula II contada da entrega do Termo de Vistoria de Entrada; aluguel devido a partir dela",
            modelo: "EX 1, EX 2",
          },
  );
  if (c.forma === "percentual")
    out.push({
      bloco: "Aluguel",
      texto:
        "Cláusula III com percentual, mínimo, diferença até o dia 20 e relatório semanal de faturamento",
      modelo: "EX 6",
    });
  const tipos = new Set(c.carencias_descontos.map((l) => l.tipo));
  if (tipos.has("desconto_fixo"))
    out.push({
      bloco: "Desconto fixo",
      texto: "§3º da Cláusula III com valor e vencimentos",
      modelo: "EX 1, EX 3",
    });
  if (tipos.has("carencia"))
    out.push({
      bloco: "Carência",
      texto: "“Carência integral pelo prazo de N dias”, sem aluguel e encargos",
      modelo: "EX 5",
    });
  if (tipos.has("valor_final"))
    out.push({
      bloco: "Valor final do boleto",
      texto:
        "§§4º a 6º da Cláusula III (valor fechado por N meses e devolução em saída antecipada)",
      modelo: "EX 5",
    });
  if (d.garantia.tipo) {
    const [texto, modelo] = GARANTIA_MODELO[d.garantia.tipo];
    out.push({ bloco: "Garantia", texto, modelo });
  }
  out.push({
    bloco: "Vaga",
    texto: `Item 4 das condições gerais (credenciamento promocional): ${(c.vagas ?? 0) > 0 ? "optou" : "não optou"}`,
    modelo: (c.vagas ?? 0) > 0 ? "EX 1" : "EX 2",
  });
  out.push({
    bloco: "Água",
    texto: `Item 5 das condições gerais: ${c.agua ? "com consumo" : "sem consumo"}`,
    modelo: c.agua ? "EX 1" : "EX 2",
  });
  out.push({
    bloco: "Obras",
    texto: "Cláusula XXII — Das obras, com a condição física da etapa 5",
    modelo: "Todos",
  });
  return out;
}
