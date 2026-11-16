import type {
  ConsultaDasIntegracoes,
  EntradaIntegracao,
  IntegracaoNaTela,
  RespostaIntegracoes,
} from "@arp/shared/admin/contratos";
import {
  type DefinicaoIntegracao,
  INTEGRACOES,
  juntarSegredos,
  type ResultadoRd,
  SEM_APP_GOOGLE,
  SISTEMAS,
  type Sistema,
  separarSegredos,
} from "@arp/shared/integracoes";
import { PERMISSOES, type Permissao } from "@arp/shared/permissions";
import { trocarCodigoRdCrm } from "@/connectors/rd-crm";
import { type Contexto, type Origem, pode } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao, ErroDeValidacao } from "@/erros";
import { banco } from "@/infra/banco";
import { cifrar, cofreConfigurado } from "@/infra/cofre";
import { registrarDepois } from "@/infra/eventos";
import { log } from "@/infra/log";
import { mesmoState } from "@/infra/oauth";
import {
  credencialEmUso,
  credencialSalva,
  IntegracaoNaoConfigurada,
  podeConfigurar,
  temNoAmbiente,
} from "@/modules/sync/credenciais.service";
import { sincronizarAgora as sincronizar } from "@/modules/sync/sync.service";
import { lerCookieRdCrm, retornoRdCrm } from "./autorizacao-rd-crm";
import {
  type Autorizacao,
  extensaoDe,
  type ResultadoTeste,
  testarConexao,
} from "./conexoes";
import * as repo from "./integracoes.repository";

// Credenciais das integrações. O segredo é cifrado aqui, antes de ir para o
// banco; as funções do banco conferem admin.integracoes e registram na
// auditoria sem o segredo. Ler a credencial salva e sincronizar usam a
// service role: a permissão é conferida direto no banco (podeConfigurar:
// admin.integracoes, ou marketing.parametros nas do Marketing).

const SEM_PERMISSAO = "Você não tem permissão para configurar integrações.";

async function exigirConfigurar(
  ctx: Contexto,
  sistema: Sistema,
): Promise<void> {
  if (!(await podeConfigurar(ctx, sistema)))
    throw new ErroDePermissao(SEM_PERMISSAO);
}

const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v))
    : {};

/** Integrações de um módulo (Administração ou Marketing), com a situação. */
export async function integracoesNaTela(
  ctx: Contexto,
  { modulo }: ConsultaDasIntegracoes,
): Promise<RespostaIntegracoes> {
  // A mesma permissão que abria cada tela; o banco confere de novo.
  const liberado =
    pode(ctx, "admin.integracoes") ||
    (modulo === "marketing" && pode(ctx, "marketing.parametros"));
  if (!liberado) throw new ErroDePermissao();

  const { conf, hist } = await banco.comoUsuario(
    ctx.usuario.id,
    async (tx) => ({
      conf: await repo.configuradas(tx),
      hist: await repo.ultimasExecucoes(tx, 15),
    }),
  );

  const doModulo = SISTEMAS.filter((s) => INTEGRACOES[s].modulo === modulo);
  const integracoes = doModulo.map((sistema): IntegracaoNaTela => {
    const c = conf.find((r) => r.sistema === sistema);
    if (c) {
      return {
        sistema,
        origem: "tela",
        parametros: objeto(c.parametros),
        ativa: c.ativa,
        configuradoPor: c.configurado_por,
        configuradoEm: c.configurado_em,
        testadoEm: c.testado_em,
        testeOk: c.teste_ok,
        testeMensagem: c.teste_mensagem,
      };
    }
    const ambiente = temNoAmbiente(sistema);
    return {
      sistema,
      origem: ambiente ? "ambiente" : null,
      parametros: {},
      ativa: ambiente,
      configuradoPor: null,
      configuradoEm: null,
      testadoEm: null,
      testeOk: null,
      testeMensagem: null,
    };
  });

  return {
    cofre: cofreConfigurado(),
    integracoes,
    historico: hist.map((h) => ({
      ...h,
      avisos: Array.isArray(h.avisos)
        ? h.avisos.filter((a): a is string => typeof a === "string")
        : [],
    })),
  };
}

/** O app (id e secret) de outro cartão já salvo (o YouTube usa o do Google). */
async function appDe(
  sistema: Sistema,
  autorizar: NonNullable<DefinicaoIntegracao["autorizar"]>,
): Promise<string | null> {
  const def = INTEGRACOES[sistema];
  const fonte = await credencialSalva(sistema);
  if (!fonte) return null;
  const p = def.parametros.safeParse(fonte.parametros);
  const s = separarSegredos(def, fonte.segredo);
  const id = p.success ? p.data[autorizar.campo] : null;
  return id && s[autorizar.credencial] ? String(id) : null;
}

async function iniciarAutorizacao(
  ctx: Contexto,
  sistema: Sistema,
  clientId: string,
): Promise<Autorizacao> {
  const { autorizar } = extensaoDe(sistema);
  if (!autorizar)
    throw new ErroDeNegocio(
      "A autorização desta integração ainda não está disponível.",
    );
  return autorizar(ctx, clientId);
}

export async function salvarIntegracao(
  ctx: Contexto,
  sistema: Sistema,
  d: EntradaIntegracao,
): Promise<{ mensagem: string; autorizacao?: Autorizacao }> {
  await exigirConfigurar(ctx, sistema);
  if (!cofreConfigurado())
    throw new ErroDeNegocio(
      "O servidor ainda não tem a chave INTEGRACOES_CHAVE: nada foi salvo.",
    );

  const def = INTEGRACOES[sistema];
  const p = def.parametros.safeParse(
    Object.fromEntries(def.campos.map((c) => [c.nome, d.campos[c.nome] ?? ""])),
  );
  if (!p.success) {
    const issue = p.error.issues[0];
    const campo = String(issue?.path[0] ?? "");
    const rotulo = def.campos.find((c) => c.nome === campo)?.rotulo;
    throw new ErroDeValidacao(
      `${rotulo ?? (campo || "Campo")}: ${issue?.message ?? "inválido"}`,
    );
  }

  // Segredo em branco mantém o salvo; com vários, cada um à parte.
  const novos = Object.fromEntries(
    def.segredos.map((s) => [s.nome, (d.segredos[s.nome] ?? "").trim()]),
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
      throw new ErroDeNegocio(
        "Não foi possível abrir os segredos salvos. Digite todos de novo.",
      );
    }
  }
  const valores = Object.fromEntries(
    def.segredos.map((s) => [s.nome, novos[s.nome] || salvos[s.nome] || ""]),
  );
  const falta = def.segredos.find((s) => !s.opcional && !valores[s.nome]);
  if (falta) throw new ErroDeNegocio(`${falta.rotulo}: obrigatório`);
  const segredo = juntarSegredos(def, valores);
  const segredoCifrado = trocou ? cifrar(segredo, sistema) : null;
  const gravar = (ativa: boolean, teste: ResultadoTeste | null) =>
    banco.comoUsuario(ctx.usuario.id, async (tx) => {
      await repo.salvar(tx, {
        sistema,
        parametros: p.data,
        segredoCifrado,
        ativa,
      });
      if (teste) await repo.registrarTeste(tx, sistema, teste);
    });

  // App de outro cartão (o YouTube usa o do Google): nada a salvar antes;
  // a volta da autorização grava tudo.
  if (def.autorizar?.appDe && d.autorizar) {
    const app = await appDe(def.autorizar.appDe, def.autorizar);
    if (!app) throw new ErroDeNegocio(SEM_APP_GOOGLE);
    return {
      mensagem: "Salvo.",
      autorizacao: await iniciarAutorizacao(ctx, sistema, app),
    };
  }

  // "Conectar com …" (OAuth): salva o que foi digitado sem testar (falta o
  // segredo que a autorização gera) e segue para a tela da ferramenta.
  if (def.autorizar && d.autorizar) {
    const { campo, credencial } = def.autorizar;
    const app = String(p.data[campo] ?? "");
    if (!app || !valores[credencial]) {
      const rotulos = [
        def.campos.find((c) => c.nome === campo)?.rotulo,
        def.segredos.find((s) => s.nome === credencial)?.rotulo,
      ];
      throw new ErroDeNegocio(
        `Preencha ${rotulos.join(" e ")} antes de conectar.`,
      );
    }
    await gravar(true, null);
    return {
      mensagem: "Salvo.",
      autorizacao: await iniciarAutorizacao(ctx, sistema, app),
    };
  }

  // O teste chama o sistema externo: fora do escopo do banco.
  const teste = d.ativa
    ? await testarConexao(sistema, { parametros: p.data, segredo })
    : null;
  if (teste && !teste.ok && !d.sem_teste)
    throw new ErroDeNegocio(`${teste.mensagem}. Nada foi salvo.`);
  await gravar(d.ativa, teste);
  extensaoDe(sistema).aoMudar?.();
  if (!teste) return { mensagem: "Salvo. A integração está desativada." };
  return {
    mensagem: teste.ok
      ? `Salvo. ${teste.mensagem}.`
      : `Salvo sem conexão. ${teste.mensagem}.`,
  };
}

/** Testa com a credencial em uso e guarda o resultado no cartão. */
export async function testarIntegracao(
  ctx: Contexto,
  sistema: Sistema,
): Promise<string> {
  await exigirConfigurar(ctx, sistema);
  let teste: ResultadoTeste;
  try {
    teste = await testarConexao(sistema, await credencialEmUso(sistema));
  } catch (erro) {
    throw new ErroDeNegocio(
      erro instanceof IntegracaoNaoConfigurada ? erro.message : "Falhou.",
    );
  }
  registrarDepois({
    modulo: "integracoes",
    evento: "integracao_testada",
    descricao: `Testou a conexão com ${INTEGRACOES[sistema].nome}: ${teste.ok ? "ok" : "falhou"}`,
    usuarioId: ctx.usuario.id,
    detalhes: { sistema, ok: teste.ok, mensagem: teste.mensagem },
  });
  if (teste.ok) extensaoDe(sistema).aoMudar?.();
  // Só a credencial salva na tela guarda o resultado (a do .env não tem linha).
  if (await credencialSalva(sistema).catch(() => null))
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.registrarTeste(tx, sistema, teste),
    );
  if (!teste.ok) throw new ErroDeNegocio(`${teste.mensagem}.`);
  return `${teste.mensagem}.`;
}

export async function removerIntegracao(
  ctx: Contexto,
  sistema: Sistema,
): Promise<void> {
  await exigirConfigurar(ctx, sistema);
  await extensaoDe(sistema).aoRemover?.();
  await banco.comoUsuario(ctx.usuario.id, (tx) => repo.remover(tx, sistema));
}

/**
 * "Sincronizar agora": registra o pedido e chama a sincronização do sistema
 * (módulo sync), que segue as mesmas travas da rotina agendada.
 */
export async function sincronizarAgora(
  ctx: Contexto,
  sistema: Sistema,
): Promise<string> {
  await exigirConfigurar(ctx, sistema);
  registrarDepois({
    modulo: "integracoes",
    evento: "sincronizacao_pedida",
    descricao: `Pediu a sincronização de ${INTEGRACOES[sistema].nome}`,
    usuarioId: ctx.usuario.id,
    detalhes: { sistema },
  });
  return (await sincronizar(ctx, sistema)).mensagem;
}

// ---------------------------------------------------------------------------
// Volta da autorização do RD Station CRM
// ---------------------------------------------------------------------------

const ehPermissao = (p: string): p is Permissao => p in PERMISSOES;

/**
 * Conclui a autorização e devolve só a chave do resultado (o texto fica em
 * RETORNO_RD_CRM, na tela). A documentação do CRM não cita o state na volta:
 * se ele vier, tem de bater; sem ele, vale o cookie desta autorização (10
 * minutos, só neste navegador). Quem autoriza é a pessoa do cookie, com a
 * permissão conferida agora no banco. Deu certo: começa a primeira leitura
 * das oportunidades, sem esperar por ela.
 */
export async function concluirAutorizacaoRdCrm(
  cookie: string | undefined,
  code: string,
  state: string,
  origem: Origem,
): Promise<ResultadoRd> {
  const SISTEMA = "rd_crm";
  const esperado = lerCookieRdCrm(cookie);
  if (!esperado) return "state";
  const { usuarioId } = esperado;
  const liberado = await banco.comoUsuario(usuarioId, (tx) =>
    repo.podeIntegracao(tx, SISTEMA),
  );
  if (!liberado) return "permissao";
  if (!code || (state && !mesmoState(state, esperado.state))) return "state";

  const def = INTEGRACOES[SISTEMA];
  const salva = await credencialSalva(SISTEMA);
  const p = def.parametros.safeParse(salva?.parametros ?? {});
  const segredos = salva ? separarSegredos(def, salva.segredo) : {};
  if (!salva || !p.success || !segredos.client_secret) return "credencial";

  let refresh: string;
  try {
    refresh = (
      await trocarCodigoRdCrm({
        clientId: String(p.data.client_id),
        clientSecret: segredos.client_secret,
        code,
        redirectUri: retornoRdCrm(),
      })
    ).refresh_token;
  } catch {
    return "codigo";
  }

  const segredo = juntarSegredos(def, { ...segredos, refresh_token: refresh });
  const parametros = p.data;
  try {
    await banco.comoUsuario(usuarioId, (tx) =>
      repo.salvar(tx, {
        sistema: SISTEMA,
        parametros,
        segredoCifrado: cifrar(segredo, SISTEMA),
        ativa: true,
      }),
    );
  } catch {
    return "salvar";
  }
  const teste = await testarConexao(SISTEMA, { parametros, segredo });
  await banco
    .comoUsuario(usuarioId, (tx) => repo.registrarTeste(tx, SISTEMA, teste))
    .catch((err) => log.error({ err }, "teste do rd crm (conexão)"));
  if (!teste.ok) return "teste";

  // A sincronização pede um Contexto: o da pessoa do cookie, sem sessão.
  const lido = await banco.comoServico((tx) => repo.pessoa(tx, usuarioId));
  if (lido) {
    const permissoes = await banco.comoUsuario(usuarioId, (tx) =>
      repo.minhasPermissoes(tx),
    );
    const agora = new Date();
    const ctx: Contexto = {
      ...origem,
      usuario: lido,
      permissoes: new Set(permissoes.filter(ehPermissao)),
      senhaProvisoria: false,
      sessao: {
        id: "00000000-0000-0000-0000-000000000000",
        inicio: agora,
        ultimoUso: agora,
        acessoExpiraEm: agora,
      },
    };
    // O erro fica registrado em integracao.sync_runs.
    void sincronizar(ctx, SISTEMA).catch((err) =>
      log.error({ err }, "sync rd crm (conexão)"),
    );
  }
  return "conectado";
}
