import { describe, expect, it } from "vitest";
import { diasEntre } from "@/lib/comercial/datas";
import { ativoEm, campoDa, estadoDa } from "@/lib/comercial/fontes";
import { cnpjValido, cpfValido } from "@/lib/documentos";
import { gerarEnet, INICIO_CONTAS } from "./enet";
import { FUNIL_COMERCIAL, gerarRd } from "./rd";

// Os dados de exemplo têm o volume da seção 6 e a distribuição da planilha
// (teste 8), são coerentes entre si e não mudam de um dia para o outro.

const HOJE = "2026-11-04";
const rd = gerarRd(HOJE);
const enet = gerarEnet(HOJE);

const pct = (n: number, de: number) => (n / de) * 100;
const contar = <T>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length;

describe("RD Station CRM", () => {
  const ano = rd.oportunidades.filter(
    (o) =>
      o.created_at.startsWith("2026") &&
      o.deal_pipeline._id === FUNIL_COMERCIAL._id,
  );

  it("≈1.850 oportunidades desde nov/2022 e ≈37 por mês em 2026", () => {
    expect(rd.oportunidades.length).toBeGreaterThan(1700);
    expect(rd.oportunidades.length).toBeLessThan(2000);
    expect(rd.oportunidades[0]?.created_at.slice(0, 7)).toBe("2022-11");
    expect(ano.length / 10).toBeGreaterThan(31);
    expect(ano.length / 10).toBeLessThan(43);
  });

  it("distribuição parecida com a da planilha", () => {
    const perdidas = ano.filter((o) => estadoDa(o) === "Perdida");
    expect(pct(perdidas.length, ano.length)).toBeGreaterThan(86);
    const vendidas = contar(ano, (o) => estadoDa(o) === "Vendida");
    expect(vendidas).toBeGreaterThan(0);
    expect(pct(vendidas, ano.length)).toBeLessThan(2);
    expect(contar(ano, (o) => estadoDa(o) === "Em andamento")).toBeGreaterThan(
      5,
    );
    const direto = contar(ano, (o) => o.deal_source?.name === "Tráfego Direto");
    expect(pct(direto, ano.length)).toBeGreaterThan(30);
    expect(pct(direto, ano.length)).toBeLessThan(44);
    const sala = contar(ano, (o) => campoDa(o, "perfil") === "Sala comercial");
    expect(pct(sala, ano.length)).toBeGreaterThan(36);
    expect(pct(sala, ano.length)).toBeLessThan(50);
    const semDisp = contar(
      perdidas,
      (o) => o.deal_lost_reason?.name === "Sem disponibilidade no momento",
    );
    expect(pct(semDisp, perdidas.length)).toBeGreaterThan(65);
  });

  it("estado, etapa, valores e datas fecham entre si", () => {
    const agora = new Date("2026-11-04T09:00:00Z").getTime();
    for (const o of rd.oportunidades) {
      const e = estadoDa(o);
      expect(new Date(o.created_at).getTime()).toBeLessThan(agora);
      expect(!!o.deal_lost_reason).toBe(e === "Perdida");
      expect(!!o.closed_at).toBe(e !== "Em andamento");
      if (e === "Em andamento") expect(o.next_task).not.toBeNull();
      if (e !== "Vendida") expect(o.amount_unique).toBe(0);
      if (o.last_activity_at && o.first_activity_at)
        expect(o.last_activity_at >= o.first_activity_at).toBe(true);
    }
    const vendidas = rd.oportunidades.filter((o) => o.win === true);
    expect(vendidas.some((o) => o.amount_montly > 0)).toBe(true);
  });

  it("contatos fictícios e conversões ligadas pelo e-mail", () => {
    const lps = new Set(rd.landingPages.map((l) => l.conversion_identifier));
    const porEmail = new Set(rd.conversoes.map((c) => c.email));
    for (const o of rd.oportunidades) {
      const email = o.contacts[0]?.emails[0]?.email ?? "";
      expect(email.endsWith("@exemplo.com.br")).toBe(true);
      expect(o.contacts[0]?.phones[0]?.phone).toMatch(/^\(22\) 90000-\d{4}$/);
      expect(porEmail.has(email)).toBe(true);
    }
    for (const c of rd.conversoes)
      expect(lps.has(c.conversion_identifier)).toBe(true);
  });

  it("o mês passado não muda de um dia para o outro", () => {
    const amanha = gerarRd("2026-11-05");
    const set = (d: typeof rd) =>
      d.oportunidades
        .filter((o) => o.created_at.startsWith("2026-09"))
        .map((o) => `${o._id} ${o.created_at} ${o.name}`);
    expect(set(amanha)).toEqual(set(rd));
  });
});

describe("ENET", () => {
  const { lucs, contratos, clientes, contasReceber } = enet;
  const ativos = contratos.filter((c) => ativoEm(c, HOJE));

  it("396 LUCs em 15 locais, 84 áreas publicitárias, ~269 locados", () => {
    expect(lucs).toHaveLength(396);
    expect(new Set(lucs.map((l) => l.local)).size).toBe(15);
    const midia = lucs.filter((l) => l.tipo_loja === "Área Publicitária");
    expect(midia).toHaveLength(84);
    expect(midia.every((l) => l.abl === 0)).toBe(true);
    expect(lucs.reduce((t, l) => t + l.abl, 0)).toBeCloseTo(41_316.81, 2);
    const locados = contar(lucs, (l) => l.status === "Locado");
    expect(locados).toBeGreaterThan(250);
    expect(locados).toBeLessThan(290);
    const vaga = lucs
      .filter((l) => l.status === "Vago" && l.tipo_loja !== "Eventos")
      .reduce((t, l) => t + l.abl, 0);
    expect(vaga).toBeGreaterThan(1500);
    expect(vaga).toBeLessThan(6000);
  });

  it("LUC locado tem um contrato ativo; vago, nenhum", () => {
    for (const l of lucs) {
      const n = contar(ativos, (c) => c.luc === l.numero);
      expect(n).toBe(l.status === "Locado" ? 1 : 0);
    }
  });

  it("clientes com documento válido, sócios e locatário de vários LUCs", () => {
    const codigos = new Set(clientes.map((c) => c.codigo));
    for (const c of contratos) expect(codigos.has(c.cliente)).toBe(true);
    for (const c of clientes) {
      const ok = c.tipo_pessoa === "PJ" ? cnpjValido : cpfValido;
      expect(ok(c.cpf_cnpj)).toBe(true);
      expect(c.socios.length).toBeGreaterThan(0);
      for (const s of c.socios) expect(cpfValido(s.cpf)).toBe(true);
    }
    const porCliente = new Map<string, number>();
    for (const c of ativos)
      porCliente.set(c.cliente, (porCliente.get(c.cliente) ?? 0) + 1);
    expect([...porCliente.values()].some((n) => n > 1)).toBe(true);
    expect(clientes.some((c) => c.socios.some((s) => !s.data_nascimento))).toBe(
      true,
    );
  });

  it("entradas, saídas, transferências e vencidos nos últimos 24 meses", () => {
    const desde = "2024-11-04";
    const saidas = contratos.filter(
      (c) => c.data_rescisao && c.data_rescisao >= desde,
    );
    const entradas = contratos.filter((c) => c.data_inicio >= desde);
    expect(saidas.length).toBeGreaterThan(20);
    expect(entradas.length).toBeGreaterThan(20);
    const transferencias = saidas.filter((s) =>
      entradas.some(
        (e) =>
          e.cliente === s.cliente &&
          e.luc !== s.luc &&
          diasEntre(s.data_rescisao as string, e.data_inicio) >= 0 &&
          diasEntre(s.data_rescisao as string, e.data_inicio) <= 30,
      ),
    );
    expect(transferencias.length).toBeGreaterThan(2);
    const vencidos = ativos.filter(
      (c) => c.prazo === "Determinado" && (c.data_termino ?? "") < HOJE,
    );
    expect(vencidos.length).toBeGreaterThan(0);
    expect(vencidos.length).toBeLessThan(ativos.length / 4);
    expect(ativos.some((c) => c.prazo === "Indeterminado")).toBe(true);
    expect(ativos.some((c) => c.indice === "IPCA")).toBe(true);
  });

  it("contas a receber por mês desde jan/2025, coerentes com os contratos", () => {
    const meses = [...new Set(contasReceber.map((c) => c.competencia))].sort();
    expect(meses[0]).toBe(INICIO_CONTAS);
    expect(meses.at(-1)).toBe("2026-11-01");
    const outubro = contasReceber.filter(
      (c) => c.competencia === "2026-10-01" && c.tipo_luc !== "Eventos",
    );
    const cheios = contratos.filter(
      (c) =>
        c.data_inicio <= "2026-10-01" &&
        (!c.data_rescisao || c.data_rescisao > "2026-10-31"),
    );
    for (const c of cheios) {
      const linha = outubro.find(
        (o) => o.luc === c.luc && o.cliente === c.cliente,
      );
      expect(linha?.valor_faturado).toBeCloseTo(c.valor_aluguel, 2);
    }
    const total = outubro.reduce((t, c) => t + c.valor_faturado, 0);
    expect(total).toBeGreaterThan(700_000);
    expect(total).toBeLessThan(1_400_000);
    expect(contasReceber.some((c) => c.tipo_luc === "Área Publicitária")).toBe(
      true,
    );
    expect(contasReceber.some((c) => c.tipo_luc === "Eventos")).toBe(true);
  });

  it("o que já aconteceu não muda de um dia para o outro", () => {
    const depois = gerarEnet("2026-11-20");
    const ate = (d: typeof enet) =>
      d.contratos
        .filter((c) => c.data_inicio < "2026-11-01")
        .map((c) => `${c.codigo} ${c.luc} ${c.cliente} ${c.data_inicio}`);
    expect(ate(depois)).toEqual(ate(enet));
  });
});
