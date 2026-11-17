import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import { type DiaLido, janelas, somarDias } from "@/connectors/growatt/client";
import { mensagemSegura } from "@/connectors/http";
import { banco } from "@/infra/banco";
import { growatt } from "./credenciais.service";
import { executar, guardarBrutos } from "./execucao.service";
import * as repo from "./growatt.repository";

// Geração diária da usina solar (Growatt), para operacoes.solar_inversor_dias.
// Toda leitura relê os últimos 8 dias (uma consulta): o dia de hoje é
// parcial e o de ontem pode fechar depois. Na primeira leitura de uma usina,
// busca o histórico desde a criação dela no portal (8 dias por consulta).

const SISTEMA = "sus_growatt";
/** Dias relidos a cada execução (o limite de uma consulta da API). */
const DIAS_RELIDOS = 8;

export interface OpcoesGrowatt {
  hoje?: Date;
  /** Força o período ("aaaa-mm-dd"), ex.: reprocessar o histórico. */
  de?: string;
  ate?: string;
}

export interface ResultadoGrowatt {
  usina: number;
  de: string;
  ate: string;
  dias: number;
  kwh: number;
  avisos: string[];
}

export async function sincronizarGrowatt(opcoes: OpcoesGrowatt = {}) {
  const api = await growatt();
  const hoje = hojeEmBrasilia(opcoes.hoje ?? new Date());
  const ate = opcoes.ate ?? hoje;
  const de =
    opcoes.de ??
    ((await banco.comoServico((tx) => repo.temDias(tx, api.usinaId)))
      ? somarDias(ate, -(DIAS_RELIDOS - 1))
      : await inicioDaUsina(api, ate));

  return executar(SISTEMA, "geracao_diaria", async (runId) => {
    const avisos: string[] = [];
    const lidos: DiaLido[] = [];
    const brutos = [];
    // Uma consulta de cada vez: a API recusa muitas seguidas. Janela que
    // falhar vira aviso; as outras ficam gravadas.
    for (const [ini, fim] of janelas(de, ate)) {
      try {
        const dias = await api.energiaPorDia(ini, fim);
        lidos.push(...dias);
        brutos.push({ chave: `${api.usinaId}:${ini}`, payload: dias });
      } catch (erro) {
        avisos.push(
          `${ini} a ${fim}: não lido (${mensagemSegura(erro).slice(0, 200)})`,
        );
      }
    }
    if (lidos.length === 0 && avisos.length > 0)
      throw new Error(`nenhum dia lido da Growatt (${avisos[0]})`);

    await banco.comoServico((tx) =>
      repo.gravarDias(tx, api.usinaId, lidos, runId),
    );
    await guardarBrutos(SISTEMA, "geracao_dia", runId, brutos);

    const resultado: ResultadoGrowatt = {
      usina: api.usinaId,
      de,
      ate,
      dias: lidos.length,
      kwh: Math.round(lidos.reduce((s, d) => s + d.kwh, 0) * 100) / 100,
      avisos,
    };
    return {
      ...resultado,
      registros: lidos.length,
      cursor: { executado_em: new Date().toISOString(), ...resultado },
    };
  });
}

/** A próxima leitura vai buscar o histórico (nenhum dia gravado da usina)? */
export async function primeiraLeitura(): Promise<boolean> {
  const api = await growatt();
  return !(await banco.comoServico((tx) => repo.temDias(tx, api.usinaId)));
}

/** Primeiro dia do histórico: a criação da usina no portal (ou a última semana). */
async function inicioDaUsina(
  api: Awaited<ReturnType<typeof growatt>>,
  ate: string,
): Promise<string> {
  const semana = somarDias(ate, -(DIAS_RELIDOS - 1));
  const criada = (await api.detalhes()).create_date ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(criada) && criada < semana
    ? criada
    : semana;
}
