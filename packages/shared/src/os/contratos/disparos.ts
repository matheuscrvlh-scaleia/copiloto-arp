import { z } from "zod";
import { statusChamado, tipoChamado } from "./base";

// Contratos de Operações › Disparos e lembretes (prefixo /api/v1/os). O
// cadastro dos modelos fica em Configurações › Modelos e lembretes.
//
//   GET  /os/disparos            → RespostaDisparos
//   POST /os/disparos            EntradaDisparo → { mensagem }
//   POST /os/series/:id/parar    EntradaPararSerie → { mensagem }

export const disparoFeito = z.object({
  id: z.string(),
  em: z.string(),
  automatico: z.boolean(),
  modelo: z.string(),
  loja: z.object({
    id: z.string(),
    nome: z.string(),
    luc: z.string(),
    situacao: z.string(),
  }),
  chamado: z
    .object({ id: z.string(), numero: z.number(), status: statusChamado })
    .nullable(),
  /** null: quem vê a tela não vê o Aviso (RLS). */
  destinos: z
    .array(
      z.object({
        setor_id: z.string().nullable(),
        titulo: z.string().nullable(),
        status: z.string(),
      }),
    )
    .nullable(),
});
export type DisparoFeito = z.infer<typeof disparoFeito>;

export const serie = z.object({
  serieId: z.string(),
  ultimaId: z.string(),
  numero: z.number(),
  titulo: z.string(),
  tipo: tipoChamado,
  setor_id: z.string(),
  responsavel_id: z.string().nullable(),
  recorrencia: z.unknown(),
  ultimaData: z.string(),
  ocorrencias: z.number(),
});
export type Serie = z.infer<typeof serie>;

export const respostaDisparos = z.object({
  /** Modelos (com a quantidade de itens) para o "Disparar modelo". */
  modelos: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      ativo: z.boolean(),
      itens: z.number(),
    }),
  ),
  /** Lojas para o botão "Disparar modelo" (vigentes primeiro). */
  lojas: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      luc: z.string(),
      situacao: z.string(),
      inicio: z.string().nullable(),
      fim: z.string().nullable(),
    }),
  ),
  disparos: z.array(disparoFeito),
  series: z.array(serie),
});
export type RespostaDisparos = z.infer<typeof respostaDisparos>;

export const entradaDisparo = z.object({
  modelo_id: z.uuid("Modelo: escolha o modelo"),
  loja_id: z.uuid("Loja: escolha a loja (contrato)"),
});
export type EntradaDisparo = z.infer<typeof entradaDisparo>;

export const idDaSerie = z.object({ id: z.uuid("Série inválida.") });
export const entradaPararSerie = z.object({
  ultima_id: z.uuid("Série inválida."),
});
export type EntradaPararSerie = z.infer<typeof entradaPararSerie>;
