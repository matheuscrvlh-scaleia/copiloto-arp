import type { ColaboradorExtrato, ExtratoMensal } from "./extrato";

export interface ItemConferencia {
  chave: string;
  titulo: string;
  /** null: não dá para conferir (falta o valor no resumo ou a regra não é conhecida). */
  ok: boolean | null;
  importado: number | null;
  resumo: number | null;
  nota?: string;
}

export interface Conferencia {
  itens: ItemConferencia[];
  /** Pessoas cujas rubricas fecham com proventos, descontos e líquido. */
  coerentes: number;
  incoerentes: { matricula: number; nome: string }[];
}

const TOLERANCIA = 0.05;
const iguais = (a: number, b: number) => Math.abs(a - b) <= TOLERANCIA;
const soma = (
  cs: ColaboradorExtrato[],
  f: (c: ColaboradorExtrato) => number | null,
) => Math.round(cs.reduce((s, c) => s + (f(c) ?? 0), 0) * 100) / 100;

/** As rubricas da pessoa fecham com o rodapé dela? É a prova de que a leitura está certa. */
export function coerente(c: ColaboradorExtrato): boolean {
  const p = soma([c], () =>
    c.rubricas
      .filter((r) => r.natureza === "provento")
      .reduce((s, r) => s + r.valor, 0),
  );
  const d = soma([c], () =>
    c.rubricas
      .filter((r) => r.natureza === "desconto")
      .reduce((s, r) => s + r.valor, 0),
  );
  return (
    c.proventos !== null &&
    c.descontos !== null &&
    c.liquido !== null &&
    iguais(p, c.proventos) &&
    iguais(d, c.descontos) &&
    iguais(c.proventos - c.descontos, c.liquido)
  );
}

function item(
  chave: string,
  titulo: string,
  importado: number,
  resumo: number | null | undefined,
  nota?: string,
): ItemConferencia {
  const r = resumo ?? null;
  return {
    chave,
    titulo,
    importado,
    resumo: r,
    ok: r === null ? null : iguais(importado, r),
    nota,
  };
}

/** Totais importados × resumo da empresa no fim do extrato. */
export function conferir(extrato: ExtratoMensal): Conferencia {
  const cs = extrato.colaboradores;
  const r = extrato.resumo;
  const proLabore = cs.filter((c) => c.tipo_contrato === "pro_labore");
  const empregados = cs.filter((c) => c.tipo_contrato !== "pro_labore");
  const incoerentes = cs
    .filter((c) => !coerente(c))
    .map((c) => ({ matricula: c.matricula, nome: c.nome }));

  return {
    coerentes: cs.length - incoerentes.length,
    incoerentes,
    itens: [
      item(
        "liquido",
        "Líquido geral",
        soma(cs, (c) => c.liquido),
        extrato.liquido_geral,
      ),
      item(
        "base_inss_empregados",
        "Base de INSS dos empregados",
        soma(empregados, (c) => c.base_inss),
        r.base_inss_empregados,
      ),
      item(
        "base_inss_contribuintes",
        "Base de INSS do pró-labore",
        soma(proLabore, (c) => c.base_inss),
        r.base_inss_contribuintes,
      ),
      {
        chave: "fgts",
        titulo: "FGTS",
        ok: null,
        importado: soma(cs, (c) => c.valor_fgts),
        resumo:
          (r.valor_fgts ?? 0) +
          (r.valor_fgts_aprendiz ?? 0) +
          (r.valor_fgts_rescisorio ?? 0),
        nota: "O resumo separa FGTS do mês, de aprendiz e de rescisão; a regra de conferência será confirmada com a contabilidade.",
      },
    ],
  };
}
