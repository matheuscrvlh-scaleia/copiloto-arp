import { formatarData } from "@arp/shared/formato";
import type { PainelMontado } from "@arp/shared/os/contratos/paineis";
import { janelaDoPeriodo, momentoDoPainel } from "@arp/shared/os/indicadores";
import { hojeEmBrasilia, paraBrasilia } from "@arp/shared/os/tempo";
import { ateNoMaximo, descreverPeriodo, lerPeriodo } from "@arp/shared/periodo";
import type { Tx } from "@/infra/banco";
import {
  type Categoria,
  type ContextoOs,
  type Pessoa,
  parametros,
  type Setor,
} from "../base.service";
import {
  chamadosDoPainel,
  chamadosPorId,
  metas,
  setoresDasPessoas,
  setoresDasVistorias,
} from "../paineis.repository";
import { montarBase } from "./base";
import { type Ctx, type FiltrosPainel, Listas, linhaDe } from "./contexto";
import { blocosDoGeral } from "./geral";
import { inicioDaTendencia } from "./operacoes";
import { blocosDeVistorias, blocosDoPortal } from "./portal";
import { blocosDoSetor } from "./setores";

// Monta o painel (geral ou de um setor) de uma vez: lê, calcula e devolve
// os cartões, os blocos e as linhas dos chamados citados. A tela e o PDF
// usam o mesmo resultado.

export type Busca = Record<string, string | string[] | undefined>;

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Configuração lida uma vez por pedido (setores, catálogo, pessoas). */
export interface Cadastro {
  cx: ContextoOs;
  setores: Setor[];
  categorias: Categoria[];
  pessoas: Pessoa[];
}

/**
 * Lê os filtros sem confiar na URL: data no futuro vira hoje, categoria de
 * outro setor ou pessoa desconhecida viram "todas".
 */
export function lerFiltrosDoPainel(
  busca: Busca,
  setor: Setor | null,
  agora: Date,
  cad: Cadastro,
): FiltrosPainel {
  const hoje = hojeEmBrasilia(agora);
  const [a, m, d] = hoje.split("-").map(Number) as [number, number, number];
  // lerPeriodo usa a data local: entrega o "hoje" de Brasília.
  const periodo = ateNoMaximo(lerPeriodo(busca, new Date(a, m - 1, d)), hoje);
  const pedida = um(busca.categoria);
  const categoria =
    cad.categorias.find(
      (c) => c.id === pedida && (!setor || c.setor_id === setor.id),
    ) ?? null;
  const pessoa = um(busca.pessoa);
  return {
    periodo,
    rotulo: descreverPeriodo(periodo),
    hoje,
    setor,
    categoria,
    pessoa:
      pessoa !== undefined && cad.pessoas.some((p) => p.id === pessoa)
        ? pessoa
        : null,
  };
}

export async function montarPainel(
  tx: Tx,
  cad: Cadastro,
  f: FiltrosPainel,
  agora: Date,
): Promise<PainelMontado> {
  const desde =
    inicioDaTendencia(f.periodo.ate) < f.periodo.de
      ? inicioDaTendencia(f.periodo.ate)
      : f.periodo.de;
  const { cx: eu, setores: sets, categorias: cats, pessoas: gente } = cad;
  const p = await parametros(tx);
  const ms = await metas(tx);
  const todos = await chamadosDoPainel(tx, desde, f.periodo.ate);
  const membros = await setoresDasPessoas(tx, sets);
  const vistoriadores = await setoresDasVistorias(tx);

  const janela = janelaDoPeriodo(f.periodo.de, f.periodo.ate);
  const momento = momentoDoPainel(janela, agora);
  const nomeSetor = new Map(sets.map((s) => [s.id, s.nome]));
  const nomePessoa = new Map(gente.map((g) => [g.id, g.nome]));
  const porCategoria = new Map(cats.map((c) => [c.id, c]));
  // Filtro de categoria inclui as subcategorias dela.
  const doFiltro = f.categoria
    ? new Set([
        f.categoria.id,
        ...cats.filter((c) => c.pai_id === f.categoria?.id).map((c) => c.id),
      ])
    : null;
  const base = todos.filter(
    (c) =>
      (!f.setor || c.setor_id === f.setor.id) &&
      (!doFiltro ||
        (c.categoria_id !== null && doFiltro.has(c.categoria_id))) &&
      (!f.pessoa || c.responsavel_id === f.pessoa),
  );

  const ctx: Ctx = {
    tx,
    f,
    agora,
    janela,
    momento,
    quando:
      momento === agora
        ? "agora"
        : `em ${formatarData(paraBrasilia(new Date(momento.getTime() - 1)).data)}`,
    pode: eu.pode,
    meusSetores: eu.setores,
    parametros: p,
    metas: ms,
    setores: sets,
    categorias: cats,
    setorNome: (id) => (id ? (nomeSetor.get(id) ?? "Setor") : "Sem setor"),
    categoriaNome: (id) => {
      const c = id ? porCategoria.get(id) : undefined;
      if (!c) return "Sem categoria";
      const pai = c.pai_id ? porCategoria.get(c.pai_id) : undefined;
      return pai ? `${pai.nome} › ${c.nome}` : c.nome;
    },
    pessoaNome: (id, vazio = "—") =>
      id ? (nomePessoa.get(id) ?? "Pessoa sem acesso") : vazio,
    setoresDasPessoas: membros,
    todos,
    base,
    listas: new Listas(
      !!f.setor,
      f.setor ? `Painel de ${f.setor.nome}` : "Painel geral",
    ),
    desde,
    extras: [],
  };

  const { cartoes, blocos: daBase } = montarBase(ctx);
  // A mesma transação atende uma consulta por vez: os blocos leem em ordem.
  const proprios = f.setor
    ? await blocosDoSetor(ctx)
    : await blocosDoGeral(ctx);
  const portal = await blocosDoPortal(ctx);
  const vistorias = await blocosDeVistorias(ctx, vistoriadores);

  // Linhas: só os chamados citados em alguma lista (vão uma vez só).
  const conhecidos = new Map([...todos, ...ctx.extras].map((c) => [c.id, c]));
  const faltam = [...ctx.listas.usados].filter((id) => !conhecidos.has(id));
  for (const c of await chamadosPorId(tx, faltam)) conhecidos.set(c.id, c);
  const citados = [...ctx.listas.usados].flatMap(
    (id) => conhecidos.get(id) ?? [],
  );

  return {
    titulo: f.setor ? `Painel de ${f.setor.nome}` : "Painel geral",
    rotulo: f.rotulo,
    atualizadoAs: paraBrasilia(agora).hora,
    cartoes,
    blocos: [...daBase, ...proprios, ...portal, ...vistorias],
    linhas: citados.map((c) => linhaDe(c, ctx)),
    avisos: [],
  };
}
