import "server-only";
import { calcularPrazo } from "@/lib/os/prazo";
import { rotaChamado } from "@/lib/os/rotas";
import type { Json } from "@/lib/supabase/database.types";
import {
  type Categoria,
  calendarioDe,
  type Enum,
  membrosDoSetor,
  notificar,
  osAdmin,
  registrarComoSistema,
  type Tabela,
} from "./base";

// Criação de chamado pelo sistema (service role): portal do lojista,
// modelos de entrada e saída, planos preventivos e lembretes recorrentes.
// Quem chama já conferiu o acesso (token do link, rotina do cron). A
// categoria dá os padrões (tipo, responsável, prioridade, prazo,
// confirmação, checklist), e quem chama pode sobrescrever.

export interface NovoChamadoSistema {
  setorId: string;
  categoriaId?: string | null;
  titulo: string;
  descricao?: string | null;
  tipo?: Enum<"tipo_chamado">;
  origem: Enum<"origem_chamado">;
  /** Quem "abriu" (usuário do modelo, do plano); null para o portal. */
  abertoPor?: string | null;
  /** Nome que aparece na linha do tempo como autor ("Portal – Loja X"). */
  autorNome: string;
  responsavelId?: string | null;
  prioridade?: Enum<"prioridade">;
  /** Prazo exato; sem ele, vale o da categoria a partir de agora. */
  prazo?: Date | null;
  solicitanteNome?: string | null;
  solicitanteTelefone?: string | null;
  lojaId?: string | null;
  /** Onde: área comum, ponto (ex.: casa de máquinas) e bloco. */
  local?: string | null;
  bloco?: string | null;
  ativoId?: string | null;
  vistoriaId?: string | null;
  planoId?: string | null;
  planoData?: string | null;
  serieId?: string | null;
  serieData?: string | null;
  recorrencia?: Json | null;
  campos?: Record<string, Json>;
  checklist?: Json[];
  etiquetas?: string[];
  /** Vários destinos (Aviso de entrada de cliente): um por setor/pessoa. */
  destinatarios?: {
    setorId?: string | null;
    usuarioId?: string | null;
    titulo?: string | null;
    prazo?: Date | null;
    responsavelId?: string | null;
  }[];
  exemplo?: boolean;
  /** Texto da notificação no lugar do padrão ("Preventiva criada."). */
  aviso?: { tipo: string; texto: string };
}

export interface ChamadoCriado {
  id: string;
  numero: number;
}

/**
 * Grava o chamado, os destinatários, o evento "criado" e as notificações.
 * Devolve null se já existia (série/plano na mesma data: o banco recusa a
 * repetição) — quem chama trata como "nada a fazer".
 */
export async function criarChamadoSistema(
  n: NovoChamadoSistema,
  agora = new Date(),
): Promise<ChamadoCriado | null> {
  const db = osAdmin();
  let categoria: Categoria | null = null;
  if (n.categoriaId) {
    const { data, error } = await db
      .from("categorias")
      .select("*")
      .eq("id", n.categoriaId)
      .maybeSingle();
    if (error) throw new Error(`Categoria: ${error.message}`);
    categoria = data;
  }

  const tipo = n.tipo ?? categoria?.tipo_padrao ?? "solicitacao";
  const prazo = n.prazo ?? (await prazoDaCategoria(categoria, agora));
  const precisaConfirmacao =
    tipo === "aviso" ? false : (categoria?.precisa_confirmacao ?? true);
  const checklist =
    n.checklist ??
    (Array.isArray(categoria?.checklist)
      ? (categoria.checklist as Json[]).map((item) => ({
          ...(item as Record<string, Json>),
          feito: false,
        }))
      : []);

  const { data, error } = await db
    .from("chamados")
    .insert({
      tipo,
      titulo: n.titulo.slice(0, 200),
      descricao: n.descricao ?? null,
      setor_id: n.setorId,
      categoria_id: n.categoriaId ?? null,
      origem: n.origem,
      prioridade: n.prioridade ?? categoria?.prioridade_padrao ?? "media",
      precisa_confirmacao: precisaConfirmacao,
      aberto_por: n.abertoPor ?? null,
      responsavel_id:
        n.responsavelId !== undefined
          ? n.responsavelId
          : (categoria?.responsavel_padrao_id ?? null),
      prazo: prazo?.toISOString() ?? null,
      solicitante_nome: n.solicitanteNome ?? null,
      solicitante_telefone: n.solicitanteTelefone ?? null,
      loja_id: n.lojaId ?? null,
      local: n.local ?? null,
      bloco: n.bloco ?? null,
      ativo_id: n.ativoId ?? null,
      vistoria_id: n.vistoriaId ?? null,
      plano_id: n.planoId ?? null,
      plano_data: n.planoData ?? null,
      serie_id: n.serieId ?? null,
      serie_data: n.serieData ?? null,
      recorrencia: n.recorrencia ?? null,
      campos: (n.campos ?? {}) as Json,
      checklist: checklist as Json,
      etiquetas: n.etiquetas ?? [],
      execucao: tipo === "os" ? "interna" : null,
      exemplo: n.exemplo ?? false,
    })
    .select("id, numero, responsavel_id")
    .single();
  if (error) {
    // Mesma série/plano na mesma data: já foi criado antes.
    if (error.code === "23505") return null;
    throw new Error(`Não foi possível criar o chamado: ${error.message}`);
  }

  if (n.destinatarios?.length) {
    const { error: e } = await db.from("destinatarios").insert(
      n.destinatarios.map((d, i) => ({
        chamado_id: data.id,
        setor_id: d.setorId ?? null,
        usuario_id: d.usuarioId ?? null,
        titulo: d.titulo ?? null,
        prazo: d.prazo?.toISOString() ?? null,
        responsavel_id: d.responsavelId ?? null,
        ordem: i,
      })),
    );
    if (e) throw new Error(`Destinatários: ${e.message}`);
  }

  await registrarComoSistema(data.id, {
    tipo: "criado",
    autorNome: n.autorNome,
    texto: `Chamado aberto por ${n.autorNome}.`,
    dados: { origem: n.origem },
    visivelLojista: n.origem === "portal",
  });

  await avisarCriacao(
    { ...data, setor_id: n.setorId, titulo: n.titulo },
    n.destinatarios ?? [],
    n.abertoPor ?? null,
    n.aviso,
  );
  return { id: data.id, numero: data.numero };
}

async function prazoDaCategoria(
  categoria: Categoria | null,
  agora: Date,
): Promise<Date | null> {
  if (!categoria?.prazo_valor) return null;
  const db = osAdmin();
  const [p, feriados] = await Promise.all([
    db
      .from("parametros")
      .select("dias_uteis, expediente_fim")
      .eq("id", 1)
      .single(),
    db.from("feriados").select("data"),
  ]);
  if (p.error) throw new Error(`Parâmetros: ${p.error.message}`);
  return calcularPrazo(
    {
      abertura: agora,
      valor: categoria.prazo_valor,
      unidade: categoria.prazo_unidade,
    },
    calendarioDe(
      p.data,
      (feriados.data ?? []).map((f) => f.data),
    ),
  );
}

/** Novo para mim → eu; para a fila do setor → todos do setor; destinos → cada um. */
async function avisarCriacao(
  ch: Pick<
    Tabela<"chamados">,
    "id" | "numero" | "responsavel_id" | "setor_id" | "titulo"
  >,
  destinos: NonNullable<NovoChamadoSistema["destinatarios"]>,
  autor: string | null,
  aviso?: NovoChamadoSistema["aviso"],
) {
  const href = rotaChamado(ch.id);
  const titulo = `#${ch.numero} ${ch.titulo}`;
  if (destinos.length) {
    const pessoas = new Set<string>();
    for (const d of destinos) {
      if (d.usuarioId) pessoas.add(d.usuarioId);
      if (d.responsavelId) pessoas.add(d.responsavelId);
      if (d.setorId)
        for (const m of await membrosDoSetor(d.setorId)) pessoas.add(m);
    }
    await notificar(
      [...pessoas],
      {
        tipo: aviso?.tipo ?? "novo",
        titulo,
        texto: aviso?.texto ?? "Novo chamado para você ou o seu setor.",
        href,
        chamadoId: ch.id,
      },
      autor,
    );
    return;
  }
  const quem = ch.responsavel_id
    ? [ch.responsavel_id]
    : await membrosDoSetor(ch.setor_id);
  await notificar(
    quem,
    {
      tipo: aviso?.tipo ?? "novo",
      titulo,
      texto:
        aviso?.texto ??
        (ch.responsavel_id
          ? "Novo chamado com você."
          : "Novo chamado na fila do seu setor."),
      href,
      chamadoId: ch.id,
    },
    autor,
  );
}
