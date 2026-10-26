import "server-only";
import type { PainelMontado } from "@/components/os/paineis/tipos";
import { formatarData } from "@/lib/formato";
import { janelaDoPeriodo, momentoDoPainel } from "@/lib/os/indicadores";
import { paraBrasilia } from "@/lib/os/tempo";
import {
  categorias,
  contexto,
  parametros,
  pessoas,
  setores,
} from "@/server/os/base";
import { montarBase } from "./base";
import {
  chamadosDoPainel,
  chamadosPorId,
  type FiltrosPainel,
  metas,
  setoresDasPessoas,
  setoresDasVistorias,
} from "./consultas";
import { type Ctx, Listas, linhaDe } from "./contexto";
import { blocosDoGeral } from "./geral";
import { inicioDaTendencia } from "./operacoes";
import { blocosDeVistorias, blocosDoPortal } from "./portal";
import { blocosDoSetor } from "./setores";

// Monta o painel (geral ou de um setor) de uma vez: lê, calcula e devolve
// os cartões, os blocos e as linhas dos chamados citados. A tela e o PDF
// usam o mesmo resultado.

export async function montarPainel(
  f: FiltrosPainel,
  agora: Date,
): Promise<PainelMontado> {
  const desde =
    inicioDaTendencia(f.periodo.ate) < f.periodo.de
      ? inicioDaTendencia(f.periodo.ate)
      : f.periodo.de;
  // Uma rodada só: a configuração (do cache) e as leituras do período.
  const [eu, p, sets, cats, gente, ms, todos, membros, vistoriadores] =
    await Promise.all([
      contexto(),
      parametros(),
      setores(),
      categorias(),
      pessoas(),
      metas(),
      chamadosDoPainel(desde, f.periodo.ate),
      setores().then(setoresDasPessoas),
      setoresDasVistorias(),
    ]);

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
    f,
    agora,
    janela,
    momento,
    quando:
      momento === agora
        ? "agora"
        : `em ${formatarData(paraBrasilia(new Date(momento.getTime() - 1)).data)}`,
    pode: eu.pode,
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
    exemplo: false,
  };

  const { cartoes, blocos: daBase } = montarBase(ctx);
  const [proprios, portal, vistorias] = await Promise.all([
    f.setor ? blocosDoSetor(ctx) : blocosDoGeral(ctx),
    blocosDoPortal(ctx),
    blocosDeVistorias(ctx, vistoriadores),
  ]);

  // Linhas: só os chamados citados em alguma lista (vão uma vez só).
  const conhecidos = new Map([...todos, ...ctx.extras].map((c) => [c.id, c]));
  const faltam = [...ctx.listas.usados].filter((id) => !conhecidos.has(id));
  for (const c of await chamadosPorId(faltam)) conhecidos.set(c.id, c);
  const citados = [...ctx.listas.usados].flatMap(
    (id) => conhecidos.get(id) ?? [],
  );

  return {
    titulo: f.setor ? `Painel de ${f.setor.nome}` : "Painel geral",
    rotulo: f.rotulo,
    atualizadoAs: paraBrasilia(agora).hora,
    temExemplo: ctx.exemplo || base.some((c) => c.exemplo),
    cartoes,
    blocos: [...daBase, ...proprios, ...portal, ...vistorias],
    linhas: citados.map((c) => linhaDe(c, ctx)),
    avisos: [],
  };
}
