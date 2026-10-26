import "server-only";
import { cache } from "react";
import {
  type ItemChecklist,
  lerCamposExtras,
  lerChecklist,
} from "@/lib/os/chamado";
import {
  type AcaoChamado,
  acoesDisponiveis,
  andamentoDosDestinos,
  type Papel,
} from "@/lib/os/ciclo";
import type { CampoExtra } from "@/lib/os/rotulos";
import {
  type Categoria,
  categorias,
  contexto,
  nomes,
  os,
  parametros,
  type Setor,
  setores,
  type Tabela,
  urlsAssinadas,
} from "./base";
import {
  type Chamado,
  gerencia,
  lerChamado,
  motivoDoBloqueio,
  papelNoChamado,
} from "./chamados";

// Tudo o que o detalhe do chamado mostra (página e janela lateral), lido
// com a sessão: o que a pessoa não pode ver o RLS já tira.

export interface ChamadoCurto {
  id: string;
  numero: number;
  titulo: string;
  status: Chamado["status"];
  tipo: Chamado["tipo"];
}

export interface DestinoDetalhe extends Tabela<"destinatarios"> {
  nome: string;
  /** A pessoa pode mexer nesta linha (é dela, do setor dela ou gerencia). */
  meu: boolean;
}

export interface AnexoDetalhe extends Tabela<"anexos"> {
  url: string | null;
}

export interface DetalheChamado {
  ch: Chamado;
  setor: Setor | null;
  categoria: Categoria | null;
  /** Categoria-mãe, se a do chamado for subcategoria. */
  categoriaPai: Categoria | null;
  campos: CampoExtra[];
  checklist: ItemChecklist[];
  destinos: DestinoDetalhe[];
  andamento: ReturnType<typeof andamentoDosDestinos> | null;
  eventos: Tabela<"eventos">[];
  anexos: AnexoDetalhe[];
  /** Nome de cada pessoa (id → nome) para a tela. */
  nomes: Record<string, string>;
  seguidores: string[];
  sigo: boolean;
  loja: Pick<Tabela<"lojas">, "id" | "luc" | "nome" | "telefone"> | null;
  ativo: { id: string; codigo: string; nome: string; local: string } | null;
  vistoria: { id: string; codigo: string } | null;
  vinculado: ChamadoCurto | null;
  convertidoDe: ChamadoCurto | null;
  convertidoEm: ChamadoCurto | null;
  papel: Papel;
  acoes: AcaoChamado[];
  bloqueio: string | null;
  pode: {
    gerenciar: boolean;
    editarPrazo: boolean;
    excluir: boolean;
    historico: boolean;
    verAtivo: boolean;
    verVistoria: boolean;
    editar: boolean;
    converter: boolean;
  };
  avisoHoras: number;
  causasFalha: string[];
  modeloMensagem: string | null;
}

const COLUNAS_CURTO = "id, numero, titulo, status, tipo";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vínculo, origem e conversão numa consulta só (pelos ids). */
async function curtos(
  ids: (string | null)[],
): Promise<Map<string, ChamadoCurto>> {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unicos.length) return new Map();
  const { data } = await (await os())
    .from("chamados")
    .select(COLUNAS_CURTO)
    .in("id", unicos);
  return new Map((data ?? []).map((c) => [c.id, c]));
}

async function lerLoja(id: string | null) {
  if (!id) return null;
  const { data } = await (await os())
    .from("lojas")
    .select("id, luc, nome, telefone")
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Ativo pelo RPC de vínculo (quem abre pode não ter acesso a Ativos). */
export async function lerAtivo(id: string | null) {
  if (!id) return null;
  // Só a linha do ativo (o filtro vai para o banco, não a lista inteira).
  const { data } = await (await os())
    .rpc("ativos_para_vincular")
    .eq("id", id)
    .maybeSingle();
  return data
    ? { id: data.id, codigo: data.codigo, nome: data.nome, local: data.local }
    : null;
}

async function lerVistoria(id: string | null, pode: boolean) {
  if (!id || !pode) return null;
  const { data } = await (await os())
    .from("vistorias")
    .select("id, codigo")
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Destinos, linha do tempo, anexos e seguidores: só dependem do id. */
async function filhosDoChamado(id: string) {
  const db = await os();
  return Promise.all([
    db.from("destinatarios").select("*").eq("chamado_id", id).order("ordem"),
    db
      .from("eventos")
      .select("*")
      .eq("chamado_id", id)
      .order("em", { ascending: true }),
    db
      .from("anexos")
      .select("*")
      .eq("chamado_id", id)
      .order("em", { ascending: true }),
    db.from("participantes").select("usuario_id, motivo").eq("chamado_id", id),
  ]);
}

/**
 * Detalhe completo; null se não existe ou a pessoa não vê. Duas idas ao
 * banco: o chamado junto com as tabelas filhas (o RLS delas também confere
 * o acesso), depois o que depende do chamado (loja, ativo, vínculos,
 * bloqueio) junto com os endereços dos anexos.
 */
export const carregarDetalhe = cache(
  async (id: string): Promise<DetalheChamado | null> => {
    if (!UUID.test(id)) return null;
    const [
      ctx,
      ch,
      [destinos, eventos, anexos, participantes],
      todosSetores,
      todasCategorias,
      mapaNomes,
      p,
    ] = await Promise.all([
      contexto(),
      lerChamado(id),
      filhosDoChamado(id),
      setores(),
      categorias(),
      nomes(),
      parametros(),
    ]);
    if (!ch) return null;
    const eu = ctx.usuario.id;

    const categoria =
      todasCategorias.find((c) => c.id === ch.categoria_id) ?? null;
    const setorDe = (s: string | null) =>
      todosSetores.find((x) => x.id === s) ?? null;
    const papel = papelNoChamado(ch, ctx);
    const ehGestor = gerencia(ctx, ch.setor_id);

    const linhas = destinos.data ?? [];
    const lista: DestinoDetalhe[] = linhas.map((d) => ({
      ...d,
      nome: d.usuario_id
        ? (mapaNomes.get(d.usuario_id) ?? "Pessoa")
        : (setorDe(d.setor_id)?.nome ?? "Setor"),
      meu:
        ehGestor ||
        d.usuario_id === eu ||
        d.responsavel_id === eu ||
        (!!d.setor_id && ctx.setores.includes(d.setor_id)),
    }));
    const multiplos = lista.length > 1;
    const acoes = acoesDisponiveis({ ...ch, multiplos }, papel);
    const arquivos = anexos.data ?? [];

    const [urls, loja, ativo, vistoria, vinculos, bloqueio] = await Promise.all(
      [
        urlsAssinadas(arquivos.map((a) => a.path)),
        lerLoja(ch.loja_id),
        lerAtivo(ch.ativo_id),
        lerVistoria(ch.vistoria_id, ctx.pode("os.vistorias")),
        curtos([ch.vinculado_a_id, ch.convertido_de_id, ch.convertido_em_id]),
        acoes.includes("concluir") ? motivoDoBloqueio(ch) : null,
      ],
    );
    const curto = (x: string | null) => (x ? (vinculos.get(x) ?? null) : null);

    const seguidores = (participantes.data ?? []).map((x) => x.usuario_id);
    const aberto = ["aberto", "em_andamento", "aguardando"].includes(ch.status);
    const mensagens = (p.mensagens ?? {}) as Record<string, unknown>;

    return {
      ch,
      setor: setorDe(ch.setor_id),
      categoria,
      categoriaPai: categoria?.pai_id
        ? (todasCategorias.find((c) => c.id === categoria.pai_id) ?? null)
        : null,
      campos: lerCamposExtras(categoria?.campos),
      checklist: lerChecklist(ch.checklist),
      destinos: lista,
      andamento: multiplos ? andamentoDosDestinos(lista) : null,
      eventos: eventos.data ?? [],
      anexos: arquivos.map((a) => ({ ...a, url: urls.get(a.path) ?? null })),
      nomes: Object.fromEntries(mapaNomes),
      seguidores,
      sigo: seguidores.includes(eu),
      loja,
      ativo,
      vistoria,
      vinculado: curto(ch.vinculado_a_id),
      convertidoDe: curto(ch.convertido_de_id),
      convertidoEm: curto(ch.convertido_em_id),
      papel,
      acoes,
      bloqueio,
      pode: {
        gerenciar: ehGestor,
        editarPrazo: ehGestor || papel.solicitante,
        excluir: ctx.pode("os.excluir"),
        historico: ctx.pode("os.historico"),
        verAtivo: ctx.pode("os.ativos") || ctx.pode("os.ativos_gerenciar"),
        verVistoria: ctx.pode("os.vistorias"),
        editar:
          papel.solicitante ||
          papel.responsavel ||
          papel.doSetor ||
          ehGestor ||
          lista.some((d) => d.meu),
        converter:
          aberto && ch.tipo !== "os" && ch.tipo !== "aviso" && !ch.pessoal,
      },
      avisoHoras: p.aviso_vencimento_horas,
      causasFalha: p.causas_falha,
      modeloMensagem:
        typeof mensagens.chamado === "string" ? mensagens.chamado : null,
    };
  },
);

/** Contatos salvos para o WhatsApp. */
export async function contatosSalvos(): Promise<
  Pick<Tabela<"contatos">, "id" | "nome" | "telefone" | "empresa">[]
> {
  const { data } = await (await os())
    .from("contatos")
    .select("id, nome, telefone, empresa")
    .order("nome")
    .limit(500);
  return data ?? [];
}
