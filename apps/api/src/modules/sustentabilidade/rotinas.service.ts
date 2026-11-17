import { fimDoMes, formatarData } from "@arp/shared/formato";
import { deBrasilia, hojeEmBrasilia } from "@arp/shared/os/tempo";
import {
  CATEGORIAS_DO_MODULO,
  type CategoriaDoModulo,
  MODULO_DOS_CHAMADOS,
  refDaEntrevista,
  rotaAplicar,
  tituloDoChamado,
} from "@arp/shared/sustentabilidade/entrevistas-chamados";
import {
  type ContratoControle,
  type EntrevistaResumo,
  type LinhaControle,
  linhasDoControle,
} from "@arp/shared/sustentabilidade/entrevistas-controle";
import {
  lerRefDaCobranca,
  programasACobrar,
  refDaCobranca,
} from "@arp/shared/sustentabilidade/programas-cobranca";
import type { ParametrosEntrevista } from "@arp/shared/sustentabilidade/situacao";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import { configDoSistema } from "@/modules/os/automacao.service";
import {
  type ChamadoCriado,
  criarChamadoSistema,
} from "@/modules/os/criar.service";
import {
  cancelarPeloSistema,
  concluirPeloSistema,
} from "@/modules/os/sistema.service";
import {
  type Parametros,
  parametros,
  sincronizarContratos,
  validadesPorSetor,
} from "./base.service";
import * as repo from "./rotinas.repository";

// Rotinas diárias do Módulo Sustentabilidade (o /api/cron/sustentabilidade
// do sistema antigo, agora em jobs.ts) e os chamados que o módulo abre pelo
// sistema. Tudo pela service role, sem sessão: quem chama de uma ação
// confere a permissão antes e passa a `tx` do `comoServico`.
//
// Para plugar uma rotina nova: uma função `(agora: Date) => Promise<number>`
// (quantos registros criou ou mudou, idempotente) e uma linha em ROTINAS.

const AUTOR = "Sistema (Sustentabilidade)";

// ---------------------------------------------------------------------------
// Categorias do módulo no Chamados
// ---------------------------------------------------------------------------

export interface CategoriaDoChamado {
  id: string;
  setorId: string;
}

/**
 * Categoria do Chamados pelo nome (as de CATEGORIAS_DO_MODULO), com o setor
 * dela. Procura no setor previsto e, se não achar, em Sustentabilidade (o
 * recolhimento fica lá quando não há o setor Operações). null se alguém
 * apagou a categoria.
 */
export async function categoriaDoModulo(
  tx: Tx,
  nome: CategoriaDoModulo,
): Promise<CategoriaDoChamado | null> {
  const previsto =
    CATEGORIAS_DO_MODULO.find((c) => c.nome === nome)?.setor ??
    "Sustentabilidade";
  const linhas = await repo.categoriasPorNome(tx, nome, [
    previsto,
    "Sustentabilidade",
  ]);
  const achada = linhas.find((l) => l.setor === previsto) ?? linhas[0] ?? null;
  return achada ? { id: achada.id, setorId: achada.setor_id } : null;
}

/** Setor Sustentabilidade do Chamados (sem a categoria, o chamado vai para ele). */
async function setorSustentabilidade(tx: Tx): Promise<string> {
  const s = await repo.setorPorNome(tx, "Sustentabilidade");
  if (!s)
    throw new Error(
      "O setor Sustentabilidade não existe no Chamados: crie-o em Chamados › Configurações.",
    );
  return s.id;
}

/** Fim do expediente do dia (Brasília), como o prazo dos lembretes. */
export async function prazoNoDia(tx: Tx, data: string): Promise<Date> {
  const { cal } = await configDoSistema(tx);
  return deBrasilia(data, cal.expedienteFim);
}

// ---------------------------------------------------------------------------
// Chamado da entrevista
// ---------------------------------------------------------------------------

export interface ContratoDoChamado {
  id: string;
  loja_id: string | null;
  cliente_nome: string;
  lucs: string[];
}

/**
 * Abre o chamado "Entrevista de resíduos" do contrato, com prazo na data
 * dada (prevista ou validade), e guarda em contratos.chamado_id. O
 * "Executar" leva à tela de aplicar; só o módulo conclui.
 */
export async function abrirChamadoDaEntrevista(
  tx: Tx,
  c: ContratoDoChamado,
  prazo: string | null,
  agora = new Date(),
): Promise<ChamadoCriado | null> {
  const categoria = await categoriaDoModulo(tx, "Entrevista de resíduos");
  const setorPadrao = await setorSustentabilidade(tx);
  const quando = prazo
    ? `Prevista para ${formatarData(prazo)}.`
    : "Sem data prevista: o contrato não tem data de inauguração. Corrija a data na ficha da entrevista.";
  const criado = await criarChamadoSistema(
    tx,
    {
      setorId: categoria?.setorId ?? setorPadrao,
      categoriaId: categoria?.id ?? null,
      titulo: tituloDoChamado(c),
      descricao: `Entrevista de diagnóstico de resíduos do locatário. ${quando} Toque em Executar para abrir o questionário; o chamado fecha sozinho ao salvar a entrevista com as assinaturas.`,
      tipo: "tarefa",
      origem: "modulo",
      autorNome: AUTOR,
      prazo: prazo ? await prazoNoDia(tx, prazo) : null,
      lojaId: c.loja_id,
      acaoUrl: rotaAplicar(c.id),
      acaoRotulo: "a entrevista",
      conclusaoExterna: true,
      origemModulo: MODULO_DOS_CHAMADOS,
      origemRef: refDaEntrevista(c.id),
    },
    agora,
  );
  if (criado) await repo.guardarChamado(tx, c.id, criado.id);
  return criado;
}

/** contratos.chamado_id (só a service role grava essa coluna). */
export function guardarChamado(
  tx: Tx,
  contratoId: string,
  chamadoId: string | null,
): Promise<void> {
  return repo.guardarChamado(tx, contratoId, chamadoId);
}

/** Muda o prazo do chamado aberto (ativação corrigida, prazo específico). */
export async function mudarPrazoDoChamado(
  tx: Tx,
  chamadoId: string,
  prazo: string | null,
): Promise<void> {
  await repo.mudarPrazo(
    tx,
    chamadoId,
    prazo ? (await prazoNoDia(tx, prazo)).toISOString() : null,
  );
}

// ---------------------------------------------------------------------------
// Situação dos contratos sem sessão (rotina e ações que mexem no chamado)
// ---------------------------------------------------------------------------

export interface ConfigDaEntrevista {
  p: Parametros;
  entrevista: ParametrosEntrevista;
}

/** Parâmetros lidos pela service role (a rotina não tem sessão). */
export async function parametrosDoSistema(tx: Tx): Promise<ConfigDaEntrevista> {
  const p = await parametros(tx);
  const validadePorSetor = await validadesPorSetor(tx);
  return {
    p,
    entrevista: {
      mesesPrimeira: p.meses_primeira_entrevista,
      validadePadraoMeses: p.validade_padrao_meses,
      validadePorSetor,
      avisoDias: p.aviso_dias,
    },
  };
}

/**
 * Linha do controle de um ou de todos os contratos, pela service role.
 * Só as entrevistas salvas contam.
 */
export async function situacaoDosContratos(
  tx: Tx,
  hoje: string,
  contratoIds?: string[],
): Promise<{ linhas: LinhaControle[]; contratos: ContratoControle[] }> {
  const cfg = await parametrosDoSistema(tx);
  const contratos = await repo.contratos(tx, contratoIds);
  const entrevistas = await repo.entrevistasSalvas(tx, contratoIds);
  const resumo: EntrevistaResumo[] = entrevistas.map((e) => ({
    ...e,
    tem_pdf: false,
  }));
  return {
    contratos,
    linhas: linhasDoControle({
      contratos,
      entrevistas: resumo,
      chamados: new Map(),
      nomes: new Map(),
      config: {
        hoje,
        parametros: cfg.entrevista,
        tiposLojaDispensados: cfg.p.tipos_loja_dispensados,
        dataInauguracao: cfg.p.data_inauguracao,
      },
    }),
  };
}

/** Chamados abertos das entrevistas, por contrato. */
async function chamadosAbertos(tx: Tx): Promise<Map<string, string>> {
  const linhas = await repo.chamadosAbertosDasEntrevistas(
    tx,
    MODULO_DOS_CHAMADOS,
  );
  const mapa = new Map<string, string>();
  for (const l of linhas) {
    const contrato = l.origem_ref?.slice("entrevista:".length);
    if (contrato && !mapa.has(contrato)) mapa.set(contrato, l.id);
  }
  return mapa;
}

/** Motivo do cancelamento quando o contrato deixou de precisar da entrevista. */
export function motivoDoCancelamento(l: LinhaControle): string {
  if (l.situacao === "dispensada")
    return `Entrevista dispensada: ${l.dispensa ?? "sem motivo"}`;
  return `${l.fora ?? "Contrato fora da lista de entrevistas"}: a entrevista não é mais necessária.`;
}

/** Precisa de chamado aberto: na lista, não dispensado e sem entrevista em dia. */
export function precisaDeChamado(l: LinhaControle): boolean {
  return l.naLista && l.situacao !== "dispensada" && l.situacao !== "em_dia";
}

/**
 * Rotina diária das entrevistas: sincroniza os contratos; abre o chamado de
 * quem entra na lista sem entrevista válida (aguardando, pendente, vencida)
 * ou com a validade terminando (a vencer), com prazo na data prevista;
 * cancela o aberto de quem foi rescindido, encerrado, virou tipo dispensado
 * ou foi dispensado. Contratos de exemplo ficam de fora. Idempotente. Cada
 * contrato muda no seu escopo: um com problema não para os outros.
 */
export async function rotinaEntrevistas(agora: Date): Promise<number> {
  await sincronizarContratos(agora);
  const hoje = hojeEmBrasilia(agora);
  const { linhas, contratos, abertos } = await banco.comoServico(
    async (tx) => ({
      ...(await situacaoDosContratos(tx, hoje)),
      abertos: await chamadosAbertos(tx),
    }),
  );
  const porId = new Map(contratos.map((c) => [c.id, c]));
  let mudou = 0;
  for (const l of linhas) {
    const c = porId.get(l.id);
    if (!c || c.exemplo) continue;
    const aberto = abertos.get(l.id) ?? null;
    const precisa = precisaDeChamado(l);
    const cancelar = !!aberto && (!l.naLista || l.situacao === "dispensada");
    // Nada a fazer: não abre outro escopo.
    if (
      !cancelar &&
      !(!aberto && precisa) &&
      !(aberto && c.chamado_id !== aberto) &&
      !(!aberto && c.chamado_id)
    )
      continue;
    try {
      const n = await banco.comoServico(async (tx) => {
        if (cancelar && aberto) {
          const ok = await cancelarPeloSistema(tx, {
            chamadoId: aberto,
            motivo: motivoDoCancelamento(l),
            autorNome: AUTOR,
          });
          if (c.chamado_id) await repo.guardarChamado(tx, c.id, null);
          return ok ? 1 : 0;
        }
        if (!aberto && precisa)
          return (await abrirChamadoDaEntrevista(tx, c, l.dataPrevista, agora))
            ? 1
            : 0;
        if (aberto && c.chamado_id !== aberto)
          await repo.guardarChamado(tx, c.id, aberto);
        else if (!aberto && c.chamado_id)
          await repo.guardarChamado(tx, c.id, null);
        return 0;
      });
      mudou += n;
    } catch (err) {
      // Um contrato com problema não para os outros.
      log.error({ err, contrato: c.id }, "rotina das entrevistas");
    }
  }
  return mudou;
}

// ---------------------------------------------------------------------------
// Cobrança de lançamento dos parceiros (programas)
// ---------------------------------------------------------------------------

const CATEGORIA_COBRANCA = "Cobrar lançamento do parceiro";

async function destinoDaCobranca(
  tx: Tx,
): Promise<{ setorId: string; categoriaId: string | null } | null> {
  const cat = (
    await repo.categoriasPorNome(tx, CATEGORIA_COBRANCA, ["Sustentabilidade"])
  )[0];
  if (cat) return { setorId: cat.setor_id, categoriaId: cat.id };
  const setor = await repo.setorPorNome(tx, "Sustentabilidade");
  return setor ? { setorId: setor.id, categoriaId: null } : null;
}

const rotuloDoMes = (mes: string) => `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;

/**
 * Rotina diária: a partir do dia `cobranca_dia` dos Parâmetros, cria o
 * chamado "Cobrar lançamento do parceiro" para a equipe (setor
 * Sustentabilidade; nunca para o parceiro) de cada programa ativo, mensal,
 * sem lançamento no mês anterior (regra em
 * @arp/shared/sustentabilidade/programas-cobranca). Conclui as cobranças
 * abertas cujo mês já tem lançamento (ex.: entrou pela importação) e cancela
 * as de programa inativado. Service role: sem sessão.
 */
export function rotinaProgramas(agora: Date): Promise<{
  criados: number;
  concluidos: number;
  cancelados: number;
}> {
  return banco.comoServico(async (tx) => {
    const hoje = hojeEmBrasilia(agora);
    const { cobranca_dia } = await repo.cobrancaDia(tx);
    const programas = await repo.programas(tx);
    const r = { criados: 0, concluidos: 0, cancelados: 0 };

    // Cobranças abertas: concluir (chegou lançamento) ou cancelar (inativo).
    for (const ch of await repo.cobrancasAbertas(tx, MODULO_DOS_CHAMADOS)) {
      const ref = lerRefDaCobranca(ch.origem_ref ?? "");
      if (!ref) continue;
      const p = programas.find((x) => x.id === ref.programaId);
      if (!p?.ativo) {
        if (
          await cancelarPeloSistema(tx, {
            chamadoId: ch.id,
            motivo:
              "Programa inativado ou excluído: a cobrança deixou de valer.",
          })
        )
          r.cancelados++;
        continue;
      }
      const inicio = `${ref.mes}-01`;
      if (
        (await repo.temLancamento(
          tx,
          ref.programaId,
          inicio,
          fimDoMes(inicio),
        )) &&
        (await concluirPeloSistema(tx, {
          chamadoId: ch.id,
          texto: `Lançamento de ${rotuloDoMes(ref.mes)} recebido.`,
        }))
      )
        r.concluidos++;
    }

    const candidatos = programasACobrar(
      programas,
      new Set(),
      hoje,
      cobranca_dia,
    );
    if (!candidatos.mes || !candidatos.programas.length) return r;
    const mes = candidatos.mes;
    const inicio = `${mes}-01`;
    const lancados = await repo.programasComLancamento(
      tx,
      candidatos.programas,
      inicio,
      fimDoMes(inicio),
    );
    const { programas: cobrar } = programasACobrar(
      programas,
      new Set(lancados.map((l) => l.programa_id)),
      hoje,
      cobranca_dia,
    );
    if (!cobrar.length) return r;
    const destino = await destinoDaCobranca(tx);
    if (!destino) {
      log.error("cobrança do parceiro: setor Sustentabilidade não existe");
      return r;
    }
    const rotulo = rotuloDoMes(mes);
    for (const id of cobrar) {
      const ref = refDaCobranca(id, mes);
      if (await repo.jaTemChamado(tx, MODULO_DOS_CHAMADOS, ref)) continue;
      const p = programas.find((x) => x.id === id);
      const criado = await criarChamadoSistema(
        tx,
        {
          setorId: destino.setorId,
          categoriaId: destino.categoriaId,
          tipo: "tarefa",
          titulo: `Cobrar lançamento do parceiro: ${p?.nome ?? "programa"} (${rotulo})`,
          descricao: `O programa ${p?.nome ?? ""} não tem lançamento em ${rotulo}. Fale com o parceiro (fora do sistema) e confira o link de lançamento, ou lance pela equipe. O chamado fecha sozinho quando chegar um lançamento de ${rotulo}.`,
          origem: "modulo",
          origemModulo: MODULO_DOS_CHAMADOS,
          origemRef: ref,
          autorNome: "Sistema (sustentabilidade)",
          acaoUrl: `/sustentabilidade/programas/${id}?aba=lancamentos&mes=${mes}`,
          acaoRotulo: `um lançamento de ${rotulo}`,
          conclusaoExterna: true,
        },
        agora,
      );
      if (criado) r.criados++;
    }
    return r;
  });
}
