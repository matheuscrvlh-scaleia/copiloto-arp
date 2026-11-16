import { QueryClient } from "@tanstack/react-query";
import { ErroDaApi } from "./api";

/**
 * Por quanto tempo um dado lido vale sem pedir de novo. Toda gravação
 * invalida as chaves do que mudou (lib/acao.ts, useMutation); o tempo é só a
 * rede de segurança, como eram os perfis de cache do sistema antigo.
 */
export const VALIDADE = {
  /** Dado de negócio (listas, painéis, indicadores). É o padrão. */
  negocio: 30_000,
  /** Configuração dos módulos: setores, catálogo, parâmetros, empresa. */
  configuracao: 5 * 60_000,
  /** Perfil e permissões de quem está logado. */
  sessao: 60_000,
} as const;

/** Erro que não adianta repetir: a API respondeu e disse não. */
function definitivo(erro: unknown): boolean {
  return erro instanceof ErroDaApi && erro.status >= 400 && erro.status < 500;
}

export function criarClienteDeConsultas(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: VALIDADE.negocio,
        gcTime: 5 * 60_000,
        // Uma nova tentativa só para falha de rede ou erro 5xx.
        retry: (falhas, erro) => !definitivo(erro) && falhas < 1,
        // Nada de buscar tudo de novo a cada troca de aba ou de janela:
        // quem precisa (sino, sessão) liga na própria consulta.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: { retry: false },
    },
  });
}

/**
 * O cliente do app. Fica num módulo para as ações (lib/acao.ts) invalidarem
 * consultas sem depender de hook, como as Server Actions faziam com as tags.
 */
export const clienteDeConsultas = criarClienteDeConsultas();
