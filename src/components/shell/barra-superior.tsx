import { navigationFor } from "@/config/navigation";
import { usuarioAtual } from "@/server/auth";
import { BarraSuperiorCliente } from "./barra-superior-cliente";

const dia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  day: "2-digit",
  month: "short",
});

/** Barra do topo: só com as telas que o usuário pode abrir. Lê a sessão. */
export async function BarraSuperior() {
  const usuario = await usuarioAtual();
  const sections = navigationFor((p) => usuario.permissoes.includes(p));
  const hoje = dia.format(new Date()).replace(/\./g, "");
  return <BarraSuperiorCliente sections={sections} hoje={hoje} />;
}
