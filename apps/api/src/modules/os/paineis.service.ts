import { formatarData } from "@arp/shared/formato";
import type {
  ConsultaDoPainel,
  RespostaPainel,
} from "@arp/shared/os/contratos/paineis";
import { slugDoSetor } from "@arp/shared/os/indicadores-setor";
import { ROTAS_OS } from "@arp/shared/os/rotas";
import { paraBrasilia } from "@arp/shared/os/tempo";
import type { Contexto } from "@/contexto";
import { ErroDePermissao, ErroNaoEncontrado } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import {
  type ContextoOs,
  categorias,
  contextoOs,
  pessoas,
  type Setor,
  setores,
} from "./base.service";
import {
  type Busca,
  type Cadastro,
  lerFiltrosDoPainel,
  montarPainel,
} from "./paineis/montar";
import { pdfDoPainel } from "./paineis/pdf";

// Painéis do Tickets (spec 4.13). Tudo lido pela sessão (RLS): o painel
// geral vê todos os setores (os.painel_geral) e o de setor, os chamados do
// próprio setor (os.painel_setor). Quem vê custo é decidido pelo RLS de
// os_custos (os.custos) e por `pode("os.custos")` nos blocos.

// ---------------------------------------------------------------------------
// Quem abre qual painel
// ---------------------------------------------------------------------------

/**
 * Setores cujo painel a pessoa pode abrir: os.painel_geral abre o geral e o
 * de qualquer setor; os.painel_setor, só o dos setores de que ela faz parte.
 */
export function setoresDoPainel(cx: ContextoOs, sets: Setor[]): Setor[] {
  if (cx.pode("os.painel_geral")) return sets.filter((s) => s.ativo);
  if (!cx.pode("os.painel_setor")) return [];
  return sets.filter((s) => cx.setores.includes(s.id));
}

/** Setor pelo endereço (/os/paineis/operacoes) ou pelo id. */
export function acharSetor(sets: Setor[], chave: string): Setor | null {
  let k = chave;
  try {
    k = decodeURIComponent(chave);
  } catch {
    // endereço com % solto: compara como veio
  }
  return sets.find((s) => s.id === k || slugDoSetor(s.nome) === k) ?? null;
}

/** Sem os.painel_geral nem os.painel_setor, nenhum painel abre. */
function exigirAlgumPainel(ctx: Contexto): void {
  if (
    !ctx.permissoes.has("os.painel_geral") &&
    !ctx.permissoes.has("os.painel_setor")
  )
    throw new ErroDePermissao();
}

async function cadastro(tx: Tx, ctx: Contexto): Promise<Cadastro> {
  return {
    cx: await contextoOs(tx, ctx),
    setores: await setores(tx),
    categorias: await categorias(tx),
    pessoas: await pessoas(tx),
  };
}

/** Os parâmetros da URL (o setor vem do endereço e não entra na busca). */
function buscaDe(consulta: ConsultaDoPainel): Busca {
  const busca: Busca = {};
  for (const [k, v] of Object.entries(consulta)) {
    if (k === "setor") continue;
    if (typeof v === "string") busca[k] = v;
    else if (Array.isArray(v))
      busca[k] = v.filter((x): x is string => typeof x === "string");
  }
  return busca;
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

/**
 * GET /os/paineis: o painel geral (sem `setor`) ou o de um setor (`setor`:
 * slug ou id do endereço). Sem os.painel_geral, o geral leva ao painel do
 * primeiro setor liberado.
 */
export async function lerPainel(
  ctx: Contexto,
  consulta: ConsultaDoPainel,
): Promise<RespostaPainel> {
  exigirAlgumPainel(ctx);
  const agora = new Date();
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const cad = await cadastro(tx, ctx);
    const visiveis = setoresDoPainel(cad.cx, cad.setores);
    let setor: Setor | null = null;
    if (consulta.setor === undefined) {
      if (!cad.cx.pode("os.painel_geral")) {
        const [primeiro] = visiveis;
        if (!primeiro) return { tipo: "sem_acesso" };
        return {
          tipo: "redirecionar",
          para: `${ROTAS_OS.paineis}/${slugDoSetor(primeiro.nome)}`,
        };
      }
    } else {
      setor = acharSetor(cad.setores, consulta.setor);
      if (!setor) throw new ErroNaoEncontrado();
      const id = setor.id;
      if (!visiveis.some((s) => s.id === id)) return { tipo: "sem_acesso" };
    }

    const busca = buscaDe(consulta);
    const f = lerFiltrosDoPainel(busca, setor, agora, cad);
    const painel = await montarPainel(tx, cad, f, agora);

    // Setor é filtro: cada opção é a rota do painel dele.
    const opcoesSetor = [
      ...(cad.cx.pode("os.painel_geral")
        ? [{ rota: ROTAS_OS.paineis, nome: "Todos os setores" }]
        : []),
      ...visiveis.map((s) => ({
        rota: `${ROTAS_OS.paineis}/${slugDoSetor(s.nome)}`,
        nome: s.nome,
      })),
    ];
    const rotaAtual = setor
      ? `${ROTAS_OS.paineis}/${slugDoSetor(setor.nome)}`
      : ROTAS_OS.paineis;
    const cats = cad.categorias;
    const opcoesCategoria = cats
      .filter((c) => c.ativo && (!setor || c.setor_id === setor.id))
      .map((c) => {
        const pai = c.pai_id ? cats.find((p) => p.id === c.pai_id) : undefined;
        return {
          id: c.id,
          nome: pai ? `${pai.nome} › ${c.nome}` : c.nome,
          grupo: setor
            ? undefined
            : (visiveis.find((s) => s.id === c.setor_id)?.nome ?? undefined),
        };
      });
    const pessoasDoRecorte = cad.pessoas
      .filter((p) => !setor || p.setores.includes(setor.id))
      .map((p) => ({ id: p.id, nome: p.nome }));
    const textoFiltros = [
      painel.titulo,
      painel.rotulo,
      f.categoria
        ? `Categoria: ${opcoesCategoria.find((c) => c.id === f.categoria?.id)?.nome}`
        : "",
      f.pessoa
        ? `Pessoa: ${cad.pessoas.find((p) => p.id === f.pessoa)?.nome}`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      tipo: "painel",
      painel,
      periodo: f.periodo,
      hoje: f.hoje,
      setorId: setor?.id ?? null,
      setores: opcoesSetor,
      rotaAtual,
      categorias: opcoesCategoria,
      categoria: f.categoria?.id ?? null,
      pessoas: pessoasDoRecorte,
      pessoa: f.pessoa,
      textoFiltros,
    };
  });
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/**
 * GET /os/paineis/exportar: PDF do painel (?setor=<id> e os mesmos filtros
 * da tela). Lê tudo pela sessão (RLS) e confere os.exportar e o acesso ao
 * painel pedido.
 */
export async function exportarPainel(
  ctx: Contexto,
  consulta: ConsultaDoPainel,
): Promise<{ bytes: Uint8Array; nome: string }> {
  if (!ctx.permissoes.has("os.exportar"))
    throw new ErroDePermissao("Você não tem permissão para exportar.");
  const agora = new Date();
  const montado = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const cad = await cadastro(tx, ctx);
    const liberados = setoresDoPainel(cad.cx, cad.setores);
    const pedido = consulta.setor;
    const setor = pedido
      ? (cad.setores.find((s) => s.id === pedido) ?? null)
      : null;
    const pode = setor
      ? liberados.some((s) => s.id === setor.id)
      : cad.cx.pode("os.painel_geral");
    if (!pode || (pedido && !setor))
      throw new ErroDePermissao("Você não tem acesso a este painel.");
    const f = lerFiltrosDoPainel(buscaDe(consulta), setor, agora, cad);
    return { f, setor, painel: await montarPainel(tx, cad, f, agora) };
  });
  const { f, setor, painel } = montado;
  const b = paraBrasilia(agora);
  const filtros = [
    painel.rotulo,
    f.categoria ? `Categoria: ${f.categoria.nome}` : "",
    f.pessoa ? "Filtrado por pessoa responsável" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const bytes = await pdfDoPainel(
    painel,
    filtros,
    `${formatarData(b.data)} ${b.hora}`,
  );
  const nome = `painel-${setor ? slugDoSetor(setor.nome) : "geral"}-${f.periodo.de}-a-${f.periodo.ate}`;
  return { bytes, nome: `${nome}.pdf` };
}
