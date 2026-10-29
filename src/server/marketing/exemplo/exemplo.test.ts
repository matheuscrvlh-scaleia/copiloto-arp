import { describe, expect, it } from "vitest";
import { dentro, somarDias } from "@/lib/marketing/periodo";
import { fluxoPorDia } from "@/lib/marketing/publico";
import { gerarAnuncios } from "./anuncios";
import { gerarAsana } from "./asana";
import { gerarPassagens } from "./estacionamento";
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
  it("12 campanhas: 6 Meta, 4 Google (1 YouTube) e 2 TikTok", () => {
    const por = (p: string) =>
      anuncios.campanhas.filter((c) => c.plataforma === p);
    expect(por("meta")).toHaveLength(6);
    expect(por("google")).toHaveLength(4);
    expect(por("google").filter((c) => c.tipo === "VIDEO")).toHaveLength(1);
    expect(por("tiktok")).toHaveLength(2);
  });

  it("uma campanha gasta e não traz lead ao RD", () => {
    const nomes = new Set(rd.conversoes.map((c) => c.traffic_campaign));
    const semLead = anuncios.campanhas.filter(
      (c) =>
        !nomes.has(c.nome) &&
        anuncios.meta.insights.some(
          (i) => i.campaign_id === c.id && i.spend > 0,
        ),
    );
    expect(semLead.map((c) => c.nome)).toEqual(["Marca | 108 anos | Alcance"]);
  });

  it("~60 leads por semana, com lead sem campanha e contato que converte duas vezes", () => {
    const semana = rd.conversoes.filter((c) =>
      dentro(c.created_at, { de: "2026-10-19", ate: "2026-10-25" }),
    );
    expect(semana.length).toBeGreaterThan(40);
    expect(semana.length).toBeLessThan(90);
    const pagasSemUtm = rd.conversoes.filter(
      (c) =>
        c.traffic_medium !== "organic" &&
        c.traffic_campaign === "" &&
        c.traffic_source === "facebook",
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
    const a = anuncios.meta.insights.filter((i) => i.date_start === dia);
    const b = amanha.meta.insights.filter((i) => i.date_start === dia);
    expect(b).toEqual(a);
  });
});

describe("site, redes, Asana, reputação e estacionamento", () => {
  it("GA4 e Search Console têm linhas todos os dias", () => {
    const site = gerarSite(HOJE, anuncios);
    expect(site.ga4.some((l) => l.date === "2026-10-28")).toBe(true);
    expect(site.buscas.some((l) => l.date === "2026-10-28")).toBe(true);
  });

  it("redes trazem foto diária de seguidores das 4 contas", () => {
    const r = gerarRedes(HOJE);
    expect(r.instagram.dias.at(-1)?.date).toBe("2026-10-28");
    expect(r.facebook.dias).toHaveLength(r.instagram.dias.length);
    expect(r.instagram.posts.length).toBeGreaterThan(50);
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

  it("estacionamento tem centenas de carros por dia e mais no sábado", () => {
    const p = gerarPassagens(HOJE, new Set());
    const doDia = (d: string) =>
      p.filter((x) => x.entrada.startsWith(d)).length;
    expect(doDia("2026-10-21")).toBeGreaterThan(150); // quarta
    expect(doDia("2026-10-24")).toBeGreaterThan(doDia("2026-10-21") * 2); // sábado
  });

  it("o estacionamento não passa das 350 vagas, nem em dia de evento", () => {
    const sabados = new Set(
      Array.from({ length: 16 }, (_, i) => somarDias("2026-10-24", -7 * i)),
    );
    const fluxo = fluxoPorDia(gerarPassagens(HOJE, sabados), 30);
    const pico = Math.max(...[...fluxo.values()].map((d) => d.dentroMax));
    expect(pico).toBeLessThan(350);
    expect(pico).toBeGreaterThan(350 * 0.6);
  });
});
