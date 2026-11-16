import { somarDias } from "@arp/shared/marketing/periodo";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import { z } from "zod";
import { mensagemSegura } from "@/connectors/http";
import type { RdContatoDaSegmentacao } from "@/connectors/marketing/rd-station";
import { banco } from "@/infra/banco";
import { rdStation } from "./credenciais.service";
import { emLotes, executar, lerCursor } from "./execucao.service";
import {
  diasDoAnalytics,
  JANELA_RD_DIAS,
  type LinhaContato,
  type LinhaConversao,
  linhaDaConversao,
  linhaDoContato,
  precisaReler,
} from "./rd-station.regras";
import * as repo from "./rd-station.repository";

// Sincronização do RD Station Marketing (só leitura). Duas partes:
// 1. Landing pages: uma foto por dia (visitas e conversões) dos dias que
//    faltam, até 45 dias para trás (limite do plano; 60 chamadas por hora).
// 2. Leads: contatos da segmentação "Todos os contatos da base de Leads",
//    da última conversão mais nova para a mais velha, até 18 semanas atrás.
//    Só relê quem é novo ou converteu de novo (2 chamadas por contato:
//    etapa do funil e conversões), no ritmo do limite de 120/min.
// Pode parar no meio (prazo da rodada): o que foi gravado fica, e a
// próxima execução continua de onde parou, porque pula quem já está em dia.

const SISTEMA = "mkt_rd_station";
const RECURSO = "conversoes";
/** Chamadas por minuto que a sincronização se permite (limite: 120). */
const RITMO_POR_MIN = 100;
const SEGMENTACAO_BASE = /todos os contatos/i;

export interface ResultadoRd {
  landingPages: number;
  dias: number;
  contatos: number;
  conversoes: number;
  /** false: parou pelo prazo; falta reler contatos (a próxima continua). */
  completo: boolean;
  faltam: number;
  avisos: string[];
}

const cursorSchema = z
  .object({ lps_ate: z.string().nullish() })
  .catch({ lps_ate: null });

export async function sincronizarRd(
  opcoes: { agora?: Date; prazoMs?: number } = {},
) {
  const agora = opcoes.agora ?? new Date();
  const prazo = Date.now() + (opcoes.prazoMs ?? 240_000);
  const hoje = hojeEmBrasilia(agora);
  const api = await rdStation();
  const cursor = cursorSchema.parse((await lerCursor(SISTEMA, RECURSO)) ?? {});

  return executar(SISTEMA, RECURSO, async () => {
    const avisos: string[] = [];

    // 1. Landing pages: nome pela lista, números pelo analytics do dia.
    const lps = await api.landingPages();
    const nomes = new Map(lps.map((l) => [l.conversion_identifier, l.title]));
    let lpsAte = cursor.lps_ate ?? null;
    let dias = 0;
    for (const dia of diasDoAnalytics(hoje, lpsAte)) {
      if (Date.now() > prazo) break;
      let linhas: Awaited<ReturnType<typeof api.analyticsDoDia>>;
      try {
        linhas = await api.analyticsDoDia(dia);
      } catch (erro) {
        avisos.push(
          `landing pages em ${dia}: ${mensagemSegura(erro).slice(0, 160)}`,
        );
        break;
      }
      if (linhas.length > 0)
        await banco.comoServico((tx) =>
          repo.gravarLandingPages(
            tx,
            linhas.map((l) => ({
              identificador: l.asset_identifier,
              dia,
              nome: nomes.get(l.asset_identifier) ?? l.asset_identifier,
              visitas: l.visits_count,
              conversoes: l.conversion_count,
            })),
          ),
        );
      lpsAte = dia;
      dias++;
    }

    // 2. Leads: quem precisa ser relido, da segmentação base.
    const segs = await api.segmentacoes();
    const base =
      segs.find((s) => SEGMENTACAO_BASE.test(s.name)) ??
      segs.find((s) => s.standard);
    if (!base)
      throw new Error("segmentação de todos os contatos não encontrada");
    const desde = somarDias(hoje, -JANELA_RD_DIAS);
    const salvos = new Map<string, string | null>(
      (await banco.comoServico(repo.contatos)).map((c) => [
        c.uuid,
        c.ultima_conversao,
      ]),
    );
    const fila: RdContatoDaSegmentacao[] = [];
    for (let pagina = 1; ; pagina++) {
      const lote = await api.contatosDaSegmentacao(base.id, pagina);
      let passou = false;
      for (const c of lote) {
        if (!c.last_conversion_date) continue;
        if (c.last_conversion_date.slice(0, 10) < desde) {
          passou = true;
          break;
        }
        if (precisaReler(c, salvos.get(c.uuid))) fila.push(c);
      }
      if (passou || lote.length < api.porPagina) break;
    }

    let contatos = 0;
    let conversoes = 0;
    const intervalo = (2 * 60_000) / RITMO_POR_MIN;
    const pendentes: { contato: LinhaContato; conversoes: LinhaConversao[] }[] =
      [];
    const gravar = async () => {
      if (!pendentes.length) return;
      const lote = pendentes.splice(0);
      await banco.comoServico((tx) =>
        repo.gravarContatos(
          tx,
          lote.map((p) => p.contato),
        ),
      );
      for (const parte of emLotes(
        lote.flatMap((p) => p.conversoes),
        500,
      ))
        await banco.comoServico((tx) => repo.gravarConversoes(tx, parte));
    };
    let feitos = 0;
    for (const c of fila) {
      if (Date.now() > prazo) break;
      const inicio = Date.now();
      const [etapa, eventos] = await Promise.allSettled([
        api.etapa(c.uuid),
        api.conversoes(c.uuid),
      ]);
      feitos++;
      if (eventos.status === "rejected") {
        avisos.push(
          `contato não lido: ${mensagemSegura(eventos.reason).slice(0, 160)}`,
        );
        continue;
      }
      const linhas = eventos.value
        .filter((e) => e.event_type === "CONVERSION")
        .map((e) => linhaDaConversao(c.uuid, e));
      pendentes.push({
        contato: linhaDoContato(
          c,
          etapa.status === "fulfilled" ? etapa.value : "",
          agora,
        ),
        conversoes: linhas,
      });
      contatos++;
      conversoes += linhas.length;
      if (pendentes.length >= 25) await gravar();
      const espera = intervalo - (Date.now() - inicio);
      if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    }
    await gravar();

    const faltam = fila.length - feitos;
    if (faltam > 0)
      avisos.push(`${faltam} contatos ficaram para a próxima execução (prazo)`);
    const resultado: ResultadoRd = {
      landingPages: lps.length,
      dias,
      contatos,
      conversoes,
      completo: faltam === 0,
      faltam,
      avisos: avisos.slice(0, 20),
    };
    return {
      ...resultado,
      registros: conversoes,
      cursor: {
        lps_ate: lpsAte,
        executado_em: agora.toISOString(),
        ...resultado,
      },
    };
  });
}
