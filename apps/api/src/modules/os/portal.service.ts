import { formatarDocumento } from "@arp/shared/documentos";
import { formatarData } from "@arp/shared/formato";
import type {
  AgendaDoPortal,
  ConsultaDasLojas,
  ConsultaDosLinks,
  EntradaAgenda,
  EntradaBloqueio,
  EntradaLoja,
  LinhaDoPortal,
  LojaDoPortal,
  RespostaAgendas,
  RespostaGravacao,
  RespostaLinks,
} from "@arp/shared/os/contratos/portal";
import type { Planilha } from "@arp/shared/os/contratos/visoes";
import type { ColunaExportar } from "@arp/shared/os/exportar";
import { paginaDaUrl } from "@arp/shared/os/paginacao";
import {
  type DiaDaEscolha,
  descreverHorario,
  horarioDisponivel,
  inicioDoMes,
  intervaloDoBloqueio,
  mediaDasNotas,
  modeloDaMensagem,
  paraEscolha,
} from "@arp/shared/os/portal";
import { lerFiltroLojas, lerFiltroPortal } from "@arp/shared/os/portal-lista";
import { ROTA_PORTAL } from "@arp/shared/os/rotas";
import { hojeEmBrasilia, paraBrasilia } from "@arp/shared/os/tempo";
import { linkWhatsApp, preencher } from "@arp/shared/os/whatsapp";
import { type Contexto, pode } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";
import { registrarDepois } from "@/infra/eventos";
import { log } from "@/infra/log";
import {
  type Agenda,
  agenda as agendaPeloId,
  agendas,
  bloqueiosFuturos,
  categoriasPorAgenda,
  diasLivres,
  ocupacao,
  paraRemarcar,
  proximosHorarios,
  regrasDe,
  reservar,
} from "./agenda.service";
import { chamado, UUID } from "./alvo";
import * as base from "./base.repository";
import { registrarComoSistema, urlDoSistema } from "./base.service";
import * as lojas from "./lojas.repository";
import { ACOES_DO_MODELO } from "./modelos.service";
import * as repo from "./portal.repository";

// Portal lojista, tela interna (spec 4.11). Acesso das lojas e lojas:
// os.portal; agendas, bloqueios e remarcação: os.portal_agenda (a rota
// confere). Tudo pela sessão (RLS e auditoria); encerrar o acesso fica
// também em core.logs e vale na hora: o portal confere a sessão e o contrato
// a cada chamada.

/** Endereço absoluto do portal (o mesmo para todas as lojas). */
export const urlDoPortal = () => urlDoSistema(ROTA_PORTAL);

/** Janela da avaliação média (mostrada no cartão). */
export const DIAS_DA_MEDIA = 90;

const desdeDaMedia = (agora: Date) =>
  new Date(agora.getTime() - DIAS_DA_MEDIA * 86_400_000).toISOString();

// ---------------------------------------------------------------------------
// Acesso das lojas ao portal
// ---------------------------------------------------------------------------

function registrarEncerramento(
  lojaId: string,
  loja: string,
  sessoes: number,
  usuarioId: string | null,
): void {
  registrarDepois({
    modulo: "os",
    evento: "os_link_portal",
    descricao: `Encerrou o acesso da loja ${loja} ao portal`,
    usuarioId,
    detalhes: { loja_id: lojaId, acao: "encerrar", sessoes },
  });
}

/** Encerra as sessões abertas da loja, no escopo de quem chama. */
async function encerrarSessoes(
  tx: Tx,
  lojaId: string,
  usuarioId: string | null,
): Promise<{ sessoes: number; loja: string }> {
  const encerradas = await repo.encerrarSessoesDaLoja(tx, lojaId, usuarioId);
  if (!encerradas.length) return { sessoes: 0, loja: lojaId };
  const loja = await repo.lojaParaOPortal(tx, lojaId);
  return { sessoes: encerradas.length, loja: loja?.nome ?? lojaId };
}

/** POST /os/portal/acessos/encerrar: quem estiver dentro sai na hora. */
export async function encerrarAcesso(
  ctx: Contexto,
  lojaId: string,
): Promise<string> {
  const r = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    encerrarSessoes(tx, lojaId, ctx.usuario.id),
  );
  if (r.sessoes)
    registrarEncerramento(lojaId, r.loja, r.sessoes, ctx.usuario.id);
  return r.sessoes
    ? "Acesso encerrado. Para voltar, a loja entra de novo com o CPF ou CNPJ."
    : "A loja não estava dentro do portal.";
}

// Ações dos modelos de entrada e saída (escopo do disparo, service role: a
// rotina ou quem disparou já teve o acesso conferido).

ACOES_DO_MODELO.portal_gerar = async (tx, p, chamadoId) => {
  const loja = await repo.lojaParaOPortal(tx, p.loja.id);
  if (!loja) throw new Error("Loja não encontrada.");
  if (loja.situacao !== "vigente")
    throw new Error("O contrato desta loja está encerrado.");
  await registrarComoSistema(tx, chamado(chamadoId), {
    tipo: "sistema",
    autorNome: "Sistema",
    texto: loja.cnpj
      ? `A loja entra no portal (${urlDoPortal()}) com o CNPJ. Envie o link pelo WhatsApp na tela do Portal.`
      : "A loja não tem CNPJ cadastrado e não consegue entrar no portal. Cadastre o CNPJ em Portal › Lojas.",
  });
};

ACOES_DO_MODELO.portal_cancelar = async (tx, p, chamadoId) => {
  const usuarioId = p.usuario?.id ?? null;
  const r = await encerrarSessoes(tx, p.loja.id, usuarioId);
  if (r.sessoes) registrarEncerramento(p.loja.id, r.loja, r.sessoes, usuarioId);
  await registrarComoSistema(tx, chamado(chamadoId), {
    tipo: "sistema",
    autorNome: "Sistema",
    texto: r.sessoes
      ? "Acesso da loja ao portal encerrado."
      : "A loja não estava dentro do portal; com o contrato encerrado, ela não entra mais.",
  });
};

// ---------------------------------------------------------------------------
// Links das lojas
// ---------------------------------------------------------------------------

type LojaDaLinha = LinhaDoPortal["loja"];

function recorte(c: ConsultaDosLinks, agora: Date): repo.Recorte {
  const { f, q } = lerFiltroPortal(c);
  return {
    f,
    busca: q,
    mes: inicioDoMes(agora),
    desdeDaMedia: desdeDaMedia(agora),
  };
}

/** Acesso, pedidos e notas das lojas pedidas. */
async function completarLojas(
  tx: Tx,
  lista: LojaDaLinha[],
  agora: Date,
): Promise<LinhaDoPortal[]> {
  if (lista.length === 0) return [];
  const ids = lista.map((l) => l.id);
  const sessoes = await repo.sessoesDasLojas(tx, ids);
  const pedidos = await repo.pedidosNoMesPorLoja(tx, ids, inicioDoMes(agora));
  const notas = await repo.notasRecentes(tx, desdeDaMedia(agora));
  const p = await base.parametros(tx);

  const modelo = modeloDaMensagem(p.mensagens, "portal_link");
  const url = urlDoPortal();
  const acessos = new Map<string, LinhaDoPortal["acesso"]>();
  for (const s of sessoes) {
    const a = acessos.get(s.loja_id) ?? { ultimo: null, dentro: false };
    if (
      s.ultimo_acesso_em &&
      (!a.ultimo || new Date(s.ultimo_acesso_em) > new Date(a.ultimo))
    )
      a.ultimo = s.ultimo_acesso_em;
    if (!s.encerrado_em && new Date(s.expira_em) > agora) a.dentro = true;
    acessos.set(s.loja_id, a);
  }
  const contar = new Map<string, number>();
  for (const c of pedidos)
    if (c.loja_id) contar.set(c.loja_id, Number(c.total));
  const notasPorLoja = new Map<string, number[]>();
  for (const c of notas)
    if (c.loja_id && c.avaliacao)
      notasPorLoja.set(c.loja_id, [
        ...(notasPorLoja.get(c.loja_id) ?? []),
        c.avaliacao,
      ]);

  return lista.map((loja) => {
    const n = notasPorLoja.get(loja.id) ?? [];
    return {
      loja,
      acesso: acessos.get(loja.id) ?? { ultimo: null, dentro: false },
      whatsapp: linkWhatsApp(
        loja.telefone,
        preencher(modelo, { nome: loja.nome, loja: loja.nome, link: url }),
      ),
      pedidosNoMes: contar.get(loja.id) ?? 0,
      media: mediaDasNotas(n),
      avaliacoes: n.length,
    };
  });
}

/** GET /os/portal/links: os cartões (contagens) e a página pedida. */
export function links(
  ctx: Contexto,
  c: ConsultaDosLinks,
): Promise<RespostaLinks> {
  const agora = new Date();
  const r = recorte(c, agora);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const semFiltro = (f: repo.Recorte["f"]) =>
      repo.contarLojas(tx, { ...r, f, busca: "" });
    const vigentes = await semFiltro(null);
    const entraram = await semFiltro("entraram");
    const semCnpj = await semFiltro("sem_cnpj");
    const pedidosNoMes = await repo.contarPedidosNoMes(tx, r.mes);
    const todas = (await repo.notasRecentes(tx, r.desdeDaMedia)).flatMap((n) =>
      n.avaliacao ? [n.avaliacao] : [],
    );
    const total = await repo.contarLojas(tx, r);
    const pagina = await repo.paginaDeLojas(tx, r, paginaDaUrl(c.pagina));
    return {
      agora: agora.toISOString(),
      diasDaMedia: DIAS_DA_MEDIA,
      indicadores: {
        vigentes,
        entraram,
        semCnpj,
        pedidosNoMes,
        media: mediaDasNotas(todas),
        avaliacoes: todas.length,
      },
      linhas: await completarLojas(tx, pagina, agora),
      total,
    };
  });
}

function exigirExportar(ctx: Contexto): void {
  if (!pode(ctx, "os.exportar"))
    throw new ErroDePermissao("Sem permissão para exportar.");
}

const dia = (iso: string | null) =>
  iso ? formatarData(paraBrasilia(new Date(iso)).data) : null;

const COLUNAS_LINKS: ColunaExportar[] = [
  { titulo: "LUC" },
  { titulo: "Loja" },
  { titulo: "Bloco" },
  { titulo: "CPF ou CNPJ" },
  { titulo: "Dentro do portal" },
  { titulo: "Último acesso" },
  { titulo: "Pedidos no mês", numero: true },
  { titulo: "Avaliação", numero: true },
];

/** GET /os/portal/links/exportacao: o filtro inteiro, lido só no clique. */
export function exportarLinks(
  ctx: Contexto,
  c: ConsultaDosLinks,
): Promise<Planilha> {
  exigirExportar(ctx);
  const agora = new Date();
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const todas = await repo.todasAsLojas(tx, recorte(c, agora));
    const linhas = await completarLojas(tx, todas, agora);
    return {
      colunas: COLUNAS_LINKS,
      linhas: linhas.map((l) => [
        l.loja.luc,
        l.loja.nome,
        l.loja.bloco,
        l.loja.cnpj ? formatarDocumento(l.loja.cnpj) : "Sem CPF ou CNPJ",
        l.acesso.dentro ? "Sim" : "Não",
        dia(l.acesso.ultimo),
        l.pedidosNoMes,
        l.media,
      ]),
    };
  });
}

// ---------------------------------------------------------------------------
// Lojas (contratos): cadastro manual até a API do ENET
// ---------------------------------------------------------------------------

/** GET /os/portal/lojas: só a página pedida, com a busca. */
export function listarLojas(
  ctx: Contexto,
  c: ConsultaDasLojas,
): Promise<{ lojas: LojaDoPortal[]; total: number }> {
  const { s, q } = lerFiltroLojas(c);
  return banco.comoUsuario(ctx.usuario.id, (tx) =>
    lojas.paginaDeLojas(tx, s, q, paginaDaUrl(c.pagina)),
  );
}

/** GET /os/portal/lojas/:id (null: não encontrada). */
export async function lerLoja(
  ctx: Contexto,
  id: string,
): Promise<LojaDoPortal | null> {
  if (!UUID.test(id)) return null;
  return (
    (await banco.comoUsuario(ctx.usuario.id, (tx) => lojas.loja(tx, id))) ??
    null
  );
}

const COLUNAS_LOJAS: ColunaExportar[] = [
  { titulo: "LUC" },
  { titulo: "Loja" },
  { titulo: "Locatário" },
  { titulo: "Bloco" },
  { titulo: "Situação" },
  { titulo: "Início" },
  { titulo: "Fim" },
  { titulo: "Telefone" },
  { titulo: "Vaga" },
];

/** GET /os/portal/lojas/exportacao: o filtro inteiro, lido só no clique. */
export async function exportarLojas(
  ctx: Contexto,
  c: ConsultaDasLojas,
): Promise<Planilha> {
  exigirExportar(ctx);
  const { s, q } = lerFiltroLojas(c);
  const lista = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    lojas.lojasDoFiltro(tx, s, q),
  );
  return {
    colunas: COLUNAS_LOJAS,
    linhas: lista.map((l) => [
      l.luc,
      l.nome,
      l.locatario,
      l.bloco,
      l.situacao === "vigente" ? "Vigente" : "Encerrado",
      l.inicio ? formatarData(l.inicio) : null,
      l.fim ? formatarData(l.fim) : null,
      l.telefone,
      l.tem_vaga === null ? null : l.tem_vaga ? "Sim" : "Não",
    ]),
  };
}

/** POST /os/portal/lojas: cria (sem id) ou salva o contrato. */
export async function salvarLoja(
  ctx: Contexto,
  d: EntradaLoja,
): Promise<RespostaGravacao> {
  const { id, ...loja } = d;
  if (!id) {
    await banco.comoUsuario(ctx.usuario.id, (tx) => repo.inserirLoja(tx, loja));
    return { mensagem: "Loja cadastrada.", criado: true };
  }
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const atual = await repo.lojaParaOPortal(tx, id);
    if (atual?.enet_id)
      throw new ErroDeNegocio(
        "Esta loja vem do ENET e não pode ser editada aqui.",
      );
    await repo.atualizarLoja(tx, id, loja);
  });
  // Contrato encerrado: o portal já recusa; aqui as sessões abertas também
  // são encerradas.
  if (loja.situacao === "encerrado")
    try {
      const r = await banco.comoUsuario(ctx.usuario.id, (tx) =>
        encerrarSessoes(tx, id, ctx.usuario.id),
      );
      if (r.sessoes)
        registrarEncerramento(id, r.loja, r.sessoes, ctx.usuario.id);
    } catch (err) {
      log.error({ err, lojaId: id }, "encerrar acesso da loja encerrada");
    }
  return { mensagem: "Loja salva.", criado: false };
}

// ---------------------------------------------------------------------------
// Agendas
// ---------------------------------------------------------------------------

/** Quantos dias à frente a lista de próximos horários mostra. */
const DIAS_PROXIMOS = 14;

const paraAgenda = (a: Agenda): AgendaDoPortal => ({
  id: a.id,
  nome: a.nome,
  hora_inicio: a.hora_inicio,
  hora_fim: a.hora_fim,
  duracao_min: a.duracao_min,
  limite_por_dia: a.limite_por_dia,
  antecedencia_dias: a.antecedencia_dias,
  dias_semana: a.dias_semana,
  orientacao: a.orientacao,
  ativo: a.ativo,
});

type Agendamento = Awaited<ReturnType<typeof paraRemarcar>>[number];

/** Mensagem "remarcar" pronta para o WhatsApp de cada agendamento. */
function mensagemDeRemarcar(
  a: Agendamento,
  agenda: string | undefined,
  mensagens: JsonValue,
): string {
  const { data, hora } = paraBrasilia(new Date(a.inicio));
  const texto = preencher(modeloDaMensagem(mensagens, "remarcar"), {
    nome: a.chamado?.solicitante_nome || a.loja?.nome,
    data: `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`,
    hora,
    assunto: a.chamado?.titulo ?? agenda,
    link: a.loja_id ? urlDoPortal() : null,
  });
  const telefone = a.chamado?.solicitante_telefone || a.loja?.telefone || null;
  return linkWhatsApp(telefone, texto);
}

/** GET /os/portal/agendas: agendas, bloqueios, quem remarcar e os próximos. */
export function lerAgendas(ctx: Contexto): Promise<RespostaAgendas> {
  const agora = new Date();
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const lista = await agendas(tx);
    const bloqueios = await bloqueiosFuturos(tx, agora);
    const remarcar = await paraRemarcar(tx);
    const proximos = await proximosHorarios(tx, agora, DIAS_PROXIMOS);
    const usos = await categoriasPorAgenda(tx);
    const p = await base.parametros(tx);
    const nomeDa = new Map(lista.map((a) => [a.id, a.nome]));
    // Dias livres de cada agenda que tem alguém para remarcar.
    const comRemarcacao = new Set(remarcar.map((a) => a.agenda_id));
    const dias: Record<string, DiaDaEscolha[]> = {};
    for (const a of lista)
      if (comRemarcacao.has(a.id))
        dias[a.id] = paraEscolha(await diasLivres(tx, a, agora));
    return {
      agora: agora.toISOString(),
      hoje: hojeEmBrasilia(agora),
      agendas: lista.map(paraAgenda),
      bloqueios: bloqueios.map((b) => ({
        id: b.id,
        agenda_id: b.agenda_id,
        inicio: b.inicio,
        fim: b.fim,
        motivo: b.motivo,
      })),
      remarcar: remarcar.map((a) => ({
        ...a,
        whatsapp: mensagemDeRemarcar(a, nomeDa.get(a.agenda_id), p.mensagens),
      })),
      dias,
      proximos,
      usos: Object.fromEntries(usos),
    };
  });
}

/** GET /os/portal/agendas/:id (null: não encontrada). */
export async function lerAgenda(
  ctx: Contexto,
  id: string,
): Promise<AgendaDoPortal | null> {
  if (!UUID.test(id)) return null;
  const a = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    agendaPeloId(tx, id),
  );
  return a ? paraAgenda(a) : null;
}

/** POST /os/portal/agendas: cria (sem id) ou salva as regras da agenda. */
export async function salvarAgenda(
  ctx: Contexto,
  d: EntradaAgenda,
): Promise<RespostaGravacao> {
  const { id, ...agenda } = d;
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    id ? repo.atualizarAgenda(tx, id, agenda) : repo.inserirAgenda(tx, agenda),
  );
  return id
    ? {
        mensagem: "Agenda salva. Vale para os próximos horários.",
        criado: false,
      }
    : { mensagem: "Agenda criada.", criado: true };
}

/**
 * Aviso ao lojista na linha do tempo do pedido ligado ao horário. Quem cuida
 * da agenda nem sempre vê o chamado (é de outro setor) e o RLS de os.eventos
 * recusaria o registro pela sessão: grava como sistema, com o nome de quem
 * fez, depois de a rota conferir os.portal_agenda e de ler o horário (o
 * chamado vem do agendamento, nunca do formulário).
 */
async function avisarNoPedido(
  avisos: {
    chamadoId: string;
    texto: string;
    dados?: Record<string, string | boolean>;
  }[],
  autor: string,
): Promise<void> {
  if (!avisos.length) return;
  try {
    await banco.comoServico(async (tx) => {
      for (const a of avisos)
        await registrarComoSistema(tx, chamado(a.chamadoId), {
          tipo: "sistema",
          autorNome: autor,
          texto: a.texto,
          dados: a.dados ?? {},
          visivelLojista: true,
        });
    });
  } catch (err) {
    log.error({ err }, "aviso da agenda no pedido");
  }
}

/**
 * POST /os/portal/bloqueios: bloqueia um dia ou um período (clima). Quem já
 * tinha horário vai para "Remarcar" (gatilho do banco) e vê o aviso no
 * portal.
 */
export async function bloquearAgenda(
  ctx: Contexto,
  b: EntradaBloqueio,
): Promise<string> {
  if (!b.dia_inteiro && (!b.hora_inicio || !b.hora_fim))
    throw new ErroDeNegocio(
      "Informe o horário do bloqueio ou marque o dia inteiro.",
    );
  const periodo = intervaloDoBloqueio({
    dataInicio: b.data_inicio,
    dataFim: b.data_fim,
    horaInicio: b.dia_inteiro ? null : b.hora_inicio,
    horaFim: b.dia_inteiro ? null : b.hora_fim,
  });
  if ("erro" in periodo) throw new ErroDeNegocio(periodo.erro);
  const inicio = periodo.inicio.toISOString();
  const fim = periodo.fim.toISOString();

  const afetados = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const lista = await repo.marcadosNoPeriodo(tx, b.agenda, inicio, fim);
    await repo.inserirBloqueio(tx, {
      agenda_id: b.agenda,
      inicio,
      fim,
      motivo: b.motivo,
      criado_por: ctx.usuario.id,
    });
    return lista;
  });

  // O lojista vê no pedido que precisa escolher outro horário.
  await avisarNoPedido(
    afetados.flatMap((a) =>
      a.chamado_id
        ? [
            {
              chamadoId: a.chamado_id,
              texto: `O horário de ${descreverHorario(new Date(a.inicio))} foi cancelado (${b.motivo}). Escolha um novo horário.`,
              dados: { agendamento_id: a.id, bloqueio: true },
            },
          ]
        : [],
    ),
    ctx.usuario.nome,
  );
  const n = afetados.length;
  return n
    ? `Bloqueado. ${n} horário${n === 1 ? "" : "s"} foi para "Remarcar".`
    : "Bloqueado. Nenhum horário marcado foi afetado.";
}

/** DELETE /os/portal/bloqueios/:id */
export async function removerBloqueio(
  ctx: Contexto,
  id: string,
): Promise<void> {
  await banco.comoUsuario(ctx.usuario.id, (tx) => repo.removerBloqueio(tx, id));
}

/**
 * POST /os/portal/agendamentos/:id/remarcacao: novo horário para quem foi
 * para "Remarcar" (a reserva confere tudo).
 */
export async function remarcarAgendamento(
  ctx: Contexto,
  id: string,
  horario: string,
): Promise<string> {
  const inicio = new Date(horario);
  const r = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const antigo = await repo.agendamento(tx, id);
    const agenda = antigo ? await agendaPeloId(tx, antigo.agenda_id) : null;
    if (!antigo || !agenda || antigo.status === "cancelado")
      throw new ErroDeNegocio("Agendamento não encontrado.");
    const diaDoHorario = paraBrasilia(inicio).data;
    const livre = horarioDisponivel({
      regras: regrasDe(agenda),
      inicio,
      ...(await ocupacao(tx, antigo.agenda_id, diaDoHorario, diaDoHorario)),
      agora: new Date(),
    });
    if (!livre) throw new ErroDeNegocio("Esse horário não está mais livre.");
    const novo = await reservar(tx, {
      agendaId: antigo.agenda_id,
      inicio: livre.inicio,
      fim: livre.fim,
      lojaId: antigo.loja_id,
      chamadoId: antigo.chamado_id,
    });
    if ("erro" in novo) throw new ErroDeNegocio(novo.erro);
    const quando = descreverHorario(livre.inicio);
    await repo.cancelarAgendamento(tx, antigo.id, `Remarcado para ${quando}`);
    return { antigo, novoId: novo.id, quando };
  });
  if (r.antigo.chamado_id)
    await avisarNoPedido(
      [
        {
          chamadoId: r.antigo.chamado_id,
          texto: `Horário remarcado para ${r.quando}.`,
          dados: { agendamento_id: r.novoId, de: r.antigo.id },
        },
      ],
      ctx.usuario.nome,
    );
  return `Remarcado para ${r.quando}.`;
}

/** POST /os/portal/agendamentos/:id/cancelamento */
export async function cancelarAgendamento(
  ctx: Contexto,
  id: string,
  motivo: string | undefined,
): Promise<void> {
  const data = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.cancelarAgendamento(tx, id, motivo || "Cancelado pela equipe"),
  );
  // Já cancelado (outra aba) ou fora do alcance do RLS: nada mudou.
  if (!data) throw new ErroDeNegocio("Este horário já foi cancelado.");
  if (data.chamado_id)
    await avisarNoPedido(
      [
        {
          chamadoId: data.chamado_id,
          texto: `O horário de ${descreverHorario(new Date(data.inicio))} foi cancelado.`,
        },
      ],
      ctx.usuario.nome,
    );
}
