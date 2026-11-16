import { beforeEach, describe, expect, it, vi } from "vitest";

// Rotina diária do Clube: abre o chamado "Renovar termo do Clube" uma vez
// por termo que vence em até termo_aviso_dias, e ao salvar o termo novo
// conclui o chamado. O banco é de mentira (as linhas já vêm como o filtro do
// banco as deixaria); o que se confere é a regra de quem recebe o chamado e o
// que vai nele.

vi.mock("server-only", () => ({}));

type Linha = Record<string, unknown>;
const dados: Record<string, Linha[]> = {};
const atualizacoes: { tabela: string; valores: Linha; id: unknown }[] = [];

function tabela(nome: string) {
  const linhas = () => dados[nome] ?? [];
  const q: Record<string, unknown> = {};
  for (const f of [
    "select",
    "gte",
    "is",
    "order",
    "eq",
    "not",
    "neq",
    "lt",
    "limit",
  ])
    q[f] = () => q;
  // Como o builder do supabase-js, a consulta também pode ser esperada direto.
  // biome-ignore lint/suspicious/noThenProperty: imita o builder do supabase-js
  q.then = (ok: (r: unknown) => unknown) => ok({ data: linhas(), error: null });
  q.range = async () => ({ data: linhas(), error: null });
  q.single = async () => ({ data: linhas()[0] ?? null, error: null });
  q.maybeSingle = async () => ({ data: linhas()[0] ?? null, error: null });
  q.update = (valores: Linha) => ({
    eq: async (_: string, id: unknown) => {
      atualizacoes.push({ tabela: nome, valores, id });
      return { error: null };
    },
  });
  return q;
}
const banco = () => ({ from: (nome: string) => tabela(nome) });

vi.mock("./base", () => ({
  suAdmin: () => banco(),
  su: async () => banco(),
  parametros: async () => ({}),
  parametrosDaEntrevista: async () => ({}),
}));
vi.mock("@/server/os/base", () => ({ osAdmin: () => banco() }));
vi.mock("@/server/os/automacao", () => ({
  configDoSistema: async () => ({ cal: { expedienteFim: "18:00" } }),
}));

const criar = vi.fn();
vi.mock("@/server/os/criar", () => ({
  criarChamadoSistema: (...a: unknown[]) => criar(...a),
}));
const aberto = vi.fn();
const concluir = vi.fn();
vi.mock("@/server/os/sistema", () => ({
  chamadoAbertoDaOrigem: (...a: unknown[]) => aberto(...a),
  concluirPeloSistema: (...a: unknown[]) => concluir(...a),
}));

const { rotinaClube, concluirRenovacoes } = await import("./clube");

const AGORA = new Date("2026-11-16T15:00:00Z");

beforeEach(() => {
  for (const k of Object.keys(dados)) delete dados[k];
  atualizacoes.length = 0;
  criar.mockReset().mockResolvedValue({ id: "chamado-1", numero: 10 });
  aberto.mockReset().mockResolvedValue(null);
  concluir.mockReset().mockResolvedValue(true);
  dados.parametros = [{ termo_aviso_dias: 30 }];
  dados.setores = [{ id: "setor-su" }];
  dados.categorias = [{ id: "cat-renovar" }];
  dados.participantes = [
    {
      id: "p1",
      nome: "Café da Serra",
      cliente_doc: "12345678000190",
      saiu_em: null,
    },
    {
      id: "p3",
      nome: "Ateliê Serrano",
      cliente_doc: "11222333000181",
      saiu_em: null,
    },
    {
      id: "p4",
      nome: "Brechó Verde",
      cliente_doc: "22333444000172",
      saiu_em: null,
    },
    {
      id: "p5",
      nome: "Doces da Vó",
      cliente_doc: "33444555000163",
      saiu_em: null,
    },
  ];
  dados.termos = [
    {
      id: "t1",
      participante_id: "p1",
      ano: 2025,
      valido_ate: "2026-12-01",
      chamado_id: null,
    },
    // Já renovou: o último termo vence depois do aviso.
    {
      id: "t2",
      participante_id: "p3",
      ano: 2025,
      valido_ate: "2026-11-30",
      chamado_id: null,
    },
    {
      id: "t3",
      participante_id: "p3",
      ano: 2026,
      valido_ate: "2027-11-30",
      chamado_id: null,
    },
    // Já tem chamado.
    {
      id: "t4",
      participante_id: "p4",
      ano: 2025,
      valido_ate: "2026-12-10",
      chamado_id: "c-antigo",
    },
    // Ainda longe.
    {
      id: "t5",
      participante_id: "p5",
      ano: 2026,
      valido_ate: "2027-05-01",
      chamado_id: null,
    },
    // Saiu do clube (fora de `participantes` ativos).
    {
      id: "t6",
      participante_id: "p2",
      ano: 2025,
      valido_ate: "2026-11-20",
      chamado_id: null,
    },
  ];
});

describe("rotinaClube", () => {
  it("abre um chamado só para o termo que vence no aviso, sem renovação, sem chamado e sem saída", async () => {
    expect(await rotinaClube(AGORA)).toBe(1);
    expect(criar).toHaveBeenCalledTimes(1);
    const [n] = criar.mock.calls[0] as [Record<string, unknown>];
    expect(n).toMatchObject({
      setorId: "setor-su",
      categoriaId: "cat-renovar",
      titulo: "Renovar termo do Clube: Café da Serra",
      origem: "modulo",
      acaoUrl: "/sustentabilidade/clube/p1",
      acaoRotulo: "o termo renovado",
      conclusaoExterna: true,
      origemModulo: "sustentabilidade",
      origemRef: "termo:p1:2025",
    });
    expect(String(n.descricao)).toContain("01/12/2026");
    expect(String(n.descricao)).toContain("CNPJ 12.345.678/0001-90");
    // O prazo é o fim do dia do vencimento (Brasília).
    expect((n.prazo as Date).toISOString()).toBe("2026-12-01T21:00:00.000Z");
    expect(atualizacoes).toEqual([
      { tabela: "termos", valores: { chamado_id: "chamado-1" }, id: "t1" },
    ]);
  });

  it("chamado já aberto da mesma origem não duplica, só liga ao termo", async () => {
    aberto.mockResolvedValue({ id: "ja-aberto" });
    expect(await rotinaClube(AGORA)).toBe(0);
    expect(criar).not.toHaveBeenCalled();
    expect(atualizacoes[0]?.valores).toEqual({ chamado_id: "ja-aberto" });
  });

  it("sem termo a vencer não cria nada", async () => {
    dados.termos = [
      {
        id: "t5",
        participante_id: "p5",
        ano: 2026,
        valido_ate: "2027-05-01",
        chamado_id: null,
      },
    ];
    expect(await rotinaClube(AGORA)).toBe(0);
    expect(criar).not.toHaveBeenCalled();
  });

  it("sem o setor Sustentabilidade, lança erro claro (a rotina do cron registra a falha)", async () => {
    dados.setores = [];
    await expect(rotinaClube(AGORA)).rejects.toThrow(/setor/i);
  });

  it("categoria ainda não criada: abre no setor, sem categoria", async () => {
    dados.categorias = [];
    await rotinaClube(AGORA);
    expect(
      (criar.mock.calls[0] as [Record<string, unknown>])[0].categoriaId,
    ).toBeNull();
  });
});

describe("concluirRenovacoes", () => {
  it("conclui o chamado do termo anterior ao salvar o termo novo", async () => {
    dados.termos = [
      {
        id: "t1",
        ano: 2025,
        valido_ate: "2026-12-01",
        chamado_id: "chamado-1",
      },
    ];
    const n = await concluirRenovacoes({
      participanteId: "p1",
      novo: { ano: 2026, validoAte: "2027-11-10" },
      concluidoPor: "u1",
    });
    expect(n).toBe(1);
    expect(concluir).toHaveBeenCalledWith({
      chamadoId: "chamado-1",
      texto: "Termo de 2026 salvo, válido até 10/11/2027.",
      concluidoPor: "u1",
    });
  });

  it("chamado que já não estava aberto não conta", async () => {
    dados.termos = [
      {
        id: "t1",
        ano: 2025,
        valido_ate: "2026-12-01",
        chamado_id: "chamado-1",
      },
    ];
    concluir.mockResolvedValue(false);
    expect(
      await concluirRenovacoes({
        participanteId: "p1",
        novo: { ano: 2026, validoAte: "2027-11-10" },
        concluidoPor: "u1",
      }),
    ).toBe(0);
  });
});
