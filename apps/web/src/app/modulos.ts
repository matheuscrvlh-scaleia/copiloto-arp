import { admin } from "@/modules/admin/rotas";
import { calendario } from "@/modules/calendario/rotas";
import { comercial } from "@/modules/comercial/rotas";
import { financeiro } from "@/modules/financeiro/rotas";
import { ia } from "@/modules/ia/rotas";
import { inicio } from "@/modules/inicio/rotas";
import { marketing } from "@/modules/marketing/rotas";
import { operacoes } from "@/modules/operacoes/rotas";
import { os } from "@/modules/os/rotas";
import { relatorios } from "@/modules/relatorios/rotas";
import { rh } from "@/modules/rh/rotas";
import { sustentabilidade } from "@/modules/sustentabilidade/rotas";
import type { Modulo } from "./rota";

/**
 * Todos os módulos do sistema. Cada módulo portado acrescenta UMA linha
 * aqui (e o import acima), em ordem alfabética. O `rotas.tsx` é só a lista
 * de endereços: o código de cada tela é baixado quando ela abre.
 */
export const MODULOS: Modulo[] = [
  admin,
  calendario,
  comercial,
  financeiro,
  ia,
  inicio,
  marketing,
  operacoes,
  os,
  relatorios,
  rh,
  sustentabilidade,
];
