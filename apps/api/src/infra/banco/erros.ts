import pg from "pg";
import {
  type ErroDaApi,
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
} from "@/erros";

// Erros do Postgres que são de negócio viram ErroDaApi com mensagem curta
// (as mesmas do sistema anterior). Os demais seguem como vieram e o plugin
// de erros responde 500 sem detalhe.

export function erroDoBanco(e: unknown): ErroDaApi | null {
  if (!(e instanceof pg.DatabaseError)) return null;
  switch (e.code) {
    case "23505":
      return new ErroDeConflito("Já existe outro registro com esse valor.");
    case "23514":
      return new ErroDeNegocio("Valor fora do permitido.");
    case "42501":
      return new ErroDePermissao("Você não tem permissão para esta alteração.");
    // Regras do banco (`raise exception`, ex.: manter um administrador) já
    // vêm em português.
    case "P0001":
    case "22023": {
      const m = e.message;
      return new ErroDeNegocio(`${m.charAt(0).toUpperCase()}${m.slice(1)}.`);
    }
    default:
      return null;
  }
}
