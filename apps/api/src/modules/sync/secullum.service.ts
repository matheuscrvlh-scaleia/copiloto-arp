import { ConnectorError, mensagemSegura } from "@/connectors/http";
import { diasDoCalculo, totaisDoCalculo } from "@/connectors/secullum/calculo";
import {
  LIMITE_CALCULAR_POR_HORA,
  type Periodo,
} from "@/connectors/secullum/client";
import { banco } from "@/infra/banco";
import { secullum as criarClienteSecullum } from "./credenciais.service";
import * as execucoes from "./execucao.repository";
import {
  emLotes,
  emParalelo,
  executar,
  guardarBrutos,
} from "./execucao.service";
import {
  competenciasParaSincronizar,
  donosDaMatricula,
  esteveAtivoNoPeriodo,
  funcionarioSemDocumentos,
  matricula,
  tipoTurnoverSugerido,
} from "./secullum.regras";
import * as repo from "./secullum.repository";

const SISTEMA = "secullum";

export interface OpcoesSecullum {
  hoje?: Date;
  /** Força as competências (ex.: reprocessar set/2026). */
  competencias?: { competencia: string; periodo: Periodo }[];
  /**
   * Máximo de cálculos nesta execução. Além dele, vale o que sobrar do
   * limite de 100 por hora do Secullum.
   */
  limiteCalculos?: number;
}

export interface ResultadoSecullum {
  departamentos: number;
  motivos: number;
  colaboradores: number;
  afastamentos: number;
  ponto: { competencia: string; calculados: number; previstos: number }[];
  avisos: string[];
}

/**
 * Traz do Secullum: departamentos, motivos de desligamento, colaboradores,
 * afastamentos e o ponto por competência (totais e cada dia). O CPF é usado
 * só em memória, para chamar o /Calcular.
 */
export async function sincronizarSecullum(opcoes: OpcoesSecullum = {}) {
  const api = await criarClienteSecullum();
  const hoje = opcoes.hoje ?? new Date();
  const competencias = opcoes.competencias ?? competenciasParaSincronizar(hoje);
  const limiteCalculos = opcoes.limiteCalculos ?? LIMITE_CALCULAR_POR_HORA;

  return executar(SISTEMA, "rh", async (runId) => {
    const avisos: string[] = [];

    // Departamentos: só cria os novos. Nome e de-para são da Gestora.
    const deps = await api.departamentos();
    for (const lote of emLotes(deps, 500))
      await banco.comoServico((tx) =>
        repo.inserirDepartamentos(
          tx,
          lote.map((d) => ({
            secullum_id: d.Id,
            nome: d.Descricao.trim(),
            ativo: !d.Desativado,
          })),
        ),
      );
    const depPorSecullum = new Map(
      (await banco.comoServico(repo.departamentos)).flatMap((l) =>
        l.secullum_id === null ? [] : [[l.secullum_id, l.id] as const],
      ),
    );

    // Motivos de desligamento: cria os novos já com a sugestão de turnover.
    const motivos = await api.motivosDemissao();
    for (const lote of emLotes(motivos, 500))
      await banco.comoServico((tx) =>
        repo.inserirMotivos(
          tx,
          lote.map((m) => ({
            secullum_id: m.Id,
            descricao: m.Descricao.trim(),
            tipo_turnover: tipoTurnoverSugerido(m.Descricao),
          })),
        ),
      );

    // Colaboradores: só quem veio do Copiloto RH fica no sistema. O Secullum
    // liga o ponto a essa pessoa pelo id do Secullum ou pela matrícula e traz
    // o departamento; não cria ninguém. Quem não tem par fica de fora.
    const funcionarios = await api.funcionarios();
    const donos = donosDaMatricula(funcionarios);
    const existentes = await banco.comoServico(repo.colaboradores);
    const porSecullum = new Map(existentes.map((c) => [c.secullum_id, c]));
    const porMatricula = new Map(
      existentes
        .filter((c) => c.secullum_id === null)
        .map((c) => [c.matricula, c]),
    );

    const colaboradores: repo.LigacaoDoPonto[] = [];
    const ligados = [];
    // Matrículas de quem ficou de fora: os afastamentos delas também ficam.
    const matriculasDeFora = new Set<number>();
    for (const f of funcionarios) {
      const m = matricula(f.NumeroFolha);
      const minha = m !== null && donos.get(m) === f.Id ? m : null;
      const c =
        porSecullum.get(f.Id) ??
        (minha !== null ? porMatricula.get(minha) : undefined);
      if (!c) {
        if (m !== null) matriculasDeFora.add(m);
        continue;
      }
      if (m !== null && minha === null) {
        avisos.push(
          `matrícula ${m} repetida no ponto (Secullum id ${f.Id} ligado sem ela)`,
        );
      }
      ligados.push(f);
      colaboradores.push({
        id: c.id,
        copiloto_id: c.copiloto_id,
        nome: c.nome,
        secullum_id: f.Id,
        matricula: minha ?? c.matricula,
        departamento_id: f.Departamento
          ? (depPorSecullum.get(f.Departamento.Id) ?? null)
          : null,
      });
    }
    const deFora = funcionarios.length - ligados.length;
    if (deFora > 0) {
      avisos.push(
        `${deFora} funcionário(s) do ponto sem par no Copiloto RH ficaram de fora`,
      );
    }
    for (const lote of emLotes(colaboradores, 500))
      await banco.comoServico((tx) => repo.ligarColaboradores(tx, lote));
    await guardarBrutos(
      SISTEMA,
      "funcionarios",
      runId,
      ligados.map((f) => ({
        chave: String(f.Id),
        payload: funcionarioSemDocumentos(f),
      })),
    );
    const colaboradorPorSecullum = new Map(
      colaboradores.map((c) => [c.secullum_id, c]),
    );
    const foraDoPonto = new Set(
      existentes.filter((c) => c.fora_do_ponto).map((c) => c.id),
    );
    const colaboradorPorMatricula = new Map(
      colaboradores
        .filter((c) => c.matricula !== null)
        .map((c) => [c.matricula, c.id]),
    );

    // Afastamentos do ano passado e deste (a API exige o período).
    const ano = hoje.getFullYear();
    const afastamentos = await api.afastamentos({
      inicio: `${ano - 1}-01-01`,
      fim: `${ano}-12-31`,
    });
    const linhasAfastamento = afastamentos.flatMap((a) => {
      const m = matricula(a.NumeroFolha);
      const colaborador_id =
        m !== null ? colaboradorPorMatricula.get(m) : undefined;
      if (!colaborador_id) {
        if (m === null || !matriculasDeFora.has(m))
          avisos.push(
            `afastamento ${a.Id} sem colaborador com a matrícula informada`,
          );
        return [];
      }
      return [
        {
          secullum_id: a.Id,
          colaborador_id,
          // "2026-01-15T00:00:00" → "2026-01-15" (o data() das regras).
          inicio: a.Inicio.slice(0, 10),
          fim: a.Fim.slice(0, 10),
          motivo: a.Motivo ?? null,
          justificativa: a.JustificativaNome ?? null,
        },
      ];
    });
    const gravados = new Set(linhasAfastamento.map((l) => l.secullum_id));
    for (const lote of emLotes(linhasAfastamento, 500))
      await banco.comoServico((tx) => repo.gravarAfastamentos(tx, lote));
    await guardarBrutos(
      SISTEMA,
      "afastamentos",
      runId,
      afastamentos
        .filter((a) => gravados.has(a.Id))
        .map((a) => ({ chave: String(a.Id), payload: a })),
    );

    // Ponto: totais e dias do /Calcular de quem está ligado e esteve ativo em
    // cada competência (menos quem o RH marcou como fora do ponto).
    // A API aceita 100 cálculos por hora: desconta o que já foi gasto na
    // última hora e, no primeiro 429, para e deixa o resto para depois.
    const usados = await calculosNaUltimaHora();
    let orcamento = Math.min(
      limiteCalculos,
      LIMITE_CALCULAR_POR_HORA - RESERVA_CALCULAR - usados,
    );
    let limiteAtingido = false;
    let adiados = 0;
    const ponto: ResultadoSecullum["ponto"] = [];
    for (const { competencia, periodo } of competencias) {
      const alvos = ligados.filter(
        (f) =>
          (f.Cpf || f.NumeroPis) &&
          esteveAtivoNoPeriodo(f, periodo) &&
          !foraDoPonto.has(colaboradorPorSecullum.get(f.Id)?.id ?? ""),
      );
      const daVez = alvos.slice(0, Math.max(orcamento, 0));
      orcamento -= daVez.length;
      adiados += alvos.length - daVez.length;

      const resultados = await emParalelo(daVez, 3, async (f) => {
        if (limiteAtingido) throw ADIADO;
        try {
          const calculo = await api.calcular(
            { cpf: f.Cpf, pis: f.NumeroPis },
            periodo,
          );
          return { f, calculo, totais: totaisDoCalculo(calculo) };
        } catch (erro) {
          if (erro instanceof ConnectorError && erro.status === 429) {
            limiteAtingido = true;
            throw ADIADO;
          }
          throw erro;
        }
      });

      const linhas: repo.LinhaPontoMensal[] = [];
      const dias: repo.LinhaPontoDiario[] = [];
      const brutos = [];
      for (const [i, r] of resultados.entries()) {
        const f = daVez[i];
        if (!f) continue;
        if (r.status === "rejected") {
          if (r.reason === ADIADO) {
            adiados++;
          } else {
            avisos.push(
              `${competencia}: cálculo do Secullum id ${f.Id} falhou (${mensagemSegura(r.reason).slice(0, 200)})`,
            );
          }
          continue;
        }
        const colaborador = colaboradorPorSecullum.get(f.Id);
        if (!colaborador) continue;
        linhas.push({
          competencia,
          colaborador_id: colaborador.id,
          departamento_id: colaborador.departamento_id,
          ...r.value.totais,
          sync_run_id: runId,
        });
        try {
          for (const dia of diasDoCalculo(r.value.calculo)) {
            dias.push({
              colaborador_id: colaborador.id,
              competencia,
              ...dia,
              sync_run_id: runId,
            });
          }
        } catch (erro) {
          // Os totais do mês continuam valendo sem os dias.
          avisos.push(
            `${competencia}: dias do Secullum id ${f.Id} não lidos (${mensagemSegura(erro).slice(0, 200)})`,
          );
        }
        brutos.push({
          chave: `${competencia}:${f.Id}`,
          payload: {
            periodo,
            Colunas: r.value.calculo.Colunas,
            Linhas: r.value.calculo.Linhas,
            Totais: r.value.calculo.Totais,
          },
        });
      }
      for (const lote of emLotes(linhas, 500))
        await banco.comoServico((tx) => repo.gravarPontoMensal(tx, lote));
      for (const lote of emLotes(dias, 500))
        await banco.comoServico((tx) => repo.gravarPontoDiario(tx, lote));
      await guardarBrutos(SISTEMA, "calculo_mensal", runId, brutos);
      ponto.push({
        competencia,
        calculados: linhas.length,
        previstos: alvos.length,
      });
    }

    if (adiados > 0) {
      avisos.push(
        `${adiados} cálculos do ponto ficaram para a próxima execução (limite de ${LIMITE_CALCULAR_POR_HORA} por hora do Secullum${limiteAtingido ? ", atingido nesta execução" : ""})`,
      );
    }

    const resultado: ResultadoSecullum = {
      departamentos: deps.length,
      motivos: motivos.length,
      colaboradores: colaboradores.length,
      afastamentos: linhasAfastamento.length,
      ponto,
      avisos,
    };
    return {
      ...resultado,
      registros:
        colaboradores.length +
        linhasAfastamento.length +
        ponto.reduce((s, p) => s + p.calculados, 0),
      cursor: {
        executado_em: hoje.toISOString(),
        competencias: ponto,
        chamadas_calcular: api.chamadasCalcular(),
        // Aparecem no histórico de Administração › Integrações.
        avisos,
      },
    };
  });
}

/** Folga para reprocessos manuais e testes dentro da mesma hora. */
const RESERVA_CALCULAR = 5;
const ADIADO = Symbol("adiado");

/** Chamadas ao /Calcular registradas pelas execuções da última hora. */
async function calculosNaUltimaHora(): Promise<number> {
  const cursores = await banco.comoServico((tx) =>
    execucoes.cursoresDesde(
      tx,
      SISTEMA,
      new Date(Date.now() - 60 * 60_000).toISOString(),
    ),
  );
  return cursores.reduce<number>((soma, c) => {
    const chamadas =
      c !== null && typeof c === "object" && !Array.isArray(c)
        ? c.chamadas_calcular
        : undefined;
    return soma + (Number(chamadas) || 0);
  }, 0);
}
