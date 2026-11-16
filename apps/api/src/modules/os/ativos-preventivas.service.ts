import { checklistDaOS, preventivasAGerar } from "@arp/shared/os/ativos";
import { deBrasilia, hojeEmBrasilia } from "@arp/shared/os/tempo";
import type { Tx } from "@/infra/banco";
import type { AtivoDaPreventiva, Plano } from "./ativos.repository";
import * as repo from "./ativos.repository";
import { configDoSistema } from "./automacao.service";
import { type ChamadoCriado, criarChamadoSistema } from "./criar.service";

// OS preventiva de um plano: a mesma criação para a rotina de hora em hora
// e para o botão "Gerar agora" da ficha (que confere a permissão antes).
// O banco recusa a mesma data do mesmo plano duas vezes: aí devolve null.
//
// Para a rotina das preventivas (área das rotinas), no escopo `comoServico`:
//   preventivasDevidas(tx, agora)  o que vence, com as datas a gerar
//   criarPreventiva(tx, …)         cria a OS de uma data
//   avancarPlano(tx, id, de, para) avança a próxima data do plano

export type { AtivoDaPreventiva, Plano };
export { avancarPlano } from "./ativos.repository";

type PlanoDaOS = Pick<
  Plano,
  | "id"
  | "titulo"
  | "descricao"
  | "setor_id"
  | "categoria_id"
  | "responsavel_id"
  | "checklist"
>;

export async function criarPreventiva(
  tx: Tx,
  plano: PlanoDaOS,
  ativo: Omit<AtivoDaPreventiva, "situacao">,
  data: string,
  opcoes: {
    /** "hh:mm" do fim do expediente: o prazo é o fim do dia da data. */
    expedienteFim: string;
    abertoPor?: string | null;
    autorNome: string;
    agora?: Date;
  },
): Promise<ChamadoCriado | null> {
  const checklist = checklistDaOS(plano.checklist);
  return criarChamadoSistema(
    tx,
    {
      setorId: plano.setor_id,
      categoriaId: plano.categoria_id,
      tipo: "os",
      origem: "preventiva",
      titulo: `Preventiva: ${plano.titulo} — ${ativo.nome}`,
      descricao: plano.descricao,
      abertoPor: opcoes.abertoPor ?? null,
      autorNome: opcoes.autorNome,
      // Sem responsável no plano, vale o padrão da categoria.
      responsavelId: plano.responsavel_id ?? undefined,
      prazo: deBrasilia(data, opcoes.expedienteFim.slice(0, 5)),
      lojaId: ativo.loja_id,
      // O local da OS é o do ativo.
      bloco: ativo.bloco,
      local:
        [ativo.area, ativo.ponto].filter((p) => p?.trim()).join(" · ") || null,
      ativoId: ativo.id,
      planoId: plano.id,
      planoData: data,
      // Plano sem checklist: vale o da categoria.
      checklist: checklist.length ? checklist : undefined,
      aviso: { tipo: "preventiva", texto: "Preventiva criada." },
    },
    opcoes.agora,
  );
}

export interface PreventivaDevida {
  plano: Plano;
  /** Datas cujas OS já devem existir (até 10 por plano). */
  datas: string[];
  /** Para onde o plano avança depois de criar as OS. */
  proxima: string;
  /** O ativo do plano; ausente: o ativo sumiu. */
  ativo: AtivoDaPreventiva | undefined;
}

/**
 * O que vence: planos ativos cuja OS já deve ter sido criada (data menos a
 * antecedência), com as datas, a próxima data e o ativo. Ativo baixado
 * continua na lista (quem cria pula). Também o fim do expediente, para o
 * prazo da OS.
 */
export async function preventivasDevidas(
  tx: Tx,
  agora: Date,
): Promise<{ devidas: PreventivaDevida[]; expedienteFim: string }> {
  const hoje = hojeEmBrasilia(agora);
  const { p } = await configDoSistema(tx);
  const padrao = p.preventiva_antecedencia_dias;
  const devidas = (await repo.planosAtivos(tx))
    .map((plano) => ({ plano, ...preventivasAGerar(plano, padrao, hoje) }))
    .filter((d) => d.datas.length > 0);
  const ativos = await repo.ativosDaPreventiva(tx, [
    ...new Set(devidas.map((d) => d.plano.ativo_id)),
  ]);
  const porId = new Map(ativos.map((a) => [a.id, a]));
  return {
    devidas: devidas.map((d) => ({ ...d, ativo: porId.get(d.plano.ativo_id) })),
    expedienteFim: p.expediente_fim,
  };
}
