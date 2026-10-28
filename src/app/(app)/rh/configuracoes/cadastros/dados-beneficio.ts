import "server-only";
import { competenciaDe, formatarMes, formatarMoeda } from "@/lib/formato";
import { vigenteEm } from "@/lib/rh/custo";
import { titularRecebe, valeNoMes } from "@/lib/rh/dependentes";
import { ROTULO_CONTRATO } from "@/lib/rh/rubricas";
import {
  type Beneficio,
  beneficiosCadastrados,
  colaboradoresAtivos,
  tabelasDoPlano,
  valoresMensais,
  vinculosDeBeneficio,
  vinculosPorContrato,
} from "@/server/rh/beneficios";
import { folhasDoCusto } from "@/server/rh/dados";
import { dependentesDoCopiloto } from "@/server/rh/dependentes";
import type { PessoaDoBeneficio } from "./valores-do-mes";

// Dados da lista de benefícios e da página de cada um: tudo lido uma vez
// (leituras com cache por requisição) e o resumo de cada benefício calculado
// do mesmo jeito nas duas telas.

/** Tipos de contrato que recebem benefício (sócio fica fora do custo). */
export const CONTRATOS_NO_PLURAL: Record<string, string> = {
  clt: "CLT",
  aprendiz: "jovens aprendizes",
  estagiario: "estagiários",
  pj: "PJ",
};
export const todosOs = (tipo: string) =>
  `Todos os ${CONTRATOS_NO_PLURAL[tipo] ?? tipo}`;

export async function dadosDosBeneficios() {
  const [
    beneficios,
    vinculos,
    contratos,
    colaboradores,
    tabelas,
    folhas,
    lancados,
  ] = await Promise.all([
    beneficiosCadastrados(),
    vinculosDeBeneficio(),
    vinculosPorContrato(),
    colaboradoresAtivos(),
    tabelasDoPlano(),
    folhasDoCusto(),
    valoresMensais(),
  ]);
  // Só plano e odonto têm dependentes; sem nenhum dos dois, nem lê.
  const dependentes = beneficios.some(
    (b) => b.tipo === "plano_saude" || b.tipo === "odonto",
  )
    ? await dependentesDoCopiloto()
    : [];
  const pessoasDoContrato = new Map<string, number>();
  for (const c of colaboradores)
    if (c.tipo_contrato)
      pessoasDoContrato.set(
        c.tipo_contrato,
        (pessoasDoContrato.get(c.tipo_contrato) ?? 0) + 1,
      );
  return {
    beneficios,
    vinculos,
    contratos,
    colaboradores,
    tabelas,
    lancados,
    dependentes,
    pessoasDoContrato,
    /** Competência mostrada (aaaa-mm-01): o mês de hoje. */
    mesAtual: competenciaDe(new Date()),
    /** Vínculo novo começa no mês da última folha, para entrar no custo dela. */
    desdeSugerido: folhas[0]?.competencia ?? null,
    opcoesColaborador: colaboradores.map((c) => ({
      valor: c.id,
      rotulo: c.nome,
      descricao: [
        c.matricula ? `matrícula ${c.matricula}` : null,
        c.tipo_contrato ? ROTULO_CONTRATO[c.tipo_contrato] : null,
      ]
        .filter(Boolean)
        .join(" · "),
    })),
  };
}

export type DadosDosBeneficios = Awaited<ReturnType<typeof dadosDosBeneficios>>;

/** O que é de um benefício e o resumo dele no mês atual. */
export function doBeneficio(d: DadosDosBeneficios, b: Beneficio) {
  const mes = d.mesAtual;
  const vinculos = d.vinculos.filter((v) => v.beneficio_id === b.id);
  const contratos = d.contratos.filter((c) => c.beneficio_id === b.id);
  const tabelas = d.tabelas.filter((t) => t.beneficio_id === b.id);
  const lancados = d.lancados.filter((l) => l.beneficio_id === b.id);
  const porMes = b.valor_por_mes;
  const pelaFaixa = !porMes && b.valor_padrao === null;
  const faixas = vigenteEm(tabelas, mes)?.faixas ?? null;

  // Quem recebe: pelo contrato e pela pessoa (o vínculo da pessoa vem por
  // último e vence, como no custo).
  const pessoas: PessoaDoBeneficio[] = [
    ...contratos.flatMap((c) =>
      d.colaboradores
        .filter((p) => p.tipo_contrato === c.tipo_contrato)
        .map((p) => ({
          colaborador_id: p.id,
          nome: p.nome,
          desde: p.admissao && p.admissao > c.desde ? p.admissao : c.desde,
          ate: c.ate,
        })),
    ),
    ...vinculos.map((v) => ({
      colaborador_id: v.colaborador_id,
      nome: v.nome,
      desde: v.desde,
      ate: v.ate,
    })),
  ];
  const recebemNoMes = new Set(
    pessoas.filter((p) => valeNoMes(p, mes)).map((p) => p.colaborador_id),
  );
  const semValorNoMes = porMes
    ? [...recebemNoMes].filter(
        (id) =>
          !lancados.some(
            (l) => l.colaborador_id === id && l.competencia === mes,
          ),
      ).length
    : 0;

  const temDependentes = b.tipo === "plano_saude" || b.tipo === "odonto";
  const dependentes = temDependentes
    ? d.dependentes.filter((x) =>
        b.tipo === "plano_saude" ? x.tem_plano : x.tem_odonto,
      )
    : [];
  const dependentesSemTitular = dependentes.filter(
    (x) => !titularRecebe(x, vinculos, contratos, mes),
  ).length;

  const ativos = vinculos.filter((v) => v.ate === null);
  const contratosAtivos = contratos.filter((c) => c.ate === null);
  const quemRecebe =
    contratosAtivos.length === 0 && ativos.length === 0
      ? "Ninguém vinculado"
      : [
          ...contratosAtivos.map((c) => todosOs(c.tipo_contrato)),
          ...(ativos.length
            ? [`${ativos.length} ${ativos.length === 1 ? "pessoa" : "pessoas"}`]
            : []),
        ].join(" + ");

  const valor = porMes
    ? "Valor varia por mês"
    : pelaFaixa
      ? tabelas.length > 0
        ? "Valor pela faixa etária"
        : "Valor pela faixa: falta enviar a tabela"
      : `${formatarMoeda(b.valor_padrao)}/mês`;

  return {
    vinculos,
    contratos,
    tabelas,
    lancados,
    faixas,
    pessoas,
    porMes,
    pelaFaixa,
    temDependentes,
    dependentes,
    dependentesSemTitular,
    quemRecebe,
    valor,
    recebemNoMes: recebemNoMes.size,
    semValorNoMes,
    /** "faltam 9 em out/2026" (só benefício que varia por mês). */
    pendencia:
      porMes && semValorNoMes > 0
        ? `faltam ${semValorNoMes} em ${formatarMes(mes)}`
        : null,
  };
}
