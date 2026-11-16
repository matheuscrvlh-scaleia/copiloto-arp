import type { Permissao } from "@arp/shared/permissions";
import { type ComponentType, type ReactNode, Suspense } from "react";
import type { RouteObject } from "react-router";
import { Carregando } from "@/components/carregando";
import { LimiteDeErro } from "@/components/limite-de-erro";
import { SemAcesso } from "@/components/protegido";
import { useCaminho, useTitulo } from "@/lib/navegacao";
import { useSessaoOpcional } from "@/lib/sessao";

// Como um módulo declara as suas telas (modules/<modulo>/rotas.tsx). O
// roteador (app/roteador.tsx) junta as de todos os módulos de app/modulos.ts.

/** Uma tela (ou um layout com telas dentro). */
export interface Rota {
  /**
   * Endereço sem a barra inicial, igual ao do sistema antigo, na sintaxe do
   * React Router: "rh/jornada", "os/chamados/:id", "portal/*". Em rota
   * filha, é relativo à mãe. Não se usa com `indice`.
   */
  caminho?: string;
  /** true: é a tela do endereço da própria rota mãe (o `page.tsx` da pasta do `layout.tsx`). */
  indice?: boolean;
  /** Título da aba do navegador (o `metadata.title` do Next). */
  titulo?: string;
  /**
   * Quem pode abrir (com lista, basta uma). Sem a permissão, aparece o
   * aviso de tela sem acesso. Só esconde a tela: a API confere de novo.
   * Não vale em rota pública.
   */
  permissao?: Permissao | readonly Permissao[];
  /**
   * O arquivo da tela, pedido só quando ela abre:
   * `pagina: () => import("./paginas/jornada")` (export default). Num
   * layout, o componente desenha `<Filhas />` onde as telas entram.
   */
  pagina?: () => Promise<{ default: ComponentType }>;
  /** Esqueleto enquanto os dados chegam (o `loading.tsx`/fallback do Suspense). */
  carregando?: ReactNode;
  /** Telas dentro deste layout. */
  filhas?: Rota[];
}

/** As telas de um módulo. */
export interface Modulo {
  /** Nome da pasta em src/modules. */
  nome: string;
  /** Telas com a casca (menu e barra) e sessão obrigatória. */
  autenticadas?: Rota[];
  /** Telas sem casca e sem sessão (portal, links por token). */
  publicas?: Rota[];
}

/**
 * O que toda tela ganha: título da aba, permissão, esqueleto de carregamento
 * e limite de erro com "Tentar de novo".
 */
function Tela({
  rota,
  publica,
  children,
}: {
  rota: Rota;
  publica: boolean;
  children: ReactNode;
}) {
  useTitulo(rota.titulo);
  const caminho = useCaminho();
  const sessao = useSessaoOpcional();
  if (!publica && rota.permissao && !sessao?.pode(rota.permissao))
    return <SemAcesso />;
  return (
    <LimiteDeErro chave={caminho}>
      <Suspense fallback={rota.carregando ?? <Carregando />}>
        {children}
      </Suspense>
    </LimiteDeErro>
  );
}

/** Rota do módulo → rota do React Router (com o arquivo carregado sob demanda). */
export function paraRotaDoRoteador(rota: Rota, publica: boolean): RouteObject {
  const { pagina } = rota;
  const lazy = pagina
    ? async () => {
        const { default: Pagina } = await pagina();
        function Component() {
          return (
            <Tela rota={rota} publica={publica}>
              <Pagina />
            </Tela>
          );
        }
        return { Component };
      }
    : undefined;
  if (rota.indice) return { index: true, lazy };
  return {
    path: rota.caminho,
    lazy,
    children: rota.filhas?.map((f) => paraRotaDoRoteador(f, publica)),
  };
}
