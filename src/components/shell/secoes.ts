import "server-only";
import { cache } from "react";
import { type NavSection, navigationFor } from "@/config/navigation";
import type { Usuario } from "@/server/auth";

/**
 * Seções do menu que a pessoa pode ver, uma vez por renderização: o menu e
 * a barra do topo recebem o mesmo objeto (o React o manda uma vez só).
 */
export const secoesDo = cache((usuario: Usuario): NavSection[] =>
  navigationFor((p) => usuario.permissoes.includes(p)),
);
