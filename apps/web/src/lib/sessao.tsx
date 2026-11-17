import {
  type PrazosDaSessao,
  type RespostaEu,
  respostaEu,
  respostaMensagem,
} from "@arp/shared/contratos/auth";
import {
  ehPermissaoDePrograma,
  PERMISSOES,
  type Permissao,
  type PermissaoDePrograma,
} from "@arp/shared/permissions";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, use, useMemo } from "react";
import { Outlet, useLocation } from "react-router";
import { api, ErroDaApi, enderecoDoLogin } from "./api";
import { clienteDeConsultas, VALIDADE } from "./consulta";
import { Redirecionar } from "./navegacao";

// Quem está logado. A tela nunca vê token: os cookies são HttpOnly e vão
// sozinhos. Aqui só se pergunta à API "quem sou eu" (GET /auth/eu) e se
// guarda a resposta no TanStack Query. A permissão na tela só esconde o que
// a pessoa não pode usar; quem garante é a API.

export const ROTA_DO_LOGIN = "/login";
export const ROTA_TROCAR_SENHA = "/trocar-senha";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  permissoes: Permissao[];
  /** "Programa – lançar" (Sustentabilidade): uma permissão por programa,
   * fora do catálogo fixo (sustentabilidade.programa.<id>). */
  programas: PermissaoDePrograma[];
}

export interface Sessao {
  usuario: Usuario;
  /** true: só pode trocar a senha e sair. */
  senhaProvisoria: boolean;
  prazos: PrazosDaSessao;
  /** A pessoa tem a permissão (ou alguma delas, numa lista)? */
  pode(
    permissao:
      | Permissao
      | PermissaoDePrograma
      | readonly (Permissao | PermissaoDePrograma)[],
  ): boolean;
}

const ehPermissao = (p: string): p is Permissao => p in PERMISSOES;

/** Resposta da API → sessão da tela (só as permissões que o sistema conhece). */
export function montarSessao(eu: RespostaEu): Sessao {
  const permissoes = eu.usuario.permissoes.filter(ehPermissao);
  const programas = eu.usuario.permissoes.filter(ehPermissaoDePrograma);
  const tem = new Set<string>([...permissoes, ...programas]);
  return {
    usuario: { ...eu.usuario, permissoes, programas },
    senhaProvisoria: eu.senha_provisoria,
    prazos: eu.sessao,
    pode: (permissao) =>
      typeof permissao === "string"
        ? tem.has(permissao)
        : permissao.some((p) => tem.has(p)),
  };
}

/** Chave da consulta da sessão. */
export const CHAVE_DA_SESSAO = ["sessao"] as const;

/**
 * Quem está logado, ou null sem sessão. Um 401 aqui já passou pela tentativa
 * de renovar (lib/api.ts); não leva ao login sozinho: quem decide é a guarda
 * da rota (a tela de login também faz esta pergunta).
 */
export const consultaDaSessao = queryOptions({
  queryKey: CHAVE_DA_SESSAO,
  queryFn: async ({ signal }): Promise<RespostaEu | null> => {
    try {
      return await api.get("/auth/eu", {
        esquema: respostaEu,
        sinal: signal,
        irParaOLogin: false,
      });
    } catch (erro) {
      if (erro instanceof ErroDaApi && erro.codigo === "nao_autenticado")
        return null;
      throw erro;
    }
  },
  staleTime: VALIDADE.sessao,
  // Permissão tirada pelo administrador some da tela ao voltar para a aba.
  refetchOnWindowFocus: true,
});

/** Guarda a resposta de entrar (ou esquece a sessão, com null). */
export function definirSessao(eu: RespostaEu | null): void {
  clienteDeConsultas.setQueryData(CHAVE_DA_SESSAO, eu);
}

/** Pergunta de novo quem está logado (depois de trocar a senha, por exemplo). */
export function atualizarSessao(): Promise<void> {
  return clienteDeConsultas.invalidateQueries({ queryKey: CHAVE_DA_SESSAO });
}

/**
 * Sai do sistema: encerra a sessão na API e recarrega no login, o que tira
 * da memória tudo o que estava na tela.
 */
export async function sair(motivo?: "expirou"): Promise<void> {
  await api
    .post("/auth/sair", undefined, {
      esquema: respostaMensagem,
      renovar: false,
    })
    .catch(() => undefined);
  clienteDeConsultas.clear();
  window.location.assign(
    motivo ? enderecoDoLogin(window.location, motivo) : ROTA_DO_LOGIN,
  );
}

// ---------------------------------------------------------------------------
// Contexto: dentro das rotas autenticadas a sessão sempre existe.
// ---------------------------------------------------------------------------

const ContextoDaSessao = createContext<Sessao | null>(null);

/** Entrega a sessão às telas (a guarda faz isso; nos testes, use direto). */
export function ProvedorDaSessao({
  eu,
  children,
}: {
  eu: RespostaEu;
  children: ReactNode;
}) {
  const sessao = useMemo(() => montarSessao(eu), [eu]);
  return <ContextoDaSessao value={sessao}>{children}</ContextoDaSessao>;
}

/** Sessão de quem está logado. Só dentro das rotas autenticadas. */
export function useSessao(): Sessao {
  const sessao = use(ContextoDaSessao);
  if (!sessao)
    throw new Error("useSessao fora de uma rota autenticada (ExigeSessao)");
  return sessao;
}

/** Sessão, ou null em tela pública (portal, links por token). */
export function useSessaoOpcional(): Sessao | null {
  return use(ContextoDaSessao);
}

/**
 * A pessoa tem a permissão? Com lista, basta uma. É o `pode()` do sistema
 * antigo. Só esconde o que não pode ser usado: a API confere de novo.
 */
export function usePermissao(
  permissao:
    | Permissao
    | PermissaoDePrograma
    | readonly (Permissao | PermissaoDePrograma)[],
): boolean {
  return useSessao().pode(permissao);
}

// ---------------------------------------------------------------------------
// Guardas de rota
// ---------------------------------------------------------------------------

/**
 * Guarda das rotas autenticadas:
 * - sem sessão → /login?destino=<tela pedida>;
 * - senha provisória → só /trocar-senha;
 * - com a senha definida, /trocar-senha volta ao início.
 * `carregando` aparece enquanto a API responde quem está logado.
 */
export function ExigeSessao({
  inicio,
  carregando = null,
  children,
}: {
  /** Primeira tela de quem está logado (config/navigation: INICIO). */
  inicio: string;
  carregando?: ReactNode;
  /** Padrão: as rotas filhas (<Outlet />). */
  children?: ReactNode;
}) {
  const local = useLocation();
  const { data: eu, isPending, error } = useQuery(consultaDaSessao);

  if (isPending) return carregando;
  // Falha que não é "sem sessão" (API fora do ar): o limite de erro da rota
  // mostra o aviso com o botão de tentar de novo.
  if (error) throw error;
  if (!eu) return <Redirecionar para={enderecoDoLogin(local)} />;

  const trocando = local.pathname === ROTA_TROCAR_SENHA;
  if (eu.senha_provisoria !== trocando)
    return <Redirecionar para={trocando ? inicio : ROTA_TROCAR_SENHA} />;

  return <ProvedorDaSessao eu={eu}>{children ?? <Outlet />}</ProvedorDaSessao>;
}

/**
 * Guarda das telas de quem ainda não entrou (login): quem já está logado
 * vai direto para o início.
 */
export function SoSemSessao({
  inicio,
  children,
}: {
  inicio: string;
  children: ReactNode;
}) {
  const { data: eu } = useQuery(consultaDaSessao);
  if (eu)
    return (
      <Redirecionar para={eu.senha_provisoria ? ROTA_TROCAR_SENHA : inicio} />
    );
  // Enquanto a API responde (ou se ela falhar), a tela de entrar já aparece.
  return children;
}
