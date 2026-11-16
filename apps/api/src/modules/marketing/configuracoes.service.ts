import { formatarMes } from "@arp/shared/formato";
import {
  INDICADORES_MKT,
  type IndicadorMkt,
} from "@arp/shared/marketing/contratos/base";
import type {
  Formulario,
  RespostaPreviaCarga,
} from "@arp/shared/marketing/contratos/configuracoes";
import {
  AREAS,
  avisoSemDados,
  CAMPOS,
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
} from "@arp/shared/marketing/parametros";
import {
  CHAVES_QUADROS,
  ocultosDoFormulario,
} from "@arp/shared/marketing/visualizacao";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import { z } from "zod";
import { type Contexto, exigir } from "@/contexto";
import {
  ErroDaApi,
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
} from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import * as repo from "./configuracoes.repository";
import { alteracaoMkt } from "./historico.service";

// Gravações de Marketing › Configurações (spec 4.12). Toda ação: valida o
// formulário → confere marketing.parametros no banco → grava em nome de quem
// pediu (o RLS confere de novo e core.auditoria registra quem, quando, antes
// e depois). As conferências da tela rodam de novo aqui: nada salva sem
// elas. Mesmas mensagens do sistema antigo.

const SEM_PERMISSAO =
  "Você não tem permissão para alterar os parâmetros do Marketing.";

async function exigirParametros(ctx: Contexto): Promise<void> {
  try {
    await exigir(ctx, "marketing.parametros");
  } catch (e) {
    if (e instanceof ErroDePermissao) throw new ErroDePermissao(SEM_PERMISSAO);
    throw e;
  }
}

/** Grava com a sessão; o erro do banco vira a mensagem do antigo. */
async function gravar<T>(
  ctx: Contexto,
  fn: (tx: Tx) => Promise<T>,
  repetido = "Já existe outro registro com esse valor.",
): Promise<T> {
  try {
    return await banco.comoUsuario(ctx.usuario.id, fn);
  } catch (e) {
    if (e instanceof ErroDeConflito) throw new ErroDeConflito(repetido);
    if (e instanceof ErroDePermissao) throw new ErroDePermissao(SEM_PERMISSAO);
    if (e instanceof ErroDaApi) throw e;
    log.error({ err: e }, "parâmetros do marketing");
    throw new ErroDeNegocio("Não foi possível salvar. Tente de novo.");
  }
}

/** "Nome: informe o nome" (o rótulo da tela e a mensagem do campo). */
function validar<T>(schema: z.ZodType<T>, dados: unknown): T {
  const r = schema.safeParse(dados);
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const campo = String(issue?.path[0] ?? "");
  throw new ErroDeNegocio(
    `${CAMPOS[campo] ?? (campo || "Campo")}: ${issue?.message ?? "inválido"}`,
  );
}

/** O formulário como o `Object.fromEntries(form)` do antigo (o último valor). */
const plano = (form: Formulario): Record<string, string> =>
  Object.fromEntries(
    Object.entries(form).map(([k, v]) => [
      k,
      Array.isArray(v) ? (v[v.length - 1] ?? "") : v,
    ]),
  );
const lista = (form: Formulario, chave: string): string[] => {
  const v = form[chave];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
};

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
const visualizacaoCampos = z.object({
  quadros_ocultos: z.array(z.string().max(80)).max(200),
});
const termosCampos = z.object({
  termos_marca: z
    .array(z.string().trim().min(2, "cada termo com 2 letras ou mais").max(60))
    .min(1, "informe ao menos um termo")
    .max(20, "até 20 termos"),
});
const referenciaCampos = z.object({
  nome: texto(80, "informe o nome"),
  cidade: textoOpcional(80),
  instagram: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(/^@/, "") : v),
    z.preprocess(
      vazioNulo,
      z
        .string()
        .regex(
          /^[A-Za-z0-9._]{1,30}$/,
          "só o usuário, sem espaço (ex.: espacoarp)",
        )
        .nullable()
        .default(null),
    ),
  ),
  site: z.preprocess(
    vazioNulo,
    z
      .string()
      .trim()
      .max(200)
      .transform((v) => normalizarLink(v) ?? "")
      .refine((v) => /^https?:\/\/\S+$/i.test(v), "link do site inválido")
      .nullable()
      .default(null),
  ),
  ativo: marcado,
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
const idOpcional = z.preprocess(vazioNulo, id.nullable().default(null));

/** Saída da lista não pode ser antes da entrada (o banco também recusa). */
const datasEmOrdem = (l: { entrada_em: string; saida_em: string | null }) =>
  !l.saida_em || l.saida_em >= l.entrada_em;

const ehIndicador = (i: string): i is IndicadorMkt => i in INDICADORES_MKT;

/** Faixa de atenção depois da meta, no sentido do indicador. */
function atencaoDepoisDaMeta(
  indicador: string,
  meta: number,
  limite: number | null,
): boolean {
  if (limite === null || !ehIndicador(indicador)) return true;
  const def = INDICADORES_MKT[indicador];
  return def.direcao === "menor_melhor" ? limite >= meta : limite <= meta;
}

const ERRO_ATENCAO =
  "Limite de atenção: precisa ficar depois da meta (abaixo dela quando maior é melhor; acima quando menor é melhor).";

// ---------------------------------------------------------------------------
// Locatários monitorados
// ---------------------------------------------------------------------------

export async function salvarLocatario(
  ctx: Contexto,
  form: Formulario,
): Promise<string> {
  const l = validar(locatarioCampos.extend({ id: idOpcional }), plano(form));
  if (!datasEmOrdem(l))
    throw new ErroDeNegocio("A saída da lista precisa ser depois da entrada.");
  await exigirParametros(ctx);
  const { id: alvo, ...valores } = l;
  const msgRepetido = (nome: string) =>
    `Locatário repetido: já existe “${nome}”.`;
  await gravar(
    ctx,
    async (tx) => {
      const repetido = locatarioRepetido(
        l.nome,
        await repo.nomesDosLocatarios(tx),
        alvo,
      );
      if (repetido) throw new ErroDeNegocio(msgRepetido(repetido));
      if (alvo) await repo.alterarLocatario(tx, alvo, valores);
      else await repo.incluirLocatarios(tx, [valores]);
    },
    msgRepetido(l.nome),
  );
  const aviso = avisoSemDados(valores);
  return aviso ? `Salvo, com aviso. ${aviso}` : "Salvo.";
}

export async function removerLocatario(
  ctx: Contexto,
  alvo: string,
): Promise<string> {
  validar(id, alvo);
  await exigirParametros(ctx);
  await gravar(ctx, (tx) => repo.removerLocatario(tx, alvo));
  return "Removido. Dá para voltar pelo Histórico.";
}

// ---------------------------------------------------------------------------
// Carga inicial da planilha de locatários: prévia → confirmar
// ---------------------------------------------------------------------------

export const TAMANHO_MAXIMO_CARGA = 5 * 1024 * 1024;

/** Célula do Excel no formato das regras da carga. */
const celula = (c: unknown): Celula =>
  c instanceof Date ||
  typeof c === "string" ||
  typeof c === "number" ||
  typeof c === "boolean"
    ? c
    : null;

/** .xlsx é um zip: começa com "PK\x03\x04". */
const ehXlsx = (b: Uint8Array) =>
  b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

/** Lê a planilha (.xlsx ou .csv) e devolve a prévia. Nada é gravado. */
export async function lerCargaLocatarios(
  ctx: Contexto,
  arquivo: { nome: string; bytes: Uint8Array } | undefined,
): Promise<RespostaPreviaCarga> {
  await exigirParametros(ctx);
  if (!arquivo || arquivo.bytes.length === 0)
    throw new ErroDeNegocio("Escolha a planilha (.xlsx ou .csv).");
  if (arquivo.bytes.length > TAMANHO_MAXIMO_CARGA)
    throw new ErroDeNegocio("O arquivo passa de 5 MB.");
  const { bytes } = arquivo;
  try {
    let linhas: Celula[][];
    if (ehXlsx(bytes)) {
      // Só quem carrega a planilha carrega o leitor de Excel.
      const { default: readXlsxFile } = await import("read-excel-file/node");
      const abas = await readXlsxFile(Buffer.from(bytes));
      linhas = (abas[0]?.data ?? []).map((l) => l.map(celula));
    } else if (/\.(csv|txt)$/i.test(arquivo.nome)) {
      linhas = lerCsv(decodificarTexto(bytes));
    } else {
      throw new ErroDeNegocio(
        "O arquivo não é uma planilha .xlsx nem um .csv.",
      );
    }
    const lida = lerPlanilhaDeLocatarios(linhas);
    if (!lida.linhas.length)
      throw new ErroDeNegocio("A planilha não tem nenhuma linha de locatário.");
    return { previa: { ...lida, arquivo: arquivo.nome.slice(0, 200) } };
  } catch (e) {
    if (e instanceof ErroDaApi) throw e;
    if (e instanceof ErroPlanilha) throw new ErroDeNegocio(e.message);
    log.error({ err: e }, "planilha de locatários");
    throw new ErroDeNegocio("Não consegui ler a planilha. Confira o arquivo.");
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
 * conferências rodam de novo aqui; linha com problema fica de fora. Uma
 * transação só: ou entra tudo, ou nada.
 */
export async function confirmarCargaLocatarios(
  ctx: Contexto,
  form: Formulario,
): Promise<string> {
  const c = carga.safeParse(plano(form));
  if (!c.success)
    throw new ErroDeNegocio("Prévia inválida. Leia a planilha de novo.");
  await exigirParametros(ctx);
  const linhas = marcarRepetidas(
    c.data.linhas.map((l) =>
      conferirLinhaDaCarga({ ...l, perfil_url: normalizarLink(l.perfil_url) }),
    ),
  );
  const hoje = hojeEmBrasilia(new Date());
  const plano_ = await gravar(
    ctx,
    async (tx) => {
      const existentes = await repo.locatariosDaCarga(tx);
      const p = planoDaCarga(linhas, existentes, c.data.tirar_ausentes);
      if (p.incluir.length)
        await repo.incluirLocatarios(
          tx,
          p.incluir.map((l) => ({
            ...l,
            entrada_em: l.entrada_em ?? hoje,
            ativo: true,
          })),
        );
      for (const { id: alvo, ...l } of p.atualizar)
        await repo.alterarLocatario(tx, alvo, {
          ...l,
          ativo: true,
          saida_em: null,
        });
      const entradas = new Map(existentes.map((e) => [e.id, e.entrada_em]));
      for (const t of p.tirar) {
        const entrada = entradas.get(t.id) ?? hoje;
        await repo.alterarLocatario(tx, t.id, {
          ativo: false,
          saida_em: entrada > hoje ? entrada : hoje,
        });
      }
      return p;
    },
    "Locatário repetido na planilha ou no cadastro.",
  );
  const partes = [
    `${plano_.incluir.length} incluído(s)`,
    `${plano_.atualizar.length} atualizado(s)`,
    plano_.tirar.length ? `${plano_.tirar.length} fora da lista` : "",
    plano_.deFora
      ? `${plano_.deFora} linha(s) com problema ficaram de fora`
      : "",
  ].filter(Boolean);
  return `Carga feita: ${partes.join(", ")}.`;
}

// ---------------------------------------------------------------------------
// Landing pages
// ---------------------------------------------------------------------------

export async function salvarLandingPage(
  ctx: Contexto,
  form: Formulario,
): Promise<void> {
  const lp = validar(
    landingPageCampos.extend({
      identificador: texto(200),
      interesse: daLista(INTERESSES_LP, "escolha o interesse"),
    }),
    plano(form),
  );
  await exigirParametros(ctx);
  await gravar(ctx, (tx) => repo.gravarLandingPage(tx, lp));
}

// ---------------------------------------------------------------------------
// Metas mensais (core.metas, indicador marketing.*)
// ---------------------------------------------------------------------------

const indicadores = Object.keys(INDICADORES_MKT) as [
  IndicadorMkt,
  ...IndicadorMkt[],
];

export async function incluirMeta(
  ctx: Contexto,
  form: Formulario,
): Promise<void> {
  const m = validar(
    metaCampos.extend({
      indicador: z.enum(indicadores, { message: "escolha o indicador" }),
      mes: z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "escolha o mês")
        .transform((m) => `${m}-01`),
    }),
    plano(form),
  );
  const { indicador, mes, meta, limite_atencao } = m;
  if (!atencaoDepoisDaMeta(indicador, meta, limite_atencao))
    throw new ErroDeNegocio(ERRO_ATENCAO);
  await exigirParametros(ctx);
  const def = INDICADORES_MKT[indicador];
  await gravar(
    ctx,
    (tx) =>
      repo.incluirMeta(tx, {
        indicador,
        direcao: def.direcao,
        meta,
        limite_atencao,
        vigente_desde: mes,
      }),
    `Meta repetida: já existe meta de “${def.nome}” a partir de ${formatarMes(mes)}. Altere a linha dela na lista.`,
  );
}

export async function alterarMeta(
  ctx: Contexto,
  alvo: string,
  form: Formulario,
): Promise<void> {
  validar(id, alvo);
  const m = validar(metaCampos, plano(form));
  await exigirParametros(ctx);
  await gravar(ctx, async (tx) => {
    const atual = await repo.metaDoMarketing(tx, alvo);
    if (!atual) throw new ErroDeNegocio("Meta não encontrada.");
    if (!atencaoDepoisDaMeta(atual.indicador, m.meta, m.limite_atencao))
      throw new ErroDeNegocio(ERRO_ATENCAO);
    await repo.alterarMeta(tx, atual.id, m);
  });
}

export async function removerMeta(
  ctx: Contexto,
  alvo: string,
): Promise<string> {
  validar(id, alvo);
  await exigirParametros(ctx);
  await gravar(ctx, (tx) => repo.removerMeta(tx, alvo));
  return "Removida. Dá para voltar pelo Histórico.";
}

// ---------------------------------------------------------------------------
// Regras de alerta
// ---------------------------------------------------------------------------

const regras = Object.keys(REGRAS) as [
  keyof typeof REGRAS,
  ...(keyof typeof REGRAS)[],
];

export async function salvarRegra(
  ctx: Contexto,
  form: Formulario,
): Promise<void> {
  const { regra, ...valores } = validar(
    regraCampos.extend({
      regra: z.enum(regras, { message: "regra inválida" }),
    }),
    plano(form),
  );
  // Só as regras que contam algo têm limite; nas outras ele fica vazio.
  const usaLimite = REGRAS[regra].limite !== null;
  if (usaLimite && valores.limite === null)
    throw new ErroDeNegocio("Limite: informe o número desta regra.");
  await exigirParametros(ctx);
  await gravar(ctx, (tx) =>
    repo.alterarRegra(tx, regra, {
      ...valores,
      limite: usaLimite ? valores.limite : null,
    }),
  );
}

// ---------------------------------------------------------------------------
// Linha única de parâmetros: reputação, Asana, visualização e termos
// ---------------------------------------------------------------------------

export async function salvarReputacao(
  ctx: Contexto,
  form: Formulario,
): Promise<void> {
  const r = validar(reputacaoCampos, {
    ...plano(form),
    estrelas_reclamacao: lista(form, "estrelas_reclamacao"),
  });
  const faixa = conferirFaixasReputacao(
    r.reclamacoes_atencao,
    r.reclamacoes_alerta,
  );
  if (faixa) throw new ErroDeNegocio(faixa);
  await exigirParametros(ctx);
  await gravar(ctx, (tx) => repo.alterarParametros(tx, r));
}

export async function salvarAsana(
  ctx: Contexto,
  form: Formulario,
): Promise<void> {
  const projetos = String(plano(form).asana_projetos_marketing ?? "")
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const a = validar(asanaCampos, {
    ...plano(form),
    asana_projetos_marketing: [...new Set(projetos)],
  });
  await exigirParametros(ctx);
  await gravar(ctx, (tx) => repo.alterarParametros(tx, a));
}

/** Escondidos = os quadros que existem e não vieram marcados. */
export async function salvarVisualizacao(
  ctx: Contexto,
  form: Formulario,
): Promise<void> {
  const r = z
    .array(z.enum(CHAVES_QUADROS as [string, ...string[]]))
    .safeParse(lista(form, "visivel"));
  if (!r.success)
    throw new ErroDeNegocio("Formulário inválido. Recarregue a tela.");
  await exigirParametros(ctx);
  await gravar(ctx, (tx) =>
    repo.alterarParametros(tx, {
      quadros_ocultos: ocultosDoFormulario(r.data),
    }),
  );
}

export async function salvarTermosMarca(
  ctx: Contexto,
  form: Formulario,
): Promise<void> {
  const termos = String(plano(form).termos_marca ?? "")
    .split(/[,\n]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const r = validar(termosCampos, { termos_marca: [...new Set(termos)] });
  await exigirParametros(ctx);
  await gravar(ctx, (tx) => repo.alterarParametros(tx, r));
}

// ---------------------------------------------------------------------------
// Temas da reputação e códigos da ronda
// ---------------------------------------------------------------------------

export async function salvarTema(
  ctx: Contexto,
  form: Formulario,
): Promise<void> {
  const { id: alvo, ...valores } = validar(
    temaCampos.extend({ id: idOpcional }),
    plano(form),
  );
  await exigirParametros(ctx);
  await gravar(
    ctx,
    (tx) =>
      alvo
        ? repo.alterarTema(tx, alvo, valores)
        : repo.incluirTema(tx, valores),
    `Tema repetido: já existe “${valores.nome}”.`,
  );
}

export async function salvarCodigoRonda(
  ctx: Contexto,
  form: Formulario,
): Promise<void> {
  const { codigo, novo, ...valores } = validar(
    rondaCampos.extend({ codigo: codigoRonda, novo: marcado }),
    plano(form),
  );
  await exigirParametros(ctx);
  await gravar(
    ctx,
    (tx) =>
      novo
        ? repo.incluirCodigoRonda(tx, { codigo, ...valores })
        : repo.alterarCodigoRonda(tx, codigo, valores),
    `Código da ronda repetido: o código “${codigo}” já existe.`,
  );
}

export async function removerCodigoRonda(
  ctx: Contexto,
  codigo: string,
): Promise<string> {
  const c = validar(codigoRonda, codigo);
  await exigirParametros(ctx);
  await gravar(ctx, (tx) => repo.removerCodigoRonda(tx, c));
  return "Removido. Dá para voltar pelo Histórico.";
}

// ---------------------------------------------------------------------------
// Referências do Benchmark
// ---------------------------------------------------------------------------

export async function salvarReferencia(
  ctx: Contexto,
  form: Formulario,
): Promise<void> {
  const { id: alvo, ...valores } = validar(
    referenciaCampos.extend({ id: idOpcional }),
    plano(form),
  );
  await exigirParametros(ctx);
  await gravar(
    ctx,
    (tx) =>
      alvo
        ? repo.alterarReferencia(tx, alvo, valores)
        : repo.incluirReferencia(tx, valores),
    `Referência repetida: já existe “${valores.nome}”.`,
  );
}

export async function removerReferencia(
  ctx: Contexto,
  alvo: string,
): Promise<string> {
  validar(id, alvo);
  await exigirParametros(ctx);
  await gravar(ctx, (tx) => repo.removerReferencia(tx, alvo));
  return "Removida. Dá para voltar pelo Histórico.";
}

// ---------------------------------------------------------------------------
// Histórico: voltar uma alteração
// ---------------------------------------------------------------------------

const parametrosCampos = reputacaoCampos
  .extend(asanaCampos.shape)
  .extend(visualizacaoCampos.shape)
  .extend(termosCampos.shape);

const INVALIDO = "Os valores de antes não passam nas conferências de hoje.";

/**
 * Os valores do "antes" passam pelas mesmas regras dos formulários (a
 * inclusão confere de novo com o formulário inteiro). Só as colunas que
 * voltam: campo ausente não vira padrão (falso, nulo).
 */
function validarVolta<T extends object>(
  r: z.ZodSafeParseResult<T>,
  valores: Record<string, unknown>,
): Partial<T> {
  if (!r.success) throw new ErroDeNegocio(INVALIDO);
  const p: Partial<T> = { ...r.data };
  for (const k in p) if (!(k in valores)) delete p[k];
  return p;
}

const conferir = <T>(schema: z.ZodType<T>, valor: unknown): T => {
  const r = schema.safeParse(valor);
  if (!r.success) throw new ErroDeNegocio(INVALIDO);
  return r.data;
};

async function aplicarVoltar(
  tx: Tx,
  v: Exclude<Voltar, { tipo: "impossivel" }>,
): Promise<void> {
  if (v.tipo === "apagar") {
    await repo.apagarDaTabela(tx, v.tabela, String(v.chave.valor));
    return;
  }
  const chave = v.tipo === "alterar" ? String(v.chave.valor) : "";
  switch (v.tabela) {
    case "marketing.locatarios": {
      const p = validarVolta(
        locatarioCampos.partial().safeParse(v.valores),
        v.valores,
      );
      if (v.tipo === "incluir") {
        const novo = conferir(locatarioCampos.extend({ id }), v.valores);
        if (!datasEmOrdem(novo)) throw new ErroDeNegocio(INVALIDO);
        await repo.incluirLocatarios(tx, [novo]);
      } else await repo.alterarLocatario(tx, chave, p);
      return;
    }
    case "marketing.landing_pages": {
      const p = validarVolta(
        landingPageCampos.partial().safeParse(v.valores),
        v.valores,
      );
      if (v.tipo === "incluir")
        await repo.incluirLandingPage(tx, {
          ...conferir(landingPageCampos, v.valores),
          identificador: String(v.valores.identificador),
        });
      else await repo.alterarLandingPage(tx, chave, p);
      return;
    }
    case "core.metas": {
      const p = validarVolta(
        metaCampos.partial().safeParse(v.valores),
        v.valores,
      );
      if (v.tipo === "incluir")
        await repo.incluirMeta(
          tx,
          conferir(
            metaCampos.extend({
              id,
              indicador: z.enum(indicadores),
              direcao: z.enum(["maior_melhor", "menor_melhor"]),
              vigente_desde: data,
            }),
            v.valores,
          ),
        );
      else await repo.alterarMeta(tx, chave, p);
      return;
    }
    case "marketing.regras_alerta": {
      const p = validarVolta(
        regraCampos.partial().safeParse(v.valores),
        v.valores,
      );
      if (v.tipo !== "alterar") throw new ErroDeNegocio(INVALIDO);
      await repo.alterarRegra(tx, chave, p);
      return;
    }
    case "marketing.temas": {
      const p = validarVolta(
        temaCampos.partial().safeParse(v.valores),
        v.valores,
      );
      if (v.tipo === "incluir")
        await repo.incluirTema(tx, {
          ...conferir(temaCampos, v.valores),
          id: conferir(id, v.valores.id),
        });
      else await repo.alterarTema(tx, chave, p);
      return;
    }
    case "marketing.ronda_codigos": {
      const p = validarVolta(
        rondaCampos.partial().safeParse(v.valores),
        v.valores,
      );
      if (v.tipo === "incluir")
        await repo.incluirCodigoRonda(tx, {
          ...conferir(rondaCampos, v.valores),
          codigo: conferir(codigoRonda, v.valores.codigo),
        });
      else await repo.alterarCodigoRonda(tx, chave, p);
      return;
    }
    case "marketing.benchmark": {
      const p = validarVolta(
        referenciaCampos.partial().safeParse(v.valores),
        v.valores,
      );
      if (v.tipo === "incluir")
        await repo.incluirReferencia(tx, {
          ...conferir(referenciaCampos, v.valores),
          id: conferir(id, v.valores.id),
        });
      else await repo.alterarReferencia(tx, chave, p);
      return;
    }
    case "marketing.parametros": {
      const p = validarVolta(
        parametrosCampos.partial().safeParse(v.valores),
        v.valores,
      );
      if (v.tipo !== "alterar") throw new ErroDeNegocio(INVALIDO);
      await repo.alterarParametros(tx, p);
      return;
    }
  }
  throw new ErroDeNegocio("Esta alteração não pode ser desfeita aqui.");
}

/** Mensagem de "repetido" da volta, por tabela (as do antigo). */
const REPETIDO_NA_VOLTA: Record<string, string> = {
  "marketing.locatarios": "Locatário repetido: já existe outro com esse nome.",
  "core.metas": "Já existe meta desse indicador nesse mês.",
  "marketing.temas": "Tema repetido.",
  "marketing.ronda_codigos": "Código da ronda repetido.",
  "marketing.benchmark": "Referência repetida.",
};

/**
 * "Voltar" de uma linha do histórico. Só o id vem do navegador: a alteração
 * é relida com a sessão (RLS) e o que voltar sai de montarVoltar. A volta
 * também cai no histórico.
 */
export async function voltarAlteracao(
  ctx: Contexto,
  alvo: number,
): Promise<string> {
  await exigirParametros(ctx);
  const linha = await alteracaoMkt(ctx, alvo);
  if (!linha || !TABELAS_MKT[linha.tabela])
    throw new ErroDeNegocio("Alteração não encontrada.");
  const v = montarVoltar(linha);
  if (v.tipo === "impossivel") throw new ErroDeNegocio(v.motivo);
  await gravar(
    ctx,
    (tx) => aplicarVoltar(tx, v),
    REPETIDO_NA_VOLTA[linha.tabela],
  );
  return "Alteração desfeita. A volta também ficou no histórico.";
}
