import { isoLocal } from "@arp/shared/formato";
import { diaAnterior, ultimoDiaFechado } from "@arp/shared/periodo";
import type { LinhaPonto } from "@arp/shared/rh/calculos";
import type { ConsultaDoPeriodo } from "@arp/shared/rh/contratos/comum";
import type {
  BeneficiosDoFuncionario,
  DiaDoPonto,
  Funcionario,
  RespostaPerfil,
} from "@arp/shared/rh/contratos/funcionarios";
import { situacaoDe } from "@arp/shared/rh/funcionarios";
import {
  juntarPonto,
  planejarPonto,
  somarDias,
  type TrechoDoPonto,
} from "@arp/shared/rh/ponto-periodo";
import { z } from "zod";
import { type Contexto, pode } from "@/contexto";
import { ErroDePermissao, ErroNaoEncontrado } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { adicionalDoBanco, lerMemoria, minutos } from "./dados";
import * as dados from "./dados.repository";
import { lerFiltrosDoPeriodo } from "./filtros";
import * as repo from "./funcionarios.repository";

// Funcionários: lista, perfil e "fora do ponto" (funcionarios.ts e
// acoes/funcionarios.ts do antigo). Tudo com a sessão de quem pede: o RLS
// decide; folha, rubricas e custo só saem com rh.custo_pessoal.individual.

interface AfastamentoDeHoje {
  inicio: string;
  fim: string;
  motivo: string | null;
}

function paraFuncionario(
  c: repo.LinhaColaborador,
  hoje: string,
  afastados: Map<string, AfastamentoDeHoje>,
): Funcionario {
  return {
    id: c.id,
    nome: c.nome,
    matricula: c.matricula,
    departamento_id: c.departamento_id,
    departamento: c.departamento ?? "Sem departamento",
    cargo: c.cargo,
    tipo_contrato: c.tipo_contrato,
    nascimento: c.nascimento,
    admissao: c.admissao,
    desligamento: c.desligamento,
    situacao: situacaoDe(c, hoje, afastados.has(c.id)),
    noPonto: c.secullum_id !== null,
    foraDoPonto: c.fora_do_ponto,
    afastamentoHoje: afastados.get(c.id) ?? null,
  };
}

/** Quem tem afastamento do ponto cobrindo `hoje`, com motivo e período. */
async function afastadosEm(
  tx: Tx,
  hoje: string,
  id?: string,
): Promise<Map<string, AfastamentoDeHoje>> {
  const mapa = new Map<string, AfastamentoDeHoje>();
  for (const a of await repo.afastamentosEm(tx, hoje, id))
    if (!mapa.has(a.colaborador_id))
      mapa.set(a.colaborador_id, {
        inicio: a.inicio,
        fim: a.fim,
        motivo: a.justificativa ?? a.motivo,
      });
  return mapa;
}

/** Todos os colaboradores (vindos do Copiloto RH), por nome, menos os sócios. */
export function listar(ctx: Contexto): Promise<Funcionario[]> {
  const hoje = isoLocal(new Date());
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const todos = await repo.todosOsColaboradores(tx);
    const afastados = await afastadosEm(tx, hoje);
    const deFora = await dados.socios(tx);
    return todos
      .filter((c) => !deFora.has(c.id))
      .map((c) => paraFuncionario(c, hoje, afastados));
  });
}

const batidas = z.array(z.string().nullable()).catch([]);

/**
 * Ponto da pessoa num período, com as regras das outras telas: mês inteiro
 * pelo total do mês, pedaço de mês pela soma dos dias. Pedaço sem dias
 * guardados fica fora do total (e a tela avisa).
 */
async function pontoDoPeriodoDe(
  tx: Tx,
  f: Funcionario,
  mensal: RespostaPerfil["mensal"],
  de: string,
  ate: string,
): Promise<RespostaPerfil["ponto"]> {
  const plano = planejarPonto({ de, ate }, ultimoDiaFechado());
  const dias: DiaDoPonto[] = plano.efetivo
    ? (
        await repo.pontoDiarioDe(tx, f.id, plano.efetivo.de, plano.efetivo.ate)
      ).map((d) => ({
        ...d,
        batidas: batidas.parse(d.batidas ?? []),
        abonos_min: minutos(d.abonos_min),
        extras_min: minutos(d.extras_min),
      }))
    : [];
  const quem = {
    colaborador_id: f.id,
    nome: f.nome,
    matricula: f.matricula,
    departamento_id: f.departamento_id,
    departamento: f.departamento,
  };

  const semDias: TrechoDoPonto[] = [];
  let normais = 0;
  const pedacos: { chave: string; linhas: LinhaPonto[] }[] = [];
  for (const c of plano.meses) {
    const m = mensal.find((x) => x.competencia === c);
    if (!m) continue;
    const { competencia: _, normais_min, ...resto } = m;
    normais += normais_min;
    pedacos.push({ chave: c, linhas: [{ ...resto, ...quem }] });
  }
  for (const t of plano.trechos) {
    const doTrecho = dias.filter((d) => d.data >= t.de && d.data <= t.ate);
    const primeiro = doTrecho[0]?.data;
    if (!primeiro) semDias.push(t);
    else if (primeiro > t.de)
      semDias.push({ ...t, ate: diaAnterior(primeiro) });
    normais += doTrecho.reduce((s, d) => s + d.normais_min, 0);
    pedacos.push({
      chave: t.de,
      linhas: somarDias(
        doTrecho.map(({ batidas: _, normais_min: __, ...d }) => ({
          ...d,
          ...quem,
        })),
      ),
    });
  }
  pedacos.sort((a, b) => a.chave.localeCompare(b.chave));
  const linhas = juntarPonto(pedacos.map((p) => p.linhas));
  return {
    linhas,
    efetivo: plano.efetivo,
    semDias,
    total: linhas[0] ?? null,
    normais_min: normais,
    dias,
  };
}

async function beneficiosDe(
  tx: Tx,
  id: string,
): Promise<BeneficiosDoFuncionario> {
  const vinculos = await repo.beneficiosDe(tx, id);
  // Do mais recente ao mais antigo: o primeiro de cada benefício é o último.
  const lancados = await repo.valoresLancadosDe(tx, id);
  const dependentes = await repo.dependentesDe(tx, id);
  const ultimoLancado = (beneficioId: string | null) =>
    lancados.find((l) => l.beneficio_id === beneficioId)?.valor ?? null;
  return {
    beneficios: vinculos.map((b) => {
      const porMes = b.valor_por_mes ?? false;
      return {
        nome: b.nome ?? "—",
        tipo: b.tipo ?? "outro",
        desde: b.desde,
        ate: b.ate,
        valor: porMes
          ? ultimoLancado(b.beneficio_id)
          : (b.valor_manual ?? b.valor_padrao ?? null),
        manual: !porMes && b.valor_manual !== null,
        porMes,
      };
    }),
    dependentes,
  };
}

/** Perfil de um colaborador no período do filtro. 404 se o id não existe. */
export async function perfil(
  ctx: Contexto,
  id: string,
  busca: ConsultaDoPeriodo,
): Promise<RespostaPerfil> {
  // Id que não é uuid não existe: nem chega ao banco.
  if (!z.uuid().safeParse(id).success) throw new ErroNaoEncontrado();
  const hoje = isoLocal(new Date());
  const verSalario = pode(ctx, "rh.custo_pessoal.individual");
  const r = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const c = await repo.colaborador(tx, id);
    if (!c) return null;
    const afastados = await afastadosEm(tx, hoje, id);
    const funcionario = {
      ...paraFuncionario(c, hoje, afastados),
      motivoDesligamento: c.motivo ?? c.motivo_desligamento_copiloto ?? null,
    };
    const filtros = await lerFiltrosDoPeriodo(tx, busca);
    const mensal = (await repo.pontoMensalDe(tx, id)).map((l) => ({
      ...l,
      abonos_min: minutos(l.abonos_min),
      extras_min: minutos(l.extras_min),
    }));
    const ponto = await pontoDoPeriodoDe(
      tx,
      funcionario,
      mensal,
      filtros.periodo.de,
      filtros.periodo.ate,
    );
    const afastamentos = await repo.afastamentosDe(tx, id);
    const beneficios = pode(ctx, "rh.beneficios")
      ? await beneficiosDe(tx, id)
      : null;
    const folhas = verSalario
      ? (await repo.folhasDe(tx, id)).sort((a, b) =>
          b.competencia.localeCompare(a.competencia),
        )
      : [];
    const custos = verSalario
      ? (await repo.custosDe(tx, id)).map((c) => ({
          ...c,
          provisoes: c.provisao_13 + c.provisao_ferias + c.multa_rescisoria,
          memoria: lerMemoria(c.memoria),
        }))
      : [];
    const adicional = verSalario
      ? adicionalDoBanco(await dados.parametrosEmpresa(tx), filtros.mes)
      : null;
    // Folha do mês do fim do período; sem ela, a última antes (ou a última).
    const folha =
      folhas.find((x) => x.competencia <= filtros.mes) ?? folhas[0] ?? null;
    const rubricas = folha
      ? (await repo.rubricasDe(tx, id, folha.folha_id)).map((r) => ({
          codigo: r.rubrica_codigo,
          descricao: r.descricao ?? "—",
          grupo: r.grupo ?? "nao_classificada",
          natureza: r.natureza,
          referencia: r.referencia,
          valor: r.valor,
        }))
      : [];
    return {
      funcionario,
      filtros,
      ponto,
      mensal,
      afastamentos,
      beneficios,
      verSalario,
      folha,
      rubricas,
      custos,
      adicional,
      editar: pode(ctx, "rh.parametros"),
    };
  });
  if (!r) throw new ErroNaoEncontrado();
  return r;
}

/**
 * Fora do ponto: quem segue no Secullum mas não conta no ponto. Passa pelo
 * RLS (rh.parametros) e cai em core.auditoria.
 */
export async function marcarForaDoPonto(
  ctx: Contexto,
  id: string,
  fora: boolean,
): Promise<string> {
  if (!pode(ctx, "rh.parametros"))
    throw new ErroDePermissao(
      "Você não tem permissão para alterar este cadastro.",
    );
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.marcarForaDoPonto(tx, id, fora),
  );
  return fora ? "Fora do ponto." : "De volta ao ponto.";
}
