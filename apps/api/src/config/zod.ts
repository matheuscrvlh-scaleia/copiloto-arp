import { z } from "zod";
import { ptBR } from "zod/locales";

// Mensagens padrão do Zod em português, para o processo inteiro. Importado
// uma vez, pelo app.ts (API e testes). Schema com mensagem própria não muda.

z.config(ptBR());

/**
 * A mensagem é uma das padrões do Zod (em português ou, se alguém validar
 * antes de este arquivo carregar, em inglês)? Serve a quem troca a mensagem
 * padrão por um texto da tela.
 */
export const mensagemPadraoDoZod = (m: string): boolean =>
  /^(Invalid|Too|Expected|Unrecognized|Entrada inválida|Opção inválida|Grande demais|Pequeno demais|Texto inválido|Formato d|Número inválido|Chaves? inválidas?|Valor de discriminação)/.test(
    m,
  );
