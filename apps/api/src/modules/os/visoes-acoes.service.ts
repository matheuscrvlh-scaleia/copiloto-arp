import type { EntradaAlteracao } from "@arp/shared/os/contratos/chamados";
import type {
  EntradaAtribuir,
  EntradaMover,
  EntradaPrazo,
  EntradaPrioridade,
} from "@arp/shared/os/contratos/visoes";
import {
  lerFiltros,
  PREFERENCIA_FILTROS,
  PREFERENCIA_SEU_DIA,
  type Tela,
} from "@arp/shared/os/lista";
import { passosDoMovimento } from "@arp/shared/os/quadro";
import { STATUS } from "@arp/shared/os/rotulos";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import type { Contexto } from "@/contexto";
import { ErroDaApi, ErroDeNegocio } from "@/erros";
import { banco } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";
import {
  assumirOuIniciar,
  executarAcao,
  lerChamado,
  NAO_ENCONTRADO,
} from "./chamados.service";
import { alterarChamado } from "./chamados-acoes.service";
import { gravarPreferencia } from "./preferencias.repository";

// Ações das visões do dia a dia (listas, quadro e calendário): alterações
// rápidas, ações em lote, confirmar/reabrir na linha e as preferências da
// tela. O ciclo e as alterações passam pelas mesmas funções do detalhe do
// chamado (mesmas regras, textos na linha do tempo e notificações); o banco
// confere de novo quem pode (RLS e os.validar_chamado).

/** Resultado de várias alterações: "3 alterados" ou o que falhou. */
function resumo(
  erros: (string | null)[],
  feito: (n: number) => string,
): string {
  const falhas = erros.filter((e): e is string => e !== null);
  const certos = erros.length - falhas.length;
  if (!falhas.length) return feito(certos);
  const motivo = falhas[0] || "Não foi possível alterar.";
  if (!certos) throw new ErroDeNegocio(motivo);
  throw new ErroDeNegocio(
    `${feito(certos)}; ${falhas.length} não ${falhas.length === 1 ? "pôde" : "puderam"}: ${motivo}`,
  );
}

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

// ---------------------------------------------------------------------------
// Alterações rápidas e em lote (responsável, prazo, prioridade)
// ---------------------------------------------------------------------------

/** Alterações do lote rodando juntas (sem afogar o banco). */
const EM_PARALELO = 6;

/**
 * Cada um passa pelas regras e vai para a linha do tempo, no seu próprio
 * escopo; alguns ao mesmo tempo. Devolve o erro de cada um (null: certo).
 */
async function alterarVarios(
  ctx: Contexto,
  lista: string[],
  campos: EntradaAlteracao,
): Promise<(string | null)[]> {
  const erros: (string | null)[] = new Array(lista.length).fill(null);
  let proximo = 0;
  const trabalhar = async () => {
    while (proximo < lista.length) {
      const i = proximo++;
      const id = lista[i];
      if (!id) continue;
      try {
        await alterarChamado(ctx, id, campos);
      } catch (e) {
        if (!(e instanceof ErroDaApi)) throw e;
        erros[i] = e.message;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(EM_PARALELO, lista.length) }, trabalhar),
  );
  return erros;
}

/** POST /os/chamados/lote/responsavel (null: volta para a fila do setor). */
export async function atribuirResponsavel(
  ctx: Contexto,
  d: EntradaAtribuir,
): Promise<string> {
  return resumo(
    await alterarVarios(ctx, d.ids, { responsavel: d.responsavel ?? "" }),
    (n) => plural(n, "chamado atribuído", "chamados atribuídos"),
  );
}

/** POST /os/chamados/lote/prazo */
export async function mudarPrazo(
  ctx: Contexto,
  d: EntradaPrazo,
): Promise<string> {
  return resumo(
    await alterarVarios(ctx, d.ids, { prazo: d.prazo ?? "" }),
    (n) => plural(n, "prazo alterado", "prazos alterados"),
  );
}

/** POST /os/chamados/lote/prioridade */
export async function mudarPrioridade(
  ctx: Contexto,
  d: EntradaPrioridade,
): Promise<string> {
  return resumo(
    await alterarVarios(ctx, d.ids, { prioridade: d.prioridade }),
    (n) => plural(n, "prioridade alterada", "prioridades alteradas"),
  );
}

// ---------------------------------------------------------------------------
// Ciclo: confirmar e reabrir na linha; arrastar no quadro
// ---------------------------------------------------------------------------

/** POST /os/chamados/:id/confirmar */
export async function confirmarChamado(
  ctx: Contexto,
  id: string,
): Promise<string> {
  await executarAcao(ctx, id, "confirmar");
  return "Confirmado e fechado.";
}

/** POST /os/chamados/:id/reabrir */
export async function reabrirChamado(
  ctx: Contexto,
  id: string,
  motivo: string,
): Promise<string> {
  await executarAcao(ctx, id, "reabrir", { motivo });
  return "Reaberto. O responsável foi avisado.";
}

/**
 * POST /os/chamados/:id/mover: cartão solto noutra coluna do quadro: vira as
 * ações do detalhe (iniciar, aguardar, concluir, confirmar, reabrir,
 * devolver), na ordem. Cada passo grava no seu escopo: se um falhar, os
 * anteriores ficam (como antes).
 */
export async function moverChamado(
  ctx: Contexto,
  id: string,
  d: EntradaMover,
): Promise<string> {
  const ch = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    lerChamado(tx, id),
  );
  if (!ch) throw new ErroDeNegocio(NAO_ENCONTRADO);
  const passos = passosDoMovimento(ch.status, d.para);
  if (!passos.length)
    throw new ErroDeNegocio(
      `Não dá para passar de ${STATUS[ch.status]} para ${STATUS[d.para]}.`,
    );
  for (const passo of passos) {
    if (passo === "iniciar") await assumirOuIniciar(ctx, ch.id);
    else
      await executarAcao(ctx, ch.id, passo, {
        aguardandoTipo: d.aguardandoTipo,
        motivo: d.motivo,
      });
  }
  return "Movido.";
}

// ---------------------------------------------------------------------------
// Preferências da tela
// ---------------------------------------------------------------------------

/**
 * PUT /os/preferencias/filtros/:tela: lembra os filtros da tela para a
 * próxima visita (só os válidos).
 */
export function lembrarFiltros(
  ctx: Contexto,
  tela: Tela,
  valores: Record<string, string>,
): Promise<void> {
  const validos: Record<string, JsonValue> = {};
  for (const [k, v] of Object.entries(lerFiltros(tela, valores)))
    if (v !== undefined) validos[k] = v;
  return banco.comoUsuario(ctx.usuario.id, (tx) =>
    gravarPreferencia(tx, ctx.usuario.id, PREFERENCIA_FILTROS[tela], validos),
  );
}

/** POST /os/preferencias/seu-dia: visto hoje, não aparece até amanhã. */
export function marcarSeuDiaVisto(ctx: Contexto): Promise<void> {
  return banco.comoUsuario(ctx.usuario.id, (tx) =>
    gravarPreferencia(tx, ctx.usuario.id, PREFERENCIA_SEU_DIA, {
      dia: hojeEmBrasilia(new Date()),
    }),
  );
}
