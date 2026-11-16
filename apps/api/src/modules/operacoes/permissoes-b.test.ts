import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contexto } from "@/contexto";
import { ErroDePermissao } from "@/erros";

// Operações, parte B: cada gravação confere a permissão no banco agora
// (podeAgora) antes de tocar em qualquer dado, e responde 403 com a mensagem
// de antes. O "Atualizar agora" do Diário nunca dispara a consulta sem a
// permissão. Sem banco: banco, arquivos e sincronização são falsos.

const podeAgora = vi.fn<(ctx: Contexto, p: string) => Promise<boolean>>();
const comoUsuario = vi.fn();
const comoServico = vi.fn();
const sincronizarDiario = vi.fn(async () => undefined);

vi.mock("@/infra/banco", () => ({ banco: { comoUsuario, comoServico } }));
vi.mock("@/infra/arquivos", () => ({
  gravarArquivo: vi.fn(),
  lerArquivo: async () => null,
  linkDeLeitura: async () => null,
  linksDeLeitura: async () => new Map(),
  prepararEnvio: vi.fn(),
  removerArquivos: vi.fn(),
  infoDoArquivo: vi.fn(),
}));
vi.mock("../sync/diario-de-obras.service", () => ({
  RECURSO_DIARIO: "relatorios",
  SISTEMA_DIARIO: "diario_de_obras",
  sincronizarDiario,
}));
vi.mock("./apoio", async (original) => ({
  ...(await original<typeof import("./apoio")>()),
  podeAgora,
}));

const cadastros = await import("./cadastros.service");
const limpeza = await import("./limpeza-acoes.service");
const obras = await import("./obras-acoes.service");
const diario = await import("./diario.service");

const ctx: Contexto = {
  ip: "127.0.0.1",
  agente: null,
  requisicaoId: "teste",
  usuario: { id: "u", nome: "Teste", email: "teste@exemplo.com" },
  permissoes: new Set(),
  senhaProvisoria: false,
  sessao: {
    id: "s",
    inicio: new Date(),
    ultimoUso: new Date(),
    acessoExpiraEm: new Date(),
  },
};

const ID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  podeAgora.mockReset();
  podeAgora.mockResolvedValue(false);
  comoUsuario.mockClear();
  comoServico.mockClear();
  sincronizarDiario.mockClear();
});

/** Recusa com 403 e a mensagem dada, sem ler nem gravar nada. */
async function recusa(fazer: () => Promise<unknown>, mensagem: string) {
  const erro = await fazer().then(
    () => null,
    (e: unknown) => e,
  );
  expect(erro).toBeInstanceOf(ErroDePermissao);
  expect(erro instanceof Error ? erro.message : "").toBe(mensagem);
  expect(comoUsuario).not.toHaveBeenCalled();
  expect(comoServico).not.toHaveBeenCalled();
}

describe("cadastros", () => {
  it("hidrômetro: sem importar a água nem ligar hidrômetro, 403", async () => {
    await recusa(
      () =>
        cadastros.salvarHidrometro(ctx, {
          id: null,
          numero: "TESTE",
          bloco: "01",
          sala: "",
          sala_id: null,
          descricao: null,
          observacoes: null,
          ativo: true,
        }),
      "Você não tem permissão para cadastrar hidrômetros.",
    );
    expect(podeAgora).toHaveBeenCalledWith(ctx, "operacoes.agua.importar");
    await recusa(
      () => cadastros.excluirHidrometro(ctx, ID),
      "Você não tem permissão para excluir hidrômetros.",
    );
  });

  it("sala: sem editar a energia, 403", async () => {
    await recusa(
      () => cadastros.excluirSala(ctx, ID),
      "Você não tem permissão para excluir salas.",
    );
    expect(podeAgora).toHaveBeenCalledWith(ctx, "operacoes.energia.editar");
  });
});

describe("rateio da limpeza", () => {
  it("criar, fechar e enviar o mês: sem lançar o rateio, 403", async () => {
    const mensagem = "Você não tem permissão para lançar o rateio da limpeza.";
    await recusa(
      () => limpeza.criarMes(ctx, { referencia: "2026-09", copiar: false }),
      mensagem,
    );
    expect(podeAgora).toHaveBeenCalledWith(ctx, "operacoes.limpeza.fechar");
  });
});

describe("obras", () => {
  it("dados da obra e realizado: sem importar o orçamento, 403", async () => {
    const mensagem =
      "Você não tem permissão para importar o orçamento nem lançar o realizado.";
    await recusa(() => obras.salvarObra(ctx, ID, { nome: "Obra" }), mensagem);
    await recusa(() => obras.excluirRealizado(ctx, ID), mensagem);
    expect(podeAgora).toHaveBeenCalledWith(ctx, "operacoes.obras.importar");
  });
});

describe("Diário de Obra", () => {
  it("estado: sem o Diário nem o painel, 403", async () => {
    await recusa(
      () => diario.estadoDoDiario(ctx),
      "Sem acesso ao Diário de Obra.",
    );
  });

  it("Atualizar agora: sem a permissão, 403 e nenhuma consulta", async () => {
    await recusa(
      () => diario.atualizarAgora(ctx),
      "Sem permissão para atualizar o Diário de Obra.",
    );
    expect(podeAgora).toHaveBeenCalledWith(ctx, "operacoes.obras.atualizar");
    expect(sincronizarDiario).not.toHaveBeenCalled();
  });
});
