import { z } from "zod";
import { parametrosSu } from "./base";

// Contratos de Configurações › Parâmetros e › Coletores do Sustentabilidade.
// As gravações recebem os campos do formulário como texto (a tela manda o
// que digitou); quem valida, com os esquemas de `../painel-parametros`, é o
// service.

/** Campos de formulário (texto; campo repetido vira lista). */
export const camposDeFormulario = z.record(z.string(), z.unknown());
export type CamposDeFormulario = z.infer<typeof camposDeFormulario>;

/** GET /sustentabilidade/parametros/tela?aba=&ano= */
export const consultaDaTelaDeParametros = z.object({
  aba: z.string().max(40).optional(),
  ano: z.string().max(10).optional(),
});
export type ConsultaDaTelaDeParametros = z.infer<
  typeof consultaDaTelaDeParametros
>;

const mudanca = z.object({
  chave: z.string(),
  campo: z.string(),
  aba: z
    .enum(["entrevistas", "clube", "coletores", "rcc", "programas", "painel"])
    .nullable(),
  antes: z.string(),
  depois: z.string(),
});

export const alteracaoDeParametro = z.object({
  id: z.number(),
  em: z.string(),
  autor: z.string(),
  mudancas: z.array(mudanca),
});
export type AlteracaoDeParametro = z.infer<typeof alteracaoDeParametro>;

export const linhaDeSetor = z.object({ setor: z.string(), meses: z.number() });
export type LinhaDeSetor = z.infer<typeof linhaDeSetor>;

export const vigenciaDoRcc = z.object({
  vigenteDesde: z.string(),
  toneladasPorCacamba: z.number(),
  volumeM3: z.number(),
  /** Null sem "Ver valores" (ou sem preço nessa data). */
  precoA: z.number().nullable(),
  precoB: z.number().nullable(),
});
export type VigenciaDoRcc = z.infer<typeof vigenciaDoRcc>;

export const marcoDoPainel = z.object({
  indicador: z.string(),
  ano: z.number(),
  valor: z.number(),
  exemplo: z.boolean(),
});
export type MarcoDoPainel = z.infer<typeof marcoDoPainel>;

export const equivalenciaCadastrada = z.object({
  nome: z.string(),
  fator: z.number(),
  unidade: z.string().nullable(),
  confirmado: z.boolean(),
});
export type EquivalenciaCadastrada = z.infer<typeof equivalenciaCadastrada>;

/** Tudo o que a tela de Parâmetros mostra (só o que a aba pedida usa). */
export const respostaTelaDeParametros = z.object({
  /** A aba lida (a pedida, ou "entrevistas"). */
  aba: z.string(),
  anoAtual: z.number(),
  anoDasMetas: z.number(),
  parametros: parametrosSu,
  alteracoes: z.array(alteracaoDeParametro),
  exemplos: z.array(
    z.object({ tabela: z.string(), nome: z.string(), linhas: z.number() }),
  ),
  /** "Ver valores", conferido no banco. */
  comValores: z.boolean(),
  setoresDeValidade: z.array(linhaDeSetor).nullable(),
  setoresDoChamado: z
    .array(z.object({ id: z.string(), nome: z.string() }))
    .nullable(),
  rcc: z
    .object({ vigencias: z.array(vigenciaDoRcc), comPrecos: z.boolean() })
    .nullable(),
  custos: z.object({ album: z.number(), copo: z.number() }).nullable(),
  painel: z
    .object({
      marcos: z.array(marcoDoPainel),
      /** Chave do indicador → meta do ano. */
      metas: z.record(z.string(), z.number()),
      equivalencias: z.array(equivalenciaCadastrada),
    })
    .nullable(),
});
export type RespostaTelaDeParametros = z.infer<typeof respostaTelaDeParametros>;
