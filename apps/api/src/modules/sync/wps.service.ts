import { mensagemSegura } from "@/connectors/http";
import {
  LEITURAS_DO_DIA,
  type LeituraDoDia,
  type WpsClient,
} from "@/connectors/wps/client";
import { banco } from "@/infra/banco";
import { wps as criarClienteWps } from "./credenciais.service";
import { emParalelo, executar, guardarBrutos } from "./execucao.service";
import {
  acessosDoDia,
  acessosSemLista,
  contratosDe,
  eventosDe,
  garagemDe,
  type LinhaAcesso,
  type LinhaEvento,
  mensalidadesDe,
} from "./wps.detalhes";
import {
  type DiaEstacionamento,
  dataLocal,
  diasParaSincronizar,
  isoDoDia,
  janelaDasMensalidades,
  linhasDoDia,
  pagamentosSemPlaca,
  semRepetirEntreDias,
} from "./wps.regras";
import * as repo from "./wps.repository";

const SISTEMA = "wps";
const LEITURAS = Object.keys(LEITURAS_DO_DIA) as LeituraDoDia[];

export interface OpcoesWps {
  hoje?: Date;
  /** Força os dias ("aaaa-mm-dd"), ex.: reprocessar setembro. */
  dias?: string[];
}

export interface ResultadoWps {
  estacionamento: number;
  dias: number;
  pagamentos: number;
  entradas: number;
  saidas: number;
  eventos: number;
  contratos: number | null;
  mensalidades: number | null;
  avisos: string[];
}

/** Uma leitura do dia já convertida em eventos (mantém o tipo ligado à resposta). */
async function lerEventos<K extends LeituraDoDia>(
  api: WpsClient,
  tipo: K,
  dia: string,
): Promise<LinhaEvento[]> {
  return eventosDe(tipo, await api.doDia(tipo, dataLocal(dia)));
}

/**
 * Traz da WPS, para cada dia, os pagamentos (sem repetição), as entradas e
 * saídas (por tipo de veículo e por hora) e as demais leituras do dia
 * (descontos, validações, selos, abonos, manobras, cancelamentos…); e, uma
 * vez, os contratos, as mensalidades e o cadastro da garagem. Troca tudo no
 * banco de uma vez. Dia sem pagamentos/entradas/saídas fica como estava; as
 * outras leituras que falharem também ficam como estavam. Tudo vira aviso.
 */
export async function sincronizarWps(opcoes: OpcoesWps = {}) {
  const api = await criarClienteWps();
  const hoje = opcoes.hoje ?? new Date();
  const dias = opcoes.dias ?? diasParaSincronizar(hoje);
  const id = api.estacionamentoId;

  return executar(SISTEMA, "estacionamento", async (runId) => {
    const avisos: string[] = [];
    const falhou = (onde: string, erro: unknown) =>
      avisos.push(`${onde}: não lido (${mensagemSegura(erro).slice(0, 200)})`);

    // 1. Chamadas externas, todas fora do escopo do banco.
    const base = await emParalelo(dias, 3, async (dia) => {
      const data = dataLocal(dia);
      const [pagamentos, entradas, saidas] = await Promise.all([
        api.pagamentos(data),
        api.entradas(data),
        api.saidas(data),
      ]);
      return { dia, pagamentos, entradas, saidas };
    });

    const tarefas = dias.flatMap((dia) =>
      LEITURAS.map((tipo) => ({ dia, tipo })),
    );
    const extras = await emParalelo(tarefas, 4, ({ dia, tipo }) =>
      lerEventos(api, tipo, dia),
    );

    const janela = janelaDasMensalidades(hoje);
    const [
      clientes,
      lancamentos,
      garagens,
      setores,
      mensalistas,
      credenciados,
    ] = await Promise.allSettled([
      api.clientes(),
      api.lancamentos(janela.de, janela.ate),
      api.garagens(),
      api.setores(),
      api.totalDeClientes("MENSALISTA"),
      api.totalDeClientes("CREDENCIADO"),
    ]);

    // 2. Pagamentos, movimento e acessos por hora.
    const lidos: DiaEstacionamento[] = [];
    const acessos: { data: string; linhas: LinhaAcesso[] }[] = [];
    const brutos = [];
    for (const [i, r] of base.entries()) {
      if (r.status === "rejected") {
        falhou(dias[i] ?? "?", r.reason);
        continue;
      }
      const { dia, pagamentos, entradas, saidas } = r.value;
      lidos.push(linhasDoDia(dia, pagamentos, entradas, saidas));
      const porHora = acessosDoDia(entradas, saidas);
      acessos.push({ data: dia, linhas: porHora.linhas });
      if (porHora.semDetalhe > 0) {
        avisos.push(
          `${dia}: ${porHora.semDetalhe} acessos sem hora (contam no total, não no gráfico por hora)`,
        );
      }
      brutos.push({
        chave: `${id}:${dia}`,
        payload: {
          pagamento: pagamentosSemPlaca(pagamentos),
          entrada: acessosSemLista(entradas),
          saida: acessosSemLista(saidas),
        },
      });
    }
    if (lidos.length === 0) {
      throw new Error(`nenhum dia lido da WPS (${avisos[0] ?? "sem dias"})`);
    }

    const { dias: gravar, repetidos } = semRepetirEntreDias(lidos);
    if (repetidos > 0) {
      avisos.push(
        `${repetidos} pagamentos listados em mais de um dia (ficaram no último)`,
      );
    }

    // 3. Demais leituras do dia: um aviso por tipo, com os dias que falharam.
    const eventos: {
      data: string;
      tipo: LeituraDoDia;
      linhas: LinhaEvento[];
    }[] = [];
    const falhas = new Map<LeituraDoDia, { dias: number; erro: unknown }>();
    for (const [i, r] of extras.entries()) {
      const t = tarefas[i];
      if (!t) continue;
      if (r.status === "fulfilled") {
        eventos.push({ data: t.dia, tipo: t.tipo, linhas: r.value });
      } else {
        const f = falhas.get(t.tipo);
        falhas.set(t.tipo, {
          dias: (f?.dias ?? 0) + 1,
          erro: f?.erro ?? r.reason,
        });
      }
    }
    for (const [tipo, f] of falhas) {
      falhou(`${tipo} em ${f.dias} de ${dias.length} dias`, f.erro);
    }

    // 4. Cadastros: a situação de hoje.
    const contratos =
      clientes.status === "fulfilled" ? contratosDe(clientes.value) : null;
    if (clientes.status === "rejected") falhou("contratos", clientes.reason);

    const mensalidades =
      lancamentos.status === "fulfilled"
        ? mensalidadesDe(lancamentos.value)
        : null;
    if (lancamentos.status === "rejected")
      falhou("mensalidades", lancamentos.reason);
    if (mensalidades?.descartadas) {
      avisos.push(
        `${mensalidades.descartadas} mensalidades sem vencimento (ignoradas)`,
      );
    }

    if (setores.status === "rejected") falhou("setores", setores.reason);
    if (mensalistas.status === "rejected")
      falhou("total de mensalistas", mensalistas.reason);
    if (credenciados.status === "rejected")
      falhou("total de credenciados", credenciados.reason);
    const garagem =
      garagens.status === "fulfilled"
        ? garagemDe(
            garagens.value,
            id,
            setores.status === "fulfilled" ? setores.value : null,
            {
              mensalistas:
                mensalistas.status === "fulfilled" ? mensalistas.value : null,
              credenciados:
                credenciados.status === "fulfilled" ? credenciados.value : null,
            },
          )
        : null;
    if (garagens.status === "rejected") falhou("garagem", garagens.reason);
    else if (!garagem) avisos.push(`garagem ${id} não está na lista da WPS`);

    // 5. Grava tudo numa transação só.
    const diasGravados = new Set(gravar.map((d) => d.data));
    await banco.comoServico(async (tx) => {
      await repo.gravarEstacionamento(tx, id, gravar, runId);
      await repo.gravarAcessos(
        tx,
        id,
        acessos.filter((a) => diasGravados.has(a.data)),
        runId,
      );
      await repo.gravarEventos(tx, id, eventos, runId);
      if (contratos) await repo.gravarContratos(tx, id, contratos, runId);
      if (mensalidades)
        await repo.gravarMensalidades(
          tx,
          id,
          { de: isoDoDia(janela.de), ate: isoDoDia(janela.ate) },
          mensalidades.linhas,
          runId,
        );
      if (garagem) await repo.gravarGaragem(tx, id, garagem, runId);
    });

    await guardarBrutos(SISTEMA, "estacionamento_dia", runId, brutos);

    const soma = (f: (d: DiaEstacionamento) => number) =>
      gravar.reduce((s, d) => s + f(d), 0);
    const resultado: ResultadoWps = {
      estacionamento: id,
      dias: gravar.length,
      pagamentos: soma((d) => d.pagamentos.length),
      entradas: soma((d) => d.movimento.reduce((s, m) => s + m.entradas, 0)),
      saidas: soma((d) => d.movimento.reduce((s, m) => s + m.saidas, 0)),
      eventos: eventos.reduce((s, e) => s + e.linhas.length, 0),
      contratos: contratos?.length ?? null,
      mensalidades: mensalidades?.linhas.length ?? null,
      avisos,
    };
    return {
      ...resultado,
      registros: resultado.pagamentos,
      cursor: {
        executado_em: new Date().toISOString(),
        de: gravar[0]?.data ?? null,
        ate: gravar.at(-1)?.data ?? null,
        ...resultado,
      },
    };
  });
}
