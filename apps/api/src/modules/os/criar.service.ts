import { ehCaminhoInterno } from "@arp/shared/os/chamado";
import { numeroDo } from "@arp/shared/os/numeros";
import { calcularPrazo } from "@arp/shared/os/prazo";
import { rotaDo } from "@arp/shared/os/rotas";
import type { Tx } from "@/infra/banco";
import type {
  JsonValue,
  OsOrigemChamado,
  OsPrioridade,
  OsTipoChamado,
} from "@/infra/banco/tipos";
import { type Alvo, donoDo } from "./alvo";
import * as base from "./base.repository";
import {
  type Categoria,
  calendarioDe,
  notificarNoEscopo,
  registrarComoSistema,
} from "./base.service";
import * as repo from "./chamados.repository";
import { tentar } from "./tentar";

// Criação de chamado ou OS pelo sistema (service role): portal do lojista,
// modelos de entrada e saída, planos preventivos, lembretes recorrentes e
// outros módulos (origem 'modulo', ver ./sistema.service.ts).
// Quem chama já conferiu o acesso (token do link, rotina) e abriu o escopo
// `comoServico`. A categoria dá os padrões (tipo, responsável, prioridade,
// prazo, confirmação, checklist), e quem chama pode sobrescrever. Só tipo
// 'os' explícito cria OS (em os.ordens): a categoria de OS não transforma o
// pedido do portal nem o modelo em OS.

export interface NovoChamadoSistema {
  setorId: string;
  categoriaId?: string | null;
  titulo: string;
  descricao?: string | null;
  tipo?: OsTipoChamado;
  origem: OsOrigemChamado;
  /** Quem "abriu" (usuário do modelo, do plano); null para o portal. */
  abertoPor?: string | null;
  /** Nome que aparece na linha do tempo como autor ("Portal – Loja X"). */
  autorNome: string;
  responsavelId?: string | null;
  prioridade?: OsPrioridade;
  /** Prazo exato; sem ele, vale o da categoria a partir de agora. */
  prazo?: Date | null;
  solicitanteNome?: string | null;
  solicitanteTelefone?: string | null;
  lojaId?: string | null;
  /** Só na OS. Onde: área comum, ponto (ex.: casa de máquinas) e bloco. */
  local?: string | null;
  bloco?: string | null;
  ativoId?: string | null;
  vistoriaId?: string | null;
  /** Só na OS: o plano preventivo e a data da ocorrência. */
  planoId?: string | null;
  planoData?: string | null;
  serieId?: string | null;
  serieData?: string | null;
  recorrencia?: JsonValue | null;
  campos?: Record<string, JsonValue>;
  checklist?: JsonValue[];
  etiquetas?: string[];
  /** Vários destinos (Aviso de entrada de cliente): um por setor/pessoa. */
  destinatarios?: {
    setorId?: string | null;
    usuarioId?: string | null;
    titulo?: string | null;
    prazo?: Date | null;
    responsavelId?: string | null;
  }[];
  /** Texto da notificação no lugar do padrão ("Preventiva criada."). */
  aviso?: { tipo: string; texto: string };
  /**
   * Botão "Executar" do detalhe: caminho interno da tela onde o trabalho é
   * feito ("/sustentabilidade/entrevistas/..."), começando com "/".
   */
  acaoUrl?: string | null;
  /**
   * O que o módulo salva, com artigo ("a entrevista", "a ronda da semana"):
   * entra em "Este chamado fecha sozinho ao salvar <acaoRotulo> no módulo".
   */
  acaoRotulo?: string | null;
  /**
   * Só o módulo conclui (./sistema.service.ts); a pessoa não conclui pelo
   * Chamados (o banco também recusa). Exige acaoUrl e não aceita vários
   * destinos.
   */
  conclusaoExterna?: boolean;
  /** Módulo que criou ("sustentabilidade"), com origem 'modulo'. */
  origemModulo?: string | null;
  /** Referência no módulo ("entrevista:<contrato_id>"), para achar o chamado. */
  origemRef?: string | null;
}

export interface ChamadoCriado extends Alvo {
  numero: number;
}

const ehObjeto = (v: JsonValue): v is Record<string, JsonValue> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Grava o chamado, os destinatários, o evento "criado" e as notificações,
 * tudo no escopo de quem chama. Devolve null se já existia (série/plano na
 * mesma data: o banco recusa a repetição) — quem chama trata como "nada a
 * fazer" (o escopo segue valendo).
 */
export async function criarChamadoSistema(
  tx: Tx,
  n: NovoChamadoSistema,
  agora = new Date(),
): Promise<ChamadoCriado | null> {
  if (n.acaoUrl && !ehCaminhoInterno(n.acaoUrl))
    throw new Error(`acaoUrl precisa ser um caminho interno: ${n.acaoUrl}`);
  if (n.conclusaoExterna && !n.acaoUrl)
    throw new Error("Conclusão externa precisa de acaoUrl (botão Executar).");
  // O último destino concluiria o chamado pelo banco, sem passar pelo módulo.
  if (n.conclusaoExterna && n.destinatarios?.length)
    throw new Error("Conclusão externa não aceita vários destinos.");
  const categoria = n.categoriaId
    ? ((await base.categoria(tx, n.categoriaId)) ?? null)
    : null;

  const padrao =
    categoria?.tipo_padrao === "os" ? null : categoria?.tipo_padrao;
  const tipo = n.tipo ?? padrao ?? "solicitacao";
  // Aviso não tem prazo: é para ler.
  const prazo =
    tipo === "aviso"
      ? null
      : (n.prazo ?? (await prazoDaCategoria(tx, categoria, agora)));
  const precisaConfirmacao =
    tipo === "aviso" ? false : (categoria?.precisa_confirmacao ?? true);
  const checklist =
    n.checklist ??
    (Array.isArray(categoria?.checklist)
      ? categoria.checklist.map((item) => ({
          ...(ehObjeto(item) ? item : {}),
          feito: false,
        }))
      : []);

  const comum = {
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
    ativo_id: n.ativoId ?? null,
    vistoria_id: n.vistoriaId ?? null,
    serie_id: n.serieId ?? null,
    serie_data: n.serieData ?? null,
    recorrencia: n.recorrencia == null ? null : JSON.stringify(n.recorrencia),
    campos: JSON.stringify(n.campos ?? {}),
    checklist: JSON.stringify(checklist),
    etiquetas: n.etiquetas ?? [],
    acao_url: n.acaoUrl ?? null,
    acao_rotulo: n.acaoRotulo?.trim() || null,
    conclusao_externa: n.conclusaoExterna ?? false,
    origem_modulo: n.origemModulo ?? null,
    origem_ref: n.origemRef ?? null,
  };
  const COLUNAS = ["id", "numero", "tipo", "responsavel_id"] as const;
  const gravado = await tentar(tx, () =>
    tipo === "os"
      ? tx
          .insertInto("os.ordens")
          .values({
            ...comum,
            local: n.local ?? null,
            bloco: n.bloco ?? null,
            plano_id: n.planoId ?? null,
            plano_data: n.planoData ?? null,
          })
          .returning(COLUNAS)
          .executeTakeFirstOrThrow()
      : tx
          .insertInto("os.chamados")
          .values({ ...comum, tipo })
          .returning(COLUNAS)
          .executeTakeFirstOrThrow(),
  );
  if (!gravado.ok) {
    // Mesma série/plano na mesma data: já foi criado antes.
    if (gravado.codigo === "23505") return null;
    throw gravado.erro;
  }
  const data = gravado.valor;

  if (n.destinatarios?.length)
    await repo.inserirDestinos(
      tx,
      n.destinatarios.map((d, i) => ({
        ...donoDo(data),
        setor_id: d.setorId ?? null,
        usuario_id: d.usuarioId ?? null,
        titulo: d.titulo ?? null,
        prazo: tipo === "aviso" ? null : (d.prazo?.toISOString() ?? null),
        responsavel_id: d.responsavelId ?? null,
        ordem: i,
      })),
    );

  await tentar(tx, () =>
    registrarComoSistema(tx, data, {
      tipo: "criado",
      autorNome: n.autorNome,
      texto: `${tipo === "os" ? "OS aberta" : "Chamado aberto"} por ${n.autorNome}.`,
      dados: { origem: n.origem },
      visivelLojista: n.origem === "portal",
    }),
  );

  await avisarCriacao(
    tx,
    { ...data, setor_id: n.setorId, titulo: n.titulo },
    n.destinatarios ?? [],
    n.abertoPor ?? null,
    n.aviso,
  );
  return { id: data.id, tipo: data.tipo, numero: data.numero };
}

async function prazoDaCategoria(
  tx: Tx,
  categoria: Categoria | null,
  agora: Date,
): Promise<Date | null> {
  if (!categoria?.prazo_valor) return null;
  const p = await base.parametros(tx);
  return calcularPrazo(
    {
      abertura: agora,
      valor: categoria.prazo_valor,
      unidade: categoria.prazo_unidade,
    },
    calendarioDe(p, await base.feriados(tx)),
  );
}

/** Novo para mim → eu; para a fila do setor → todos do setor; destinos → cada um. */
async function avisarCriacao(
  tx: Tx,
  ch: {
    id: string;
    tipo: OsTipoChamado;
    numero: number;
    responsavel_id: string | null;
    setor_id: string;
    titulo: string;
  },
  destinos: NonNullable<NovoChamadoSistema["destinatarios"]>,
  autor: string | null,
  aviso?: NovoChamadoSistema["aviso"],
) {
  const href = rotaDo(ch);
  const titulo = `${numeroDo(ch)} ${ch.titulo}`;
  if (destinos.length) {
    const quem = new Set<string>();
    for (const d of destinos) {
      if (d.usuarioId) quem.add(d.usuarioId);
      if (d.responsavelId) quem.add(d.responsavelId);
      if (d.setorId)
        for (const m of await base.membrosDoSetor(tx, d.setorId)) quem.add(m);
    }
    await notificarNoEscopo(
      tx,
      [...quem],
      {
        tipo: aviso?.tipo ?? "novo",
        titulo,
        texto: aviso?.texto ?? "Novo chamado para você ou o seu setor.",
        href,
        alvo: ch,
      },
      autor,
    );
    return;
  }
  const quem = ch.responsavel_id
    ? [ch.responsavel_id]
    : await base.membrosDoSetor(tx, ch.setor_id);
  await notificarNoEscopo(
    tx,
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
      alvo: ch,
    },
    autor,
  );
}
