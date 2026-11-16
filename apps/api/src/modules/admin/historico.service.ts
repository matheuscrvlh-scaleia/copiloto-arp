import type {
  ConsultaDoHistorico,
  RespostaAutores,
  RespostaHistorico,
} from "@arp/shared/admin/contratos";
import { POR_PAGINA, tabelasQueCasam } from "@arp/shared/historico";
import type { Contexto } from "@/contexto";
import { banco } from "@/infra/banco";
import * as repo from "./historico.repository";

// Leitura do histórico de todo o sistema, com a sessão do usuário: a função
// do banco confere admin.historico e devolve vazio para quem não tem.

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v))
    : null;

export async function historico(
  ctx: Contexto,
  f: ConsultaDoHistorico,
): Promise<RespostaHistorico> {
  const linhas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.historico(tx, {
      busca: f.busca || null,
      tabelas: f.busca ? tabelasQueCasam(f.busca) : null,
      modulo: f.modulo ?? null,
      tipo: f.tipo ?? null,
      usuario: f.usuario ?? null,
      de: f.de ?? null,
      ate: f.ate ?? null,
      limite: POR_PAGINA,
      deslocamento: (f.pagina - 1) * POR_PAGINA,
    }),
  );
  return {
    linhas: linhas.map((l) => ({
      tipo: l.tipo,
      id: l.id,
      em: l.em,
      modulo: l.modulo,
      usuarioId: l.usuario_id,
      usuarioNome: l.usuario_nome,
      acao: l.acao,
      objeto: l.objeto,
      registroId: l.registro_id,
      descricao: l.descricao,
      antes: objeto(l.antes),
      depois: objeto(l.depois),
    })),
    total: Number(linhas[0]?.total ?? 0),
  };
}

export async function autores(ctx: Contexto): Promise<RespostaAutores> {
  return {
    autores: await banco.comoUsuario(ctx.usuario.id, (tx) => repo.autores(tx)),
  };
}
