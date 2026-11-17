import { z } from "zod";
import type { Descoberta } from "../../integracoes";
import { FORMAS_ACESSO, type FormaAcesso } from "../parametros";

// Contrato das gravações de Marketing › Configurações (marketing.parametros)
// e das listas do Google no cartão de Integrações. As gravações recebem o
// formulário como a tela manda (texto ou lista de textos): quem valida é o
// service, com as mesmas regras e mensagens do sistema antigo ("Nome:
// informe o nome").
//
//   POST   /api/v1/marketing/configuracoes/locatarios           formulário → mensagem
//   DELETE /api/v1/marketing/configuracoes/locatarios/:id       → mensagem
//   POST   /api/v1/marketing/configuracoes/locatarios/carga     multipart (arquivo) → RespostaPreviaCarga
//   POST   /api/v1/marketing/configuracoes/locatarios/carga/confirmacao  formulário → mensagem
//   POST   /api/v1/marketing/configuracoes/landing-pages        formulário → mensagem
//   POST   /api/v1/marketing/configuracoes/metas                formulário → mensagem
//   PATCH  /api/v1/marketing/configuracoes/metas/:id            formulário → mensagem
//   DELETE /api/v1/marketing/configuracoes/metas/:id            → mensagem
//   PATCH  /api/v1/marketing/configuracoes/regras               formulário → mensagem
//   PATCH  /api/v1/marketing/configuracoes/reputacao            formulário → mensagem
//   PATCH  /api/v1/marketing/configuracoes/asana                formulário → mensagem
//   POST   /api/v1/marketing/configuracoes/temas                formulário → mensagem
//   POST   /api/v1/marketing/configuracoes/codigos-ronda        formulário → mensagem
//   DELETE /api/v1/marketing/configuracoes/codigos-ronda/:codigo → mensagem
//   PATCH  /api/v1/marketing/configuracoes/visualizacao         formulário → mensagem
//   PATCH  /api/v1/marketing/configuracoes/termos-marca         formulário → mensagem
//   POST   /api/v1/marketing/configuracoes/referencias          formulário → mensagem
//   DELETE /api/v1/marketing/configuracoes/referencias/:id      → mensagem
//   POST   /api/v1/marketing/historico/:id/volta                → mensagem
//   GET    /api/v1/marketing/integracoes/:sistema/descobertas   → RespostaDescobertas

/** Formulário como a tela manda (campo repetido vira lista). */
export const formulario = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]),
);
export type Formulario = z.infer<typeof formulario>;

const formaAcesso = z.enum(
  Object.keys(FORMAS_ACESSO) as [FormaAcesso, ...FormaAcesso[]],
);

export const linhaDaCarga = z.object({
  linha: z.number(),
  nome: z.string(),
  categoria: z.string(),
  perfil_url: z.string().nullable(),
  forma_acesso: formaAcesso,
  entrada_em: z.string().nullable(),
  problemas: z.array(z.string()),
  avisos: z.array(z.string()),
});

/** Prévia da planilha de locatários (nada gravado ainda). */
export const respostaPreviaCarga = z.object({
  previa: z.object({
    colunas: z.object({
      nome: z.string().nullable(),
      categoria: z.string().nullable(),
      perfil_url: z.string().nullable(),
      forma_acesso: z.string().nullable(),
      entrada_em: z.string().nullable(),
    }),
    faltando: z.array(z.string()),
    linhas: z.array(linhaDaCarga),
    arquivo: z.string(),
  }),
});
export type RespostaPreviaCarga = z.infer<typeof respostaPreviaCarga>;

export const descoberta: z.ZodType<Descoberta> = z.object({
  opcoes: z.array(z.object({ valor: z.string(), rotulo: z.string() })),
  erro: z.string().optional(),
});

/** null: sem permissão, sem credencial ou antes de conectar. */
export const respostaDescobertas = z.object({
  descobertas: z.record(z.string(), descoberta).nullable(),
});
