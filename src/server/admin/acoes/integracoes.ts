"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import type { EstadoAcao } from "@/components/form-acao";
import { ehSistema, INTEGRACOES, type Sistema } from "@/lib/integracoes";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { cifrar, cofreConfigurado } from "@/server/cofre";
import {
  credencialEmUso,
  credencialSalva,
  testarConexao,
} from "@/server/integracoes";
import { registrarDepois } from "@/server/logs";
import { sincronizarCopiloto } from "@/server/sync/copiloto-rh";
import { sincronizarSecullum } from "@/server/sync/secullum";
import { sincronizarWps } from "@/server/sync/wps";

// Credenciais das integrações. O segredo é cifrado aqui, antes de ir para o
// banco; as funções do banco conferem admin.integracoes e registram na
// auditoria sem o segredo. Ler a credencial salva e sincronizar usam a
// service role: a permissão é conferida direto no banco (podeAgora).

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para configurar integrações.",
};

async function sistemaDoForm(form: FormData): Promise<Sistema | EstadoAcao> {
  if (!(await podeAgora("admin.integracoes"))) return SEM_PERMISSAO;
  const s = form.get("sistema");
  return ehSistema(s) ? s : { erro: "Integração desconhecida." };
}

const ehErro = (v: unknown): v is EstadoAcao =>
  typeof v === "object" && v !== null;

export async function salvarIntegracao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const sistema = await sistemaDoForm(form);
  if (ehErro(sistema)) return sistema;
  if (!cofreConfigurado())
    return {
      erro: "O servidor ainda não tem a chave INTEGRACOES_CHAVE: nada foi salvo.",
    };

  const def = INTEGRACOES[sistema];
  const p = def.parametros.safeParse(
    Object.fromEntries(def.campos.map((c) => [c.nome, form.get(c.nome) ?? ""])),
  );
  if (!p.success)
    return primeiroErro(
      p.error,
      Object.fromEntries(def.campos.map((c) => [c.nome, c.rotulo])),
    );

  const novo = String(form.get("segredo") ?? "").trim() || null;
  let segredo = novo;
  if (!segredo) {
    try {
      segredo = (await credencialSalva(sistema))?.segredo ?? null;
    } catch {
      return {
        erro: `Não foi possível abrir a ${def.segredo.rotulo.toLowerCase()} salva. Digite de novo.`,
      };
    }
    if (!segredo) return { erro: `${def.segredo.rotulo}: obrigatório` };
  }

  const ativa = form.get("ativa") === "on";
  const semTeste = form.get("sem_teste") === "on";
  const teste = ativa
    ? await testarConexao(sistema, { parametros: p.data, segredo })
    : null;
  if (teste && !teste.ok && !semTeste)
    return { erro: `${teste.mensagem}. Nada foi salvo.` };

  const core = (await createClient()).schema("core");
  const salvo = await core.rpc("salvar_integracao", {
    p_sistema: sistema,
    p_parametros: p.data as Json,
    // Sem segredo novo, o banco mantém o atual.
    p_segredo_cifrado: (novo ? cifrar(novo, sistema) : null) as string,
    p_ativa: ativa,
  });
  if (salvo.error) return erroDoBanco(salvo.error);
  if (teste) {
    const r = await core.rpc("registrar_teste_integracao", {
      p_sistema: sistema,
      p_ok: teste.ok,
      p_mensagem: teste.mensagem,
    });
    if (r.error) return erroDoBanco(r.error);
  }
  refresh();
  if (!teste) return { ok: "Salvo. A integração está desativada." };
  return teste.ok
    ? { ok: `Salvo. ${teste.mensagem}.` }
    : { ok: `Salvo sem conexão. ${teste.mensagem}.` };
}

export async function testarIntegracao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const sistema = await sistemaDoForm(form);
  if (ehErro(sistema)) return sistema;
  let teste: Awaited<ReturnType<typeof testarConexao>>;
  try {
    teste = await testarConexao(sistema, await credencialEmUso(sistema));
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Falhou." };
  }
  registrarDepois({
    modulo: "integracoes",
    evento: "integracao_testada",
    descricao: `Testou a conexão com ${INTEGRACOES[sistema].nome}: ${teste.ok ? "ok" : "falhou"}`,
    usuarioId: (await usuarioAtual()).id,
    detalhes: { sistema, ok: teste.ok, mensagem: teste.mensagem },
  });
  // Só a credencial salva na tela guarda o resultado (a do .env não tem linha).
  if (await credencialSalva(sistema).catch(() => null)) {
    const r = await (await createClient())
      .schema("core")
      .rpc("registrar_teste_integracao", {
        p_sistema: sistema,
        p_ok: teste.ok,
        p_mensagem: teste.mensagem,
      });
    if (r.error) return erroDoBanco(r.error);
    refresh();
  }
  return teste.ok
    ? { ok: `${teste.mensagem}.` }
    : { erro: `${teste.mensagem}.` };
}

export async function removerIntegracao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const sistema = await sistemaDoForm(form);
  if (ehErro(sistema)) return sistema;
  const { error } = await (await createClient())
    .schema("core")
    .rpc("remover_integracao", { p_sistema: sistema });
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Credencial removida." };
}

/**
 * Roda a sincronização do ponto depois de responder (leva minutos). Segue
 * as mesmas travas do cron: uma de cada vez e o limite de 100 cálculos por hora.
 */
export async function sincronizarAgora(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const sistema = await sistemaDoForm(form);
  if (ehErro(sistema)) return sistema;
  registrarDepois({
    modulo: "integracoes",
    evento: "sincronizacao_pedida",
    descricao: `Pediu a sincronização de ${INTEGRACOES[sistema].nome}`,
    usuarioId: (await usuarioAtual()).id,
    detalhes: { sistema },
  });
  if (sistema === "copiloto_rh") return sincronizarCopilotoAgora();
  if (sistema === "wps") return sincronizarWpsAgora();
  if (sistema !== "secullum")
    return { erro: "A sincronização desta integração ainda não existe." };
  try {
    await credencialEmUso("secullum");
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Sem credencial." };
  }
  after(async () => {
    try {
      await sincronizarSecullum();
    } catch (erro) {
      // O erro fica registrado em integracao.sync_runs (histórico da tela).
      console.error("sync secullum (manual)", erro);
    }
  });
  return {
    ok: "Sincronização iniciada. Leva alguns minutos; acompanhe no histórico.",
  };
}

/** O Copiloto responde em segundos: roda na hora e mostra o resumo. */
async function sincronizarCopilotoAgora(): Promise<EstadoAcao> {
  try {
    const r = await sincronizarCopiloto();
    refresh();
    const avisos = r.avisos.length ? ` · ${r.avisos.length} avisos` : "";
    return {
      ok: `${r.colaboradores} colaboradores do Copiloto (${r.ativos} ativos, ${r.desligados} desligados)${r.novos ? ` · ${r.novos} novos` : ""}${avisos}.`,
    };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Falhou." };
  }
}

/** A semana do estacionamento sai em segundos: roda na hora. */
async function sincronizarWpsAgora(): Promise<EstadoAcao> {
  try {
    const r = await sincronizarWps();
    refresh();
    const avisos = r.avisos.length ? ` · ${r.avisos.length} avisos` : "";
    return {
      ok: `${r.dias} dias do estacionamento ${r.estacionamento}: ${r.pagamentos} pagamentos, ${r.entradas} entradas e ${r.saidas} saídas${avisos}.`,
    };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Falhou." };
  }
}
