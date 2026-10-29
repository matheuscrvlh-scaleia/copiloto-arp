"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { formatarMes } from "@/lib/formato";
import {
  AREAS,
  avisoSemDados,
  CAMPOS,
  type CargaLida,
  type Celula,
  conferirFaixasReputacao,
  conferirLinhaDaCarga,
  decodificarTexto,
  ErroPlanilha,
  FORMAS_ACESSO,
  INTERESSES_LP,
  lerCsv,
  lerPlanilhaDeLocatarios,
  locatarioRepetido,
  marcarRepetidas,
  montarVoltar,
  NIVEIS,
  normalizarLink,
  numeroDigitado,
  planoDaCarga,
  REGRAS,
  TABELAS_MKT,
  type Voltar,
} from "@/lib/marketing/parametros";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { createClient } from "@/lib/supabase/server";
import { podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";
import {
  INDICADORES_MKT,
  type IndicadorMkt,
  mkt,
} from "@/server/marketing/base";
import { alteracaoMkt } from "@/server/marketing/parametros";

// Gravações de Marketing › Configurações (spec 4.12). Toda ação: Zod → confere
// marketing.parametros no banco (podeAgora) → grava com o cliente da sessão
// (o RLS confere de novo e core.auditoria registra quem, quando, antes e
// depois) → invalida a tag do cadastro → refresh() (o histórico é lido na
// requisição). As conferências da tela rodam de novo aqui: nada salva sem
// elas.

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para alterar os parâmetros do Marketing.",
};

function erroDoBanco(
  error: { message: string; code?: string },
  repetido = "Já existe outro registro com esse valor.",
): EstadoAcao {
  if (error.code === "23505") return { erro: repetido };
  if (error.code === "23514") return { erro: "Valor fora do permitido." };
  if (error.code === "42501") return SEM_PERMISSAO;
  console.error("parâmetros do marketing", error);
  return { erro: "Não foi possível salvar. Tente de novo." };
}

function primeiroErro(e: z.ZodError): EstadoAcao {
  const issue = e.issues[0];
  const campo = String(issue?.path[0] ?? "");
  return {
    erro: `${CAMPOS[campo] ?? (campo || "Campo")}: ${issue?.message ?? "inválido"}`,
  };
}

function salvo(...tags: string[]): EstadoAcao {
  for (const t of tags) updateTag(t);
  refresh();
  return { ok: "Salvo." };
}

// ---------------------------------------------------------------------------
// Campos (os mesmos do formulário e do "voltar" do histórico)
// ---------------------------------------------------------------------------

const vazioNulo = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;
const texto = (max: number, falta = "obrigatório") =>
  z
    .string({ message: falta })
    .trim()
    .min(1, falta)
    .max(max, `até ${max} letras`);
const textoOpcional = (max: number) =>
  z.preprocess(vazioNulo, z.string().trim().max(max).nullable().default(null));
const marcado = z.preprocess((v) => v === "on" || v === true, z.boolean());
const numero = z.preprocess(
  numeroDigitado,
  z.number({ message: "informe um número" }).finite(),
);
const numeroOpcional = z.preprocess(
  (v) => numeroDigitado(v) ?? null,
  z.number({ message: "informe um número" }).finite().nullable(),
);
const inteiro = (min: number, max: number) =>
  z.preprocess(
    numeroDigitado,
    z
      .number({ message: "informe um número" })
      .int("sem casas decimais")
      .min(min, `no mínimo ${min}`)
      .max(max, `no máximo ${max}`),
  );
const data = z.iso.date({ message: "data inválida" });
const dataOpcional = z.preprocess(vazioNulo, data.nullable().default(null));
const daLista = <T extends string>(lista: Record<T, string>, msg: string) =>
  z.enum(Object.keys(lista) as [T, ...T[]], { message: msg });

const locatarioCampos = z.object({
  nome: texto(120, "informe o nome"),
  categoria: texto(80, "informe a categoria"),
  perfil_url: z.preprocess(
    (v) => normalizarLink(typeof v === "string" ? v : null),
    z.string().max(1000).nullable(),
  ),
  forma_acesso: daLista(FORMAS_ACESSO, "escolha a forma de acesso"),
  ativo: marcado,
  entrada_em: data,
  saida_em: dataOpcional,
});
const landingPageCampos = z.object({
  nome: texto(200),
  interesse: z.preprocess(
    vazioNulo,
    daLista(INTERESSES_LP, "escolha o interesse").nullable(),
  ),
});
const metaCampos = z.object({
  meta: numero,
  limite_atencao: numeroOpcional,
});
const regraCampos = z.object({
  limite: numeroOpcional.refine(
    (v) => v === null || v >= 0,
    "não pode ser negativo",
  ),
  nivel: daLista(NIVEIS, "escolha o nível"),
  ativa: marcado,
});
const temaCampos = z.object({
  nome: texto(60, "informe o tema"),
  ativo: marcado,
  ordem: inteiro(0, 999),
});
const rondaCampos = z.object({
  descricao: texto(120, "informe a descrição"),
  area: daLista(AREAS, "escolha a área"),
});
const codigoRonda = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{1,5}$/, "de 1 a 5 letras ou números, sem espaço");
const estrelas = z
  .array(z.coerce.number().int().min(1).max(5))
  .min(1, "marque ao menos uma estrela")
  .transform((v) => [...new Set(v)].sort());
const reputacaoCampos = z.object({
  estrelas_reclamacao: estrelas,
  janela_reputacao_dias: inteiro(1, 365),
  reclamacoes_atencao: inteiro(1, 999),
  reclamacoes_alerta: inteiro(1, 999),
  nota_atencao: numero.refine((v) => v >= 1 && v <= 5, "entre 1 e 5"),
});
const asanaCampos = z.object({
  asana_projetos_marketing: z.array(z.string().trim().min(1).max(200)).max(30),
  asana_projeto_calendario: textoOpcional(200),
  asana_projeto_ronda: textoOpcional(200),
  asana_tag_locatario: textoOpcional(100),
  asana_tag_terceiro: textoOpcional(100),
  asana_tag_gratuita: textoOpcional(100),
  asana_tag_paga: textoOpcional(100),
  sinalizacao_antiga_dias: inteiro(1, 365),
});

const id = z.uuid({ message: "registro inválido" });

/** Saída da lista não pode ser antes da entrada (o banco também recusa). */
const datasEmOrdem = (l: { entrada_em: string; saida_em: string | null }) =>
  !l.saida_em || l.saida_em >= l.entrada_em;

/** Faixa de atenção depois da meta, no sentido do indicador. */
function atencaoDepoisDaMeta(
  indicador: string,
  meta: number,
  limite: number | null,
): boolean {
  if (limite === null) return true;
  const def = INDICADORES_MKT[indicador as IndicadorMkt];
  if (!def) return true;
  return def.direcao === "menor_melhor" ? limite >= meta : limite <= meta;
}

const ERRO_ATENCAO: EstadoAcao = {
  erro: "Limite de atenção: precisa ficar depois da meta (abaixo dela quando maior é melhor; acima quando menor é melhor).",
};

// ---------------------------------------------------------------------------
// Locatários monitorados
// ---------------------------------------------------------------------------

const locatarioForm = locatarioCampos.extend({
  id: z.preprocess(vazioNulo, id.nullable().default(null)),
});

export async function salvarLocatario(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const l = locatarioForm.safeParse(Object.fromEntries(form));
  if (!l.success) return primeiroErro(l.error);
  if (!datasEmOrdem(l.data))
    return { erro: "A saída da lista precisa ser depois da entrada." };
  if (!(await podeAgora("marketing.parametros"))) return SEM_PERMISSAO;
  const db = await mkt();
  const lista = await db.from("locatarios").select("id, nome");
  if (lista.error) return erroDoBanco(lista.error);
  const repetido = locatarioRepetido(l.data.nome, lista.data ?? [], l.data.id);
  const msgRepetido = `Locatário repetido: já existe “${repetido ?? l.data.nome}”.`;
  if (repetido) return { erro: msgRepetido };
  const { id: alvo, ...valores } = l.data;
  const { error } = alvo
    ? await db.from("locatarios").update(valores).eq("id", alvo)
    : await db.from("locatarios").insert(valores);
  if (error) return erroDoBanco(error, msgRepetido);
  salvo(TAG.marketing.locatarios);
  const aviso = avisoSemDados(valores);
  return { ok: aviso ? `Salvo, com aviso. ${aviso}` : "Salvo." };
}

export async function removerLocatario(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const alvo = id.safeParse(form.get("id"));
  if (!alvo.success) return primeiroErro(alvo.error);
  if (!(await podeAgora("marketing.parametros"))) return SEM_PERMISSAO;
  const { error } = await (await mkt())
    .from("locatarios")
    .delete()
    .eq("id", alvo.data);
  if (error) return erroDoBanco(error);
  salvo(TAG.marketing.locatarios);
  return { ok: "Removido. Dá para voltar pelo Histórico." };
}

// ---------------------------------------------------------------------------
// Carga inicial da planilha de locatários: prévia → confirmar
// ---------------------------------------------------------------------------

export interface EstadoCarga extends EstadoAcao {
  previa?: CargaLida & { arquivo: string };
}

const TAMANHO_MAXIMO = 5 * 1024 * 1024;

/** .xlsx é um zip: começa com "PK\x03\x04". */
const ehXlsx = (b: Uint8Array) =>
  b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

/** Lê a planilha (.xlsx ou .csv) e devolve a prévia. Nada é gravado. */
export async function lerCargaLocatarios(
  _: EstadoCarga,
  form: FormData,
): Promise<EstadoCarga> {
  if (!(await podeAgora("marketing.parametros"))) return SEM_PERMISSAO;
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { erro: "Escolha a planilha (.xlsx ou .csv)." };
  if (arquivo.size > TAMANHO_MAXIMO)
    return { erro: "O arquivo passa de 5 MB." };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  try {
    let linhas: Celula[][];
    if (ehXlsx(bytes)) {
      // Só quem carrega a planilha carrega o leitor de Excel.
      const { default: readXlsxFile } = await import("read-excel-file/node");
      const abas = (await readXlsxFile(Buffer.from(bytes))) as {
        data: Celula[][];
      }[];
      linhas = abas[0]?.data ?? [];
    } else if (/\.(csv|txt)$/i.test(arquivo.name)) {
      linhas = lerCsv(decodificarTexto(bytes));
    } else {
      return { erro: "O arquivo não é uma planilha .xlsx nem um .csv." };
    }
    const lida = lerPlanilhaDeLocatarios(linhas);
    if (!lida.linhas.length)
      return { erro: "A planilha não tem nenhuma linha de locatário." };
    return { previa: { ...lida, arquivo: arquivo.name.slice(0, 200) } };
  } catch (e) {
    if (e instanceof ErroPlanilha) return { erro: e.message };
    console.error("planilha de locatários", e);
    return { erro: "Não consegui ler a planilha. Confira o arquivo." };
  }
}

const linhaDaCarga = z.object({
  linha: z.number().int().min(1),
  nome: z.string().max(120),
  categoria: z.string().max(80),
  perfil_url: z.string().max(1000).nullable(),
  forma_acesso: daLista(FORMAS_ACESSO, "forma de acesso inválida"),
  entrada_em: data.nullable(),
});
const carga = z.object({
  linhas: z.preprocess((v) => {
    try {
      return JSON.parse(String(v));
    } catch {
      return null;
    }
  }, z.array(linhaDaCarga).min(1).max(500)),
  tirar_ausentes: marcado,
});

/**
 * Grava a carga confirmada na prévia (com as correções feitas nela). As
 * conferências rodam de novo aqui; linha com problema fica de fora.
 */
export async function confirmarCargaLocatarios(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const c = carga.safeParse(Object.fromEntries(form));
  if (!c.success) return { erro: "Prévia inválida. Leia a planilha de novo." };
  if (!(await podeAgora("marketing.parametros"))) return SEM_PERMISSAO;
  const linhas = marcarRepetidas(
    c.data.linhas.map((l) =>
      conferirLinhaDaCarga({ ...l, perfil_url: normalizarLink(l.perfil_url) }),
    ),
  );
  const db = await mkt();
  const existentes = await db
    .from("locatarios")
    .select("id, nome, ativo, entrada_em");
  if (existentes.error) return erroDoBanco(existentes.error);
  const plano = planoDaCarga(
    linhas,
    existentes.data ?? [],
    c.data.tirar_ausentes,
  );
  const hoje = hojeEmBrasilia(new Date());

  // atalho: sem transação (são ~20 linhas); se uma falhar, as anteriores
  // ficam gravadas e a mensagem diz quantas. Repetir a carga só atualiza.
  let feitos = 0;
  const parar = (error: { message: string; code?: string }) => {
    if (feitos) {
      updateTag(TAG.marketing.locatarios);
      refresh();
    }
    const e = erroDoBanco(
      error,
      "Locatário repetido na planilha ou no cadastro.",
    );
    return { erro: `${e.erro} ${feitos} linha(s) gravada(s) antes do erro.` };
  };
  if (plano.incluir.length) {
    const { error } = await db.from("locatarios").insert(
      plano.incluir.map((l) => ({
        ...l,
        entrada_em: l.entrada_em ?? hoje,
        ativo: true,
      })),
    );
    if (error) return parar(error);
    feitos += plano.incluir.length;
  }
  for (const { id: alvo, ...l } of plano.atualizar) {
    const { error } = await db
      .from("locatarios")
      .update({ ...l, ativo: true, saida_em: null })
      .eq("id", alvo);
    if (error) return parar(error);
    feitos++;
  }
  const entradas = new Map(
    (existentes.data ?? []).map((e) => [e.id, e.entrada_em]),
  );
  for (const t of plano.tirar) {
    const entrada = entradas.get(t.id) ?? hoje;
    const { error } = await db
      .from("locatarios")
      .update({ ativo: false, saida_em: entrada > hoje ? entrada : hoje })
      .eq("id", t.id);
    if (error) return parar(error);
    feitos++;
  }
  salvo(TAG.marketing.locatarios);
  const partes = [
    `${plano.incluir.length} incluído(s)`,
    `${plano.atualizar.length} atualizado(s)`,
    plano.tirar.length ? `${plano.tirar.length} fora da lista` : "",
    plano.deFora ? `${plano.deFora} linha(s) com problema ficaram de fora` : "",
  ].filter(Boolean);
  return { ok: `Carga feita: ${partes.join(", ")}.` };
}

// ---------------------------------------------------------------------------
// Landing pages
// ---------------------------------------------------------------------------

const landingPageForm = landingPageCampos.extend({
  identificador: texto(200),
  interesse: daLista(INTERESSES_LP, "escolha o interesse"),
});

export async function salvarLandingPage(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const lp = landingPageForm.safeParse(Object.fromEntries(form));
  if (!lp.success) return primeiroErro(lp.error);
  if (!(await podeAgora("marketing.parametros"))) return SEM_PERMISSAO;
  const { error } = await (await mkt())
    .from("landing_pages")
    .upsert(lp.data, { onConflict: "identificador" });
  if (error) return erroDoBanco(error);
  return salvo(TAG.marketing.landingPages);
}

// ---------------------------------------------------------------------------
// Metas mensais (core.metas, indicador marketing.*)
// ---------------------------------------------------------------------------

const indicadores = Object.keys(INDICADORES_MKT) as [
  IndicadorMkt,
  ...IndicadorMkt[],
];

const novaMeta = metaCampos.extend({
  indicador: z.enum(indicadores, { message: "escolha o indicador" }),
  mes: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "escolha o mês")
    .transform((m) => `${m}-01`),
});

const core = async () => (await createClient()).schema("core");

export async function incluirMeta(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const m = novaMeta.safeParse(Object.fromEntries(form));
  if (!m.success) return primeiroErro(m.error);
  const { indicador, mes, meta, limite_atencao } = m.data;
  if (!atencaoDepoisDaMeta(indicador, meta, limite_atencao))
    return ERRO_ATENCAO;
  if (!(await podeAgora("marketing.parametros"))) return SEM_PERMISSAO;
  const def = INDICADORES_MKT[indicador];
  const { error } = await (await core()).from("metas").insert({
    indicador,
    direcao: def.direcao,
    meta,
    limite_atencao,
    vigente_desde: mes,
  });
  if (error)
    return erroDoBanco(
      error,
      `Meta repetida: já existe meta de “${def.nome}” a partir de ${formatarMes(mes)}. Altere a linha dela na lista.`,
    );
  return salvo(TAG.marketing.metas);
}

/** Meta do Marketing pelo id (com a sessão), para conferir a direção. */
async function metaDoMarketing(alvo: string) {
  const { data } = await (await core())
    .from("metas")
    .select("id, indicador")
    .eq("id", alvo)
    .like("indicador", "marketing.%")
    .maybeSingle();
  return data;
}

export async function alterarMeta(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const m = metaCampos.extend({ id }).safeParse(Object.fromEntries(form));
  if (!m.success) return primeiroErro(m.error);
  if (!(await podeAgora("marketing.parametros"))) return SEM_PERMISSAO;
  const atual = await metaDoMarketing(m.data.id);
  if (!atual) return { erro: "Meta não encontrada." };
  if (!atencaoDepoisDaMeta(atual.indicador, m.data.meta, m.data.limite_atencao))
    return ERRO_ATENCAO;
  const { error } = await (await core())
    .from("metas")
    .update({ meta: m.data.meta, limite_atencao: m.data.limite_atencao })
    .eq("id", atual.id);
  if (error) return erroDoBanco(error);
  return salvo(TAG.marketing.metas);
}

export async function removerMeta(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const alvo = id.safeParse(form.get("id"));
  if (!alvo.success) return primeiroErro(alvo.error);
  if (!(await podeAgora("marketing.parametros"))) return SEM_PERMISSAO;
  const { error } = await (await core())
    .from("metas")
    .delete()
    .eq("id", alvo.data)
    .like("indicador", "marketing.%");
  if (error) return erroDoBanco(error);
  salvo(TAG.marketing.metas);
  return { ok: "Removida. Dá para voltar pelo Histórico." };
}

// ---------------------------------------------------------------------------
// Regras de alerta
// ---------------------------------------------------------------------------

const regras = Object.keys(REGRAS) as [
  keyof typeof REGRAS,
  ...(keyof typeof REGRAS)[],
];

export async function salvarRegra(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const r = regraCampos
    .extend({ regra: z.enum(regras, { message: "regra inválida" }) })
    .safeParse(Object.fromEntries(form));
  if (!r.success) return primeiroErro(r.error);
  const { regra, ...valores } = r.data;
  // Só as regras que contam algo têm limite; nas outras ele fica vazio.
  const usaLimite = REGRAS[regra].limite !== null;
  if (usaLimite && valores.limite === null)
    return { erro: "Limite: informe o número desta regra." };
  if (!(await podeAgora("marketing.parametros"))) return SEM_PERMISSAO;
  const { error } = await (await mkt())
    .from("regras_alerta")
    .update({ ...valores, limite: usaLimite ? valores.limite : null })
    .eq("regra", regra);
  if (error) return erroDoBanco(error);
  return salvo(TAG.marketing.regras);
}

// ---------------------------------------------------------------------------
// Linha única de parâmetros: reputação e Asana
// ---------------------------------------------------------------------------

async function gravarParametros(
  valores: Partial<z.infer<typeof reputacaoCampos>> &
    Partial<z.infer<typeof asanaCampos>>,
): Promise<EstadoAcao> {
  if (!(await podeAgora("marketing.parametros"))) return SEM_PERMISSAO;
  const { error } = await (await mkt())
    .from("parametros")
    .update(valores)
    .eq("id", true);
  if (error) return erroDoBanco(error);
  return salvo(TAG.marketing.parametros);
}

export async function salvarReputacao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const r = reputacaoCampos.safeParse({
    ...Object.fromEntries(form),
    estrelas_reclamacao: form.getAll("estrelas_reclamacao"),
  });
  if (!r.success) return primeiroErro(r.error);
  const faixa = conferirFaixasReputacao(
    r.data.reclamacoes_atencao,
    r.data.reclamacoes_alerta,
  );
  if (faixa) return { erro: faixa };
  return gravarParametros(r.data);
}

export async function salvarAsana(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const projetos = String(form.get("asana_projetos_marketing") ?? "")
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const a = asanaCampos.safeParse({
    ...Object.fromEntries(form),
    asana_projetos_marketing: [...new Set(projetos)],
  });
  if (!a.success) return primeiroErro(a.error);
  return gravarParametros(a.data);
}

// ---------------------------------------------------------------------------
// Temas da reputação
// ---------------------------------------------------------------------------

export async function salvarTema(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const t = temaCampos
    .extend({ id: z.preprocess(vazioNulo, id.nullable().default(null)) })
    .safeParse(Object.fromEntries(form));
  if (!t.success) return primeiroErro(t.error);
  if (!(await podeAgora("marketing.parametros"))) return SEM_PERMISSAO;
  const { id: alvo, ...valores } = t.data;
  const db = await mkt();
  const { error } = alvo
    ? await db.from("temas").update(valores).eq("id", alvo)
    : await db.from("temas").insert(valores);
  if (error)
    return erroDoBanco(error, `Tema repetido: já existe “${valores.nome}”.`);
  return salvo(TAG.marketing.parametros);
}

// ---------------------------------------------------------------------------
// Códigos da ronda de ambiência
// ---------------------------------------------------------------------------

export async function salvarCodigoRonda(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const r = rondaCampos
    .extend({ codigo: codigoRonda, novo: marcado })
    .safeParse(Object.fromEntries(form));
  if (!r.success) return primeiroErro(r.error);
  if (!(await podeAgora("marketing.parametros"))) return SEM_PERMISSAO;
  const { codigo, novo, ...valores } = r.data;
  const db = await mkt();
  const { error } = novo
    ? await db.from("ronda_codigos").insert({ codigo, ...valores })
    : await db.from("ronda_codigos").update(valores).eq("codigo", codigo);
  if (error)
    return erroDoBanco(
      error,
      `Código da ronda repetido: o código “${codigo}” já existe.`,
    );
  return salvo(TAG.marketing.parametros);
}

export async function removerCodigoRonda(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const c = codigoRonda.safeParse(form.get("codigo"));
  if (!c.success) return primeiroErro(c.error);
  if (!(await podeAgora("marketing.parametros"))) return SEM_PERMISSAO;
  const { error } = await (await mkt())
    .from("ronda_codigos")
    .delete()
    .eq("codigo", c.data);
  if (error) return erroDoBanco(error);
  salvo(TAG.marketing.parametros);
  return { ok: "Removido. Dá para voltar pelo Histórico." };
}

// ---------------------------------------------------------------------------
// Histórico: voltar uma alteração
// ---------------------------------------------------------------------------

/** Tag do cache de cada tabela das Configurações. */
const TAG_DA_TABELA: Record<string, string> = {
  "marketing.locatarios": TAG.marketing.locatarios,
  "marketing.landing_pages": TAG.marketing.landingPages,
  "core.metas": TAG.marketing.metas,
  "marketing.regras_alerta": TAG.marketing.regras,
  "marketing.temas": TAG.marketing.parametros,
  "marketing.ronda_codigos": TAG.marketing.parametros,
  "marketing.parametros": TAG.marketing.parametros,
};

const parametrosCampos = reputacaoCampos.extend(asanaCampos.shape);

/** Os valores do "antes" passam pelas mesmas regras dos formulários. */
function validar<T extends z.ZodObject>(
  schema: T,
  v: Exclude<Voltar, { tipo: "impossivel" | "apagar" }>,
): { success: true; data: Partial<z.output<T>> } | { success: false } {
  const r =
    v.tipo === "alterar"
      ? schema.partial().safeParse(v.valores)
      : schema.safeParse(v.valores);
  if (!r.success) return { success: false };
  // Só as colunas que voltam: campo ausente não vira padrão (falso, nulo).
  const data = Object.fromEntries(
    Object.entries(r.data as object).filter(([k]) => k in v.valores),
  ) as Partial<z.output<T>>;
  return { success: true, data };
}

async function aplicarVoltar(
  v: Exclude<Voltar, { tipo: "impossivel" }>,
): Promise<EstadoAcao | null> {
  const db = await mkt();
  const c = await core();
  if (v.tipo === "apagar") {
    const valor = String(v.chave.valor);
    const r =
      v.tabela === "core.metas"
        ? await c
            .from("metas")
            .delete()
            .eq("id", valor)
            .like("indicador", "marketing.%")
        : v.tabela === "marketing.locatarios"
          ? await db.from("locatarios").delete().eq("id", valor)
          : v.tabela === "marketing.landing_pages"
            ? await db.from("landing_pages").delete().eq("identificador", valor)
            : v.tabela === "marketing.temas"
              ? await db.from("temas").delete().eq("id", valor)
              : await db.from("ronda_codigos").delete().eq("codigo", valor);
    return r.error ? erroDoBanco(r.error) : null;
  }
  const chave = v.tipo === "alterar" ? String(v.chave.valor) : "";
  const invalido = {
    erro: "Os valores de antes não passam nas conferências de hoje.",
  };
  switch (v.tabela) {
    case "marketing.locatarios": {
      const p = validar(locatarioCampos, v);
      if (!p.success) return invalido;
      if (v.tipo === "incluir") {
        const novo = locatarioCampos.extend({ id }).safeParse(v.valores);
        if (!novo.success || !datasEmOrdem(novo.data)) return invalido;
        const r = await db.from("locatarios").insert(novo.data);
        return r.error
          ? erroDoBanco(
              r.error,
              "Locatário repetido: já existe outro com esse nome.",
            )
          : null;
      }
      const r = await db.from("locatarios").update(p.data).eq("id", chave);
      return r.error
        ? erroDoBanco(
            r.error,
            "Locatário repetido: já existe outro com esse nome.",
          )
        : null;
    }
    case "marketing.landing_pages": {
      const p = validar(landingPageCampos, v);
      if (!p.success) return invalido;
      const r =
        v.tipo === "incluir"
          ? await db.from("landing_pages").insert({
              ...landingPageCampos.parse(v.valores),
              identificador: String(v.valores.identificador),
            })
          : await db
              .from("landing_pages")
              .update(p.data)
              .eq("identificador", chave);
      return r.error ? erroDoBanco(r.error) : null;
    }
    case "core.metas": {
      const p = validar(metaCampos, v);
      if (!p.success) return invalido;
      if (v.tipo === "incluir") {
        const nova = metaCampos
          .extend({
            id,
            indicador: z.enum(indicadores),
            direcao: z.enum(["maior_melhor", "menor_melhor"]),
            vigente_desde: data,
          })
          .safeParse(v.valores);
        if (!nova.success) return invalido;
        const r = await c.from("metas").insert(nova.data);
        return r.error
          ? erroDoBanco(r.error, "Já existe meta desse indicador nesse mês.")
          : null;
      }
      const r = await c
        .from("metas")
        .update(p.data)
        .eq("id", chave)
        .like("indicador", "marketing.%");
      return r.error ? erroDoBanco(r.error) : null;
    }
    case "marketing.regras_alerta": {
      const p = validar(regraCampos, v);
      if (!p.success || v.tipo !== "alterar") return invalido;
      const r = await db
        .from("regras_alerta")
        .update(p.data)
        .eq("regra", chave);
      return r.error ? erroDoBanco(r.error) : null;
    }
    case "marketing.temas": {
      const p = validar(temaCampos, v);
      if (!p.success) return invalido;
      const r =
        v.tipo === "incluir"
          ? await db.from("temas").insert({
              ...temaCampos.parse(v.valores),
              id: id.parse(v.valores.id),
            })
          : await db.from("temas").update(p.data).eq("id", chave);
      return r.error ? erroDoBanco(r.error, "Tema repetido.") : null;
    }
    case "marketing.ronda_codigos": {
      const p = validar(rondaCampos, v);
      if (!p.success) return invalido;
      const r =
        v.tipo === "incluir"
          ? await db.from("ronda_codigos").insert({
              ...rondaCampos.parse(v.valores),
              codigo: codigoRonda.parse(v.valores.codigo),
            })
          : await db.from("ronda_codigos").update(p.data).eq("codigo", chave);
      return r.error ? erroDoBanco(r.error, "Código da ronda repetido.") : null;
    }
    case "marketing.parametros": {
      const p = validar(parametrosCampos, v);
      if (!p.success || v.tipo !== "alterar") return invalido;
      const r = await db.from("parametros").update(p.data).eq("id", true);
      return r.error ? erroDoBanco(r.error) : null;
    }
  }
  return { erro: "Esta alteração não pode ser desfeita aqui." };
}

/**
 * "Voltar" de uma linha do histórico. Só o id vem do navegador: a alteração
 * é relida com a sessão (RLS) e o que voltar sai de montarVoltar. A volta
 * também cai no histórico.
 */
export async function voltarAlteracao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const alvo = z.coerce.number().int().positive().safeParse(form.get("id"));
  if (!alvo.success) return { erro: "Alteração inválida." };
  if (!(await podeAgora("marketing.parametros"))) return SEM_PERMISSAO;
  const linha = await alteracaoMkt(alvo.data);
  if (!linha || !TABELAS_MKT[linha.tabela])
    return { erro: "Alteração não encontrada." };
  const v = montarVoltar(linha);
  if (v.tipo === "impossivel") return { erro: v.motivo };
  try {
    const erro = await aplicarVoltar(v);
    if (erro) return erro;
  } catch (e) {
    if (e instanceof z.ZodError)
      return {
        erro: "Os valores de antes não passam nas conferências de hoje.",
      };
    throw e;
  }
  const tag = TAG_DA_TABELA[linha.tabela];
  if (tag) updateTag(tag);
  refresh();
  return { ok: "Alteração desfeita. A volta também ficou no histórico." };
}
