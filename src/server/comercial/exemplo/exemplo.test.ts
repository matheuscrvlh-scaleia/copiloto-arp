import { describe, expect, it } from "vitest";
import { diasEntre } from "@/lib/comercial/datas";
import { ativoEm } from "@/lib/comercial/fontes";
import { cnpjValido, cpfValido } from "@/lib/documentos";
import { gerarEnet, INICIO_CONTAS } from "./enet";

// Os dados de exemplo têm o volume da seção 6 e a distribuição da planilha
// (teste 8), são coerentes entre si e não mudam de um dia para o outro.

const HOJE = "2026-11-04";
const enet = gerarEnet(HOJE);

const contar = <T>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length;

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
