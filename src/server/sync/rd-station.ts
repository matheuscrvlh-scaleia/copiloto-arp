import "server-only";
import { mensagemSegura } from "@/connectors/http";
import type { RdContatoDaSegmentacao } from "@/connectors/marketing/rd-station";
import { somarDias } from "@/lib/marketing/periodo";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { createAdminClient } from "@/lib/supabase/admin";
import { rdStation } from "../integracoes";
import { emLotes, executar } from "./execucao";
import {
  diasDoAnalytics,
  JANELA_RD_DIAS,
  type LinhaContato,
  type LinhaConversao,
  linhaDaConversao,
  linhaDoContato,
  precisaReler,
} from "./rd-station-regras";

// Sincronização do RD Station Marketing (só leitura). Duas partes:
// 1. Landing pages: uma foto por dia (visitas e conversões) dos dias que
//    faltam, até 45 dias para trás (limite do plano; 60 chamadas por hora).
// 2. Leads: contatos da segmentação "Todos os contatos da base de Leads",
//    da última conversão mais nova para a mais velha, até 18 semanas atrás.
//    Só relê quem é novo ou converteu de novo (2 chamadas por contato:
//    etapa do funil e conversões), no ritmo do limite de 120/min.
// Pode parar no meio (prazo da função): o que foi gravado fica, e a
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

interface Cursor {
  lps_ate?: string | null;
}

export async function sincronizarRd(
  opcoes: { agora?: Date; prazoMs?: number } = {},
) {
  const agora = opcoes.agora ?? new Date();
  const prazo = Date.now() + (opcoes.prazoMs ?? 240_000);
  const hoje = hojeEmBrasilia(agora);
  const admin = createAdminClient();
  const mkt = admin.schema("marketing");
  const api = await rdStation();

  const anterior = await admin
    .schema("integracao")
    .from("cursores")
    .select("cursor")
    .eq("sistema", SISTEMA)
    .eq("recurso", RECURSO)
    .maybeSingle();
  if (anterior.error) throw anterior.error;
  const cursor = (anterior.data?.cursor ?? {}) as Cursor;

  return executar(admin, SISTEMA, RECURSO, async () => {
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
      const { error } = await mkt.from("rd_landing_pages_dia").upsert(
        linhas.map((l) => ({
          identificador: l.asset_identifier,
          dia,
          nome: nomes.get(l.asset_identifier) ?? l.asset_identifier,
          visitas: l.visits_count,
          conversoes: l.conversion_count,
        })),
        { onConflict: "identificador,dia" },
      );
      if (error) throw error;
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
    const salvos = new Map<string, string | null>();
    {
      const { data, error } = await mkt
        .from("rd_contatos")
        .select("uuid, ultima_conversao");
      if (error) throw error;
      for (const c of data ?? []) salvos.set(c.uuid, c.ultima_conversao);
    }
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
      const a = await mkt.from("rd_contatos").upsert(
        lote.map((p) => p.contato),
        { onConflict: "uuid" },
      );
      if (a.error) throw a.error;
      for (const parte of emLotes(
        lote.flatMap((p) => p.conversoes),
        500,
      )) {
        const b = await mkt
          .from("rd_conversoes")
          .upsert(parte, { onConflict: "id" });
        if (b.error) throw b.error;
      }
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
