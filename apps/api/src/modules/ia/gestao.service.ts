import {
  type ConfigDaIa,
  type ConsultaConversasDaEquipe,
  type ConsultaDoUso,
  type EntradaLimite,
  POR_PAGINA,
  precoDoModelo,
  type RespostaConfig,
  type RespostaConversaDaEquipe,
  type RespostaConversasDaEquipe,
  type RespostaUso,
} from "@arp/shared/ia/contratos";
import { z } from "zod";
import { type Contexto, exigir } from "@/contexto";
import { ErroDeValidacao, ErroNaoEncontrado } from "@/erros";
import { banco } from "@/infra/banco";
import { registrarDepois } from "@/infra/eventos";
import {
  configClaude,
  credencialEmUso,
  IntegracaoNaoConfigurada,
} from "@/modules/sync/credenciais.service";
import * as conversasRepo from "./assistente.repository";
import { catalogo, fontesSalvas, paginar } from "./assistente.service";
import * as repo from "./gestao.repository";

// Gestão da IA ARP (ia.gerenciar): ligar e desligar, esforço, tetos,
// limites por cargo e por pessoa, preços e o painel de consumo. O gestor vê
// números de uso; o conteúdo das conversas é só de quem conversou.

const precos = z.record(z.string(), precoDoModelo);
const esforco = z.enum(["low", "medium", "high", "xhigh", "max"]);

async function modeloEmUso(): Promise<string | null> {
  try {
    return configClaude(await credencialEmUso("claude")).modelo;
  } catch (e) {
    if (e instanceof IntegracaoNaoConfigurada) return null;
    throw e;
  }
}

export async function lerConfig(ctx: Contexto): Promise<RespostaConfig> {
  await exigir(ctx, "ia.gerenciar");
  const r = await banco.comoServico(async (tx) => ({
    config: await repo.config(tx),
    limites: await repo.limites(tx),
    cargos: await repo.cargos(tx),
    usuarios: await repo.usuarios(tx),
  }));
  const modelo = await modeloEmUso();
  const c = r.config;
  return {
    config: {
      ativa: c.ativa,
      esforco: esforco.catch("medium").parse(c.esforco),
      max_consultas: c.max_consultas,
      limite_padrao_mes: c.limite_padrao_mes,
      orcamento_mes_usd: c.orcamento_mes_usd,
      dias_de_guarda: c.dias_de_guarda,
      cotacao_dolar: c.cotacao_dolar,
      precos: precos.catch({}).parse(c.precos),
      instrucoes: c.instrucoes,
    },
    modelo,
    configurada: modelo !== null,
    limites: r.limites.flatMap((l) => {
      const tipo = l.cargo_id ? ("cargo" as const) : ("usuario" as const);
      const id = l.cargo_id ?? l.usuario_id;
      return id ? [{ tipo, id, nome: l.nome, tokens_mes: l.tokens_mes }] : [];
    }),
    cargos: r.cargos,
    usuarios: r.usuarios,
    fontes: catalogo().fontes.length,
  };
}

export async function salvarConfig(
  ctx: Contexto,
  c: ConfigDaIa,
): Promise<void> {
  if (Object.keys(c.precos).length === 0)
    throw new ErroDeValidacao("Informe o preço de pelo menos um modelo.");
  await banco.comoUsuario(ctx.usuario.id, (tx) => repo.salvarConfig(tx, c));
  registrarDepois({
    modulo: "admin",
    evento: "ia_configuracao",
    descricao: `Alterou a configuração da IA (${c.ativa ? "ligada" : "desligada"})`,
    usuarioId: ctx.usuario.id,
  });
}

export async function salvarLimite(
  ctx: Contexto,
  l: EntradaLimite,
): Promise<void> {
  await banco.comoUsuario(ctx.usuario.id, (tx) => repo.salvarLimite(tx, l));
}

export async function removerLimite(
  ctx: Contexto,
  l: { tipo: "cargo" | "usuario"; id: string },
): Promise<void> {
  const ok = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.removerLimite(tx, l),
  );
  if (!ok) throw new ErroNaoEncontrado("Limite não encontrado.");
}

export async function uso(
  ctx: Contexto,
  q: ConsultaDoUso,
): Promise<RespostaUso> {
  await exigir(ctx, "ia.gerenciar");
  // Nomes de pessoas e cargos vêm de core (service role, depois de exigir).
  return banco.comoServico(async (tx) => ({
    resumo: await repo.resumo(tx, q.de, q.ate),
    mes: await repo.doMes(tx),
    por_dia: await repo.porDia(tx, q.de, q.ate),
    por_hora: await repo.porHora(tx, q.de, q.ate),
    por_usuario: await repo.porUsuario(tx, q.de, q.ate),
    por_cargo: await repo.porCargo(tx, q.de, q.ate),
    por_modulo: await repo.porModulo(tx, q.de, q.ate),
    por_modelo: await repo.porModelo(tx, q.de, q.ate),
    por_status: await repo.porStatus(tx, q.de, q.ate),
  }));
}

// ---------------------------------------------------------------------------
// Conversas da equipe (ia.conversas): só leitura. Nomes vêm de core, por isso
// service role depois de exigir. Abrir uma conversa fica no histórico.
// ---------------------------------------------------------------------------

export async function conversasDaEquipe(
  ctx: Contexto,
  c: ConsultaConversasDaEquipe,
): Promise<RespostaConversasDaEquipe> {
  await exigir(ctx, "ia.conversas");
  const r = await banco.comoServico(async (tx) => ({
    linhas: await conversasRepo.conversas(tx, {
      ...c,
      usuarioId: c.usuario_id,
      limite: POR_PAGINA + 1,
    }),
    pessoas: await repo.pessoasComConversa(tx),
  }));
  const nomes = new Map(r.pessoas.map((p) => [p.id, p.nome]));
  const contagem = await banco.comoServico((tx) =>
    repo.perguntasPorConversa(
      tx,
      r.linhas.slice(0, POR_PAGINA).map((l) => l.id),
    ),
  );
  return {
    ...paginar(r.linhas, (l) => ({
      id: l.id,
      titulo: l.titulo,
      atualizada_em: l.atualizada_em,
      usuario_id: l.usuario_id,
      pessoa: nomes.get(l.usuario_id) ?? "—",
      perguntas: contagem.get(l.id) ?? 0,
    })),
    pessoas: r.pessoas,
  };
}

export async function conversaDaEquipe(
  ctx: Contexto,
  id: string,
): Promise<RespostaConversaDaEquipe> {
  await exigir(ctx, "ia.conversas");
  const r = await banco.comoServico(async (tx) => {
    const c = await conversasRepo.conversa(tx, id);
    if (!c) return null;
    return {
      ...c,
      pessoa: (await repo.nomeDe(tx, c.usuario_id)) ?? "—",
      perguntas: await conversasRepo.perguntas(tx, id),
    };
  });
  if (!r) throw new ErroNaoEncontrado("Conversa não encontrada.");
  if (r.usuario_id !== ctx.usuario.id)
    registrarDepois({
      modulo: "admin",
      evento: "ia_conversa_lida",
      descricao: `Leu a conversa de ${r.pessoa} com a IA`,
      usuarioId: ctx.usuario.id,
      detalhes: { conversa_id: r.id, dono_id: r.usuario_id },
    });
  return {
    id: r.id,
    titulo: r.titulo,
    pessoa: r.pessoa,
    perguntas: r.perguntas.map((p) => ({
      ...p,
      fontes: fontesSalvas.catch([]).parse(p.fontes),
    })),
  };
}
