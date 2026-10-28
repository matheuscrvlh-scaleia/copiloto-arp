"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// Modal padrão do sistema para "quem forma este número": abre ao clicar num
// gráfico ou indicador. Usa <dialog> (Esc fecha, foco preso dentro, fundo
// inerte). Tudo o que ele mostra vem do servidor, já filtrado pelas
// permissões de quem está vendo: pronto com a página ou, nas listas grandes,
// pedido ao servidor (carregarTabelas). Esse pedido começa quando o mouse
// para sobre o que abre o modal (ou o foco chega nele) e fica guardado:
// abrir e reabrir não esperam de novo.

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
// Tabelas pedidas ao servidor: uma vez por detalhe, guardadas no navegador.
// ---------------------------------------------------------------------------

type Carregar = NonNullable<Detalhe["carregarTabelas"]>;

/** Pedido das tabelas de um detalhe: em andamento, pronto ou com erro. */
export interface PedidoDeTabelas {
  promessa: Promise<TabelaDetalhe[]>;
  lista?: TabelaDetalhe[];
  erro?: boolean;
}

// Pela função de carga (a Server Action com os argumentos já presos): a
// mesma da página enquanto ela não for recarregada. Some com a página.
const pedidos = new WeakMap<Carregar, PedidoDeTabelas>();

/** O pedido já feito para o detalhe, sem começar nenhum. */
export function pedidoDe(d: Detalhe | null): PedidoDeTabelas | undefined {
  return d?.carregarTabelas ? pedidos.get(d.carregarTabelas) : undefined;
}

/**
 * Começa o pedido das tabelas do detalhe, ou devolve o que já existe. Um
 * pedido que falhou é refeito (fechar e abrir de novo tenta outra vez).
 */
export function pedirTabelas(d: Detalhe): PedidoDeTabelas | undefined {
  const carregar = d.carregarTabelas;
  if (!carregar) return undefined;
  const feito = pedidos.get(carregar);
  if (feito && !feito.erro) return feito;
  const pedido: PedidoDeTabelas = {
    promessa: carregar().then(
      (lista) => {
        pedido.lista = lista;
        return lista;
      },
      (erro: unknown) => {
        pedido.erro = true;
        throw erro;
      },
    ),
  };
  // Quem espera (o modal) trata o erro; a pré-carga sozinha não avisa nada.
  pedido.promessa.catch(() => undefined);
  pedidos.set(carregar, pedido);
  return pedido;
}

/**
 * Pré-carga do detalhe que o mouse ou o foco tocou: começa a buscar as
 * tabelas (e baixa a janela) antes do clique. Sem carregarTabelas, só a
 * janela. Nunca em lote: só quem a pessoa está prestes a abrir.
 */
export function preCarregarDetalhe(d: Detalhe | undefined): void {
  if (!d) return;
  void carregarJanela();
  pedirTabelas(d);
}

/** Espera do mouse parado antes da pré-carga: passar por cima não pede. */
export const ESPERA_PRE_CARGA_MS = 100;

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

export function ProvedorDetalhe({
  exportar = false,
  children,
}: {
  /** Botões Excel e PDF no modal (quem tem a permissão de exportar). */
  exportar?: boolean;
  children: React.ReactNode;
}) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [usado, setUsado] = useState(false);
  const abrir = useCallback((d: Detalhe) => {
    // Se a pré-carga não pediu (toque direto, Enter), pede agora.
    pedirTabelas(d);
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
      {usado && (
        <Janela
          detalhe={detalhe}
          exportar={exportar}
          aoFechar={() => setDetalhe(null)}
        />
      )}
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
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(espera.current), []);
  if (!detalhe || !abrir) return <div className={className}>{children}</div>;
  return (
    <button
      type="button"
      onClick={() => abrir(detalhe)}
      // Pré-carga: mouse parado em cima, dedo encostado ou foco do teclado.
      onPointerEnter={() => {
        clearTimeout(espera.current);
        espera.current = setTimeout(
          () => preCarregarDetalhe(detalhe),
          ESPERA_PRE_CARGA_MS,
        );
      }}
      onPointerLeave={() => clearTimeout(espera.current)}
      onPointerDown={() => preCarregarDetalhe(detalhe)}
      onFocus={() => preCarregarDetalhe(detalhe)}
      aria-haspopup="dialog"
      className={`group/detalhe cursor-pointer text-left transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca ${className}`}
    >
      {children}
    </button>
  );
}
