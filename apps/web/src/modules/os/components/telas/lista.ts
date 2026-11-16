import {
  type Busca,
  lerBusca,
  lerCartao,
  lerFiltros,
  lerOrdem,
  modoDaLista,
  type Tela,
  type TelaComLista,
} from "@arp/shared/os/lista";
import { lerMais } from "@arp/shared/os/quadro";
import { PARAM_PAINEL } from "@arp/shared/os/rotas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo } from "react";
import { useBusca } from "@/lib/navegacao";
import { consultaDaLista, consultaDoQuadro } from "@/modules/os/api";
import { setoresPorId, useApoio } from "@/modules/os/apoio";

// O estado das visões (o `estadoDaLista` e o `estadoDoQuadro` do servidor
// antigo): a API lê os filtros da URL (ou os lembrados), consulta e devolve
// a página; o que é só leitura da URL (cartão, ordem, busca, modo) a tela
// relê com as mesmas regras puras de @arp/shared/os/lista.

/**
 * Parâmetros da URL sem a janela lateral (?c=): abrir o detalhe não busca a
 * lista de novo. Adiado: a lista antiga fica até a nova chegar.
 */
export function useBuscaDaTela(): Busca {
  const busca = useBusca();
  const semPainel = useMemo(() => {
    const { [PARAM_PAINEL]: _painel, ...resto } = busca;
    return resto;
  }, [busca]);
  return useDeferredValue(semPainel);
}

const TELA_DOS_FILTROS: Record<TelaComLista, Tela> = {
  caixa: "caixa",
  setor: "setor",
  avisos: "avisos",
  os_caixa: "os_caixa",
  os_setor: "os_setor",
};

/** Minha caixa, Geral e Avisos (e as mesmas telas das OS). */
export function useLista(tela: TelaComLista) {
  const busca = useBuscaDaTela();
  const a = useApoio();
  const { data } = useSuspenseQuery(consultaDaLista(tela, busca));
  return useMemo(() => {
    const filtros = lerFiltros(TELA_DOS_FILTROS[tela], data.filtros);
    const ordem = lerOrdem(busca.ordem);
    return {
      a,
      /** A lista em vigor ("abertos" e "avisos_mandados" vêm de um filtro). */
      tela: data.tela,
      filtros,
      lembrados: data.lembrados,
      cartao: lerCartao(data.tela, busca.cartao),
      q: lerBusca(busca.q),
      ordem,
      modo: modoDaLista(data.tela, filtros.agrupar, ordem),
      /** Geral: setores que a pessoa pode escolher e os em vigor. */
      disponiveis: setoresPorId(a, data.disponiveis),
      setores: data.setores,
      pagina: { linhas: data.linhas, total: data.total, pagina: data.pagina },
      cartoes: data.cartoes,
      carga: data.carga,
      agora: data.agora,
    };
  }, [a, data, busca, tela]);
}

/** Quadro dos chamados e das OS. */
export function useQuadro(ordens: boolean) {
  const busca = useBuscaDaTela();
  const a = useApoio();
  const { data } = useSuspenseQuery(consultaDoQuadro(busca, ordens));
  return useMemo(() => {
    const tela: Tela = ordens ? "os_quadro" : "quadro";
    return {
      a,
      filtros: lerFiltros(tela, data.filtros),
      /** Filtros em vigor (recorte permitido, setor só onde cabe). */
      valores: lerFiltros(tela, data.valores),
      lembrados: data.lembrados,
      permitidos: data.permitidos,
      comSetor: data.comSetor,
      setores: setoresPorId(a, data.setores),
      colunas: data.colunas,
      mais: lerMais(busca.mais),
      agora: data.agora,
    };
  }, [a, data, busca, ordens]);
}
