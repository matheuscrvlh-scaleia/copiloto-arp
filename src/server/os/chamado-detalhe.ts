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
import { type LeitorDoAviso, leitoresDosAvisos } from "./leituras";

// Tudo o que o detalhe do chamado ou da OS mostra (página e janela
// lateral), lido com a sessão: o que a pessoa não pode ver o RLS já tira.

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
  /** Destinos em ordem: o anterior que ainda não concluiu (null: é a vez). */
  espera: string | null;
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
  /** Aviso: quem recebe e quando leu; `euRecebo` e `liEm` são os meus. */
  leitura: {
    leitores: (LeitorDoAviso & { nome: string })[];
    euRecebo: boolean;
    liEm: string | null;
  } | null;
  eventos: Tabela<"eventos">[];
  anexos: AnexoDetalhe[];
  /** Nome de cada pessoa (id → nome) para a tela. */
  nomes: Record<string, string>;
  seguidores: string[];
  sigo: boolean;
  loja: Pick<Tabela<"lojas">, "id" | "luc" | "nome" | "telefone"> | null;
  ativo: { id: string; codigo: string; nome: string; local: string } | null;
  vistoria: { id: string; codigo: string } | null;
  /** Na OS: o chamado a que ela está ligada. */
  vinculado: ChamadoCurto | null;
  /** No chamado: as OS ligadas a ele. */
  ordensLigadas: ChamadoCurto[];
  papel: Papel;
  acoes: AcaoChamado[];
  bloqueio: string | null;
  pode: {
    gerenciar: boolean;
    editarPrazo: boolean;
    historico: boolean;
    verAtivo: boolean;
    verVistoria: boolean;
    editar: boolean;
    definirTarefas: boolean;
    /** Gestor do setor: reordena as etapas que ainda não começaram. */
    reordenar: boolean;
  };
  avisoHoras: number;
  causasFalha: string[];
  modeloMensagem: string | null;
}

const COLUNAS_CURTO = "id, numero, titulo, status, tipo";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O chamado ligado (a OS aponta para ele). */
async function chamadoCurto(id: string | null): Promise<ChamadoCurto | null> {
  if (!id) return null;
  const { data } = await (await os())
    .from("chamados")
    .select(COLUNAS_CURTO)
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** As OS ligadas a um chamado (as que a pessoa vê). */
async function ordensDoChamado(id: string): Promise<ChamadoCurto[]> {
  const { data } = await (await os())
    .from("ordens")
    .select(COLUNAS_CURTO)
    .eq("vinculado_a_id", id)
    .order("numero");
  return data ?? [];
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

/**
 * Destinos, linha do tempo, anexos e seguidores: só dependem do id (único
 * entre chamado e OS), então saem junto com a leitura do dono.
 */
async function filhosDoChamado(id: string) {
  const db = await os();
  const dono = `chamado_id.eq.${id},ordem_id.eq.${id}`;
  return Promise.all([
    db.from("destinatarios").select("*").or(dono).order("ordem"),
    db.from("eventos").select("*").or(dono).order("em", { ascending: true }),
    db.from("anexos").select("*").or(dono).order("em", { ascending: true }),
    db.from("participantes").select("usuario_id, motivo").or(dono),
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
    const nomeDe = (d: (typeof linhas)[number]) =>
      d.usuario_id
        ? (mapaNomes.get(d.usuario_id) ?? "Pessoa")
        : (setorDe(d.setor_id)?.nome ?? "Setor");
    const lista: DestinoDetalhe[] = linhas.map((d) => {
      const antes = ch.destinos_em_ordem
        ? linhas.find((x) => x.ordem < d.ordem && x.status !== "concluido")
        : undefined;
      return {
        ...d,
        nome: nomeDe(d),
        meu:
          ehGestor ||
          d.usuario_id === eu ||
          d.responsavel_id === eu ||
          (!!d.setor_id && ctx.setores.includes(d.setor_id)),
        espera: antes && d.status === "aberto" ? nomeDe(antes) : null,
      };
    });
    const multiplos = lista.length > 1;
    const acoes = acoesDisponiveis({ ...ch, multiplos }, papel);
    const arquivos = anexos.data ?? [];

    const aviso = ch.tipo === "aviso";
    const [
      urls,
      loja,
      ativo,
      vistoria,
      vinculado,
      bloqueio,
      ordensLigadas,
      leitores,
    ] = await Promise.all([
      urlsAssinadas(arquivos.map((a) => a.path)),
      lerLoja(ch.loja_id),
      lerAtivo(ch.ativo_id),
      lerVistoria(ch.vistoria_id, ctx.pode("os.vistorias")),
      chamadoCurto(ch.vinculado_a_id),
      acoes.includes("concluir") ? motivoDoBloqueio(ch) : null,
      ch.tipo === "os" ? [] : ordensDoChamado(ch.id),
      aviso ? leitoresDosAvisos([ch.id]) : null,
    ]);
    const doAviso = leitores?.get(ch.id) ?? [];
    const meu = doAviso.find((l) => l.id === eu);

    const seguidores = (participantes.data ?? []).map((x) => x.usuario_id);
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
      andamento: multiplos && !aviso ? andamentoDosDestinos(lista) : null,
      leitura: aviso
        ? {
            leitores: doAviso
              .map((l) => ({ ...l, nome: mapaNomes.get(l.id) ?? "Pessoa" }))
              .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
            euRecebo: !!meu,
            liEm: meu?.lidoEm ?? null,
          }
        : null,
      eventos: eventos.data ?? [],
      anexos: arquivos.map((a) => ({ ...a, url: urls.get(a.path) ?? null })),
      nomes: Object.fromEntries(mapaNomes),
      seguidores,
      sigo: seguidores.includes(eu),
      loja,
      ativo,
      vistoria,
      vinculado,
      ordensLigadas,
      papel,
      acoes,
      bloqueio,
      pode: {
        gerenciar: ehGestor,
        editarPrazo: ehGestor || papel.solicitante,
        historico: ctx.pode("os.historico"),
        verAtivo: ctx.pode("os.ativos") || ctx.pode("os.ativos_gerenciar"),
        verVistoria: ctx.pode("os.vistorias"),
        editar:
          papel.solicitante ||
          papel.responsavel ||
          papel.doSetor ||
          ehGestor ||
          lista.some((d) => d.meu),
        // A mesma regra de definirTarefaDestino.
        definirTarefas:
          papel.solicitante || papel.responsavel || papel.doSetor || ehGestor,
        reordenar: ehGestor && ch.destinos_em_ordem,
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
