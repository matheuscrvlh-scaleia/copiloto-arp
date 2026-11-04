import { formatarNumero } from "@/lib/formato";

// Formatos das telas do Comercial (spec 4.3): valores 1.234,56 (sem "R$"
// nas listas), áreas em m² e o "Dados de dd/mm/aaaa às hh:mm" do topo.

export { linhaDeFiltros } from "@/lib/marketing/periodo";

/** 1234.5 → "1.234,50"; null → "—". */
export const formatarValor = (v: number | null) =>
  v === null ? "—" : formatarNumero(v, 2);

/** 30.5 → "30,50 m²"; null → "—". */
export const formatarArea = (v: number | null) =>
  v === null ? "—" : `${formatarNumero(v, 2)} m²`;

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Instante → "Dados de 04/11/2026 às 06:00" (horário de Brasília). */
export function dadosDe(instante: string | Date): string {
  const [dia, hora] = dataHora
    .format(new Date(instante))
    .replace(",", "")
    .split(" ");
  return `Dados de ${dia} às ${hora}`;
}
