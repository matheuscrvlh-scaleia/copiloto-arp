import { describe, expect, it } from "vitest";
import { gerarEnet } from "@/server/comercial/exemplo/enet";
import type { EnetCliente, EnetContrato, EnetLuc } from "./fontes";
import {
  comStatus,
  filtrarLucs,
  fotoDaOcupacao,
  linhasDeLucs,
  movimentos,
  quadroMovPorBloco,
  quadroPor,
  quadroPorMes,
  TODOS_OS_TIPOS,
  totais,
  totalMovimentos,
} from "./ocupacao";

const luc = (numero: string, o: Partial<EnetLuc> = {}): EnetLuc => ({
  numero,
  data_inicio: "2010-01-01",
  tipo_loja: "Loja Comercial",
  abl: 50,
  area_util: 45,
  status: "Vago",
  local: "Bloco 01",
  piso: "Piso 1",
  rua: "Rua 1911",
  situacao: "Ativo",
  ...o,
});

const contrato = (
  codigo: string,
  luc: string,
  cliente: string,
  o: Partial<EnetContrato> = {},
): EnetContrato => ({
  codigo,
  luc,
  cliente,
  locatario: `Locatário ${cliente}`,
  data_inicio: "2025-03-10",
  data_termino: null,
  prazo: "Indeterminado",
  valor_aluguel: 1000,
  indice: "IGPM",
  mes_reajuste: 3,
  data_rescisao: null,
  ...o,
});

const cliente = (codigo: string, doc: string): EnetCliente => ({
  codigo,
  nome: codigo,
  cpf_cnpj: doc,
  tipo_pessoa: "PJ",
  socios: [],
  atividade: "Comércio",
});

const HOJE = "2026-11-04";

describe("LUCs e totais", () => {
  const lucs = [
    luc("01_101", { status: "Locado", abl: 100 }),
    luc("01_102", { abl: 40 }),
    luc("OOH_01", {
      tipo_loja: "Área Publicitária",
      abl: 0,
      local: "ARP",
      status: "Locado",
    }),
    luc("02_101", {
      local: "Bloco 02",
      status: "Locado",
      abl: 60,
      rua: "Rua das Rendas",
    }),
  ];
  const contratos = [
    contrato("CT1", "01_101", "C1", { valor_aluguel: 2500 }),
    contrato("CT2", "OOH_01", "C2", { valor_aluguel: 500 }),
    contrato("CT3", "02_101", "C3", { valor_aluguel: 1800 }),
    contrato("CT0", "01_102", "C9", { data_rescisao: "2026-01-01" }),
  ];
  const linhas = linhasDeLucs({ lucs, contratos }, HOJE, true);

  it("uma linha por LUC, com o contrato ativo; vago sem locatário", () => {
    expect(linhas).toHaveLength(4);
    expect(linhas[0]).toMatchObject({
      locatario: "Locatário C1",
      aluguel: 2500,
    });
    expect(linhas[1]).toMatchObject({ contrato: null, locatario: null });
  });

  it("sem a permissão de valores o aluguel nem vem", () => {
    const sem = linhasDeLucs({ lucs, contratos }, HOJE, false);
    expect(sem.every((l) => l.aluguel === null)).toBe(true);
    expect(totais(sem).aluguel).toBeNull();
  });

  it("% de ocupação em m²; área publicitária conta na quantidade, não nos m²", () => {
    const t = totais(linhas);
    expect(t).toMatchObject({
      quantidade: 4,
      locados: 3,
      vagos: 1,
      ablTotal: 200,
      ablLocada: 160,
      ablVaga: 40,
      aluguel: 4800,
    });
    expect(t.pct).toBeCloseTo(80);
  });

  it("tipo padrão = os que contam na ocupação; 'todos' traz tudo", () => {
    const contam = new Set(["Loja Comercial"]);
    const base = { bloco: "", rua: "" };
    expect(filtrarLucs(linhas, { ...base, tipo: "" }, contam)).toHaveLength(3);
    expect(
      filtrarLucs(linhas, { ...base, tipo: TODOS_OS_TIPOS }, contam),
    ).toHaveLength(4);
    expect(
      filtrarLucs(linhas, { ...base, tipo: "Área Publicitária" }, contam),
    ).toHaveLength(1);
    expect(
      filtrarLucs(linhas, { bloco: "Bloco 02", rua: "", tipo: "" }, contam),
    ).toHaveLength(1);
    expect(comStatus(linhas, "vago").map((l) => l.numero)).toEqual(["01_102"]);
  });

  it("quadro por bloco e por tipo", () => {
    const b = quadroPor(linhas, "bloco");
    expect(
      b.map((x) => [x.chave, x.locados, x.vagos, x.ablLocada, x.ablVaga]),
    ).toEqual([
      ["Bloco 01", 1, 1, 100, 40],
      ["ARP", 1, 0, 0, 0],
      ["Bloco 02", 1, 0, 60, 0],
    ]);
    expect(b[1]?.pct).toBeNull();
    const t = quadroPor(linhas, "tipo");
    expect(t.map((x) => [x.chave, x.quantidade])).toEqual([
      ["Loja Comercial", 3],
      ["Área Publicitária", 1],
    ]);
  });
});

describe("entradas, saídas e transferências", () => {
  const lucs = [
    luc("01_101", { abl: 50 }),
    luc("01_102", { abl: 80 }),
    luc("02_101", { abl: 30, local: "Bloco 02" }),
  ];
  const clientes = [
    cliente("C1", "111"),
    cliente("C2", "222"),
    cliente("C3", "111"),
  ];
  const enet = {
    lucs,
    clientes,
    contratos: [
      // C1 sai do 01_101 e o mesmo CNPJ (cadastro C3) entra no 02_101 20 dias depois.
      contrato("CT1", "01_101", "C1", {
        data_inicio: "2020-01-01",
        data_rescisao: "2026-03-05",
        valor_aluguel: 1500,
      }),
      contrato("CT2", "02_101", "C3", {
        data_inicio: "2026-03-25",
        valor_aluguel: 900,
      }),
      contrato("CT3", "01_102", "C2", {
        data_inicio: "2026-02-10",
        valor_aluguel: 2000,
      }),
      contrato("CT4", "01_101", "C2", {
        data_inicio: "2026-06-01",
        data_rescisao: "2026-10-01",
        valor_aluguel: 1200,
      }),
      contrato("CT5", "01_101", "C1", { data_inicio: "2026-12-01" }),
    ],
  };

  it("mesmo CPF/CNPJ em até X dias vira transferência (fora de entrada e saída)", () => {
    const ms = movimentos(enet, HOJE, 30);
    const tipos = ms
      .filter((m) => m.data.startsWith("2026"))
      .map((m) => [m.tipo, m.contrato]);
    expect(tipos).toEqual([
      ["entrada", "CT3"],
      ["transferencia", "CT2"],
      ["entrada", "CT4"],
      ["saida", "CT4"],
    ]);
    expect(ms.find((m) => m.tipo === "transferencia")?.origem).toBe("CT1");
  });

  it("fora do prazo do parâmetro, é saída e entrada", () => {
    const ms = movimentos(enet, HOJE, 10).filter((m) =>
      m.data.startsWith("2026"),
    );
    expect(ms.filter((m) => m.tipo === "transferencia")).toHaveLength(0);
    expect(ms.filter((m) => m.tipo === "saida")).toHaveLength(2);
  });

  it("quadros por mês e por bloco, por quantidade, m² e valor", () => {
    const ms = movimentos(enet, HOJE, 30);
    const meses = quadroPorMes(ms, 2026, "quantidade");
    expect(meses).toHaveLength(12);
    expect(meses[2]?.colunas).toEqual({
      entrada: 0,
      saida: 0,
      transferencia: 1,
      saldo: 0,
    });
    expect(meses[9]?.colunas.saldo).toBe(-1);
    expect(totalMovimentos(ms, 2026, "m2")).toEqual({
      entrada: 130,
      saida: 50,
      transferencia: 30,
      saldo: 80,
    });
    const blocos = quadroMovPorBloco(ms, 2026, "valor", [
      "Bloco 01",
      "Bloco 02",
    ]);
    expect(blocos[0]?.colunas).toEqual({
      entrada: 3200,
      saida: 1200,
      transferencia: 0,
      saldo: 2000,
    });
    expect(blocos[1]?.colunas.transferencia).toBe(900);
  });
});

describe("com o ENET de exemplo", () => {
  const enet = gerarEnet(HOJE);
  it("396 LUCs, 41.316,81 m² e LUC locado sempre com locatário", () => {
    const linhas = linhasDeLucs(enet, HOJE, true);
    const t = totais(linhas);
    expect(t.quantidade).toBe(396);
    expect(t.ablTotal).toBeCloseTo(41_316.81, 2);
    expect(
      linhas.filter((l) => l.status === "Locado").every((l) => l.locatario),
    ).toBe(true);
  });
});

describe("foto do fim do mês", () => {
  it("só os tipos que contam, com o contrato em vigor naquele dia", () => {
    const enet = {
      lucs: [
        luc("01_101", { abl: 100 }),
        luc("01_102", { abl: 40, local: "Bloco 02" }),
        luc("OOH_01", { tipo_loja: "Área Publicitária", abl: 0 }),
      ],
      contratos: [
        contrato("CT1", "01_101", "C1", { data_inicio: "2026-01-10" }),
        contrato("CT2", "01_102", "C2", { data_inicio: "2026-11-01" }),
        contrato("CT3", "OOH_01", "C3", { data_inicio: "2020-01-01" }),
      ],
    };
    const f = fotoDaOcupacao(enet, "2026-10-31", new Set(["Loja Comercial"]));
    expect(f).toMatchObject({
      mes: "2026-10-01",
      lucs: 2,
      lucs_locados: 1,
      abl_total: 140,
      abl_locada: 100,
      clientes_ativos: 1,
    });
    expect(f.por_bloco["Bloco 02"]).toEqual({
      lucs: 1,
      lucs_locados: 0,
      abl_total: 40,
      abl_locada: 0,
    });
    expect(Object.keys(f.por_tipo)).toEqual(["Loja Comercial"]);
  });
});
