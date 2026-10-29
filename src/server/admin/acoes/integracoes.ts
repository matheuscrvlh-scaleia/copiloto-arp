"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { EstadoAcao } from "@/components/form-acao";
import {
  ehSistema,
  INTEGRACOES,
  juntarSegredos,
  type Sistema,
  separarSegredos,
} from "@/lib/integracoes";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";
import { cifrar, cofreConfigurado } from "@/server/cofre";
import {
  credencialEmUso,
  credencialSalva,
  podeConfigurar,
  rdStation,
  testarConexao,
} from "@/server/integracoes";
import { registrarDepois } from "@/server/logs";
import { iniciarAutorizacaoRd } from "@/server/marketing/autorizacao-rd";
import { sincronizarCopiloto } from "@/server/sync/copiloto-rh";
import { sincronizarRd } from "@/server/sync/rd-station";
import { sincronizarSecullum } from "@/server/sync/secullum";
import { sincronizarWps } from "@/server/sync/wps";

// Credenciais das integrações. O segredo é cifrado aqui, antes de ir para o
// banco; as funções do banco conferem admin.integracoes e registram na
// auditoria sem o segredo. Ler a credencial salva e sincronizar usam a
// service role: a permissão é conferida direto no banco (podeConfigurar:
// admin.integracoes, ou marketing.parametros nas do Marketing).

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para configurar integrações.",
};

async function sistemaDoForm(form: FormData): Promise<Sistema | EstadoAcao> {
  const s = form.get("sistema");
  if (!ehSistema(s)) return { erro: "Integração desconhecida." };
  return (await podeConfigurar(s)) ? s : SEM_PERMISSAO;
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

  // Segredo em branco mantém o salvo; com vários, cada um à parte.
  const novos = Object.fromEntries(
    def.segredos.map((s) => [
      s.nome,
      String(form.get(`segredo.${s.nome}`) ?? "").trim(),
    ]),
  );
  // Sem segredo (endereço público) vai um vazio cifrado: o banco exige um.
  const trocou =
    def.segredos.length === 0 || Object.values(novos).some(Boolean);
  let salvos: Record<string, string> = {};
  if (def.segredos.some((s) => !novos[s.nome])) {
    try {
      const c = await credencialSalva(sistema);
      if (c) salvos = separarSegredos(def, c.segredo);
    } catch {
      return {
        erro: "Não foi possível abrir os segredos salvos. Digite todos de novo.",
      };
    }
  }
  const valores = Object.fromEntries(
    def.segredos.map((s) => [s.nome, novos[s.nome] || salvos[s.nome] || ""]),
  );
  const falta = def.segredos.find((s) => !s.opcional && !valores[s.nome]);
  if (falta) return { erro: `${falta.rotulo}: obrigatório` };
  const segredo = juntarSegredos(def, valores);

  // "Conectar com …" (OAuth): salva o que foi digitado sem testar (falta o
  // segredo que a autorização gera) e segue para a tela da ferramenta.
  if (def.autorizar && form.get("autorizar") === "1") {
    const salvo = await (await createClient())
      .schema("core")
      .rpc("salvar_integracao", {
        p_sistema: sistema,
        p_parametros: p.data as Json,
        p_segredo_cifrado: (trocou ? cifrar(segredo, sistema) : null) as string,
        p_ativa: true,
      });
    if (salvo.error) return erroDoBanco(salvo.error);
    redirect(await iniciarAutorizacaoRd(String(p.data.client_id)));
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
    p_segredo_cifrado: (trocou ? cifrar(segredo, sistema) : null) as string,
    p_ativa: ativa,
  });
  if (salvo.error) return erroDoBanco(salvo.error);
  if (sistema === "mkt_site") updateTag(TAG.marketing.eventosSite);
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
  // Testar a agenda do site também relê os eventos na tela.
  if (sistema === "mkt_site" && teste.ok) updateTag(TAG.marketing.eventosSite);
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
  if (sistema === "mkt_rd_station") return sincronizarRdAgora();
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
      ok: `${r.colaboradores} colaboradores do Copiloto (${r.ativos} ativos, ${r.desligados} desligados)${r.novos ? ` · ${r.novos} novos` : ""}${r.dependentes !== null ? ` · ${r.dependentes} dependentes` : ""}${avisos}.`,
    };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Falhou." };
  }
}

/**
 * RD Station: roda depois de responder (a primeira leitura passa de um
 * minuto). Se o prazo acabar, a próxima continua de onde parou.
 */
async function sincronizarRdAgora(): Promise<EstadoAcao> {
  try {
    await rdStation();
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Sem credencial." };
  }
  after(async () => {
    try {
      await sincronizarRd();
    } catch (erro) {
      // O erro fica registrado em integracao.sync_runs.
      console.error("sync rd station (manual)", erro);
    }
  });
  return {
    ok: "Leitura do RD iniciada. Leva alguns minutos; as telas do Marketing passam a mostrar os leads reais.",
  };
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
