import { inicio } from "@/modules/inicio/rotas";
import type { Modulo } from "./rota";

/**
 * Todos os módulos do sistema. Cada módulo portado acrescenta UMA linha
 * aqui (e o import acima), em ordem alfabética. O `rotas.tsx` é só a lista
 * de endereços: o código de cada tela é baixado quando ela abre.
 */
export const MODULOS: Modulo[] = [inicio];
