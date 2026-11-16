import "server-only";
import { statusAoConcluir } from "@/lib/os/ciclo";
import { numeroDo } from "@/lib/os/numeros";
import { rotaDo } from "@/lib/os/rotas";
import {
  chamado,
  notificar,
  osAdmin,
  registrarComoSistema,
  type Tabela,
} from "./base";

// Chamados de outros módulos (origem 'modulo'): o módulo cria o chamado com
// criarChamadoSistema (./criar.ts, com acaoUrl, conclusaoExterna,
// origemModulo e origemRef) e, quando grava o trabalho, conclui por aqui.
// Também cancela o que deixou de valer (ex.: contrato rescindido) e acha o
// chamado aberto de uma referência.
//
// Tudo pela service role, sem conferir permissão: QUEM CHAMA já conferiu
// (podeAgora da ação do módulo, ou é a rotina do cron). Só chamados (não OS).
// O update só vale se o status ainda é o lido, então rodar duas vezes não
// conclui nem avisa duas vezes. Como as rotinas de ./rotinas/aceite.ts, a
// linha do tempo fica em nome do sistema.

/** Em aberto: o Concluído já foi resolvido pelo módulo. */
const EM_ABERTO = ["aberto", "em_andamento", "aguardando"] as const;
const emAberto = (s: string) => (EM_ABERTO as readonly string[]).includes(s);

const COLUNAS =
  "id, tipo, numero, titulo, status, prazo, setor_id, responsavel_id, aberto_por, pessoal, precisa_confirmacao, origem_modulo, origem_ref" as const;

export type ChamadoDaOrigem = Pick<
  Tabela<"chamados">,
  | "id"
  | "tipo"
  | "numero"
  | "titulo"
  | "status"
  | "prazo"
  | "setor_id"
  | "responsavel_id"
  | "aberto_por"
  | "pessoal"
  | "precisa_confirmacao"
  | "origem_modulo"
  | "origem_ref"
>;

/** O chamado em aberto (aberto, em andamento ou aguardando) da referência. */
export async function chamadoAbertoDaOrigem(
  modulo: string,
  ref: string,
): Promise<ChamadoDaOrigem | null> {
  const { data, error } = await osAdmin()
    .from("chamados")
    .select(COLUNAS)
    .eq("origem_modulo", modulo)
    .eq("origem_ref", ref)
    .in("status", EM_ABERTO)
    .order("criado_em")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Chamado de ${modulo} ${ref}: ${error.message}`);
  return data;
}

async function lerAberto(id: string): Promise<ChamadoDaOrigem | null> {
  const { data, error } = await osAdmin()
    .from("chamados")
    .select(COLUNAS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Chamado ${id}: ${error.message}`);
  return data && emAberto(data.status) ? data : null;
}

const autor = (ch: ChamadoDaOrigem, nome?: string) =>
  nome ?? (ch.origem_modulo ? `Sistema (${ch.origem_modulo})` : "Sistema");

/**
 * Conclui o chamado porque o módulo gravou o trabalho. Fecha direto ou
 * fica Concluído esperando quem pediu, pela mesma regra do botão Concluir
 * (statusAoConcluir: tarefa pessoal, aviso ou sem confirmação fecham).
 * `texto` vira a solução e a linha do tempo ("Entrevista salva em ...").
 * `concluidoPor`: quem salvou no módulo (entra em concluido_por).
 * Devolve false se o chamado já não estava em aberto (nada a fazer).
 */
export async function concluirPeloSistema(p: {
  chamadoId: string;
  texto: string;
  concluidoPor?: string | null;
  autorNome?: string;
}): Promise<boolean> {
  const ch = await lerAberto(p.chamadoId);
  if (!ch) return false;
  const status = statusAoConcluir(ch);
  const texto = p.texto.trim().slice(0, 2000);
  const { data, error } = await osAdmin()
    .from("chamados")
    .update({
      status,
      solucao: texto || null,
      concluido_por: p.concluidoPor ?? null,
    })
    .eq("id", ch.id)
    .eq("status", ch.status)
    .select("id");
  if (error) throw new Error(`Concluir ${numeroDo(ch)}: ${error.message}`);
  if (!data?.length) return false;

  await registrarComoSistema(chamado(ch.id), {
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
    await notificar(
      [ch.aberto_por],
      {
        ...base,
        tipo: "concluido",
        texto: "Concluído. Confirme se ficou resolvido.",
      },
      p.concluidoPor,
    );
  else
    await notificar(
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
export async function cancelarPeloSistema(p: {
  chamadoId: string;
  motivo: string;
  autorNome?: string;
}): Promise<boolean> {
  const motivo = p.motivo.trim().slice(0, 500);
  if (!motivo) throw new Error("Cancelar pelo sistema precisa de um motivo.");
  const ch = await lerAberto(p.chamadoId);
  if (!ch) return false;
  const { data, error } = await osAdmin()
    .from("chamados")
    .update({ status: "cancelado", motivo_cancelamento: motivo })
    .eq("id", ch.id)
    .eq("status", ch.status)
    .select("id");
  if (error) throw new Error(`Cancelar ${numeroDo(ch)}: ${error.message}`);
  if (!data?.length) return false;

  await registrarComoSistema(chamado(ch.id), {
    tipo: "status",
    autorNome: autor(ch, p.autorNome),
    texto: `Cancelou: ${motivo}`,
    dados: { acao: "cancelar", de: ch.status, para: "cancelado", motivo },
  });
  await notificar([ch.responsavel_id], {
    titulo: `${numeroDo(ch)} ${ch.titulo}`,
    href: rotaDo(ch),
    alvo: chamado(ch.id),
    tipo: "cancelado",
    texto: `O chamado foi cancelado: ${motivo}`,
  });
  return true;
}
