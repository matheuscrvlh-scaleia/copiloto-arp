import { BarraSuperiorCliente } from "./barra-superior-cliente";
import { useSecoes } from "./secoes";

const dia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  day: "2-digit",
  month: "short",
});

/** Barra do topo: só com as telas que o usuário pode abrir. Lê a sessão. */
export function BarraSuperior() {
  const sections = useSecoes();
  const hoje = dia.format(new Date()).replace(/\./g, "");
  return <BarraSuperiorCliente sections={sections} hoje={hoje} />;
}
