import { statusAoConcluir } from "@arp/shared/os/ciclo";
import { numeroDo } from "@arp/shared/os/numeros";
import { rotaDo } from "@arp/shared/os/rotas";
import type { Tx } from "@/infra/banco";
import type { OsStatusChamado } from "@/infra/banco/tipos";
import { log } from "@/infra/log";
import { chamado } from "./alvo";
import { notificarNoEscopo, registrarComoSistema } from "./base.service";
import * as repo from "./sistema.repository";
import { tentar } from "./tentar";

// Chamados de outros módulos (origem 'modulo'): o módulo cria o chamado com
// criarChamadoSistema (./criar.service.ts, com acaoUrl, conclusaoExterna,
// origemModulo e origemRef) e, quando grava o trabalho, conclui por aqui.
// Também cancela o que deixou de valer (ex.: contrato rescindido) e acha o
// chamado aberto de uma referência.
//
// Tudo pela service role (a `tx` é do escopo `comoServico` de quem chama),
// sem conferir permissão: QUEM CHAMA já conferiu (`exigir` da ação do
// módulo, ou é a rotina). Só chamados (não OS). O update só vale se o status
// ainda é o lido, então rodar duas vezes não conclui nem avisa duas vezes.
// Como as rotinas de aceite, a linha do tempo fica em nome do sistema.

export type { ChamadoDaOrigem } from "./sistema.repository";

/** Em aberto: o Concluído já foi resolvido pelo módulo. */
const EM_ABERTO: readonly OsStatusChamado[] = [
  "aberto",
  "em_andamento",
  "aguardando",
];

/** O chamado em aberto (aberto, em andamento ou aguardando) da referência. */
export async function chamadoAbertoDaOrigem(
  tx: Tx,
  modulo: string,
  ref: string,
): Promise<repo.ChamadoDaOrigem | null> {
  return (await repo.abertoDaOrigem(tx, modulo, ref, EM_ABERTO)) ?? null;
}

async function lerAberto(
  tx: Tx,
  id: string,
): Promise<repo.ChamadoDaOrigem | null> {
  const ch = await repo.porId(tx, id);
  return ch && EM_ABERTO.includes(ch.status) ? ch : null;
}

const autor = (ch: repo.ChamadoDaOrigem, nome?: string) =>
  nome ?? (ch.origem_modulo ? `Sistema (${ch.origem_modulo})` : "Sistema");

/** A linha do tempo nunca desfaz a mudança de status (como no sistema antigo). */
async function registrarSemFalhar(
  tx: Tx,
  id: string,
  e: Parameters<typeof registrarComoSistema>[2],
): Promise<void> {
  const t = await tentar(tx, () => registrarComoSistema(tx, chamado(id), e));
  if (!t.ok) log.error({ err: t.erro, id }, "linha do tempo (sistema)");
}

/**
 * Conclui o chamado porque o módulo gravou o trabalho. Fecha direto ou
 * fica Concluído esperando quem pediu, pela mesma regra do botão Concluir
 * (statusAoConcluir: tarefa pessoal, aviso ou sem confirmação fecham).
 * `texto` vira a solução e a linha do tempo ("Entrevista salva em ...").
 * `concluidoPor`: quem salvou no módulo (entra em concluido_por).
 * Devolve false se o chamado já não estava em aberto (nada a fazer).
 */
export async function concluirPeloSistema(
  tx: Tx,
  p: {
    chamadoId: string;
    texto: string;
    concluidoPor?: string | null;
    autorNome?: string;
  },
): Promise<boolean> {
  const ch = await lerAberto(tx, p.chamadoId);
  if (!ch) return false;
  const status = statusAoConcluir(ch);
  const texto = p.texto.trim().slice(0, 2000);
  const mudou = await repo.mudarSeAinda(tx, ch.id, ch.status, {
    status,
    solucao: texto || null,
    concluido_por: p.concluidoPor ?? null,
  });
  if (!mudou) return false;

  await registrarSemFalhar(tx, ch.id, {
    tipo: "status",
    autorNome: autor(ch, p.autorNome),
    texto: texto || "Concluído pelo módulo.",
    dados: { acao: "concluir", de: ch.status, para: status, externo: true },
  });
  const base = {
    titulo: `${numeroDo(ch)} ${ch.titulo}`,
    href: rotaDo(ch),
    alvo: chamado(ch.id),
  };
  if (status === "concluido")
    await notificarNoEscopo(
      tx,
      [ch.aberto_por],
      {
        ...base,
        tipo: "concluido",
        texto: "Concluído. Confirme se ficou resolvido.",
      },
      p.concluidoPor,
    );
  else
    await notificarNoEscopo(
      tx,
      [ch.responsavel_id, ch.aberto_por],
      { ...base, tipo: "fechado", texto: texto || "Concluído pelo módulo." },
      p.concluidoPor,
    );
  return true;
}

/**
 * Cancela o chamado que deixou de valer (ex.: contrato rescindido antes da
 * entrevista). `motivo` vai para motivo_cancelamento e para a linha do
 * tempo. Devolve false se já não estava em aberto.
 */
export async function cancelarPeloSistema(
  tx: Tx,
  p: {
    chamadoId: string;
    motivo: string;
    autorNome?: string;
  },
): Promise<boolean> {
  const motivo = p.motivo.trim().slice(0, 500);
  if (!motivo) throw new Error("Cancelar pelo sistema precisa de um motivo.");
  const ch = await lerAberto(tx, p.chamadoId);
  if (!ch) return false;
  const mudou = await repo.mudarSeAinda(tx, ch.id, ch.status, {
    status: "cancelado",
    motivo_cancelamento: motivo,
  });
  if (!mudou) return false;

  await registrarSemFalhar(tx, ch.id, {
    tipo: "status",
    autorNome: autor(ch, p.autorNome),
    texto: `Cancelou: ${motivo}`,
    dados: { acao: "cancelar", de: ch.status, para: "cancelado", motivo },
  });
  await notificarNoEscopo(tx, [ch.responsavel_id], {
    titulo: `${numeroDo(ch)} ${ch.titulo}`,
    href: rotaDo(ch),
    alvo: chamado(ch.id),
    tipo: "cancelado",
    texto: `O chamado foi cancelado: ${motivo}`,
  });
  return true;
}
