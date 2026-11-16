import { hojeEmBrasilia, somarDias } from "@arp/shared/os/tempo";
import { limiteAtingido } from "@/connectors/diario-de-obras/client";
import type {
  ListaDeTarefas,
  ObraResumo,
  RelatorioResumo,
} from "@/connectors/diario-de-obras/schemas";
import { mensagemSegura } from "@/connectors/http";
import { banco } from "@/infra/banco";
import { diarioDeObras } from "./credenciais.service";
import {
  type CursorDiario,
  cursorSchema,
  devido,
  JANELA_DIAS,
  LIMITE_HISTORICO,
  LIMITE_JANELA,
  linhaDaLista,
  linhaDaObra,
  linhaDoDetalhe,
  precisaDetalhe,
  precisaFicha,
  type RelatorioNoBanco,
} from "./diario-de-obras.regras";
import * as repo from "./diario-de-obras.repository";
import * as execucoes from "./execucao.repository";
import { emLotes, emParalelo, executar, lerCursor } from "./execucao.service";

// Sincronização do Diário de Obra (só leitura; spec 4.9, "como a consulta
// funciona"):
// 1. /obras (a primeira chamada: token inválido ou aplicativo fora do ar
//    param aqui, a sync_run fica com o erro e as telas mostram a última cópia).
// 2. Os dados de exemplo saem assim que o token responde.
// 3. /empresa e /cadastros, uma vez por dia.
// 4. Por obra: /relatorios (na primeira vez, o histórico inteiro em ordem
//    crescente; depois, os últimos 30 dias); a ficha e o cronograma só quando
//    o "modified" da obra mudou ou algum relatório mudou.
// 5. O detalhe dos relatórios novos, com outro status ou ainda não
//    aprovados, mais os que ficaram sem detalhe na rodada anterior.
// Limite da API: o cliente espaça as chamadas (150/min) e espera no 429.
// Erro numa obra ou num relatório vira aviso e não derruba o resto. Se o
// prazo acabar ou o limite persistir, o que foi gravado fica e a próxima
// rodada continua de onde parou (os relatórios sem detalhe).

const SISTEMA = "diario_de_obras";
const RECURSO = "obras";
/** Prazo de uma rodada (a rota antiga tinha 300 s). */
const PRAZO_MS = 240_000;
/** Chamadas em andamento ao mesmo tempo (o espaçamento do cliente vale igual). */
const PARALELO = 3;
const MAX_AVISOS = 30;

export interface ResultadoDiario {
  registros: number;
  cursor: CursorDiario;
  obras: number;
  relatorios: number;
  detalhes: number;
  pendentes: number;
  exemplosRemovidos: boolean;
  avisos: string[];
}

export async function sincronizarDiario(
  opcoes: { agora?: Date; prazoMs?: number } = {},
): Promise<ResultadoDiario & { runId: string }> {
  const agora = opcoes.agora ?? new Date();
  const prazo = Date.now() + (opcoes.prazoMs ?? PRAZO_MS);
  const hoje = hojeEmBrasilia(agora);
  const iso = agora.toISOString();
  // Sem token: IntegracaoNaoConfigurada, antes de abrir a execução.
  const api = await diarioDeObras();
  const anterior = cursorSchema.parse(
    (await lerCursor(SISTEMA, RECURSO)) ?? {},
  );

  return executar(SISTEMA, RECURSO, async () => {
    const avisos: string[] = [];
    const avisar = (texto: string) => {
      if (avisos.length < MAX_AVISOS) avisos.push(texto.slice(0, 240));
    };
    const falha = (erro: unknown) => mensagemSegura(erro).slice(0, 160);
    let parar = false;
    const tempoAcabou = () => parar || Date.now() > prazo;

    // 1. Obras.
    const obras = await api.obras();

    // 2. Exemplos: só depois de o token responder.
    const exemplos = await banco.comoServico(repo.removerExemplos);

    // 3. Empresa e cadastros, uma vez por dia.
    let cadastrosEm = anterior.cadastrosEm ?? null;
    if (!cadastrosEm || hojeEmBrasilia(new Date(cadastrosEm)) !== hoje) {
      try {
        const empresa = await api.empresa();
        const cadastros = await api.cadastros();
        await banco.comoServico((tx) =>
          repo.gravarCadastros(tx, empresa, cadastros, iso),
        );
        cadastrosEm = iso;
      } catch (erro) {
        if (limiteAtingido(erro)) parar = true;
        avisar(`Empresa e cadastros: ${falha(erro)}`);
      }
    }

    // Obras apagadas no aplicativo saem daqui (com os relatórios).
    const noBanco = new Set(await banco.comoServico(repo.obras));
    const vistas = new Set(obras.map((o) => o._id));
    const sumiram = [...noBanco].filter((id) => !vistas.has(id));
    if (obras.length === 0 && noBanco.size > 0) {
      avisar(
        "O aplicativo devolveu nenhuma obra; as já guardadas foram mantidas.",
      );
    } else if (sumiram.length > 0) {
      await banco.comoServico((tx) => repo.removerObras(tx, sumiram));
    }

    // 4. Relatórios de cada obra (lista) e, se mudou, ficha e cronograma.
    const estado: CursorDiario["obras"] = Object.fromEntries(
      Object.entries(anterior.obras).filter(([id]) => vistas.has(id)),
    );
    const fila: { obraId: string; id: string; data: string }[] = [];
    /** Obras lidas por inteiro nesta rodada. */
    const feitas = new Set<string>();
    let relatorios = 0;

    async function sincronizarObra(o: ObraResumo) {
      const visto = estado[o._id];
      const historico = !visto?.historico || !noBanco.has(o._id);
      const desde = somarDias(hoje, -JANELA_DIAS);
      const limite = historico ? LIMITE_HISTORICO : LIMITE_JANELA;
      const lista: RelatorioResumo[] = await api.relatorios(
        o._id,
        historico
          ? { ordem: "asc", limite }
          : { periodo: { inicio: desde, fim: hoje }, limite },
      );
      if (lista.length >= limite)
        avisar(
          `${o.nome}: a API devolveu ${lista.length} relatórios, o limite pedido; pode haver mais.`,
        );

      const guardados = await banco.comoServico((tx) =>
        repo.relatoriosDaObra(
          tx,
          o._id,
          historico ? null : { desde, ate: hoje },
        ),
      );
      const salvos = new Map<string, RelatorioNoBanco>(
        guardados.map((r) => [
          r.id,
          { statusId: r.status_id, temDetalhe: r.detalhado_em !== null },
        ]),
      );
      const mudaram = lista.filter((r) => precisaDetalhe(r, salvos.get(r._id)));

      if (precisaFicha(o, visto, noBanco.has(o._id), mudaram.length > 0)) {
        const ficha = await api.obra(o._id);
        let cronograma: ListaDeTarefas | null = null;
        try {
          cronograma = await api.listaDeTarefas(o._id);
        } catch (erro) {
          if (limiteAtingido(erro)) throw erro;
          avisar(`${o.nome}, cronograma: ${falha(erro)}`);
        }
        await banco.comoServico((tx) =>
          repo.gravarObra(
            tx,
            linhaDaObra(ficha, cronograma, o.modified ?? null, iso),
          ),
        );
        noBanco.add(o._id);
      }

      for (const lote of emLotes(lista, 500))
        await banco.comoServico((tx) =>
          repo.gravarRelatorios(
            tx,
            lote.map((r) => linhaDaLista(r, o._id, iso)),
          ),
        );
      relatorios += lista.length;

      // Apagados no aplicativo (só quando a lista veio inteira).
      if (lista.length < limite) {
        const ids = new Set(lista.map((r) => r._id));
        const apagados = [...salvos.keys()].filter((id) => !ids.has(id));
        for (const lote of emLotes(apagados, 200))
          await banco.comoServico((tx) => repo.removerRelatorios(tx, lote));
      }

      for (const r of mudaram)
        fila.push({ obraId: o._id, id: r._id, data: r.data });
      estado[o._id] = { modified: o.modified ?? null, historico: true };
      feitas.add(o._id);
    }

    for (const o of obras) {
      if (tempoAcabou()) break;
      try {
        await sincronizarObra(o);
      } catch (erro) {
        if (limiteAtingido(erro)) parar = true;
        avisar(`${o.nome}: ${falha(erro)}`);
      }
    }
    const obrasFeitas = feitas.size;
    if (obrasFeitas < obras.length && !parar && Date.now() > prazo)
      avisar("O prazo da rodada acabou antes de todas as obras.");

    // 5. Detalhes: os desta rodada e os que ficaram sem detalhe antes.
    const pendentesAntes = await banco.comoServico((tx) =>
      repo.semDetalhe(tx, LIMITE_HISTORICO),
    );
    const naFila = new Set(fila.map((r) => r.id));
    for (const r of pendentesAntes)
      if (!naFila.has(r.id))
        fila.push({ obraId: r.obra_id, id: r.id, data: r.data });
    // Mais recentes primeiro: é o que a equipe consulta.
    fila.sort((a, b) => b.data.localeCompare(a.data));

    let detalhes = 0;
    let errosDetalhe = 0;
    await emParalelo(fila, PARALELO, async (r) => {
      if (tempoAcabou()) return;
      try {
        const completo = await api.relatorio(r.obraId, r.id);
        await banco.comoServico((tx) =>
          repo.gravarDetalhe(
            tx,
            r.id,
            linhaDoDetalhe(completo, new Date().toISOString()),
          ),
        );
        detalhes++;
      } catch (erro) {
        if (limiteAtingido(erro)) parar = true;
        errosDetalhe++;
        if (errosDetalhe <= 5) avisar(`Relatório ${r.id}: ${falha(erro)}`);
      }
    });
    if (errosDetalhe > 5)
      avisar(`Mais ${errosDetalhe - 5} relatórios não puderam ser lidos.`);

    const pendentes = await banco.comoServico(repo.contarSemDetalhe);
    if (parar)
      avisar(
        "O limite de 150 consultas por minuto continuou estourado (o token pode estar em uso em outro lugar); a próxima rodada continua de onde parou.",
      );
    else if (pendentes > 0)
      avisar(
        `${pendentes} relatórios ficaram para a próxima rodada (prazo de cada rodada).`,
      );

    const cursor: CursorDiario = {
      cadastrosEm,
      obras: estado,
      // Obra que falhou por erro dela não apressa a próxima; prazo e limite sim.
      pendente: pendentes > 0 || (obrasFeitas < obras.length && tempoAcabou()),
      avisos,
    };
    return {
      registros: obras.length + detalhes,
      cursor,
      obras: obras.length,
      relatorios,
      detalhes,
      pendentes,
      exemplosRemovidos: exemplos > 0,
      avisos,
    };
  });
}

/** Última rodada que terminou bem (para o intervalo e para as telas). */
export async function ultimaRodadaBoa(): Promise<{
  finalizadoEm: string;
  pendente: boolean;
} | null> {
  const r = await banco.comoServico((tx) =>
    execucoes.ultimaComSucesso(tx, SISTEMA, RECURSO),
  );
  if (!r?.finalizado_em) return null;
  return {
    finalizadoEm: r.finalizado_em,
    pendente: cursorSchema.parse(r.cursor_depois ?? {}).pendente,
  };
}

/**
 * Rotina agendada: roda se passou o intervalo dos Parâmetros
 * (obras_intervalo_min) desde a última rodada boa, ou se ela deixou
 * relatórios pendentes. Sem token, não roda (e não é erro).
 */
export async function sincronizarDiarioSeDevido(agora = new Date()) {
  const intervalo = await banco.comoServico(repo.intervaloDaRotina);
  const ultima = await ultimaRodadaBoa();
  if (!devido(ultima, intervalo, agora))
    return {
      pulado: `A última consulta terminou em ${ultima?.finalizadoEm}; o intervalo é de ${intervalo} min.`,
    };
  return sincronizarDiario({ agora });
}

export { RECURSO as RECURSO_DIARIO, SISTEMA as SISTEMA_DIARIO };
