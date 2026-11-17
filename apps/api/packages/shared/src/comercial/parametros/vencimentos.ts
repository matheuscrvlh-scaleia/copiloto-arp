import { z } from "zod";
import { inteiro, texto } from "./campo";
import type { CampoParametro } from "./quadro";

// Bloco "vencimentos" de Comercial › Configurações › Parâmetros.

export const ESQUEMA_VENCIMENTOS = z
  .object({
    vencimento_faixa1_dias: inteiro(1, 3650),
    vencimento_faixa2_dias: inteiro(1, 3650),
    lembrete_aniversario_dias: inteiro(0, 60),
    reajuste_previsto_dias: inteiro(1, 365),
    relacionamento_canal_visita: texto(80, "escolha o canal das visitas"),
    relacionamento_asana_projeto: texto(200, "informe o projeto do Asana"),
  })
  .refine((p) => p.vencimento_faixa2_dias > p.vencimento_faixa1_dias, {
    path: ["vencimento_faixa2_dias"],
    message: "precisa ser maior que a faixa 1",
  });

export const CAMPOS_VENCIMENTOS: Record<string, CampoParametro> = {
  vencimento_faixa1_dias: {
    rotulo: "Faixa 1 de vencimento (dias)",
    bloco: "vencimentos",
  },
  vencimento_faixa2_dias: {
    rotulo: "Faixa 2 de vencimento (dias)",
    bloco: "vencimentos",
  },
  lembrete_aniversario_dias: {
    rotulo: "Lembrete de aniversário (dias antes)",
    bloco: "vencimentos",
  },
  reajuste_previsto_dias: {
    rotulo: "Reajuste previsto nos próximos (dias)",
    bloco: "vencimentos",
  },
  relacionamento_canal_visita: {
    rotulo: "Canal que conta como visita",
    bloco: "vencimentos",
  },
  relacionamento_asana_projeto: {
    rotulo: "Projeto do SAC no Asana",
    bloco: "vencimentos",
  },
};
