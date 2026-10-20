import { describe, expect, it } from "vitest";
import { createSecullumClient } from "./client";

// Chama a API real. Só roda com SECULLUM_* definidas no ambiente.
const { SECULLUM_USUARIO, SECULLUM_SENHA, SECULLUM_BANCO_ID } = process.env;
const configurado = SECULLUM_USUARIO && SECULLUM_SENHA && SECULLUM_BANCO_ID;

describe.skipIf(!configurado)("secullum (API real)", () => {
  const client = createSecullumClient({
    usuario: SECULLUM_USUARIO ?? "",
    senha: SECULLUM_SENHA ?? "",
    bancoId: SECULLUM_BANCO_ID ?? "",
  });

  it("valida departamentos, funcionários e cálculo do mês", async () => {
    const deps = await client.departamentos();
    expect(deps.length).toBeGreaterThan(0);

    const funcionarios = await client.funcionarios();
    const ativo = funcionarios.find((f) => !f.Demissao && f.Cpf);
    expect(ativo?.Departamento?.Descricao).toBeTruthy();

    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const calc = await client.calcular(
      { cpf: ativo?.Cpf, pis: ativo?.NumeroPis },
      {
        inicio: iso(inicio),
        fim: iso(fim),
      },
    );
    expect(calc.Colunas).toEqual(
      expect.arrayContaining(["Faltas", "Atras.", "Carga", "BSaldo"]),
    );
  }, 60_000);
});
