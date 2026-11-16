import type { Periodo } from "@/connectors/secullum/client";
import type { Afastamento, Funcionario } from "@/connectors/secullum/schemas";

/** "2026-01-15T00:00:00" → "2026-01-15". */
export function data(valor: string | null | undefined): string | null {
  return valor ? valor.slice(0, 10) : null;
}

/** NumeroFolha só vira matrícula se for número. */
export function matricula(
  numeroFolha: string | null | undefined,
): number | null {
  const v = (numeroFolha ?? "").trim();
  return /^\d+$/.test(v) ? Number(v) : null;
}

/** Sugestão de tipo de turnover para os motivos do Secullum da ARP. */
export function tipoTurnoverSugerido(descricao: string): string | null {
  const mapa: Record<string, string> = {
    "pedido de demissão": "voluntario",
    "desligamento por parte da empresa": "involuntario",
    "encerramento contrato jovem aprendiz": "termino_contrato",
    "efetivação estagiário": "efetivacao",
    "efetivação jovem aprendiz": "efetivacao",
  };
  return mapa[descricao.trim().toLowerCase()] ?? null;
}

/**
 * A matrícula é única no banco, mas um demitido e um recontratado podem ter
 * o mesmo NumeroFolha. Fica com ela quem está ativo (ou foi admitido por
 * último); os outros ficam sem matrícula.
 */
export function donosDaMatricula(
  funcionarios: Funcionario[],
): Map<number, number> {
  const dono = new Map<number, Funcionario>();
  for (const f of funcionarios) {
    const m = matricula(f.NumeroFolha);
    if (m === null) continue;
    const atual = dono.get(m);
    if (!atual || prefere(f, atual)) dono.set(m, f);
  }
  return new Map([...dono].map(([m, f]) => [m, f.Id]));
}

function prefere(a: Funcionario, b: Funcionario): boolean {
  const ativoA = !a.Demissao;
  const ativoB = !b.Demissao;
  if (ativoA !== ativoB) return ativoA;
  return (a.Admissao ?? "") > (b.Admissao ?? "");
}

/** Removido do bruto: dado pessoal que não usamos (LGPD). */
export function funcionarioSemDocumentos(f: Funcionario) {
  const { Cpf: _cpf, NumeroPis: _pis, ...resto } = f;
  return resto;
}

export function esteveAtivoNoPeriodo(
  f: Pick<Funcionario, "Admissao" | "Demissao">,
  { inicio, fim }: Periodo,
): boolean {
  const admissao = data(f.Admissao);
  const demissao = data(f.Demissao);
  return (!admissao || admissao <= fim) && (!demissao || demissao >= inicio);
}

export function afastamentoComMatricula(a: Afastamento) {
  return { ...a, matricula: matricula(a.NumeroFolha) };
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** O dia de hoje ainda está em andamento: o ponto vale até ontem. */
function ontem(hoje: Date): Date {
  return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
}

/** Mês da data → período do dia 1 até o fim do mês, sem passar de ontem. */
function competenciaAte(mes: Date, hoje: Date) {
  const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const ultimoDia = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
  const limite = ontem(hoje);
  const fim = ultimoDia < limite ? ultimoDia : limite;
  return {
    competencia: iso(inicio),
    periodo: { inicio: iso(inicio), fim: iso(fim) },
  };
}

/**
 * Competências a sincronizar: o mês corrente até ontem e, nos primeiros
 * `diasFechamento` dias do mês, também o mês anterior inteiro (o ponto do
 * mês passado ainda está sendo fechado). No dia 1, só o mês anterior.
 */
export function competenciasParaSincronizar(
  hoje: Date,
  diasFechamento = 10,
): { competencia: string; periodo: Periodo }[] {
  const lista = [];
  if (hoje.getDate() <= diasFechamento) {
    lista.push(
      competenciaAte(
        new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1),
        hoje,
      ),
    );
  }
  if (hoje.getDate() > 1) lista.push(competenciaAte(hoje, hoje));
  return lista;
}

/** Competência informada à mão ("2026-09") → mês inteiro, até ontem. */
export function competenciaDoMes(
  mes: string,
  hoje = new Date(),
): { competencia: string; periodo: Periodo } {
  const m = mes.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error(`competência inválida: "${mes}" (use aaaa-mm)`);
  const inicio = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  if (inicio > ontem(hoje)) {
    throw new Error(`competência ${mes} ainda não tem dia completo`);
  }
  return competenciaAte(inicio, hoje);
}
