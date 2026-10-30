import { describe, expect, it } from "vitest";
import { dentro, somarDias } from "@/lib/marketing/periodo";
import { gerarAnuncios } from "./anuncios";
import { gerarAsana } from "./asana";
import { gerarRd } from "./rd";
import { gerarRedes } from "./redes";
import { gerarReputacao } from "./reputacao";
import { gerarSite } from "./site";

// Os dados de exemplo trazem os casos de teste da etapa 1 do spec e o
// volume da seção 6, e não mudam de um dia para o outro.

const HOJE = "2026-10-29";
const anuncios = gerarAnuncios(HOJE);
const rd = gerarRd(HOJE, anuncios);

describe("anúncios e RD", () => {
  it("só Google e TikTok: 4 Google (1 YouTube) e 2 TikTok (a Meta é real)", () => {
    const por = (p: string) =>
      anuncios.campanhas.filter((c) => c.plataforma === p);
    expect(anuncios.campanhas).toHaveLength(6);
    expect(por("google")).toHaveLength(4);
    expect(por("google").filter((c) => c.tipo === "VIDEO")).toHaveLength(1);
    expect(por("tiktok")).toHaveLength(2);
  });

  it("dezenas de leads por semana, com lead sem campanha e contato que converte duas vezes", () => {
    const semana = rd.conversoes.filter((c) =>
      dentro(c.created_at, { de: "2026-10-19", ate: "2026-10-25" }),
    );
    expect(semana.length).toBeGreaterThan(25);
    expect(semana.length).toBeLessThan(90);
    const pagasSemUtm = rd.conversoes.filter(
      (c) => c.traffic_medium === "cpc" && c.traffic_campaign === "",
    );
    expect(pagasSemUtm.length).toBeGreaterThan(0);
    const porContato = new Map<string, Set<string>>();
    for (const c of rd.conversoes) {
      const lps = porContato.get(c.contact_uuid) ?? new Set();
      lps.add(c.conversion_identifier);
      porContato.set(c.contact_uuid, lps);
    }
    expect([...porContato.values()].some((s) => s.size >= 2)).toBe(true);
  });

  it("a Feira de Natal (sem tipo) existe só no RD", () => {
    expect(
      rd.conversoes.some(
        (c) => c.conversion_identifier === "lp-feira-de-natal",
      ),
    ).toBe(true);
  });

  it("o mesmo dia dá os mesmos números amanhã", () => {
    const amanha = gerarAnuncios(somarDias(HOJE, 1));
    const dia = "2026-10-20";
    const a = anuncios.google.linhas.filter((l) => l.segments.date === dia);
    const b = amanha.google.linhas.filter((l) => l.segments.date === dia);
    expect(b).toEqual(a);
  });
});

describe("site, redes, Asana e reputação", () => {
  it("GA4 e Search Console têm linhas todos os dias", () => {
    const site = gerarSite(HOJE, anuncios);
    expect(site.ga4.some((l) => l.date === "2026-10-28")).toBe(true);
    expect(site.buscas.some((l) => l.date === "2026-10-28")).toBe(true);
  });

  it("redes de exemplo só do YouTube e do TikTok (Instagram e Facebook são reais)", () => {
    const r = gerarRedes(HOJE);
    expect(Object.keys(r)).toEqual(["youtube", "tiktok"]);
    expect(r.tiktok.dias.at(-1)?.date).toBe("2026-10-28");
    expect(r.youtube.dias).toHaveLength(r.tiktok.dias.length);
  });

  it("ronda com 35 sinalizações S e 20 E abertas", () => {
    const { tarefas } = gerarAsana(HOJE);
    const abertas = (c: string) =>
      tarefas.filter((t) => t.name.startsWith(`${c} - `) && !t.completed)
        .length;
    expect(abertas("S")).toBe(35);
    expect(abertas("E")).toBe(20);
    const eventosFuturos = tarefas.filter(
      (t) =>
        t.projects[0]?.name === "Calendário de eventos" &&
        (t.due_on ?? "") >= HOJE,
    );
    expect(eventosFuturos).toHaveLength(40);
  });

  it("o 1º locatário tem 4 reclamações nos últimos 30 dias", () => {
    const locs = ["Bistrô Tear", "Academia Fibra", "Livraria Novelo"].map(
      (nome, k) => ({
        id: `l${k}`,
        nome,
        forma_acesso: "gerente",
        perfil_url: null,
      }),
    );
    const r = gerarReputacao(HOJE, locs, [
      "Atendimento",
      "Limpeza",
      "Estacionamento",
    ]);
    const academia = r.avaliacoes.filter(
      (a) =>
        a.localId === "l1" &&
        ["ONE", "TWO"].includes(a.starRating) &&
        a.createTime.slice(0, 10) >= somarDias(HOJE, -29),
    );
    expect(academia).toHaveLength(4);
    const temas = new Set(r.temas.map((t) => t.tema));
    expect(
      [...temas].every((t) =>
        ["Atendimento", "Limpeza", "Estacionamento"].includes(t),
      ),
    ).toBe(true);
  });
});
