// Funcionários: situação de cada pessoa e leitura do ponto do dia.

export type Situacao =
  | "ativo"
  | "afastado"
  | "a_admitir"
  | "desligado"
  | "fora_do_copiloto";

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  ativo: "Ativo",
  afastado: "Afastado",
  a_admitir: "A admitir",
  desligado: "Desligado",
  fora_do_copiloto: "Fora do Copiloto",
};

/** Agrupa as situações no filtro da lista (o padrão é "ativos"). */
export const VINCULO: Record<Situacao, "ativos" | "desligados" | "fora"> = {
  ativo: "ativos",
  afastado: "ativos",
  a_admitir: "ativos",
  desligado: "desligados",
  fora_do_copiloto: "fora",
};

/**
 * Como no quadro, quem vale é o Copiloto RH: sem `copiloto_id` a pessoa está
 * só no ponto ou na folha. Afastado pelo Copiloto (on_leave) ou por um
 * afastamento do ponto que cobre `hoje`.
 */
export function situacaoDe(
  c: {
    copiloto_id: string | null;
    situacao_copiloto: string | null;
    admissao: string | null;
    desligamento: string | null;
  },
  hoje: string,
  afastadoHoje = false,
): Situacao {
  if (c.desligamento && c.desligamento <= hoje) return "desligado";
  if (!c.copiloto_id) return "fora_do_copiloto";
  if (c.situacao_copiloto === "pending" || (c.admissao && c.admissao > hoje))
    return "a_admitir";
  if (c.situacao_copiloto === "on_leave" || afastadoHoje) return "afastado";
  return "ativo";
}

export interface ParBatidas {
  entrada: string | null;
  saida: string | null;
}

/** [E1, S1, E2, S2…] → pares; o par sem uma das pontas fica com null. */
export function paresDeBatidas(batidas: (string | null)[]): ParBatidas[] {
  const pares: ParBatidas[] = [];
  for (let i = 0; i < batidas.length; i += 2) {
    const entrada = batidas[i] ?? null;
    const saida = batidas[i + 1] ?? null;
    if (entrada || saida) pares.push({ entrada, saida });
  }
  return pares;
}

/** Algum par sem entrada ou sem saída (batida esquecida). */
export const batidaFaltando = (batidas: (string | null)[]) =>
  paresDeBatidas(batidas).some((p) => !p.entrada || !p.saida);

// Só as justificativas de leitura óbvia; as outras aparecem como vêm do
// ponto (dependem da configuração do Secullum da ARP).
const OCORRENCIAS: Record<string, string> = {
  FOLGA: "Folga",
  FERIADO: "Feriado",
  ATESTAD: "Atestado",
  EXTERNO: "Externo",
  FALTA: "Falta",
  FALTAAB: "Falta abonada",
  FERIAS: "Férias",
  FÉRIAS: "Férias",
};

export function rotuloOcorrencia(ocorrencia: string): string {
  return OCORRENCIAS[ocorrencia.toUpperCase()] ?? ocorrencia;
}

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "2026-09-05" → "sáb". */
export function diaDaSemana(data: string): string {
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  return SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()] ?? "";
}

/** Sábado ou domingo. */
export function fimDeSemana(data: string): boolean {
  const dia = diaDaSemana(data);
  return dia === "sáb" || dia === "dom";
}
