import { useQueryClient } from "@tanstack/react-query";
import { type ComponentProps, useEffect, useMemo } from "react";
import {
  Link as LinkDoRoteador,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams as useSearchParamsDoRoteador,
} from "react-router";

// Equivalentes do que as telas usavam do Next (next/link, next/navigation,
// metadata). Os componentes copiados do sistema antigo trocam só o import:
//
//   import Link from "next/link"                      → import { Link } from "@/lib/navegacao"
//   useRouter / usePathname / useSearchParams         → os mesmos nomes, daqui
//   useParams                                         → useParametros
//   redirect("/x")                                    → <Redirecionar para="/x" />
//   notFound()                                        → naoEncontrado()
//   export const metadata = { title: "X" }            → `titulo: "X"` na rota, ou useTitulo("X")
//
// Em código novo, prefira os nomes em português (useNavegar, useCaminho,
// useParametrosDeBusca): são as mesmas funções.

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

type PropsDoLink = Omit<
  ComponentProps<typeof LinkDoRoteador>,
  "to" | "prefetch"
> & {
  /** Destino, como no `next/link`. */
  href: string;
  /** false: não volta ao topo da página ao navegar. */
  scroll?: boolean;
  /** Aceito para o código antigo compilar; aqui não há pré-carga de rota. */
  prefetch?: boolean | null;
};

/** Endereços que não são tela: o navegador busca (arquivo, download da API). */
const foraDoApp = (href: string) => href.startsWith("/api/");

/**
 * Link interno sem recarregar a página (mesma interface do `next/link`:
 * `href`, `replace`, `scroll`). Endereço de outro site ou de arquivo da API
 * vira um link comum.
 */
export function Link({
  href,
  scroll,
  prefetch: _prefetch,
  ...resto
}: PropsDoLink) {
  return (
    <LinkDoRoteador
      to={href}
      preventScrollReset={scroll === false}
      reloadDocument={foraDoApp(href) || resto.reloadDocument}
      {...resto}
    />
  );
}

// ---------------------------------------------------------------------------
// Navegar
// ---------------------------------------------------------------------------

interface OpcoesDeNavegacao {
  /** false: mantém a posição da rolagem (filtros que só mudam a URL). */
  scroll?: boolean;
}

export interface Navegador {
  /** Vai para a tela (entra no histórico). */
  push(href: string, opcoes?: OpcoesDeNavegacao): void;
  /** Troca a tela atual (não entra no histórico). */
  replace(href: string, opcoes?: OpcoesDeNavegacao): void;
  back(): void;
  /**
   * Busca de novo os dados da tela. No Next recarregava os Server
   * Components; aqui invalida as consultas (as que estão na tela refazem o
   * pedido). Prefira invalidar só as chaves do que mudou.
   */
  refresh(): void;
}

/** Navegação por código (o `useRouter` do Next). */
export function useNavegar(): Navegador {
  const navegar = useNavigate();
  const consultas = useQueryClient();
  return useMemo(
    () => ({
      push: (href, opcoes) =>
        void navegar(href, { preventScrollReset: opcoes?.scroll === false }),
      replace: (href, opcoes) =>
        void navegar(href, {
          replace: true,
          preventScrollReset: opcoes?.scroll === false,
        }),
      back: () => void navegar(-1),
      refresh: () => void consultas.invalidateQueries(),
    }),
    [navegar, consultas],
  );
}

/** Caminho da tela atual, sem a busca ("/rh/jornada"). O `usePathname` do Next. */
export function useCaminho(): string {
  return useLocation().pathname;
}

/**
 * Parâmetros de busca da URL (`?periodo=mes`), só leitura. O
 * `useSearchParams` do Next; para mudar, navegue (`useNavegar().replace`).
 */
export function useParametrosDeBusca(): URLSearchParams {
  return useSearchParamsDoRoteador()[0];
}

/** Parâmetros do caminho (`:id`, `:token`). O `params` da página do Next. */
export function useParametros(): Readonly<Record<string, string | undefined>> {
  return useParams();
}

/**
 * Um parâmetro obrigatório do caminho. Sem ele a rota nem casaria; se faltar,
 * é "não encontrado".
 */
export function useParametro(nome: string): string {
  const valor = useParams()[nome];
  if (valor === undefined) naoEncontrado();
  return valor;
}

/**
 * A busca da URL no formato que as regras de filtro do sistema antigo
 * recebiam (`searchParams` da página): chave repetida vira lista.
 */
export function useBusca(): Record<string, string | string[] | undefined> {
  const params = useParametrosDeBusca();
  return useMemo(() => {
    const busca: Record<string, string | string[] | undefined> = {};
    for (const chave of new Set(params.keys())) {
      const valores = params.getAll(chave);
      busca[chave] = valores.length > 1 ? valores : valores[0];
    }
    return busca;
  }, [params]);
}

/**
 * Onde as telas filhas entram num layout (o `{children}` do `layout.tsx`).
 */
export const Filhas = Outlet;

// Os nomes do Next, para o código copiado compilar trocando só o import.
export {
  useCaminho as usePathname,
  useNavegar as useRouter,
  useParametrosDeBusca as useSearchParams,
};

// ---------------------------------------------------------------------------
// Redirecionar e não encontrado
// ---------------------------------------------------------------------------

/** Leva para outra tela ao renderizar (o `redirect()` do Next). */
export function Redirecionar({
  para,
  manterHistorico = false,
}: {
  para: string;
  /** true: a tela atual continua no botão Voltar. */
  manterHistorico?: boolean;
}) {
  return <Navigate to={para} replace={!manterHistorico} />;
}

/** Lançado por naoEncontrado(); a rota mostra a tela de "não encontrada". */
export class ErroDeNaoEncontrado extends Error {
  constructor() {
    super("Página não encontrada");
    this.name = "ErroDeNaoEncontrado";
  }
}

/** Interrompe a tela com "página não encontrada" (o `notFound()` do Next). */
export function naoEncontrado(): never {
  throw new ErroDeNaoEncontrado();
}

// ---------------------------------------------------------------------------
// Título da aba
// ---------------------------------------------------------------------------

export const NOME_DO_SISTEMA = "ARP Centralizador";

/**
 * "Jornada · ARP Centralizador" (o `metadata.title` do Next). null volta ao
 * nome do sistema; undefined não mexe (layout sem título próprio).
 */
export function useTitulo(titulo: string | null | undefined): void {
  useEffect(() => {
    if (titulo === undefined) return;
    document.title = titulo
      ? `${titulo} · ${NOME_DO_SISTEMA}`
      : NOME_DO_SISTEMA;
  }, [titulo]);
}
