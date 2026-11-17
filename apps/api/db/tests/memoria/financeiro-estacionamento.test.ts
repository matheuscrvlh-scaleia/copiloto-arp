// Estacionamento detalhado (0008_estacionamento): quem lê as tabelas novas,
// que só a sincronização grava, e as consultas da tela rodando de verdade
// (repository pelo Kysely, no papel de quem está logado, com o RLS valendo).
// Dados fictícios.
import type { PGlite } from "@electric-sql/pglite";
import {
  type CompiledQuery,
  type DatabaseConnection,
  type Driver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type QueryResult,
} from "kysely";
import { beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/infra/banco/tipos";
import * as repo from "@/modules/financeiro/estacionamento.repository";
import { abrirBanco, type BancoDeTeste } from "../apoio";

const U = {
  estacionamento: "00000000-0000-0000-0000-0000000000e1",
  painel: "00000000-0000-0000-0000-0000000000e2",
  fora: "00000000-0000-0000-0000-0000000000e3",
};

const NOVAS = [
  "estacionamento_acessos",
  "estacionamento_eventos",
  "estacionamento_contratos",
  "estacionamento_mensalidades",
  "estacionamento_garagens",
];

/** Driver do Kysely que manda o SQL ao PGlite (a transação é a do escopo do teste). */
class DriverPglite implements Driver {
  constructor(private readonly pg: PGlite) {}
  async init() {}
  async acquireConnection(): Promise<DatabaseConnection> {
    const pg = this.pg;
    return {
      async executeQuery<R>(q: CompiledQuery): Promise<QueryResult<R>> {
        const r = await pg.query<R>(q.sql, [...q.parameters]);
        return { rows: r.rows };
      },
      // biome-ignore lint/correctness/useYield: o teste não usa stream
      async *streamQuery() {
        throw new Error("sem stream no teste");
      },
    };
  }
  async beginTransaction() {}
  async commitTransaction() {}
  async rollbackTransaction() {}
  async releaseConnection() {}
  async destroy() {}
}

let db: BancoDeTeste;
let kysely: Kysely<DB>;

async function valor<T = unknown>(sql: string): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql);
  return Object.values(rows[0] ?? {})[0] as T;
}

async function falha(usuario: string, sql: string): Promise<string | null> {
  try {
    await db.comoUsuario(usuario, () => db.query(sql));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Roda uma consulta do repository como `usuario`. */
const comoUsuario = <T>(
  usuario: string,
  fn: (tx: Parameters<typeof repo.garagemAtual>[0]) => Promise<T>,
) =>
  db.comoUsuario(usuario, () => kysely.transaction().execute((tx) => fn(tx)));

const I = { estacionamentoId: 43, de: "2026-11-01", ate: "2026-11-30" };

beforeAll(async () => {
  db = await abrirBanco();
  kysely = new Kysely<DB>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DriverPglite(db.pg),
      createIntrospector: (k) => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
  await db.criarUsuario(U.estacionamento, "estacionamento@arp.test", [
    "financeiro.estacionamento",
  ]);
  await db.criarUsuario(U.painel, "painel@arp.test", ["financeiro.painel"]);
  await db.criarUsuario(U.fora, "fora@arp.test", ["rh.painel"]);

  // Uma garagem antiga (homologação, id 1) e a atual (43), sincronizada depois.
  const dia = (data: string, entradas: number, pagamentos: unknown[]) => ({
    data,
    pagamentos,
    movimento: [
      { tipo_veiculo: "carro", entradas, saidas: entradas - 1 },
      { tipo_veiculo: "moto", entradas: 1, saidas: 1 },
    ],
  });
  const pag = (
    codigo: number,
    liquido: number,
    grupos: string[],
    tipo = "ROTATIVO",
  ) => ({
    wps_codigo: codigo,
    pago_em: "2026-11-03 10:00:00",
    tipo_cliente: tipo,
    ticket: `T${codigo}`,
    recibo: `R${codigo}`,
    forma_pagamento: "CREDITO VISA",
    forma_pagamento_codigo: 1,
    grupos,
    valor_bruto: liquido + 2,
    valor_desconto: 2,
    valor_liquido: liquido,
    parcial: 0,
    terminal: "CAIXA 1",
    tarifa: "ROTATIVO 1H",
  });
  await db.query("select financeiro.gravar_estacionamento(1, $1, null)", [
    JSON.stringify([dia("2026-11-03", 99, [pag(900, 999, ["dinheiro"])])]),
  ]);
  await db.query("select financeiro.gravar_estacionamento(43, $1, null)", [
    JSON.stringify([
      dia("2026-11-03", 10, [
        pag(1, 20, ["cartao_credito", "desconto"]),
        pag(2, 15, ["dinheiro"]),
      ]),
      dia("2026-11-04", 5, [pag(3, 300, ["carteira_digital"], "MENSALISTA")]),
      dia("2026-10-20", 4, [pag(4, 50, ["dinheiro"])]),
    ]),
  ]);
  await db.exec(`
    insert into financeiro.estacionamento_acessos
      (estacionamento_id, data, sentido, hora, tipo_cliente, tipo_veiculo, servico, quantidade, cancelados)
    values
      (43, '2026-11-03', 'entrada', 9, 'ROTATIVO', 'carro', '', 6, 1),
      (43, '2026-11-03', 'entrada', 9, 'MENSALISTA', 'carro', 'SEM PARAR', 4, 0),
      (43, '2026-11-03', 'saida', 18, 'ROTATIVO', 'carro', '', 9, 0);
    insert into financeiro.estacionamento_eventos
      (estacionamento_id, data, tipo, categoria, situacao, valor, quantidade)
    values
      (43, '2026-11-03', 'desconto', 'CONVENIO LOJA', null, 5, 1),
      (43, '2026-11-03', 'desconto', 'CONVENIO LOJA', null, 3, 1),
      (43, '2026-11-04', 'validacao', 'HIPERMERCADO', 'ISENCOES', 10, 1),
      (43, '2026-11-04', 'manutencao_patio', null, null, null, 7);
    insert into financeiro.estacionamento_contratos
      (estacionamento_id, contrato, tipo, situacao, cliente, valor_mensalidade)
    values (43, 10, 'MENSALISTA', 'ATIVO', 'LOJA EXEMPLO LTDA', 200),
           (43, 11, 'MENSALISTA', 'ATIVO', null, 200);
    insert into financeiro.estacionamento_mensalidades
      (estacionamento_id, contrato, status_contrato, vencimento, pago_em, valor, valor_pago, status)
    values
      (43, 10, 'ATIVO', '2026-10-10', '2026-10-09 10:00', 200, 200, 'BAIXADO'),
      (43, 10, 'INADIMPLENTE', '2026-11-10', null, 200, 0, 'INADIMPLENTE'),
      (43, 11, 'ATIVO', '2026-11-05', '2026-11-05 09:00', 200, 200, 'BAIXADO'),
      (43, 11, 'ATIVO', '2026-11-08', null, 200, 0, 'CANCELADO');
    insert into financeiro.estacionamento_garagens
      (estacionamento_id, descricao, vagas, clientes_mensalistas, setores)
    values (43, 'GARAGEM EXEMPLO', 800, 36, '[{"codigo": 1}, {"codigo": 2}]');
  `);
}, 180_000);

describe("0008_estacionamento: permissão e RLS", () => {
  it("a permissão nova está no catálogo", async () => {
    expect(
      await valor<number>(
        "select count(*)::int from core.permissoes where codigo = 'financeiro.estacionamento'",
      ),
    ).toBe(1);
  });

  it("lê quem tem financeiro.estacionamento; o resto não", async () => {
    for (const t of NOVAS) {
      const contar = (u: string) =>
        db.comoUsuario(u, () =>
          valor<number>(`select count(*)::int from financeiro.${t}`),
        );
      expect(await contar(U.estacionamento), t).toBeGreaterThan(
        t === "estacionamento_garagens" ? 0 : 1,
      );
      expect(await contar(U.painel), t).toBe(0);
      expect(await contar(U.fora), t).toBe(0);
    }
  });

  it("pagamentos e movimento também abrem para a tela nova", async () => {
    const contar = (u: string) =>
      db.comoUsuario(u, () =>
        valor<number>(
          "select count(*)::int from financeiro.estacionamento_pagamentos",
        ),
      );
    expect(await contar(U.estacionamento)).toBe(5);
    expect(await contar(U.painel)).toBe(5);
    expect(await contar(U.fora)).toBe(0);
  });

  it("só a sincronização grava", async () => {
    for (const t of NOVAS)
      expect(
        await falha(U.estacionamento, `delete from financeiro.${t}`),
        t,
      ).toMatch(/permission denied|permissão/i);
  });

  it("tipo de evento e sentido fora da lista são recusados", async () => {
    await expect(
      db.query(
        "insert into financeiro.estacionamento_eventos (estacionamento_id, data, tipo) values (1, '2026-11-01', 'outro')",
      ),
    ).rejects.toThrow(/check/);
    await expect(
      db.query(
        "insert into financeiro.estacionamento_acessos (estacionamento_id, data, sentido, hora, tipo_cliente, tipo_veiculo, quantidade) values (1, '2026-11-01', 'meio', 1, 'R', 'carro', 1)",
      ),
    ).rejects.toThrow(/check/);
  });
});

describe("consultas da tela", () => {
  it("usa a garagem sincronizada por último", async () => {
    const g = await comoUsuario(U.estacionamento, repo.garagemAtual);
    expect(g).toMatchObject({
      id: 43,
      nome: "GARAGEM EXEMPLO",
      vagas: 800,
      clientes_mensalistas: 36,
      setores: 2,
      dados_ate: "2026-11-04",
    });
  });

  it("receita: totais, por forma (desconto não conta como forma) e por dia", async () => {
    const r = await comoUsuario(U.estacionamento, async (tx) => ({
      totais: await repo.receitaTotais(tx, I),
      formas: await repo.receitaPorForma(tx, I),
      dias: await repo.receitaPorDia(tx, I),
      tipos: await repo.receitaPorTipoCliente(tx, I),
      tarifas: await repo.receitaPorTarifa(tx, I),
    }));
    expect(r.totais).toEqual({
      liquida: 335,
      bruta: 341,
      descontos: 6,
      pagamentos: 3,
    });
    expect(r.formas.map((f) => [f.chave, f.valor])).toEqual([
      ["carteira_digital", 300],
      ["cartao_credito", 20],
      ["dinheiro", 15],
    ]);
    expect(r.dias).toEqual([
      { data: "2026-11-03", liquida: 35, pagamentos: 2 },
      { data: "2026-11-04", liquida: 300, pagamentos: 1 },
    ]);
    expect(r.tipos[0]).toMatchObject({ chave: "MENSALISTA", valor: 300 });
    expect(r.tarifas).toEqual([
      { chave: "ROTATIVO 1H", valor: 335, quantidade: 3 },
    ]);
  });

  it("fluxo: movimento, por hora, por tipo de cliente e serviço", async () => {
    const r = await comoUsuario(U.estacionamento, async (tx) => ({
      totais: await repo.fluxoTotais(tx, I),
      veiculos: await repo.fluxoPorVeiculo(tx, I),
      horas: await repo.acessosPorHora(tx, I),
      clientes: await repo.entradasPor(tx, I, "tipo_cliente"),
      servicos: await repo.entradasPor(tx, I, "servico"),
      cancelados: await repo.ticketsCancelados(tx, I),
    }));
    expect(r.totais).toEqual({ entradas: 17, saidas: 15, dias: 2 });
    expect(r.veiculos.map((v) => [v.chave, v.quantidade])).toEqual([
      ["carro", 15],
      ["moto", 2],
    ]);
    expect(r.horas).toEqual([
      { hora: 9, entradas: 10, saidas: 0 },
      { hora: 18, entradas: 0, saidas: 9 },
    ]);
    expect(r.clientes.map((c) => [c.chave, c.quantidade])).toEqual([
      ["ROTATIVO", 6],
      ["MENSALISTA", 4],
    ]);
    expect(r.servicos.map((c) => c.chave)).toEqual(["", "SEM PARAR"]);
    expect(r.cancelados.cancelados).toBe(1);
  });

  it("eventos por tipo e por categoria", async () => {
    const r = await comoUsuario(U.estacionamento, async (tx) => ({
      tipos: await repo.eventosPorTipo(tx, I),
      categorias: await repo.eventosPorCategoria(tx, I),
    }));
    const porTipo = Object.fromEntries(r.tipos.map((t) => [t.tipo, t]));
    expect(porTipo.desconto).toMatchObject({
      ocorrencias: 2,
      quantidade: 2,
      valor: 8,
    });
    expect(porTipo.manutencao_patio).toMatchObject({
      ocorrencias: 1,
      quantidade: 7,
      valor: 0,
    });
    expect(r.categorias[0]).toMatchObject({
      tipo: "desconto",
      categoria: "CONVENIO LOJA",
      ocorrencias: 2,
      valor: 8,
    });
  });

  it("mensalistas: situação, período, atraso e por mês", async () => {
    const r = await comoUsuario(U.estacionamento, async (tx) => ({
      contratos: await repo.contratosPorSituacao(tx, 43),
      periodo: await repo.mensalidadesDoPeriodo(tx, I),
      atraso: await repo.totalEmAtraso(tx, 43, "2026-11-17"),
      atrasadas: await repo.parcelasEmAtraso(tx, 43, "2026-11-17"),
      meses: await repo.mensalidadesPorMes(tx, 43, "2026-10-01", "2026-12-31"),
    }));
    expect(r.contratos.map((c) => [c.chave, c.quantidade])).toEqual([
      ["ATIVO", 1],
      ["INADIMPLENTE", 1],
    ]);
    // Recebido: pago em novembro; previsto: vence em novembro, sem a cancelada.
    expect(r.periodo).toEqual({ recebido: 200, previsto: 400 });
    expect(r.atraso).toEqual({ quantidade: 1, valor: 200 });
    expect(r.atrasadas).toEqual([
      {
        contrato: expect.anything(),
        vencimento: "2026-11-10",
        valor: 200,
        status: "INADIMPLENTE",
        cliente: "LOJA EXEMPLO LTDA",
      },
    ]);
    expect(r.meses).toEqual([
      { mes: "2026-10", previsto: 200, recebido: 200 },
      { mes: "2026-11", previsto: 400, recebido: 200 },
    ]);
  });

  it("quem não tem a permissão não vê garagem nenhuma", async () => {
    expect(await comoUsuario(U.fora, repo.garagemAtual)).toBeUndefined();
  });
});
