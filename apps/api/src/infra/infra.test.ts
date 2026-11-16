import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as esperar } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { descreverComBanco } from "@/testes/apoio";
import { rodar } from "./agendador";
import { banco } from "./banco";
import { checksumDe, lerMigrations, migrar } from "./banco/migracoes";
import { eventosPendentes, registrarDepois, registrarEvento } from "./eventos";
import { consultaDePagina, paginar } from "./paginas";

const MIGRATIONS = fileURLToPath(
  new URL("../../db/migrations", import.meta.url),
);

describe("migrations (arquivos)", () => {
  it("o checksum não muda com o fim de linha", () => {
    expect(checksumDe("create table a();\r\nselect 1;\r\n")).toBe(
      checksumDe("create table a();\nselect 1;\n"),
    );
    expect(checksumDe("select 1;")).not.toBe(checksumDe("select 2;"));
  });

  it("lê as migrations do repositório em ordem, sem número repetido", async () => {
    const lidas = await lerMigrations(MIGRATIONS);
    expect(lidas.map((m) => m.nome).slice(0, 4)).toEqual([
      "0000_fundacao.sql",
      "0001_base.sql",
      "0002_gatilho_de_usuario.sql",
      "0003_sessoes.sql",
    ]);
    expect(lidas.map((m) => m.numero)).toEqual(lidas.map((_, i) => i));
  });

  it("recusa nome fora do padrão e número repetido", async () => {
    const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "migrations-"));
    try {
      await fs.writeFile(path.join(pasta, "0000_a.sql"), "select 1;");
      await fs.writeFile(path.join(pasta, "0000_b.sql"), "select 1;");
      await expect(lerMigrations(pasta)).rejects.toThrow(/repetido/);
      await fs.writeFile(path.join(pasta, "Errada.sql"), "select 1;");
      await expect(lerMigrations(pasta)).rejects.toThrow(/inválido/);
    } finally {
      await fs.rm(pasta, { recursive: true, force: true });
    }
  });
});

descreverComBanco("infra com o banco", () => {
  afterAll(() => banco.encerrar());

  it.skipIf(!process.env.DATABASE_ADMIN_URL)(
    "o banco está em dia com as migrations do repositório",
    async () => {
      const novas = await migrar({
        url: process.env.DATABASE_ADMIN_URL ?? "",
        pasta: MIGRATIONS,
      });
      expect(novas).toEqual([]);
    },
  );

  it("migration aplicada que mudou é recusada", async () => {
    const url = process.env.DATABASE_ADMIN_URL;
    if (!url) return;
    const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "migrations-"));
    try {
      for (const nome of await fs.readdir(MIGRATIONS))
        await fs.copyFile(path.join(MIGRATIONS, nome), path.join(pasta, nome));
      await fs.appendFile(path.join(pasta, "0003_sessoes.sql"), "\n-- mexi\n");
      await expect(migrar({ url, pasta })).rejects.toThrow(
        /0003_sessoes\.sql mudou depois de aplicada/,
      );
    } finally {
      await fs.rm(pasta, { recursive: true, force: true });
    }
  });

  it("agendador: a mesma rotina nunca roda em dobro", async () => {
    let execucoes = 0;
    const rotina = {
      nome: `teste.trava.${Date.now()}`,
      cron: "0 0 1 1 *",
      executar: async () => {
        execucoes++;
        await esperar(300);
      },
    };
    await Promise.all([rodar(rotina), rodar(rotina), rodar(rotina)]);
    expect(execucoes).toBe(1);
    // Terminou: a trava foi solta e a próxima execução roda.
    await rodar(rotina);
    expect(execucoes).toBe(2);
  });

  it("agendador: rotina que falha não derruba nada e solta a trava", async () => {
    let execucoes = 0;
    const rotina = {
      nome: `teste.falha.${Date.now()}`,
      cron: "0 0 1 1 *",
      executar: async () => {
        execucoes++;
        throw new Error("falhou");
      },
    };
    await expect(rodar(rotina)).resolves.toBeUndefined();
    await rodar(rotina);
    expect(execucoes).toBe(2);
  });

  it("eventos: grava em core.logs e nunca lança", async () => {
    const descricao = `Evento de teste ${Date.now()}`;
    registrarDepois({
      modulo: "acesso",
      evento: "login",
      descricao,
      usuarioId: null,
      detalhes: { origem: "teste" },
    });
    await eventosPendentes();
    const gravados = await banco.comoServico((tx) =>
      tx
        .selectFrom("core.logs")
        .select(["modulo", "evento", "detalhes"])
        .where("descricao", "=", descricao)
        .execute(),
    );
    expect(gravados).toEqual([
      { modulo: "acesso", evento: "login", detalhes: { origem: "teste" } },
    ]);
    // Descrição vazia fere a regra do banco: fica só o aviso no log.
    await expect(
      registrarEvento({
        modulo: "acesso",
        evento: "login",
        descricao: " ",
        usuarioId: null,
      }),
    ).resolves.toBeUndefined();
  });

  it("paginar devolve a página pedida e o total", async () => {
    const pagina = (n: number) =>
      banco.comoServico((tx) =>
        paginar(
          tx,
          tx
            .selectFrom("core.logs")
            .select(["id", "evento"])
            .orderBy("id", "desc"),
          consultaDePagina.parse({ pagina: n, por_pagina: 3 }),
        ),
      );
    const [primeira, segunda] = [await pagina(1), await pagina(2)];
    expect(primeira.itens).toHaveLength(3);
    expect(primeira.total).toBeGreaterThan(6);
    expect(primeira).toMatchObject({ pagina: 1, por_pagina: 3 });
    const ids = [...primeira.itens, ...segunda.itens].map((l) => l.id);
    expect(new Set(ids).size).toBe(6);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    expect(() => consultaDePagina.parse({ por_pagina: 5000 })).toThrow();
  });
});
