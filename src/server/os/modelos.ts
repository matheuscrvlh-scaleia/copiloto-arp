import "server-only";
import { dataDaOcorrencia } from "@/lib/os/automacao";
import {
  ACOES,
  type AcaoItem,
  type Contrato,
  type Gatilho,
  type ItemDoModelo,
  montarAviso,
  setorDoAviso,
} from "@/lib/os/modelos";
import type { Calendario } from "@/lib/os/prazo";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { registrarDepois } from "@/server/logs";
import { configDoSistema } from "./automacao";
import { os, osAdmin, registrarComoSistema, type Tabela } from "./base";
import { criarChamadoSistema } from "./criar";
import { cancelarLinkDaLoja, gerarLinkDaLoja } from "./portal";
import { criarVistoriaDoContrato } from "./vistorias";

// Modelos de entrada e saída de cliente (spec 4.12): o disparo (pela rotina
// ou pelo botão "Disparar modelo") e as consultas da tela. O disparo grava
// com a service role: os.disparos só cresce pelo servidor, e o Aviso nasce
// com destinos de vários setores. Quem chama já conferiu o acesso.

export type Modelo = Tabela<"modelos">;
export type ItemModelo = Tabela<"modelo_itens">;
export type LojaDoModelo = Pick<
  Tabela<"lojas">,
  | "id"
  | "nome"
  | "luc"
  | "situacao"
  | "inicio"
  | "fim"
  | "tem_vaga"
  | "atualizado_em"
  | "exemplo"
>;

export const COLUNAS_LOJA =
  "id, nome, luc, situacao, inicio, fim, tem_vaga, atualizado_em, exemplo" as const;

export interface ModeloComItens extends Modelo {
  itens: ItemModelo[];
}

const paraContrato = (l: LojaDoModelo): Contrato => ({
  ...l,
  situacao: l.situacao === "encerrado" ? "encerrado" : "vigente",
});

export const paraItem = (i: ItemModelo): ItemDoModelo => ({
  ...i,
  condicao: i.condicao === "tem_vaga" ? "tem_vaga" : "sempre",
  acao: (Object.hasOwn(ACOES, i.acao) ? i.acao : "nenhuma") as AcaoItem,
});

export interface Disparo {
  chamadoId: string;
  numero: number;
  avisos: string[];
}

/**
 * Dispara o modelo para o contrato: um Aviso com um destino por item, ligado
 * à loja, e as ações dos itens (vistoria, link do portal). Uma vez só por
 * modelo e loja: a linha de os.disparos é gravada antes, e a repetição volta
 * null. Nada é alterado no ENET.
 */
export async function dispararModelo(p: {
  modelo: ModeloComItens;
  loja: LojaDoModelo;
  usuario: { id: string; nome: string } | null;
  automatico: boolean;
  agora?: Date;
  cal?: Calendario;
}): Promise<Disparo | null> {
  const db = osAdmin();
  const agora = p.agora ?? new Date();
  const cal = p.cal ?? (await configDoSistema()).cal;

  const reserva = await db
    .from("disparos")
    .insert({
      modelo_id: p.modelo.id,
      loja_id: p.loja.id,
      automatico: p.automatico,
      disparado_por: p.usuario?.id ?? null,
    })
    .select("id")
    .single();
  if (reserva.error) {
    if (reserva.error.code === "23505") return null;
    throw new Error(`Disparo: ${reserva.error.message}`);
  }

  try {
    const disparo = await criarAviso(p, cal, agora);
    await db
      .from("disparos")
      .update({ chamado_id: disparo.chamadoId })
      .eq("id", reserva.data.id);
    registrarDepois({
      modulo: "os",
      evento: "os_modelo_disparado",
      descricao: `${p.automatico ? "Rotina disparou" : "Disparou"} o modelo ${p.modelo.nome} para ${p.loja.nome} (${p.loja.luc}): aviso #${disparo.numero}`,
      usuarioId: p.usuario?.id ?? null,
      detalhes: {
        modelo_id: p.modelo.id,
        loja_id: p.loja.id,
        chamado_id: disparo.chamadoId,
        automatico: p.automatico,
        avisos: disparo.avisos,
      },
    });
    return disparo;
  } catch (erro) {
    // Sem o aviso, libera para tentar de novo na próxima rodada.
    await db.from("disparos").delete().eq("id", reserva.data.id);
    throw erro;
  }
}

async function criarAviso(
  p: Parameters<typeof dispararModelo>[0],
  cal: Calendario,
  agora: Date,
): Promise<Disparo> {
  const db = osAdmin();
  const [categorias, setores] = await Promise.all([
    db.from("categorias").select("id, nome, setor_id, ativo"),
    db.from("setores").select("id, nome"),
  ]);
  if (categorias.error) throw new Error(categorias.error.message);
  if (setores.error) throw new Error(setores.error.message);

  const itens = p.modelo.itens.map(paraItem);
  const contrato = paraContrato(p.loja);
  const aviso = montarAviso(
    {
      nome: p.modelo.nome,
      gatilho: p.modelo.gatilho as Gatilho,
      descricao: p.modelo.descricao,
    },
    itens,
    contrato,
    hojeEmBrasilia(agora),
    cal,
  );
  const { setorId, categoriaId } = setorDoAviso(
    p.modelo,
    categorias.data ?? [],
    setores.data ?? [],
    itens,
  );
  if (!setorId) throw new Error("Modelo sem setor para o aviso.");
  if (!aviso.destinos.length)
    throw new Error("Nenhum item do modelo vale para este contrato.");

  const criado = await criarChamadoSistema(
    {
      tipo: "aviso",
      origem: "modelo",
      setorId,
      categoriaId,
      titulo: aviso.titulo,
      descricao: aviso.descricao,
      prazo: aviso.prazo,
      lojaId: p.loja.id,
      abertoPor: p.usuario?.id ?? null,
      autorNome: p.usuario?.nome ?? `Sistema (modelo ${p.modelo.nome})`,
      destinatarios: aviso.destinos.map((d) => ({
        setorId: d.setorId,
        titulo: d.titulo,
        prazo: d.prazo,
        responsavelId: d.responsavelId,
      })),
      exemplo: p.loja.exemplo,
    },
    agora,
  );
  if (!criado) throw new Error("O aviso do modelo não foi criado.");

  const avisos: string[] = [];
  for (const acao of new Set(aviso.destinos.map((d) => d.acao))) {
    const problema = await executarAcao(acao, p, criado.id);
    if (problema) avisos.push(problema);
  }
  return { chamadoId: criado.id, numero: criado.numero, avisos };
}

/**
 * Ação automática do item. Falhar aqui não desfaz o Aviso: o setor faz à mão
 * e a linha do tempo conta o que não deu certo.
 */
async function executarAcao(
  acao: AcaoItem,
  p: Parameters<typeof dispararModelo>[0],
  chamadoId: string,
): Promise<string | null> {
  if (acao === "nenhuma") return null;
  const usuarioId = p.usuario?.id ?? null;
  try {
    switch (acao) {
      case "vistoria_entrada":
      case "vistoria_saida":
        // A vistoria registra a criação na linha do tempo do Aviso.
        await criarVistoriaDoContrato({
          lojaId: p.loja.id,
          tipo: acao === "vistoria_entrada" ? "entrada" : "saida",
          chamadoId,
        });
        return null;
      case "portal_gerar":
        await gerarLinkDaLoja(p.loja.id, usuarioId);
        await registrarComoSistema(chamadoId, {
          tipo: "sistema",
          autorNome: "Sistema",
          texto:
            "Link do portal da loja gerado. Envie pelo WhatsApp na tela do Portal.",
        });
        return null;
      case "portal_cancelar": {
        const cancelou = await cancelarLinkDaLoja(p.loja.id, usuarioId);
        await registrarComoSistema(chamadoId, {
          tipo: "sistema",
          autorNome: "Sistema",
          texto: cancelou
            ? "Link do portal da loja cancelado: parou de funcionar."
            : "A loja não tinha link do portal ativo.",
        });
        return null;
      }
    }
  } catch (erro) {
    const texto = `Não foi possível ${ACOES[acao].toLowerCase()}: ${erro instanceof Error ? erro.message : "erro"}. Faça pela tela.`;
    console.error("ação do modelo", acao, p.loja.id, erro);
    await registrarComoSistema(chamadoId, {
      tipo: "sistema",
      autorNome: "Sistema",
      texto,
    });
    return texto;
  }
}

// ---------------------------------------------------------------------------
// Consultas (pela sessão: o RLS confere o acesso)
// ---------------------------------------------------------------------------

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler os modelos: ${erro.message}`);
}

/** Modelos com os itens na ordem. */
export async function modelos(): Promise<ModeloComItens[]> {
  const { data, error } = await (await os())
    .from("modelos")
    .select("*, itens:modelo_itens(*)")
    .order("gatilho")
    .order("nome");
  falhar(error);
  return (data ?? []).map((m) => ({
    ...m,
    itens: [...m.itens].sort((a, b) => a.ordem - b.ordem),
  }));
}

export interface DisparoFeito {
  id: string;
  em: string;
  automatico: boolean;
  modelo: string;
  loja: { id: string; nome: string; luc: string; situacao: string };
  chamado: {
    id: string;
    numero: number;
    status: Tabela<"chamados">["status"];
  } | null;
  /** null: quem vê a tela não vê o Aviso (RLS). */
  destinos:
    | { setor_id: string | null; titulo: string | null; status: string }[]
    | null;
}

/** Disparos mais recentes, com o andamento de cada setor no Aviso. */
export async function disparosFeitos(limite = 60): Promise<DisparoFeito[]> {
  const db = await os();
  const { data, error } = await db
    .from("disparos")
    .select(
      "id, em, automatico, chamado_id, modelo:modelos(nome), loja:lojas(id, nome, luc, situacao)",
    )
    .order("em", { ascending: false })
    .limit(limite);
  falhar(error);
  const ids = (data ?? []).flatMap((d) => (d.chamado_id ? [d.chamado_id] : []));
  const chamados = ids.length
    ? await db
        .from("chamados")
        .select(
          "id, numero, status, destinatarios(setor_id, titulo, status, ordem)",
        )
        .in("id", ids)
    : { data: [], error: null };
  falhar(chamados.error);
  const porId = new Map((chamados.data ?? []).map((c) => [c.id, c]));
  return (data ?? []).flatMap((d) => {
    if (!d.loja) return [];
    const c = d.chamado_id ? porId.get(d.chamado_id) : undefined;
    return [
      {
        id: d.id,
        em: d.em,
        automatico: d.automatico,
        modelo: d.modelo?.nome ?? "—",
        loja: d.loja,
        chamado: c ? { id: c.id, numero: c.numero, status: c.status } : null,
        destinos: c
          ? [...c.destinatarios].sort((a, b) => a.ordem - b.ordem)
          : null,
      },
    ];
  });
}

/** Lojas para o botão "Disparar modelo" (vigentes primeiro). */
export async function lojasParaDisparo(): Promise<LojaDoModelo[]> {
  const { data, error } = await (await os())
    .from("lojas")
    .select(COLUNAS_LOJA)
    .order("situacao", { ascending: false })
    .order("nome");
  falhar(error);
  return data ?? [];
}

export interface Serie {
  serieId: string;
  ultimaId: string;
  numero: number;
  titulo: string;
  tipo: Tabela<"chamados">["tipo"];
  setor_id: string;
  responsavel_id: string | null;
  recorrencia: unknown;
  ultimaData: string;
  ocorrencias: number;
}

/** Lembretes recorrentes ativos que a pessoa vê (RLS). */
export async function seriesAtivas(): Promise<Serie[]> {
  const db = await os();
  // Em páginas: o PostgREST para nas 1000 linhas, e toda ocorrência guarda o
  // Repetir (as séries mais antigas sumiriam da lista).
  const data = [];
  for (let de = 0; de < 10_000; de += 1000) {
    const pagina = await db
      .from("chamados")
      .select(
        "id, numero, titulo, tipo, setor_id, responsavel_id, recorrencia, serie_id, serie_data, prazo, criado_em",
      )
      .not("recorrencia", "is", null)
      .is("lixeira_em", null)
      .order("criado_em", { ascending: false })
      .order("id")
      .range(de, de + 999);
    falhar(pagina.error);
    data.push(...(pagina.data ?? []));
    if ((pagina.data ?? []).length < 1000) break;
  }
  const series = new Map<string, Serie>();
  for (const c of data) {
    const chave = c.serie_id ?? c.id;
    const dia = dataDaOcorrencia(c);
    const ultima = {
      ultimaId: c.id,
      numero: c.numero,
      titulo: c.titulo,
      tipo: c.tipo,
      setor_id: c.setor_id,
      responsavel_id: c.responsavel_id,
      recorrencia: c.recorrencia,
      ultimaData: dia,
    };
    const s = series.get(chave);
    if (!s) series.set(chave, { serieId: chave, ocorrencias: 1, ...ultima });
    else {
      s.ocorrencias++;
      if (dia > s.ultimaData) Object.assign(s, ultima);
    }
  }
  return [...series.values()].sort((a, b) =>
    a.titulo.localeCompare(b.titulo, "pt-BR"),
  );
}
