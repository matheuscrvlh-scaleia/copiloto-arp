import "server-only";
import { after } from "next/server";
import type { DefinicaoFormulario } from "@/lib/sustentabilidade/formulario/tipos";
import {
  juntarReais,
  resumoDoLancamento,
} from "@/lib/sustentabilidade/lancamento-valores";
import {
  hashDoToken,
  inicioDoMesEmBrasilia,
  podeCorrigirPeloLink,
  tokenValido,
} from "@/lib/sustentabilidade/programas-link";
import { nomesDeUsuarios } from "@/server/comercial/usuarios";
import { falhar, su, suAdmin } from "./base";
import { lerDefinicao } from "./formularios";
import {
  custosDoTour,
  type FormularioParaLancar,
  formulariosParaLancar,
  listasDoPrograma,
} from "./lancamentos";

// Link do parceiro (spec 4.8): o parceiro não tem usuário. A página
// /parceiro/[token] confere o hash do token no servidor (service role) a
// cada acesso: link ativo de programa ativo. Ele vê só os formulários
// publicados do programa e o que ESTE link lançou no mês corrente; nada de
// indicadores, painel, outros programas ou clientes.

export interface AcessoDoParceiro {
  linkId: string;
  programaId: string;
  programaNome: string;
}

/**
 * Link ativo (não desligado) de programa ativo; null para token inválido,
 * desligado, de programa inativo ou inexistente.
 */
export async function acessoDoParceiro(
  token: string,
): Promise<AcessoDoParceiro | null> {
  if (!tokenValido(token)) return null;
  const { data, error } = await suAdmin()
    .from("programa_links")
    .select("id, programa_id, desligado_em, programas!inner(nome, ativo)")
    .eq("token_hash", hashDoToken(token))
    .maybeSingle();
  if (error) {
    console.error("link do parceiro", error);
    return null;
  }
  if (!data || data.desligado_em || !data.programas.ativo) return null;
  return {
    linkId: data.id,
    programaId: data.programa_id,
    programaNome: data.programas.nome,
  };
}

/** Marca o último acesso do link (depois de responder). */
export function registrarAcesso(linkId: string): void {
  after(async () => {
    const { error } = await suAdmin()
      .from("programa_links")
      .update({ ultimo_acesso_em: new Date().toISOString() })
      .eq("id", linkId);
    if (error) console.error("último acesso do link", error);
  });
}

// atalho: limite em memória do processo (uma instância na VPS); some ao
// reiniciar. Só segura abuso de quem já tem o link (o token não se adivinha).
const JANELA_MS = 10 * 60_000;
const ENVIOS_NA_JANELA = 60;
const envios = new Map<string, number[]>();

/** Conta um envio pelo link; false se passou do limite da janela. */
export function dentroDoLimite(linkId: string, agora = Date.now()): boolean {
  const recentes = (envios.get(linkId) ?? []).filter(
    (t) => agora - t < JANELA_MS,
  );
  if (recentes.length >= ENVIOS_NA_JANELA) {
    envios.set(linkId, recentes);
    return false;
  }
  recentes.push(agora);
  envios.set(linkId, recentes);
  return true;
}

export interface LancamentoDoParceiro {
  id: string;
  formularioId: string;
  formulario: string;
  data: string;
  resumo: string;
  valores: Record<string, unknown>;
  versao: number;
  criadoEm: string;
  podeCorrigir: boolean;
}

export interface PaginaDoParceiro {
  programa: string;
  formularios: FormularioParaLancar[];
  /** Definições das versões dos lançamentos do mês (para corrigir). */
  versoes: Record<string, DefinicaoFormulario>;
  lancamentos: LancamentoDoParceiro[];
  listas: Record<string, string[]>;
}

const objeto = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

/** O que a página do parceiro mostra (depois de conferir o token). */
export async function paginaDoParceiro(
  acesso: AcessoDoParceiro,
  agora: Date,
): Promise<PaginaDoParceiro> {
  const db = suAdmin();
  const [formularios, listas, nomes, doMes, custos] = await Promise.all([
    formulariosParaLancar(acesso.programaId),
    listasDoPrograma(acesso.programaId),
    db
      .from("formularios")
      .select("id, nome")
      .eq("programa_id", acesso.programaId),
    db
      .from("lancamentos")
      .select(
        "id, formulario_id, formulario_versao, data, valores, criado_em, lancamento_valores(valores)",
      )
      .eq("link_id", acesso.linkId)
      .gte("criado_em", inicioDoMesEmBrasilia(agora))
      .order("criado_em", { ascending: false })
      .limit(500),
    custosDoTour(),
  ]);
  falhar(doMes.error);
  // Custo calculado pela ARP (Parâmetros × pessoas) não volta ao parceiro.
  const ocultos = new Set(Object.keys(custos?.custos ?? {}));
  falhar(nomes.error);
  const nomeDo = new Map(nomes.data.map((f) => [f.id, f.nome]));
  const pares = [
    ...new Set(
      doMes.data.map((l) => `${l.formulario_id}:${l.formulario_versao}`),
    ),
  ];
  const versoes: Record<string, DefinicaoFormulario> = {};
  for (const f of formularios) versoes[`${f.id}:${f.versao}`] = f.definicao;
  const faltam = pares.filter((k) => !versoes[k]);
  if (faltam.length) {
    const { data, error } = await db
      .from("formulario_versoes")
      .select("formulario_id, versao, definicao")
      .in(
        "formulario_id",
        faltam.map((k) => k.split(":")[0] as string),
      );
    falhar(error);
    for (const v of data) {
      const k = `${v.formulario_id}:${v.versao}`;
      if (faltam.includes(k)) versoes[k] = lerDefinicao(v.definicao);
    }
  }
  return {
    programa: acesso.programaNome,
    formularios,
    versoes,
    listas,
    lancamentos: doMes.data.map((l) => {
      const valores = Object.fromEntries(
        Object.entries(
          juntarReais(
            objeto(l.valores),
            l.lancamento_valores ? objeto(l.lancamento_valores.valores) : null,
          ),
        ).filter(([campo]) => !ocultos.has(campo)),
      );
      const def = versoes[`${l.formulario_id}:${l.formulario_versao}`];
      return {
        id: l.id,
        formularioId: l.formulario_id,
        formulario: nomeDo.get(l.formulario_id) ?? "",
        data: l.data,
        resumo: def ? resumoDoLancamento(def, valores) : "—",
        valores,
        versao: l.formulario_versao,
        criadoEm: l.criado_em,
        podeCorrigir: podeCorrigirPeloLink(l.criado_em, agora),
      };
    }),
  };
}

// ------------------------------------------------- aba "Link do parceiro"

export interface LinkDaEquipe {
  id: string;
  criadoEm: string;
  criadoPor: string | null;
  desligadoEm: string | null;
  desligadoPor: string | null;
  ultimoAcesso: string | null;
  lancamentos: number;
}

/**
 * Links do programa, do mais novo ao mais antigo (RLS: só "Programas –
 * gerenciar" lê). O token não existe aqui: só o hash, que não sai.
 */
export async function linksDoPrograma(
  programaId: string,
): Promise<LinkDaEquipe[]> {
  const db = await su();
  const { data, error } = await db
    .from("programa_links")
    .select(
      "id, criado_por, criado_em, desligado_em, desligado_por, ultimo_acesso_em",
    )
    .eq("programa_id", programaId)
    .order("criado_em", { ascending: false });
  falhar(error);
  const [nomes, contagens] = await Promise.all([
    nomesDeUsuarios(
      data.flatMap((l) => [l.criado_por, l.desligado_por]),
      ["sustentabilidade.programas.gerenciar"],
    ),
    Promise.all(
      data.map((l) =>
        db
          .from("lancamentos")
          .select("id", { count: "exact", head: true })
          .eq("link_id", l.id),
      ),
    ),
  ]);
  return data.map((l, i) => ({
    id: l.id,
    criadoEm: l.criado_em,
    criadoPor: l.criado_por ? (nomes.get(l.criado_por) ?? null) : null,
    desligadoEm: l.desligado_em,
    desligadoPor: l.desligado_por ? (nomes.get(l.desligado_por) ?? null) : null,
    ultimoAcesso: l.ultimo_acesso_em,
    lancamentos: contagens[i]?.count ?? 0,
  }));
}
