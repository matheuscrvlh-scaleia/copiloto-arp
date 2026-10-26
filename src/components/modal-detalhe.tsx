"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// Modal padrão do sistema para "quem forma este número": abre ao clicar num
// gráfico ou indicador. Usa <dialog> (Esc fecha, foco preso dentro, fundo
// inerte). Tudo o que ele mostra vem do servidor, já filtrado pelas
// permissões de quem está vendo: pronto com a página ou, nas listas grandes,
// pedido ao abrir (carregarTabelas).

export interface ColunaDetalhe {
  titulo: string;
  /** Alinha à direita e ordena pelo valor numérico. */
  numero?: boolean;
  /** Coluna com o nome da pessoa (ganha as iniciais ao lado). */
  pessoa?: boolean;
}

export interface LinhaDetalhe {
  chave: string;
  celulas: string[];
  /** Valores para ordenar, coluna a coluna (ex.: minutos em vez de "1h30"). */
  ordem?: (number | string | null)[];
}

export interface TabelaDetalhe {
  titulo?: string;
  colunas: ColunaDetalhe[];
  linhas: LinhaDetalhe[];
  vazio?: string;
}

export interface Detalhe {
  /** Texto pequeno acima do título (ex.: "Banco de horas"). */
  secao?: string;
  titulo: string;
  subtitulo?: string;
  resumo?: { rotulo: string; valor: string }[];
  /** De onde vem o número: fonte, fórmula, atualização, parâmetros usados. */
  fontes?: { rotulo: string; valor: string }[];
  tabelas: TabelaDetalhe[];
  /**
   * Tabelas grandes pedidas só ao abrir (uma Server Action, ex.: com
   * .bind(null, mes)), para não irem todas no HTML da página. Com ela,
   * `tabelas` fica vazia.
   */
  carregarTabelas?: () => Promise<TabelaDetalhe[]>;
  link?: { href: string; rotulo: string };
}

// ---------------------------------------------------------------------------
// Um modal por página: os gráficos só pedem para abrir.
// ---------------------------------------------------------------------------

const Contexto = createContext<((d: Detalhe) => void) | null>(null);

/** Função para abrir o modal; null fora do <ProvedorDetalhe>. */
export function useAbrirDetalhe() {
  return useContext(Contexto);
}

// A janela (tabelas, busca, ordenação) só é baixada depois que a página
// carrega, sem atrasar a primeira pintura, e só entra na tela ao abrir.
const carregarJanela = () => import("./modal-detalhe-janela");
const Janela = dynamic(() => carregarJanela().then((m) => m.ModalDetalhe), {
  ssr: false,
});

export function ProvedorDetalhe({ children }: { children: React.ReactNode }) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [usado, setUsado] = useState(false);
  const abrir = useCallback((d: Detalhe) => {
    setUsado(true);
    setDetalhe(d);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void carregarJanela(), 1500);
    return () => clearTimeout(id);
  }, []);

  return (
    <Contexto.Provider value={abrir}>
      {children}
      {usado && <Janela detalhe={detalhe} aoFechar={() => setDetalhe(null)} />}
    </Contexto.Provider>
  );
}

/**
 * Envolve qualquer bloco (ex.: um cartão de indicador) para abrir o modal
 * ao clicar. Sem permissão (detalhe ausente), vira um bloco comum.
 */
export function AbreDetalhe({
  detalhe,
  className = "",
  children,
}: {
  detalhe?: Detalhe;
  className?: string;
  children: React.ReactNode;
}) {
  const abrir = useAbrirDetalhe();
  if (!detalhe || !abrir) return <div className={className}>{children}</div>;
  return (
    <button
      type="button"
      onClick={() => abrir(detalhe)}
      aria-haspopup="dialog"
      className={`group/detalhe cursor-pointer text-left transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca ${className}`}
    >
      {children}
    </button>
  );
}
