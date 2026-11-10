import { describe, expect, it } from "vitest";
import { dentro, somarDias } from "@/lib/marketing/periodo";
import { gerarAnuncios } from "./anuncios";
import { gerarRd } from "./rd";
import { gerarRedes } from "./redes";
import { gerarReputacao } from "./reputacao";

// Os dados de exemplo trazem os casos de teste da etapa 1 do spec e o
// volume da seção 6, e não mudam de um dia para o outro.

const HOJE = "2026-10-29";
const anuncios = gerarAnuncios(HOJE);
const rd = gerarRd(HOJE, anuncios);

describe("anúncios e RD", () => {
  it("só TikTok: 2 campanhas (Meta e Google são reais)", () => {
    expect(anuncios.campanhas.map((c) => c.plataforma)).toEqual([
      "tiktok",
      "tiktok",
    ]);
  });

  it("dezenas de leads por semana, com lead sem campanha e contato que converte duas vezes", () => {
    const semana = rd.conversoes.filter((c) =>
      dentro(c.created_at, { de: "2026-10-19", ate: "2026-10-25" }),
    );
    expect(semana.length).toBeGreaterThan(25);
    expect(semana.length).toBeLessThan(90);
    const pagasSemUtm = rd.conversoes.filter(
      (c) => c.traffic_medium === "paid_social" && c.traffic_campaign === "",
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
    const a = anuncios.tiktok.linhas.filter((l) => l.stat_time_day === dia);
    const b = amanha.tiktok.linhas.filter((l) => l.stat_time_day === dia);
    expect(b).toEqual(a);
  });
});

describe("redes, Asana e reputação", () => {
  it("redes de exemplo só do YouTube e do TikTok (Instagram e Facebook são reais)", () => {
    const r = gerarRedes(HOJE);
    expect(Object.keys(r)).toEqual(["youtube", "tiktok"]);
    expect(r.tiktok.dias.at(-1)?.date).toBe("2026-10-28");
    expect(r.youtube.dias).toHaveLength(r.tiktok.dias.length);
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
