import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, expect, it, vi } from "vitest";
import { criarApp } from "@/app";
import { banco, type Tx } from "@/infra/banco";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";
import { avisosPendentes } from "./base.service";
import { criarChamadoSistema } from "./criar.service";
import {
  cancelarPeloSistema,
  chamadoAbertoDaOrigem,
  concluirPeloSistema,
} from "./sistema.service";

// Chamados de outros módulos na homologação. Os casos do service rodam num
// escopo que é desfeito no fim (nada fica gravado); o da tela grava um
// chamado de teste e o apaga.

// Só os módulos que o teste usa: um módulo de outro pedaço ainda incompleto
// não derruba este arquivo.
vi.mock("@/modules", async () => {
  const { auth } = await import("@/modules/auth");
  const { os } = await import("@/modules/os");
  return {
    MODULOS: [
      { prefixo: "/auth", plugin: auth },
      { prefixo: "/os", plugin: os },
    ],
    EXTERNOS: [],
    ROTINAS: [],
  };
});

const LONGO = 120_000;
const MODULO = "teste_porte";

class Desfazer extends Error {}

/** Roda `fn` como a service role e desfaz tudo o que ela gravou. */
async function semGravar(fn: (tx: Tx) => Promise<void>): Promise<void> {
  await banco
    .comoServico(async (tx) => {
      await fn(tx);
      throw new Desfazer();
    })
    .catch((erro: unknown) => {
      if (!(erro instanceof Desfazer)) throw erro;
    });
}

async function criar(tx: Tx, ref: string, responsavelId?: string) {
  const setor = await tx
    .selectFrom("os.setores")
    .select("id")
    .where("ativo", "=", true)
    .limit(1)
    .executeTakeFirstOrThrow();
  const criado = await criarChamadoSistema(tx, {
    setorId: setor.id,
    titulo: `Teste porte ${ref}`,
    tipo: "tarefa",
    origem: "modulo",
    autorNome: "Sistema (teste)",
    acaoUrl: "/sustentabilidade/entrevistas",
    acaoRotulo: " a entrevista ",
    conclusaoExterna: true,
    origemModulo: MODULO,
    origemRef: ref,
    responsavelId,
  });
  if (!criado) throw new Error("não criou o chamado de teste");
  return criado;
}

const lido = (tx: Tx, id: string) =>
  tx
    .selectFrom("os.chamados")
    .select([
      "status",
      "solucao",
      "motivo_cancelamento",
      "acao_url",
      "acao_rotulo",
      "conclusao_externa",
      "origem",
      "origem_modulo",
      "origem_ref",
    ])
    .where("id", "=", id)
    .executeTakeFirstOrThrow();

descreverComBanco("tickets: chamados de outros módulos", () => {
  let app: FastifyInstance | undefined;
  const criados: string[] = [];

  afterAll(async () => {
    await avisosPendentes();
    // Só o que este teste criou (as filhas saem em cascata).
    if (criados.length)
      await banco.comoServico((tx) =>
        tx.deleteFrom("os.chamados").where("id", "in", criados).execute(),
      );
    await app?.close();
    await banco.encerrar();
  });

  it(
    "o detalhe traz o Executar e a pessoa não conclui pelo Chamados",
    async () => {
      app = await criarApp();
      const admin = new Navegador(app);
      const entrou = await admin.pedir("POST", "/api/v1/auth/entrar", {
        email: TESTE.email,
        senha: TESTE.senha,
      });
      expect(entrou.statusCode).toBe(200);
      const eu: string = entrou.json().usuario.id;
      const ref = `teste:${randomUUID()}`;
      const criado = await banco.comoServico((tx) => criar(tx, ref, eu));
      criados.push(criado.id);

      const caminho = `/api/v1/os/chamados/${criado.id}`;
      const detalhe = await admin.pedir("GET", caminho);
      expect(detalhe.statusCode).toBe(200);
      expect(detalhe.json().ch).toMatchObject({
        origem: "modulo",
        origem_modulo: MODULO,
        acao_url: "/sustentabilidade/entrevistas",
        acao_rotulo: "a entrevista",
        conclusao_externa: true,
      });
      const MOTIVO =
        "Este chamado fecha sozinho ao salvar a entrevista no módulo. Use o botão Executar.";
      expect(detalhe.json().acoes).toContain("concluir");
      expect(detalhe.json().bloqueio).toBe(MOTIVO);

      const concluir = await admin.pedir("POST", `${caminho}/acoes`, {
        acao: "concluir",
        solucao: "feito",
      });
      expect(concluir.statusCode).toBe(422);
      expect(concluir.json().erro.mensagem).toBe(MOTIVO);

      // O módulo conclui.
      expect(
        await banco.comoServico((tx) =>
          concluirPeloSistema(tx, {
            chamadoId: criado.id,
            texto: "Entrevista salva.",
            concluidoPor: eu,
          }),
        ),
      ).toBe(true);
      const depois = await admin.pedir("GET", caminho);
      expect(["concluido", "fechado"]).toContain(depois.json().ch.status);
      expect(depois.json().ch.concluido_por).toBe(eu);
    },
    LONGO,
  );

  it("criarChamadoSistema recusa acaoUrl externa e conclusão externa sem Executar", async () => {
    const base = {
      setorId: randomUUID(),
      titulo: "x",
      origem: "modulo",
      autorNome: "Sistema",
    } as const;
    await semGravar(async (tx) => {
      await expect(
        criarChamadoSistema(tx, {
          ...base,
          acaoUrl: "https://exemplo.invalid",
        }),
      ).rejects.toThrow("acaoUrl precisa ser um caminho interno");
      await expect(
        criarChamadoSistema(tx, { ...base, acaoUrl: "//exemplo.invalid" }),
      ).rejects.toThrow("acaoUrl precisa ser um caminho interno");
      await expect(
        criarChamadoSistema(tx, { ...base, conclusaoExterna: true }),
      ).rejects.toThrow("Conclusão externa precisa de acaoUrl");
      await expect(
        criarChamadoSistema(tx, {
          ...base,
          acaoUrl: "/x",
          conclusaoExterna: true,
          destinatarios: [{ setorId: base.setorId }],
        }),
      ).rejects.toThrow("Conclusão externa não aceita vários destinos.");
    });
  });

  it(
    "cria com origem 'modulo', acha pela referência e conclui uma vez só",
    async () => {
      const ref = `teste:${randomUUID()}`;
      await semGravar(async (tx) => {
        const criado = await criar(tx, ref);
        expect(await lido(tx, criado.id)).toMatchObject({
          status: "aberto",
          acao_url: "/sustentabilidade/entrevistas",
          acao_rotulo: "a entrevista",
          conclusao_externa: true,
          origem: "modulo",
          origem_modulo: MODULO,
          origem_ref: ref,
        });

        const aberto = await chamadoAbertoDaOrigem(tx, MODULO, ref);
        expect(aberto?.id).toBe(criado.id);
        expect(await chamadoAbertoDaOrigem(tx, MODULO, `${ref}-outra`)).toBe(
          null,
        );

        expect(
          await concluirPeloSistema(tx, {
            chamadoId: criado.id,
            texto: "  Entrevista salva.  ",
          }),
        ).toBe(true);
        const depois = await lido(tx, criado.id);
        expect(["concluido", "fechado"]).toContain(depois.status);
        expect(depois.solucao).toBe("Entrevista salva.");
        const evento = await tx
          .selectFrom("os.eventos")
          .select(["tipo", "texto", "autor_nome"])
          .where("chamado_id", "=", criado.id)
          .where("tipo", "=", "status")
          .executeTakeFirstOrThrow();
        expect(evento).toEqual({
          tipo: "status",
          texto: "Entrevista salva.",
          autor_nome: `Sistema (${MODULO})`,
        });

        // Já não está em aberto: nada a fazer, nem para concluir nem cancelar.
        expect(await chamadoAbertoDaOrigem(tx, MODULO, ref)).toBe(null);
        expect(
          await concluirPeloSistema(tx, { chamadoId: criado.id, texto: "x" }),
        ).toBe(false);
        expect(
          await cancelarPeloSistema(tx, { chamadoId: criado.id, motivo: "x" }),
        ).toBe(false);
      });
    },
    LONGO,
  );

  it(
    "cancela o que deixou de valer, com motivo",
    async () => {
      const ref = `teste:${randomUUID()}`;
      await semGravar(async (tx) => {
        const criado = await criar(tx, ref);
        await expect(
          cancelarPeloSistema(tx, { chamadoId: criado.id, motivo: "  " }),
        ).rejects.toThrow("Cancelar pelo sistema precisa de um motivo.");
        expect(
          await cancelarPeloSistema(tx, {
            chamadoId: criado.id,
            motivo: "Contrato rescindido.",
            autorNome: "Sistema (teste)",
          }),
        ).toBe(true);
        expect(await lido(tx, criado.id)).toMatchObject({
          status: "cancelado",
          motivo_cancelamento: "Contrato rescindido.",
        });
        expect(
          await cancelarPeloSistema(tx, {
            chamadoId: criado.id,
            motivo: "Contrato rescindido.",
          }),
        ).toBe(false);
        expect(
          await cancelarPeloSistema(tx, {
            chamadoId: randomUUID(),
            motivo: "x",
          }),
        ).toBe(false);
      });
    },
    LONGO,
  );
});
