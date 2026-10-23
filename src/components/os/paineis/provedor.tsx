"use client";

import { createContext, useContext, useMemo } from "react";
import {
  BarrasHorizontais,
  Colunas,
  ColunasEspelhadas,
  Faixas,
  type ItemGrafico,
  Rosca,
} from "@/components/dashboard/graficos";
import { CartaoIndicador } from "@/components/dashboard/indicador";
import {
  AbreDetalhe,
  type Detalhe,
  ProvedorDetalhe,
} from "@/components/modal-detalhe";
import { BotaoExportar } from "@/components/os/exportar";
import {
  type CartaoPainel,
  type Conteudo,
  detalheDaLista,
  ehLista,
  type ItemBloco,
  type LinhaChamado,
  type ListaChamados,
  type Origem,
  tabelaDaParte,
} from "./tipos";

// Lado do navegador dos painéis: guarda os chamados uma vez e transforma a
// lista de ids de cada número no modal de detalhe do sistema (ou no Excel).

const Linhas = createContext<Map<string, LinhaChamado>>(new Map());

export function ProvedorPainel({
  linhas,
  children,
}: {
  linhas: LinhaChamado[];
  children: React.ReactNode;
}) {
  const mapa = useMemo(() => new Map(linhas.map((l) => [l.id, l])), [linhas]);
  return (
    <Linhas.Provider value={mapa}>
      <ProvedorDetalhe>{children}</ProvedorDetalhe>
    </Linhas.Provider>
  );
}

function useDetalhe() {
  const linhas = useContext(Linhas);
  return (o?: Origem): Detalhe | undefined =>
    o ? (ehLista(o) ? detalheDaLista(o, linhas) : o) : undefined;
}

/** Qualquer bloco que abre a lista de quem forma o número. */
export function AbreLista({
  origem,
  className,
  children,
}: {
  origem?: Origem;
  className?: string;
  children: React.ReactNode;
}) {
  const detalhe = useDetalhe();
  return (
    <AbreDetalhe detalhe={detalhe(origem)} className={className}>
      {children}
    </AbreDetalhe>
  );
}

export function CartaoLista({ cartao }: { cartao: CartaoPainel }) {
  const detalhe = useDetalhe();
  const { origem, ...resto } = cartao;
  return <CartaoIndicador {...resto} origem={detalhe(origem)} />;
}

function paraGrafico(itens: ItemBloco[]): ItemGrafico[] {
  return itens.map(({ origem: _, cor: __, ...i }) => i);
}

/** Detalhe de cada item, montado uma vez (o gráfico redesenha no hover). */
function useDetalhes(itens: { chave: string; origem?: Origem }[]) {
  const linhas = useContext(Linhas);
  return useMemo(() => {
    const pares = itens.flatMap((i) => {
      if (!i.origem) return [];
      const d = ehLista(i.origem) ? detalheDaLista(i.origem, linhas) : i.origem;
      return [[i.chave, d] as const];
    });
    return pares.length ? Object.fromEntries(pares) : undefined;
  }, [itens, linhas]);
}

/** Gráfico do bloco, com o modal de cada barra, coluna ou fatia. */
export function GraficoDoBloco({
  conteudo,
  descricao,
  preencher = false,
}: {
  conteudo: Exclude<
    Conteudo,
    { tipo: "numeros" | "tabela" | "matriz" | "texto" }
  >;
  descricao: string;
  /** Ocupa a altura que sobra no cartão (pai em coluna flex). */
  preencher?: boolean;
}) {
  const detalhes = useDetalhes(conteudo.itens);
  switch (conteudo.tipo) {
    case "barras":
      return (
        <BarrasHorizontais
          itens={paraGrafico(conteudo.itens)}
          meta={conteudo.meta}
          vazio={conteudo.vazio}
          rotuloLargo={conteudo.rotuloLargo}
          descricao={descricao}
          detalhes={detalhes}
        />
      );
    case "colunas":
      return conteudo.itens.length ? (
        <Colunas
          itens={paraGrafico(conteudo.itens)}
          rotularTodas={conteudo.rotularTodas}
          descricao={descricao}
          detalhes={detalhes}
        />
      ) : (
        <p className="py-6 text-sm text-neutral-500">Sem dados no período.</p>
      );
    case "faixas":
      return (
        <Faixas
          itens={paraGrafico(conteudo.itens)}
          descricao={descricao}
          detalhes={detalhes}
          className={preencher ? "flex-1" : ""}
        />
      );
    case "rosca":
      return (
        <Rosca
          fatias={conteudo.itens.map((i, k) => ({
            chave: i.chave,
            rotulo: i.rotulo,
            valor: i.valor,
            texto: i.texto,
            cor: i.cor ?? (((k % 5) + 1) as 1 | 2 | 3 | 4 | 5),
          }))}
          centro={conteudo.centro}
          descricao={descricao}
          detalhes={detalhes}
        />
      );
    case "espelhadas":
      return (
        <ColunasEspelhadas
          itens={conteudo.itens.map(({ origem: _, ...i }) => i)}
          rotulos={conteudo.rotulos}
          descricao={descricao}
          detalhes={detalhes}
          preencher={preencher}
          barrasLargas
        />
      );
  }
}

/** Botão Excel com a lista do bloco (as mesmas colunas do modal). */
export function ExportarLista({
  lista,
  nomeArquivo,
  filtros,
}: {
  lista: ListaChamados;
  nomeArquivo: string;
  filtros: string;
}) {
  const linhas = useContext(Linhas);
  const partes = lista.partes.map((p) => ({
    titulo: p.titulo ?? lista.titulo,
    ...tabelaDaParte(p, linhas, lista.semSetor),
  }));
  const varias = partes.length > 1;
  const base = partes[0];
  if (!base) return null;
  // Partes com colunas extras diferentes: exporta a primeira tabela inteira
  // e as demais pelas colunas comuns, com o nome da parte na frente.
  const colunas = base.colunas;
  return (
    <BotaoExportar
      titulo={lista.titulo}
      filtros={filtros}
      nomeArquivo={nomeArquivo}
      colunas={[
        ...(varias ? [{ titulo: "Lista" }] : []),
        ...colunas.map((c) => ({ titulo: c, numero: base.numericas.has(c) })),
      ]}
      linhas={partes.flatMap((p) =>
        p.linhas.map((l) => [
          ...(varias ? [p.titulo] : []),
          ...colunas.map((_, k) => l.celulas[k] ?? null),
        ]),
      )}
    />
  );
}
