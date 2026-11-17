import {
  aceiteVenceu,
  avisoDoPrazo,
  chaveDoAviso,
  confirmacaoParada,
  dataDaOcorrencia,
  datasACriar,
  destinoVenceu,
  JANELA_VENCIDO_DIAS,
  lerRecorrencia,
  prazoDaOcorrencia,
  TEXTO_FECHADO_AUTOMATICO,
} from "@arp/shared/os/automacao";
import { checklistInicial } from "@arp/shared/os/chamado";
import type { ResultadoRotina } from "@arp/shared/os/contratos/configuracoes";
import {
  contratoNovo,
  contratoSaindo,
  itensDoContrato,
  JANELA_CONTRATO_DIAS,
} from "@arp/shared/os/modelos";
import { formatarNumeroOS, numeroDo } from "@arp/shared/os/numeros";
import type { Calendario } from "@arp/shared/os/prazo";
import { dataHoraBr } from "@arp/shared/os/relatorios";
import { rotaDo, rotaOrdem } from "@arp/shared/os/rotas";
import { hojeEmBrasilia, MS_DIA, somarDias } from "@arp/shared/os/tempo";
import { prazoRelativo } from "@arp/shared/os/texto";
import { banco, type Tx } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";
import { registrarDepois } from "@/infra/eventos";
import { log } from "@/infra/log";
import { type Alvo, ordem } from "./alvo";
import {
  avancarPlano,
  criarPreventiva,
  preventivasDevidas,
} from "./ativos-preventivas.service";
import {
  type AvisoPlanejado,
  cacheDeSetores,
  configDoSistema,
  notificarUmaVez,
} from "./automacao.service";
import {
  notificarNoEscopo,
  type Parametros,
  registrarComoSistema,
} from "./base.service";
import { criarChamadoSistema } from "./criar.service";
import { modelos as lerModelos } from "./modelos.repository";
import { dispararModelo, paraItem } from "./modelos.service";
import type { Recorte, Tabela } from "./rotinas.repository";
import * as repo from "./rotinas.repository";

// Rotinas do módulo, uma vez por dia (agendador, 10:30 UTC) ou pelo botão
// "Rodar rotinas agora": aceite automático e avisos de prazo, lembretes
// recorrentes, modelos de entrada e saída, planos preventivos e cobrança do
// terceirizado. Cada uma roda isolada: uma falha não impede as outras. Todas
// são idempotentes (rodar de novo não cria nada a mais). Service role, sem
// sessão; cada registro grava no seu escopo, como antes (um item com
// problema não desfaz os outros).
//
// `recorte` só existe para os testes: limita cada rotina a ids conhecidos
// (chamados, OS, séries, lojas, modelos, planos), para rodar com dados
// próprios na homologação sem tocar nos reais.

const DONOS: readonly Tabela[] = ["os.chamados", "os.ordens"];

const titulo = (c: Pick<Alvo, "tipo"> & { numero: number; titulo: string }) =>
  `${numeroDo(c)} ${c.titulo}`;

// ---------------------------------------------------------------------------
// Aceite automático, avisos de prazo e confirmação parada
// ---------------------------------------------------------------------------

/**
 * Fecha o Concluído depois do prazo de aceite, avisa "vence em N horas" e
 * "venceu" (do chamado e dos destinos de Aviso) e lembra a confirmação
 * parada. Devolve quantos fechou mais quantas notificações novas saíram.
 */
export async function rotinaAceite(
  agora: Date,
  recorte?: Recorte,
): Promise<number> {
  const { p, cal } = await banco.comoServico((tx) => configDoSistema(tx));
  const fechados = await fecharVencidos(p, cal, agora, recorte);
  return banco.comoServico(async (tx) => {
    const setores = cacheDeSetores(tx);
    const avisos = [
      ...(await avisosDePrazo(tx, p, agora, setores, recorte)),
      ...(await avisosDosDestinos(tx, agora, setores, recorte)),
      ...(await lembretesDeConfirmacao(tx, p, cal, agora, recorte)),
    ];
    return fechados + (await notificarUmaVez(tx, avisos));
  });
}

/** Concluído há mais que o prazo de aceite → Fechado sozinho. */
async function fecharVencidos(
  p: Parametros,
  cal: Calendario,
  agora: Date,
  recorte: Recorte,
): Promise<number> {
  const lidos = await banco.comoServico(async (tx) => {
    const todos = [];
    for (const t of DONOS)
      todos.push(...(await repo.concluidos(tx, t, recorte)));
    return todos;
  });
  let fechados = 0;
  for (const c of lidos) {
    if (!c.concluido_em) continue;
    if (!aceiteVenceu(c.concluido_em, p.aceite_dias_uteis, cal, agora))
      continue;
    const fechou = await banco
      .comoServico(async (tx) => {
        // Só fecha se ainda está Concluído (quem pediu pode ter confirmado
        // ou reaberto entre a leitura e agora).
        if (!(await repo.fecharAutomatico(tx, repo.tabelaDo(c), c.id)))
          return false;
        await registrarComoSistema(tx, c, {
          tipo: "status",
          autorNome: "Sistema",
          texto: TEXTO_FECHADO_AUTOMATICO,
          dados: { de: "concluido", para: "fechado", automatico: true },
        });
        await notificarNoEscopo(tx, [c.responsavel_id], {
          tipo: "fechado",
          titulo: titulo(c),
          texto: TEXTO_FECHADO_AUTOMATICO,
          href: rotaDo(c),
          alvo: c,
        });
        return true;
      })
      .catch((erro: unknown) => {
        throw new Error(
          `Fechar ${numeroDo(c)}: ${erro instanceof Error ? erro.message : erro}`,
        );
      });
    if (fechou) fechados++;
  }
  return fechados;
}

/**
 * Vence em N horas → responsável (ou a fila do setor). Venceu → responsável
 * e gestores do setor. Vencido há muito tempo não avisa de novo: o aviso é
 * do momento em que venceu (a tela já mostra o atraso).
 */
async function avisosDePrazo(
  tx: Tx,
  p: Parametros,
  agora: Date,
  setores: ReturnType<typeof cacheDeSetores>,
  recorte: Recorte,
): Promise<AvisoPlanejado[]> {
  const ate = new Date(agora.getTime() + p.aviso_vencimento_horas * 3_600_000);
  const desde = new Date(agora.getTime() - JANELA_VENCIDO_DIAS * MS_DIA);
  const avisos: AvisoPlanejado[] = [];
  for (const t of DONOS)
    for (const c of await repo.comPrazoPerto(
      tx,
      t,
      desde.toISOString(),
      ate.toISOString(),
      recorte,
    )) {
      const tipo = avisoDoPrazo(c, agora, p.aviso_vencimento_horas);
      if (!tipo || !c.prazo) continue;
      const usuarios =
        tipo === "vence"
          ? c.responsavel_id
            ? [c.responsavel_id]
            : await setores.membros(c.setor_id)
          : [
              ...(c.responsavel_id ? [c.responsavel_id] : []),
              ...(await setores.gestores(c.setor_id)),
            ];
      avisos.push({
        usuarios,
        tipo,
        titulo: titulo(c),
        texto:
          tipo === "vence"
            ? `O prazo está chegando: ${prazoRelativo(c.prazo, agora)}.`
            : "O prazo venceu.",
        href: rotaDo(c),
        alvo: c,
        chave: chaveDoAviso(tipo, c.id, c.prazo),
      });
    }
  return avisos;
}

/** Destino de Aviso com prazo próprio que venceu → quem cuida dele. */
async function avisosDosDestinos(
  tx: Tx,
  agora: Date,
  setores: ReturnType<typeof cacheDeSetores>,
  recorte: Recorte,
): Promise<AvisoPlanejado[]> {
  const desde = new Date(agora.getTime() - JANELA_VENCIDO_DIAS * MS_DIA);
  const avisos: AvisoPlanejado[] = [];
  for (const t of DONOS)
    for (const d of await repo.destinosVencidos(
      tx,
      t,
      desde.toISOString(),
      agora.toISOString(),
      recorte,
    )) {
      if (!d.prazo || !destinoVenceu(d, agora)) continue;
      const { dono } = d;
      const quem = d.responsavel_id ?? d.usuario_id;
      const usuarios = quem
        ? [quem]
        : d.setor_id
          ? await setores.membros(d.setor_id)
          : [];
      avisos.push({
        usuarios,
        tipo: "venceu",
        titulo: titulo(dono),
        texto: `Venceu o prazo da sua parte${d.titulo ? `: ${d.titulo}` : ""}.`,
        href: rotaDo(dono),
        alvo: dono,
        chave: `venceu:destino:${d.id}:${new Date(d.prazo).toISOString()}`,
      });
    }
  return avisos;
}

/** Concluído esperando confirmação há N dias úteis → lembra quem pediu. */
async function lembretesDeConfirmacao(
  tx: Tx,
  p: Parametros,
  cal: Calendario,
  agora: Date,
  recorte: Recorte,
): Promise<AvisoPlanejado[]> {
  const avisos: AvisoPlanejado[] = [];
  for (const t of DONOS)
    for (const c of await repo.esperandoConfirmacao(tx, t, recorte)) {
      if (!c.concluido_em || !c.aberto_por) continue;
      if (
        !confirmacaoParada(
          c.concluido_em,
          p.confirmacao_alerta_dias,
          cal,
          agora,
        )
      )
        continue;
      avisos.push({
        usuarios: [c.aberto_por],
        tipo: "confirmar",
        titulo: titulo(c),
        texto:
          "Concluído e esperando a sua confirmação. Confirme ou reabra; sem resposta, fecha sozinho.",
        href: rotaDo(c),
        alvo: c,
        // Reaberto e concluído de novo, lembra de novo.
        chave: `confirmar:${c.id}:${new Date(c.concluido_em).toISOString()}`,
      });
    }
  return avisos;
}

// ---------------------------------------------------------------------------
// Lembretes recorrentes (Repetir): cada série cria a próxima ocorrência
// sozinha, N dias antes da data (parametros.recorrencia_antecedencia_dias).
// Série = serie_id (o id do primeiro chamado, gravado nele também) +
// serie_data. O banco recusa a mesma série na mesma data (unique), então
// rodar duas vezes não cria nada a mais. Parar a série = tirar o Repetir.
// Chamados e OS repetem cada um na sua tabela (a OS gera OS).
// ---------------------------------------------------------------------------

export async function rotinaRecorrencias(
  agora: Date,
  recorte?: Recorte,
): Promise<number> {
  let criados = 0;
  for (const t of DONOS) criados += await recorrenciasDe(t, agora, recorte);
  return criados;
}

async function recorrenciasDe(
  tabela: Tabela,
  agora: Date,
  recorte: Recorte,
): Promise<number> {
  const { cal, p, series, fins, destinosDe } = await banco.comoServico(
    async (tx) => {
      const config = await configDoSistema(tx);
      const lidas = await repo.ocorrenciasComRepetir(tx, tabela, recorte);
      // A ocorrência mais recente de cada série manda (Repetir editado vale
      // dali para a frente).
      const porSerie = new Map<string, (typeof lidas)[number]>();
      for (const c of lidas) {
        const chave = c.serie_id ?? c.id;
        const atual = porSerie.get(chave);
        if (!atual || dataDaOcorrencia(c) > dataDaOcorrencia(atual))
          porSerie.set(chave, c);
      }
      // A data mais nova de cada série, contando as ocorrências sem Repetir.
      const ultimas = new Map<string, { data: string; repete: boolean }>();
      for (const c of await repo.datasDasSeries(tx, tabela, [
        ...porSerie.keys(),
      ])) {
        if (!c.serie_id || !c.serie_data) continue;
        const atual = ultimas.get(c.serie_id);
        if (!atual || c.serie_data > atual.data)
          ultimas.set(c.serie_id, {
            data: c.serie_data,
            repete: c.recorrencia !== null,
          });
      }
      const destinos = await repo.destinosDas(
        tx,
        tabela,
        [...porSerie.values()].map((c) => c.id),
      );
      return {
        ...config,
        series: porSerie,
        fins: ultimas,
        destinosDe: (id: string) =>
          destinos.filter((d) => (d.ordem_id ?? d.chamado_id) === id),
      };
    },
  );

  const hoje = hojeEmBrasilia(agora);
  let criados = 0;
  for (const [serieId, ultima] of series) {
    const r = lerRecorrencia(ultima.recorrencia);
    if (!r) continue;
    let dataUltima = dataDaOcorrencia(ultima);
    const fim = fins.get(serieId);
    if (fim && fim.data > dataUltima) {
      // A ocorrência mais nova perdeu o Repetir: a série parou ali.
      if (!fim.repete) continue;
      dataUltima = fim.data;
    }
    if (!ultima.serie_id) {
      const data = dataUltima;
      await banco.comoServico((tx) =>
        repo.marcarPrimeira(tx, tabela, ultima.id, data),
      );
    }

    for (const dia of datasACriar(
      r,
      dataUltima,
      hoje,
      p.recorrencia_antecedencia_dias,
    )) {
      const prazo = prazoDaOcorrencia(dia, cal);
      const novo = await banco.comoServico(async (tx) => {
        const criado = await criarChamadoSistema(
          tx,
          {
            tipo: ultima.tipo,
            setorId: ultima.setor_id,
            categoriaId: ultima.categoria_id,
            titulo: ultima.titulo,
            descricao: ultima.descricao,
            origem: "recorrencia",
            abertoPor: ultima.aberto_por,
            autorNome: "Sistema (lembrete recorrente)",
            responsavelId: ultima.responsavel_id,
            prioridade: ultima.prioridade,
            prazo,
            lojaId: ultima.loja_id,
            ativoId: ultima.ativo_id,
            serieId,
            serieData: dia,
            recorrencia: ultima.recorrencia,
            campos: camposDe(ultima.campos),
            checklist: checklistInicial(ultima.checklist).map((i) => ({
              texto: i.texto,
              obrigatorio: i.obrigatorio,
              feito: false,
            })),
            etiquetas: ultima.etiquetas,
            // Chamado de outro módulo: a ocorrência nova também tem o
            // Executar e só conclui pelo módulo.
            acaoUrl: ultima.acao_url,
            acaoRotulo: ultima.acao_rotulo,
            conclusaoExterna: ultima.conclusao_externa,
            origemModulo: ultima.origem_modulo,
            origemRef: ultima.origem_ref,
            destinatarios: destinosDe(ultima.id).map((d) => ({
              setorId: d.setor_id,
              usuarioId: d.usuario_id,
              titulo: d.titulo,
              responsavelId: d.responsavel_id,
              prazo,
            })),
          },
          agora,
        );
        // A criação pelo sistema tira a confirmação da categoria; a
        // ocorrência repete o que a anterior tinha (tarefa pessoal, sem
        // confirmação, destinos em ordem).
        if (criado)
          await repo.manterTipoDeTarefa(tx, repo.tabelaDo(criado), criado.id, {
            pessoal: ultima.pessoal,
            precisa_confirmacao: ultima.precisa_confirmacao,
            destinos_em_ordem: ultima.destinos_em_ordem,
          });
        return criado;
      });
      if (novo) criados++;
    }
  }
  return criados;
}

const camposDe = (v: JsonValue): Record<string, JsonValue> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(
        Object.entries(v).flatMap(([k, x]) =>
          x === undefined ? [] : [[k, x]],
        ),
      )
    : {};

// ---------------------------------------------------------------------------
// Modelos de entrada e saída: contrato novo (vigente com início nos últimos
// dias ou no futuro) dispara o modelo de entrada; saída (data de saída
// chegou ou contrato encerrado) dispara o de saída. Uma vez só por modelo e
// loja (os.disparos). Até a API do ENET, as lojas entram à mão. Devolve
// quantos avisos criou.
// ---------------------------------------------------------------------------

export async function rotinaModelos(
  agora: Date,
  recorte?: Recorte,
): Promise<number> {
  const hoje = hojeEmBrasilia(agora);
  const desde = somarDias(hoje, -JANELA_CONTRATO_DIAS);
  const lido = await banco.comoServico(async (tx) => {
    const ativos = (await lerModelos(tx)).filter(
      (m) =>
        m.ativo &&
        (m.gatilho === "entrada" || m.gatilho === "saida") &&
        (!recorte || recorte.includes(m.id)),
    );
    if (!ativos.length) return null;
    const lojas = await repo.lojasCandidatas(tx, hoje, desde, recorte);
    if (!lojas.length) return null;
    const ja = await repo.disparosDosModelos(
      tx,
      ativos.map((m) => m.id),
    );
    return {
      modelos: ativos,
      lojas,
      feitos: new Set(ja.map((d) => `${d.modelo_id}|${d.loja_id}`)),
      cal: (await configDoSistema(tx)).cal,
    };
  });
  if (!lido) return 0;

  let criados = 0;
  const falhas: string[] = [];
  for (const loja of lido.lojas) {
    const contrato = {
      ...loja,
      situacao:
        loja.situacao === "encerrado"
          ? ("encerrado" as const)
          : ("vigente" as const),
    };
    for (const modelo of lido.modelos) {
      if (lido.feitos.has(`${modelo.id}|${loja.id}`)) continue;
      const vale =
        modelo.gatilho === "entrada"
          ? contratoNovo(contrato, hoje)
          : contratoSaindo(contrato, hoje);
      if (!vale) continue;
      // Nenhum item vale para o contrato (ex.: só credenciamento e a loja
      // não tem vaga): nada a avisar, e não é falha.
      if (!itensDoContrato(modelo.itens.map(paraItem), loja).length) continue;
      // Uma loja com problema não segura as outras: segue e avisa no fim.
      try {
        const disparo = await dispararModelo({
          modelo,
          loja,
          usuario: null,
          automatico: true,
          agora,
          cal: lido.cal,
        });
        if (disparo) criados++;
      } catch (erro) {
        log.error(
          { err: erro, modelo: modelo.id, loja: loja.id },
          "rotina de modelos",
        );
        falhas.push(
          `${modelo.nome} – ${loja.nome}: ${erro instanceof Error ? erro.message : "falha"}`,
        );
      }
    }
  }
  if (falhas.length)
    throw new Error(
      `${criados} avisos criados; ${falhas.length} não: ${falhas.slice(0, 5).join("; ")}`,
    );
  return criados;
}

// ---------------------------------------------------------------------------
// Planos preventivos: cria a OS preventiva N dias antes da data (uma vez só
// por plano e data) e avança a próxima data do plano. Devolve quantas OS
// criou mais quantos planos avançou. Ativo baixado não gera OS.
// ---------------------------------------------------------------------------

const AUTOR_PREVENTIVA = "Plano preventivo";

export async function rotinaPreventivas(
  agora: Date,
  recorte?: Recorte,
): Promise<number> {
  const { devidas, expedienteFim } = await banco.comoServico((tx) =>
    preventivasDevidas(tx, agora),
  );
  let feitos = 0;
  for (const { plano, datas, proxima, ativo } of devidas) {
    if (recorte && !recorte.includes(plano.id)) continue;
    if (!ativo || ativo.situacao === "baixado") continue;
    try {
      feitos += await banco.comoServico(async (tx) => {
        let n = 0;
        for (const data of datas) {
          const criado = await criarPreventiva(tx, plano, ativo, data, {
            expedienteFim,
            autorNome: AUTOR_PREVENTIVA,
            agora,
          });
          if (criado) n++;
        }
        // Só avança se ninguém mexeu na data enquanto isso (outra rodada,
        // "Gerar agora" ou edição do plano).
        if (await avancarPlano(tx, plano.id, plano.proxima_data, proxima)) n++;
        return n;
      });
    } catch (erro) {
      // Um plano com problema não segura os outros.
      log.error({ err: erro, plano: plano.id }, "rotina preventivas");
    }
  }
  return feitos;
}

// ---------------------------------------------------------------------------
// Prazo do terceirizado (spec 4.8): um dia antes de vencer, o responsável da
// OS recebe o aviso para cobrar; o botão "Cobrar pelo WhatsApp" fica no
// bloco da OS, com a mensagem pronta. Um aviso por OS (cobranca_avisada_em
// e a chave da notificação). Devolve quantas OS avisou.
// ---------------------------------------------------------------------------

const ANTECEDENCIA_COBRANCA_MS = 24 * 3_600_000;

export async function rotinaCobrancaTerceirizado(
  agora: Date,
  recorte?: Recorte,
): Promise<number> {
  const ate = new Date(agora.getTime() + ANTECEDENCIA_COBRANCA_MS);
  const { ordens, links } = await banco.comoServico(async (tx) => {
    const lidas = await repo.ordensParaCobrar(tx, ate.toISOString(), recorte);
    return {
      ordens: lidas,
      links: await repo.linksDasOrdens(
        tx,
        lidas.map((o) => o.id),
      ),
    };
  });

  let avisadas = 0;
  for (const ch of ordens) {
    const link = links.find((l) => l.ordem_id === ch.id);
    // Já terminou pelo link: não há o que cobrar.
    if (link?.terminado_em || !ch.prazo_terceirizado) continue;
    const prazo = ch.prazo_terceirizado;
    const vencido = new Date(prazo).getTime() < agora.getTime();
    try {
      await banco.comoServico(async (tx) => {
        await notificarNoEscopo(
          tx,
          [ch.responsavel_id ?? link?.criado_por ?? ch.aberto_por],
          {
            tipo: "cobranca",
            titulo: `${formatarNumeroOS(ch.numero)} ${ch.titulo}`,
            texto: vencido
              ? `O prazo do terceirizado venceu em ${dataHoraBr(prazo)}. Cobre pelo WhatsApp na OS.`
              : `O prazo do terceirizado vence em ${dataHoraBr(prazo)}. Cobre pelo WhatsApp na OS.`,
            href: rotaOrdem(ch.id),
            alvo: ordem(ch.id),
            // Link novo (outro prazo) avisa de novo: a chave leva o prazo.
            chave: `cobranca:${ch.id}:${prazo}`,
          },
        );
        await repo.marcarCobranca(tx, ch.id, agora.toISOString());
      });
      avisadas++;
    } catch (erro) {
      log.error({ err: erro, ordem: ch.id }, "cobrança do terceirizado");
    }
  }
  return avisadas;
}

// ---------------------------------------------------------------------------
// Todas, em sequência
// ---------------------------------------------------------------------------

const ROTINAS: {
  chave: string;
  rotulo: string;
  rodar: (agora: Date, recorte?: Recorte) => Promise<number>;
}[] = [
  {
    chave: "aceite",
    rotulo: "Aceite automático e avisos de prazo",
    rodar: rotinaAceite,
  },
  {
    chave: "recorrencias",
    rotulo: "Lembretes recorrentes",
    rodar: rotinaRecorrencias,
  },
  {
    chave: "modelos",
    rotulo: "Modelos de entrada e saída de cliente",
    rodar: rotinaModelos,
  },
  {
    chave: "preventivas",
    rotulo: "Planos preventivos",
    rodar: rotinaPreventivas,
  },
  {
    chave: "cobranca",
    rotulo: "Cobrança do terceirizado",
    rodar: rotinaCobrancaTerceirizado,
  },
];

/**
 * Roda tudo, uma rotina depois da outra (em sequência uma não disputa a
 * outra pelo mesmo chamado). Registra no histórico quando algo mudou, quando
 * falhou ou quando foi pedido à mão.
 */
export async function rodarRotinas(
  agora = new Date(),
  usuarioId: string | null = null,
  recorte?: Recorte,
): Promise<ResultadoRotina[]> {
  const resultados: ResultadoRotina[] = [];
  for (const r of ROTINAS) {
    const inicio = Date.now();
    try {
      const registros = await r.rodar(agora, recorte);
      resultados.push({
        chave: r.chave,
        rotulo: r.rotulo,
        ok: true,
        registros,
        ms: Date.now() - inicio,
      });
    } catch (erro) {
      log.error({ err: erro, rotina: r.chave }, "rotina do módulo os");
      resultados.push({
        chave: r.chave,
        rotulo: r.rotulo,
        ok: false,
        registros: 0,
        erro: erro instanceof Error ? erro.message : "falha desconhecida",
        ms: Date.now() - inicio,
      });
    }
  }

  const total = resultados.reduce((t, r) => t + r.registros, 0);
  const falhas = resultados.filter((r) => !r.ok);
  if (total > 0 || falhas.length > 0 || usuarioId)
    registrarDepois({
      modulo: "os",
      evento: "os_rotina",
      descricao: [
        usuarioId ? "Rodou as rotinas à mão" : "Rotinas de hora em hora",
        `${total} ${total === 1 ? "registro" : "registros"}`,
        falhas.length
          ? `falha em ${falhas.map((f) => f.rotulo).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      usuarioId,
      detalhes: {
        rotinas: resultados.map((r) => ({
          rotina: r.chave,
          ok: r.ok,
          registros: r.registros,
          erro: r.erro,
          ms: r.ms,
        })),
      },
    });
  return resultados;
}
