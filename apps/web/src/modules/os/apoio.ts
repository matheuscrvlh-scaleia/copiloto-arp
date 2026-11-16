import type {
  CategoriaDoApoio,
  RespostaApoio,
  SetorDoApoio,
} from "@arp/shared/os/contratos/base";
import type { Filtros } from "@arp/shared/os/lista";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { consultaDoApoio } from "./api";

// O apoio das telas do Tickets (o `apoio()` do servidor antigo): setores,
// catálogo e pessoas do módulo, lidos uma vez (GET /os/apoio) e cruzados
// aqui. As regras são as mesmas de `@/server/os/visoes` do sistema antigo.

export interface Apoio extends RespostaApoio {
  setorPorId: Map<string, SetorDoApoio>;
  categoriaPorId: Map<string, CategoriaDoApoio>;
  /** Nome de quem usa o módulo, por id. */
  nomes: Map<string, string>;
}

/** Use dentro de <Suspense> (a rota já tem um). */
export function useApoio(): Apoio {
  const { data } = useSuspenseQuery(consultaDoApoio);
  return useMemo(
    () => ({
      ...data,
      setorPorId: new Map(data.setores.map((s) => [s.id, s])),
      categoriaPorId: new Map(data.categorias.map((c) => [c.id, c])),
      nomes: new Map(data.pessoas.map((p) => [p.id, p.nome])),
    }),
    [data],
  );
}

/** Setores a partir dos ids que a API devolve (na ordem dela). */
export function setoresPorId(a: Apoio, ids: string[]): SetorDoApoio[] {
  return ids.flatMap((id) => a.setorPorId.get(id) ?? []);
}

/** Pessoas de cada setor (para atribuir responsável em 1 clique). */
export function pessoasPorSetor(
  a: Apoio,
  setorIds: Iterable<string>,
): Record<string, { id: string; nome: string }[]> {
  const r: Record<string, { id: string; nome: string }[]> = {};
  for (const id of new Set(setorIds))
    r[id] = a.pessoas
      .filter((p) => p.setores.includes(id))
      .map((p) => ({ id: p.id, nome: p.nome }));
  return r;
}

/** Rótulos dos filtros (linha de filtros da tela e da exportação). */
export function nomesDosFiltros(f: Filtros, a: Apoio) {
  return {
    setor: f.setor ? (a.setorPorId.get(f.setor)?.nome ?? null) : null,
    setores: f.setores
      ?.split(",")
      .flatMap((id) => a.setorPorId.get(id)?.nome ?? []),
    categoria: f.categoria
      ? (a.categoriaPorId.get(f.categoria)?.nome ?? null)
      : null,
    responsavel: f.responsavel ? (a.nomes.get(f.responsavel) ?? null) : null,
  };
}

/** Opções de categoria do filtro: só as do setor escolhido (ou dos meus). */
export function opcoesDeCategoria(a: Apoio, setorIds: string[] | null) {
  return a.categorias
    .filter((c) => c.ativo && (!setorIds || setorIds.includes(c.setor_id)))
    .map((c) => ({
      valor: c.id,
      rotulo: c.nome,
      descricao: a.setorPorId.get(c.setor_id)?.nome,
    }));
}

/** "10:32" (Brasília): o "Atualizado às" do topo. */
export function horaDaVisita(agora: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(agora));
}
