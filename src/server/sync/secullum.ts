import "server-only";
import { randomUUID } from "node:crypto";
import { ConnectorError, mensagemSegura } from "@/connectors/http";
import { diasDoCalculo, totaisDoCalculo } from "@/connectors/secullum/calculo";
import {
  LIMITE_CALCULAR_POR_HORA,
  type Periodo,
} from "@/connectors/secullum/client";
import { type AdminClient, createAdminClient } from "@/lib/supabase/admin";
import { secullum as criarClienteSecullum } from "../integracoes";
import { emLotes, emParalelo, executar, guardarBrutos } from "./execucao";
import {
  competenciasParaSincronizar,
  data,
  donosDaMatricula,
  esteveAtivoNoPeriodo,
  funcionarioSemDocumentos,
  matricula,
  tipoTurnoverSugerido,
} from "./secullum-regras";

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
  const admin = createAdminClient();
  const api = await criarClienteSecullum();
  const rh = admin.schema("rh");
  const hoje = opcoes.hoje ?? new Date();
  const competencias = opcoes.competencias ?? competenciasParaSincronizar(hoje);
  const limiteCalculos = opcoes.limiteCalculos ?? LIMITE_CALCULAR_POR_HORA;

  return executar(admin, SISTEMA, "rh", async (runId) => {
    const avisos: string[] = [];

    // Departamentos: só cria os novos. Nome e de-para são da Gestora.
    const deps = await api.departamentos();
    {
      const { error } = await rh.from("departamentos").upsert(
        deps.map((d) => ({
          secullum_id: d.Id,
          nome: d.Descricao.trim(),
          ativo: !d.Desativado,
        })),
        { onConflict: "secullum_id", ignoreDuplicates: true },
      );
      if (error) throw error;
    }
    const depPorSecullum = await mapa(
      rh.from("departamentos").select("id, secullum_id"),
    );

    // Motivos de desligamento: cria os novos já com a sugestão de turnover.
    const motivos = await api.motivosDemissao();
    {
      const { error } = await rh.from("motivos_desligamento").upsert(
        motivos.map((m) => ({
          secullum_id: m.Id,
          descricao: m.Descricao.trim(),
          tipo_turnover: tipoTurnoverSugerido(m.Descricao),
        })),
        { onConflict: "secullum_id", ignoreDuplicates: true },
      );
      if (error) throw error;
    }
    const motivoPorSecullum = await mapa(
      rh.from("motivos_desligamento").select("id, secullum_id"),
    );

    // Colaboradores: casa pelo id do Secullum ou, para quem veio da folha,
    // pela matrícula. Tipo de contrato e cargo são da folha: não mexe. Quem
    // está ligado ao Copiloto RH fica com nome, nascimento, admissão e
    // desligamento de lá (o Secullum só liga o ponto a essa pessoa).
    const funcionarios = await api.funcionarios();
    const donos = donosDaMatricula(funcionarios);
    const existentes = await rh
      .from("colaboradores")
      .select(
        "id, matricula, secullum_id, copiloto_id, nome, nascimento, admissao, desligamento, motivo_desligamento_id",
      );
    if (existentes.error) throw existentes.error;
    const doCopiloto = new Map(
      existentes.data
        .filter((c) => c.copiloto_id !== null)
        .map((c) => [c.id, c]),
    );
    const porSecullum = new Map(
      existentes.data.map((c) => [c.secullum_id, c.id]),
    );
    const porMatricula = new Map(
      existentes.data
        .filter((c) => c.secullum_id === null)
        .map((c) => [c.matricula, c.id]),
    );

    const colaboradores = funcionarios.map((f) => {
      const m = matricula(f.NumeroFolha);
      const minha = m !== null && donos.get(m) === f.Id ? m : null;
      if (m !== null && minha === null) {
        avisos.push(
          `matrícula ${m} repetida no ponto (Secullum id ${f.Id} ficou sem matrícula)`,
        );
      }
      const id =
        porSecullum.get(f.Id) ??
        (minha !== null ? porMatricula.get(minha) : undefined) ??
        randomUUID();
      const copiloto = doCopiloto.get(id);
      return {
        id,
        secullum_id: f.Id,
        matricula: minha,
        departamento_id: f.Departamento
          ? (depPorSecullum.get(f.Departamento.Id) ?? null)
          : null,
        ...(copiloto
          ? {
              nome: copiloto.nome,
              nascimento: copiloto.nascimento,
              admissao: copiloto.admissao,
              desligamento: copiloto.desligamento,
              motivo_desligamento_id: copiloto.motivo_desligamento_id,
            }
          : {
              nome: f.Nome.trim(),
              nascimento: data(f.Nascimento),
              admissao: data(f.Admissao),
              desligamento: data(f.Demissao),
              motivo_desligamento_id: f.MotivoDemissaoId
                ? (motivoPorSecullum.get(f.MotivoDemissaoId) ?? null)
                : null,
            }),
      };
    });
    for (const lote of emLotes(colaboradores, 500)) {
      const { error } = await rh
        .from("colaboradores")
        .upsert(lote, { onConflict: "id" });
      if (error) throw error;
    }
    await guardarBrutos(
      admin,
      SISTEMA,
      "funcionarios",
      runId,
      funcionarios.map((f) => ({
        chave: String(f.Id),
        payload: funcionarioSemDocumentos(f),
      })),
    );
    const colaboradorPorSecullum = new Map(
      colaboradores.map((c) => [c.secullum_id, c]),
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
        avisos.push(
          `afastamento ${a.Id} sem colaborador com a matrícula informada`,
        );
        return [];
      }
      return [
        {
          secullum_id: a.Id,
          colaborador_id,
          inicio: data(a.Inicio) as string,
          fim: data(a.Fim) as string,
          motivo: a.Motivo ?? null,
          justificativa: a.JustificativaNome ?? null,
        },
      ];
    });
    for (const lote of emLotes(linhasAfastamento, 500)) {
      const { error } = await rh
        .from("afastamentos")
        .upsert(lote, { onConflict: "secullum_id" });
      if (error) throw error;
    }
    await guardarBrutos(
      admin,
      SISTEMA,
      "afastamentos",
      runId,
      afastamentos.map((a) => ({ chave: String(a.Id), payload: a })),
    );

    // Ponto: totais e dias do /Calcular de quem esteve ativo em cada competência.
    // A API aceita 100 cálculos por hora: desconta o que já foi gasto na
    // última hora e, no primeiro 429, para e deixa o resto para depois.
    const usados = await calculosNaUltimaHora(admin);
    let orcamento = Math.min(
      limiteCalculos,
      LIMITE_CALCULAR_POR_HORA - RESERVA_CALCULAR - usados,
    );
    let limiteAtingido = false;
    let adiados = 0;
    const ponto: ResultadoSecullum["ponto"] = [];
    for (const { competencia, periodo } of competencias) {
      const alvos = funcionarios.filter(
        (f) => (f.Cpf || f.NumeroPis) && esteveAtivoNoPeriodo(f, periodo),
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

      const linhas = [];
      const dias = [];
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
      for (const lote of emLotes(linhas, 500)) {
        const { error } = await rh
          .from("ponto_mensal")
          .upsert(lote, { onConflict: "competencia,colaborador_id" });
        if (error) throw error;
      }
      for (const lote of emLotes(dias, 500)) {
        const { error } = await rh
          .from("ponto_diario")
          .upsert(lote, { onConflict: "colaborador_id,data" });
        if (error) throw error;
      }
      await guardarBrutos(admin, SISTEMA, "calculo_mensal", runId, brutos);
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
async function calculosNaUltimaHora(admin: AdminClient): Promise<number> {
  const { data: execucoes, error } = await admin
    .schema("integracao")
    .from("sync_runs")
    .select("cursor_depois")
    .eq("sistema", SISTEMA)
    .gte("iniciado_em", new Date(Date.now() - 60 * 60_000).toISOString());
  if (error) throw error;
  return execucoes.reduce((soma, e) => {
    const cursor = e.cursor_depois as { chamadas_calcular?: unknown } | null;
    return soma + (Number(cursor?.chamadas_calcular) || 0);
  }, 0);
}

/** secullum_id → id, a partir de um select dessas duas colunas. */
async function mapa(
  consulta: PromiseLike<{
    data: { id: string; secullum_id: number | null }[] | null;
    error: unknown;
  }>,
): Promise<Map<number, string>> {
  const { data: linhas, error } = await consulta;
  if (error) throw error;
  return new Map(
    (linhas ?? [])
      .filter(
        (l): l is { id: string; secullum_id: number } => l.secullum_id !== null,
      )
      .map((l) => [l.secullum_id, l.id]),
  );
}
