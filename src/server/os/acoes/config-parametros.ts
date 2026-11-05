"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { limparLista } from "@/lib/os/catalogo";
import {
  CHAVES_MENSAGEM,
  dimensoesDaImagem,
  erroDaMeta,
  erroDoPapelTimbrado,
  INDICADORES_META,
  type IndicadorMeta,
  mensagensParaGravar,
  PAPEL_TIMBRADO_MAX_BYTES,
} from "@/lib/os/configuracoes";
import { TIPOS_VISTORIA, type TipoVistoria } from "@/lib/os/rotulos";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import type { Database, Json } from "@/lib/supabase/database.types";
import { erroDoBanco, primeiroErro, valores } from "@/server/acoes";
import { TAG } from "@/server/cache";
import { registrarDepois } from "@/server/logs";
import { enviarArquivo, os, osAdmin, removerArquivos } from "@/server/os/base";
import {
  data,
  decimal,
  decimalOpcional,
  exigir,
  exigirAgora,
  hora,
  inteiro,
  json,
  NADA_ALTERADO,
  texto,
  textoOpcional,
  uuidOpcional,
} from "@/server/os/config-acoes";
import { recalcularOS } from "@/server/os/ordem";
import { CAMINHOS_PAPEL_TIMBRADO } from "@/server/os/pdf/papel-timbrado";

// Parâmetros do módulo (spec 4.15): tudo o que pode mudar, numa tela só.
// Cada bloco salva separado, pelo RLS (os.parametros); o gatilho de
// auditoria guarda quem mudou, quando, o antes e o depois.

type AtualizarParametros = Database["os"]["Tables"]["parametros"]["Update"];

const ROTULOS: Record<string, string> = {
  aceite_dias_uteis: "Aceite automático",
  aviso_vencimento_horas: "Aviso de vencimento",
  confirmacao_alerta_dias: "Alerta de confirmação parada",
  dias_uteis: "Dias úteis",
  expediente_inicio: "Início do expediente",
  expediente_fim: "Fim do expediente",
  almoco_inicio: "Início do almoço",
  almoco_fim: "Fim do almoço",
  teto_terceirizado: "Teto do terceirizado",
  terceirizado_prazo_dias: "Retorno do terceirizado",
  causas_falha: "Causas de falha",
  preventiva_antecedencia_dias: "Antecedência das preventivas",
  recorrencia_antecedencia_dias: "Antecedência dos lembretes",
  garantia_aviso_dias: "Aviso de garantia",
  sinal_peso_avaliar: "Peso da manutenção (avaliar)",
  sinal_peso_trocar: "Peso da manutenção (trocar)",
  sinal_corretivas_avaliar: "Corretivas (avaliar)",
  sinal_corretivas_trocar: "Corretivas (trocar)",
  sinal_idade_avaliar_pct: "Idade (avaliar)",
  sinal_idade_trocar_pct: "Idade (trocar)",
  vistoria_locador: "Locador",
  vistoria_local: "Local",
  vistoria_ambientes: "Ambientes",
  portal_boas_vindas: "Boas-vindas",
  nome: "Nome",
  data: "Data",
  usuario_id: "Usuário",
  setor_id: "Setor",
  desligado_em: "Desligamento",
  vigente_desde: "Vale a partir de",
  valor_minuto: "Valor por minuto",
  vida_util_padrao_anos: "Vida útil",
  escopo: "Para quem",
  indicador: "Indicador",
  meta: "Meta",
  limite_atencao: "Limite de atenção",
};

/** Grava na linha única de parâmetros. */
async function gravarParametros(
  linha: AtualizarParametros,
): Promise<EstadoAcao> {
  const { data: alterada, error } = await (await os())
    .from("parametros")
    .update(linha)
    .eq("id", 1)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!alterada?.length) return NADA_ALTERADO;
  updateTag(TAG.os.parametros);
  refresh();
  return { ok: "Salvo." };
}

// ---------------------------------------------------------------------------
// Ciclo: aceite, avisos, dias úteis, expediente e feriados
// ---------------------------------------------------------------------------

const ciclo = z
  .object({
    aceite_dias_uteis: inteiro(0, 60),
    aviso_vencimento_horas: inteiro(1, 240),
    confirmacao_alerta_dias: inteiro(1, 60),
    dias_uteis: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, "marque ao menos um dia"),
    expediente_inicio: hora,
    expediente_fim: hora,
  })
  .refine((c) => c.expediente_inicio < c.expediente_fim, {
    message: "o fim vem depois do início",
    path: ["expediente_fim"],
  });

export async function salvarCiclo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros");
  if (acesso.erro) return acesso.erro;
  const d = ciclo.safeParse({
    ...Object.fromEntries(form),
    dias_uteis: valores(form, "dias_uteis"),
  });
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  return gravarParametros({
    ...d.data,
    dias_uteis: [...new Set(d.data.dias_uteis)].sort(),
  });
}

const feriado = z.object({ data, nome: texto(80, "informe o nome") });

export async function incluirFeriado(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros");
  if (acesso.erro) return acesso.erro;
  const d = feriado.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { error } = await (await os())
    .from("feriados")
    .upsert(d.data, { onConflict: "data" });
  if (error) return erroDoBanco(error);
  updateTag(TAG.os.feriados);
  refresh();
  return { ok: "Feriado incluído." };
}

export async function removerFeriado(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros");
  if (acesso.erro) return acesso.erro;
  const d = data.safeParse(form.get("data"));
  if (!d.success) return primeiroErro(d.error);
  const { data: removido, error } = await (await os())
    .from("feriados")
    .delete()
    .eq("data", d.data)
    .select("data");
  if (error) return erroDoBanco(error);
  if (!removido?.length) return NADA_ALTERADO;
  updateTag(TAG.os.feriados);
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Operações: almoço, terceirizado, causas de falha, técnicos e valor/minuto
// ---------------------------------------------------------------------------

const operacoes = z
  .object({
    almoco_inicio: hora,
    almoco_fim: hora,
    teto_terceirizado: decimalOpcional(0, 10_000_000),
    terceirizado_prazo_dias: inteiro(1, 90),
    causas_falha: json,
  })
  .refine((o) => o.almoco_inicio < o.almoco_fim, {
    message: "o fim vem depois do início",
    path: ["almoco_fim"],
  });

export async function salvarOperacoes(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros");
  if (acesso.erro) return acesso.erro;
  const d = operacoes.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  return gravarParametros({
    ...d.data,
    causas_falha: limparLista(d.data.causas_falha, 100),
  });
}

const tecnico = z.object({
  id: uuidOpcional,
  nome: texto(120, "informe o nome"),
  usuario_id: uuidOpcional,
  setor_id: uuidOpcional,
  desligado_em: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    data.nullable(),
  ),
});

export async function salvarTecnico(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros");
  if (acesso.erro) return acesso.erro;
  const d = tecnico.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { id, ...linha } = d.data;
  const banco = await os();
  if (id) {
    const { data: alterado, error } = await banco
      .from("tecnicos")
      .update(linha)
      .eq("id", id)
      .select("id");
    if (error) return erroDoBanco(error);
    if (!alterado?.length) return NADA_ALTERADO;
  } else {
    const { error } = await banco.from("tecnicos").insert(linha);
    if (error) return erroDoBanco(error);
  }
  refresh();
  return {
    ok: id
      ? "Técnico salvo."
      : "Técnico incluído. Agora informe o valor por minuto.",
  };
}

const vigencia = z.object({
  tecnico_id: z.uuid(),
  vigente_desde: data,
  valor_minuto: decimal(0, 10_000),
});

/**
 * Nova vigência do valor por minuto. Não muda nada do passado: cada sessão
 * de OS usa o valor vigente na data dela.
 */
export async function incluirVigencia(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros");
  if (acesso.erro) return acesso.erro;
  const d = vigencia.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { error } = await (await os()).from("tecnico_valores").insert({
    ...d.data,
    valor_minuto: Math.round(d.data.valor_minuto * 1_000_000) / 1_000_000,
  });
  if (error) {
    if (error.code === "23505")
      return {
        erro: "Já existe um valor que começa nessa data para este técnico.",
      };
    return erroDoBanco(error);
  }
  refresh();
  return { ok: "Novo valor incluído." };
}

const correcao = z.object({
  id: z.uuid(),
  valor_minuto: decimal(0, 10_000),
});

/**
 * Corrige um valor por minuto digitado errado (inclusive o que já vale). A
 * mudança fica no histórico (auditoria do cadastro) e as OS com sessões do
 * técnico no período desse valor são recalculadas.
 */
export async function corrigirVigencia(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigirAgora("os.parametros");
  if (acesso.erro) return acesso.erro;
  const d = correcao.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const valor = Math.round(d.data.valor_minuto * 1_000_000) / 1_000_000;
  const db = await os();
  const { data: v, error } = await db
    .from("tecnico_valores")
    .update({ valor_minuto: valor })
    .eq("id", d.data.id)
    .select("tecnico_id, vigente_desde")
    .maybeSingle();
  if (error) return erroDoBanco(error);
  if (!v) return { erro: "Valor não encontrado." };

  // Período do valor: da data dele até o próximo valor do técnico.
  const admin = osAdmin();
  const { data: proximo } = await admin
    .from("tecnico_valores")
    .select("vigente_desde")
    .eq("tecnico_id", v.tecnico_id)
    .gt("vigente_desde", v.vigente_desde)
    .order("vigente_desde")
    .limit(1)
    .maybeSingle();
  let q = admin
    .from("sessoes")
    .select("ordem_id, sessao_tecnicos!inner(tecnico_id)")
    .eq("sessao_tecnicos.tecnico_id", v.tecnico_id)
    .gte("data", v.vigente_desde);
  if (proximo) q = q.lt("data", proximo.vigente_desde);
  const { data: sessoes, error: e2 } = await q;
  if (e2) return erroDoBanco(e2);
  const ordens = [...new Set((sessoes ?? []).map((s) => s.ordem_id))];
  for (let i = 0; i < ordens.length; i += 10)
    await Promise.all(ordens.slice(i, i + 10).map((o) => recalcularOS(o)));
  refresh();
  return {
    ok: ordens.length
      ? `Valor corrigido. ${ordens.length} OS recalculada${ordens.length > 1 ? "s" : ""}.`
      : "Valor corrigido. Nenhuma OS no período.",
  };
}

/** Só some uma vigência que ainda não começou (nada foi calculado com ela). */
export async function removerVigencia(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros");
  if (acesso.erro) return acesso.erro;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return primeiroErro(id.error);
  const { data: removida, error } = await (await os())
    .from("tecnico_valores")
    .delete()
    .eq("id", id.data)
    .gt("vigente_desde", hojeEmBrasilia(new Date()))
    .select("id");
  if (error) return erroDoBanco(error);
  if (!removida?.length)
    return {
      erro: "Só dá para remover um valor que ainda não começou a valer.",
    };
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Ativos: categorias, faixas do sinal de troca e antecedências
// ---------------------------------------------------------------------------

const ativos = z
  .object({
    sinal_peso_avaliar: decimal(0, 1000),
    sinal_peso_trocar: decimal(0, 1000),
    sinal_corretivas_avaliar: inteiro(0, 1000),
    sinal_corretivas_trocar: inteiro(0, 1000),
    sinal_idade_avaliar_pct: decimal(0, 1000),
    sinal_idade_trocar_pct: decimal(0, 1000),
    preventiva_antecedencia_dias: inteiro(0, 90),
    recorrencia_antecedencia_dias: inteiro(0, 60),
    garantia_aviso_dias: inteiro(0, 365),
  })
  .refine((a) => a.sinal_peso_avaliar < a.sinal_peso_trocar, {
    message: 'o "avaliar" fica abaixo do "trocar"',
    path: ["sinal_peso_trocar"],
  })
  .refine((a) => a.sinal_corretivas_avaliar < a.sinal_corretivas_trocar, {
    message: 'o "avaliar" fica abaixo do "trocar"',
    path: ["sinal_corretivas_trocar"],
  })
  .refine((a) => a.sinal_idade_avaliar_pct < a.sinal_idade_trocar_pct, {
    message: 'o "avaliar" fica abaixo do "trocar"',
    path: ["sinal_idade_trocar_pct"],
  });

export async function salvarAtivos(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros");
  if (acesso.erro) return acesso.erro;
  const d = ativos.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  return gravarParametros(d.data);
}

const ativoCategoria = z.object({
  id: uuidOpcional,
  nome: texto(80, "informe o nome"),
  vida_util_padrao_anos: decimalOpcional(0.1, 200),
});

export async function salvarAtivoCategoria(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros", "os.ativos_gerenciar");
  if (acesso.erro) return acesso.erro;
  const d = ativoCategoria.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { id, ...linha } = d.data;
  const banco = await os();
  if (id) {
    const { data: alterada, error } = await banco
      .from("ativo_categorias")
      .update(linha)
      .eq("id", id)
      .select("id");
    if (error) return erroDoBanco(error);
    if (!alterada?.length) return NADA_ALTERADO;
  } else {
    const { error } = await banco.from("ativo_categorias").insert(linha);
    if (error) return erroDoBanco(error);
  }
  updateTag(TAG.os.ativoCategorias);
  refresh();
  return { ok: id ? "Categoria salva." : "Categoria incluída." };
}

export async function removerAtivoCategoria(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros", "os.ativos_gerenciar");
  if (acesso.erro) return acesso.erro;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return primeiroErro(id.error);
  const { data: removida, error } = await (await os())
    .from("ativo_categorias")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!removida?.length) return NADA_ALTERADO;
  updateTag(TAG.os.ativoCategorias);
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Vistorias e portal
// ---------------------------------------------------------------------------

const vistorias = z.object({
  vistoria_ambientes: json,
  vistoria_locador: texto(200, "informe o locador"),
  vistoria_local: texto(120, "informe o local"),
});

export async function salvarVistorias(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros");
  if (acesso.erro) return acesso.erro;
  const d = vistorias.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const ambientes = limparLista(d.data.vistoria_ambientes, 60);
  if (ambientes.length === 0) return { erro: "Ambientes: inclua ao menos um." };
  const textos: Record<string, { observacao: string; termo: string }> = {};
  for (const tipo of Object.keys(TIPOS_VISTORIA) as TipoVistoria[]) {
    const observacao = String(form.get(`observacao_${tipo}`) ?? "").trim();
    const termo = String(form.get(`termo_${tipo}`) ?? "").trim();
    if (!observacao || !termo)
      return {
        erro: `${TIPOS_VISTORIA[tipo]}: preencha a observação e o termo.`,
      };
    if (observacao.length > 5000 || termo.length > 5000)
      return { erro: `${TIPOS_VISTORIA[tipo]}: texto longo demais.` };
    textos[tipo] = { observacao, termo };
  }
  return gravarParametros({
    vistoria_ambientes: ambientes,
    vistoria_locador: d.data.vistoria_locador,
    vistoria_local: d.data.vistoria_local,
    vistoria_textos: textos as Json,
  });
}

export async function salvarPortal(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros");
  if (acesso.erro) return acesso.erro;
  const d = textoOpcional(1000).safeParse(form.get("portal_boas_vindas"));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  return gravarParametros({ portal_boas_vindas: d.data ?? "" });
}

// ---------------------------------------------------------------------------
// Metas dos painéis
// ---------------------------------------------------------------------------

/** "geral", "setor:<id>" ou "categoria:<id>". */
const escopo = z
  .string()
  .transform(
    (v, ctx): { setor_id: string | null; categoria_id: string | null } => {
      if (v === "geral") return { setor_id: null, categoria_id: null };
      const [nivel, id] = v.split(":");
      if (
        (nivel === "setor" || nivel === "categoria") &&
        z.uuid().safeParse(id).success
      )
        return nivel === "setor"
          ? { setor_id: id as string, categoria_id: null }
          : { setor_id: null, categoria_id: id as string };
      ctx.addIssue({ code: "custom", message: "escolha para quem vale" });
      return z.NEVER;
    },
  );

const meta = z.object({
  id: uuidOpcional,
  escopo,
  indicador: z.enum(
    Object.keys(INDICADORES_META) as [IndicadorMeta, ...IndicadorMeta[]],
    "escolha o indicador",
  ),
  meta: decimal(0, 100_000),
  limite_atencao: decimalOpcional(0, 100_000),
});

export async function salvarMeta(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros");
  if (acesso.erro) return acesso.erro;
  const d = meta.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const erro = erroDaMeta(d.data.indicador, d.data.meta, d.data.limite_atencao);
  if (erro) return { erro: `Meta: ${erro}.` };
  const linha = {
    ...d.data.escopo,
    indicador: d.data.indicador,
    meta: d.data.meta,
    limite_atencao: d.data.limite_atencao,
  };
  const banco = await os();
  if (d.data.id) {
    const { data: alterada, error } = await banco
      .from("metas")
      .update(linha)
      .eq("id", d.data.id)
      .select("id");
    if (error) return erroDoBanco(error);
    if (!alterada?.length) return NADA_ALTERADO;
  } else {
    const { error } = await banco.from("metas").insert(linha);
    if (error) {
      if (error.code === "23505")
        return {
          erro: "Já existe essa meta para esse setor ou categoria: edite a que está na lista.",
        };
      return erroDoBanco(error);
    }
  }
  updateTag(TAG.os.metas);
  refresh();
  return { ok: "Meta salva." };
}

export async function removerMeta(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros");
  if (acesso.erro) return acesso.erro;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return primeiroErro(id.error);
  const { data: removida, error } = await (await os())
    .from("metas")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!removida?.length) return NADA_ALTERADO;
  updateTag(TAG.os.metas);
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// WhatsApp: mensagens prontas
// ---------------------------------------------------------------------------

export async function salvarMensagens(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros");
  if (acesso.erro) return acesso.erro;
  const textos: Record<string, string> = {};
  for (const k of CHAVES_MENSAGEM) {
    const t = String(form.get(`msg_${k}`) ?? "");
    if (t.length > 4000)
      return { erro: "Mensagem longa demais (até 4.000 caracteres)." };
    textos[k] = t;
  }
  return gravarParametros({ mensagens: mensagensParaGravar(textos) as Json });
}

// ---------------------------------------------------------------------------
// Papel timbrado (fundo de todos os PDFs): vai ao bucket pela service role,
// então a permissão é conferida no banco (exigirAgora).
// ---------------------------------------------------------------------------

export async function enviarPapelTimbrado(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigirAgora("os.parametros");
  if (acesso.erro) return acesso.erro;
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { erro: "Escolha a imagem do papel timbrado." };
  if (arquivo.size > PAPEL_TIMBRADO_MAX_BYTES)
    return {
      erro: "Imagem grande demais: use até 4 MB (um JPG costuma ficar bem abaixo disso).",
    };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const imagem = dimensoesDaImagem(bytes);
  if (!imagem) return { erro: "Use uma imagem PNG ou JPG." };
  const erro = erroDoPapelTimbrado(imagem);
  if (erro) return { erro: `Papel timbrado: ${erro}.` };
  const caminho = CAMINHOS_PAPEL_TIMBRADO.find((c) =>
    c.endsWith(`.${imagem.formato}`),
  );
  if (!caminho) return { erro: "Use uma imagem PNG ou JPG." };
  try {
    // Um só arquivo por vez: o novo substitui o atual, de qualquer formato.
    await removerArquivos([...CAMINHOS_PAPEL_TIMBRADO]);
    await enviarArquivo(
      caminho,
      bytes,
      imagem.formato === "png" ? "image/png" : "image/jpeg",
    );
  } catch (e) {
    console.error("papel timbrado", e);
    return { erro: "Não foi possível guardar a imagem. Tente de novo." };
  }
  // O bucket não tem auditoria: a troca fica nos eventos do sistema.
  registrarDepois({
    modulo: "os",
    evento: "os_papel_timbrado",
    descricao: `Enviou o papel timbrado (${imagem.formato.toUpperCase()}, ${imagem.largura} × ${imagem.altura})`,
    usuarioId: acesso.ctx.usuario.id,
    detalhes: { arquivo: arquivo.name, caminho },
  });
  refresh();
  return { ok: "Papel timbrado atualizado. Os próximos PDFs já saem com ele." };
}

export async function removerPapelTimbrado(): Promise<EstadoAcao> {
  const acesso = await exigirAgora("os.parametros");
  if (acesso.erro) return acesso.erro;
  await removerArquivos([...CAMINHOS_PAPEL_TIMBRADO]);
  registrarDepois({
    modulo: "os",
    evento: "os_papel_timbrado",
    descricao: "Removeu o papel timbrado (PDFs voltam ao desenho padrão)",
    usuarioId: acesso.ctx.usuario.id,
  });
  refresh();
  return { ok: "Papel timbrado removido. Os PDFs voltam ao desenho padrão." };
}
