"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import type { Json } from "@/lib/supabase/database.types";
import type {
  DefinicaoFormulario,
  Pergunta,
} from "@/lib/sustentabilidade/formulario/tipos";
import { podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";
import { parametros, su } from "../base";
import { definicaoPublicada, lerDefinicao } from "../formularios";

// Cadastro dos programas e dos indicadores (spec 4.8), só "Programas –
// gerenciar". Com a sessão: o RLS confere de novo e a auditoria registra.
// Inativar não apaga nada: o programa sai da tela de lançamento e o link
// para de abrir; reativar volta tudo. Área e grupo de impacto vêm das
// listas dos Parâmetros.

const GERENCIAR = "sustentabilidade.programas.gerenciar" as const;
const SEM_PERMISSAO = "Só quem gerencia os programas pode fazer isso.";

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((t) => t || null);
const dataOpcional = z
  .string()
  .trim()
  .refine((d) => !d || /^\d{4}-\d{2}-\d{2}$/.test(d), "Data inválida.")
  .transform((d) => d || null);
const sim = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true" || v === "1");

const esquemaPrograma = z
  .object({
    id: z.union([z.uuid(), z.literal("")]).optional(),
    nome: z
      .string()
      .trim()
      .min(1, "Informe o nome do programa.")
      .max(120, "Nome com no máximo 120 caracteres."),
    descricao: texto(1000),
    area: texto(80),
    parceiro_nome: texto(150),
    parceiro_doc: z
      .string()
      .transform((d) => d.replace(/\D/g, ""))
      .refine(
        (d) => !d || d.length === 14 || d.length === 11,
        "CNPJ com 14 dígitos (ou CPF com 11).",
      )
      .transform((d) => d || null),
    inicio: dataOpcional,
    fim: dataOpcional,
    frequencia: z.enum(["mensal", "evento"], "Escolha a frequência."),
    email: z
      .string()
      .trim()
      .max(150)
      .refine(
        (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
        "E-mail inválido.",
      )
      .transform((e) => e || null)
      .optional(),
    telefone: texto(40).optional(),
    contato: texto(150).optional(),
  })
  .refine((p) => !p.inicio || !p.fim || p.fim >= p.inicio, {
    message: "O fim não pode ser antes do início.",
    path: ["fim"],
  });

const primeiro = (e: z.ZodError) =>
  e.issues[0]?.message ?? "Confira os campos.";

function invalidar() {
  updateTag(TAG.sustentabilidade.programas);
  refresh();
}

/** Novo programa ou edição do cadastro (com o contato, se "Ver contato"). */
export async function salvarPrograma(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = esquemaPrograma.safeParse(Object.fromEntries(form));
  if (!e.success) return { erro: primeiro(e.error) };
  if (!(await podeAgora(GERENCIAR))) return { erro: SEM_PERMISSAO };
  const { id, email, telefone, contato, ...campos } = e.data;
  const p = await parametros();
  if (campos.area && !p.areas_impacto.includes(campos.area)) {
    // Área que saiu da lista dos Parâmetros: só fica se já era a do programa.
    const { data } = id
      ? await (await su())
          .from("programas")
          .select("area")
          .eq("id", id)
          .maybeSingle()
      : { data: null };
    if (data?.area !== campos.area)
      return { erro: "Escolha uma área de impacto da lista dos Parâmetros." };
  }
  const db = await su();
  const r = id
    ? await db.from("programas").update(campos).eq("id", id).select("id")
    : await db.from("programas").insert(campos).select("id");
  if (r.error?.code === "23505")
    return { erro: `Já existe um programa chamado "${campos.nome}".` };
  if (r.error || !r.data?.length) {
    if (r.error) console.error("salvar programa", r.error);
    return { erro: "Não foi possível salvar o programa. Tente de novo." };
  }
  const novoId = r.data[0]?.id as string;
  if (
    (email !== undefined || telefone !== undefined || contato !== undefined) &&
    (await podeAgora("sustentabilidade.contato"))
  ) {
    const c = await db.from("programa_contatos").upsert({
      programa_id: novoId,
      email: email ?? null,
      telefone: telefone ?? null,
      contato: contato ?? null,
    });
    if (c.error) {
      console.error("contato do programa", c.error);
      invalidar();
      return {
        erro: "O programa foi salvo, mas o contato do parceiro não. Abra o cadastro e tente de novo.",
      };
    }
  }
  invalidar();
  if (!id) redirect(`/sustentabilidade/programas/${novoId}`);
  return { ok: "Cadastro do programa salvo." };
}

const esquemaAtivo = z.object({
  id: z.uuid("Programa inválido."),
  ativo: z.enum(["true", "false"]),
});

/** Inativar ou reativar (nada se apaga). */
export async function alternarProgramaAtivo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = esquemaAtivo.safeParse(Object.fromEntries(form));
  if (!e.success) return { erro: "Programa inválido." };
  if (!(await podeAgora(GERENCIAR))) return { erro: SEM_PERMISSAO };
  const ativo = e.data.ativo === "true";
  const { data, error } = await (await su())
    .from("programas")
    .update({ ativo })
    .eq("id", e.data.id)
    .select("id");
  if (error || !data.length) {
    if (error) console.error("ativar programa", error);
    return { erro: "Não foi possível mudar a situação do programa." };
  }
  invalidar();
  return {
    ok: ativo
      ? "Programa reativado: volta à tela de lançamento e o link do parceiro abre de novo."
      : "Programa inativado: saiu da tela de lançamento e o link do parceiro parou de abrir. O histórico continua no painel.",
  };
}

// ---------------------------------------------------------------- indicadores

const CALCULOS = [
  "soma",
  "contagem",
  "contagem_distintos",
  "media",
  "percentual",
] as const;
const NUMERICOS: readonly Pergunta["tipo"][] = [
  "numero",
  "numero_unidade",
  "reais",
  "sim_nao_quantidade",
];

const esquemaIndicador = z.object({
  id: z.union([z.uuid(), z.literal("")]).optional(),
  programa_id: z.uuid("Programa inválido."),
  nome: z
    .string()
    .trim()
    .min(1, "Informe o nome do indicador.")
    .max(120, "Nome com no máximo 120 caracteres."),
  formulario_id: z.uuid("Escolha o formulário."),
  campo_id: z.string().trim().max(100),
  calculo: z.enum(CALCULOS, "Escolha o cálculo."),
  filtro_campo: z.string().trim().max(100).optional(),
  filtro_valor: z.string().trim().max(200).optional(),
  percentual_valor: z.string().trim().max(200).optional(),
  unidade: texto(40),
  grupo: texto(80),
  ordem: z.coerce.number().int().min(0).max(999).default(0),
  mostrar_painel: sim,
  em_reais: sim,
});

/** Campos do formulário: os da versão publicada e os do rascunho. */
async function camposDoFormulario(
  formularioId: string,
  programaId: string,
): Promise<Map<string, Pergunta> | null> {
  const { data, error } = await (await su())
    .from("formularios")
    .select("programa_id, rascunho")
    .eq("id", formularioId)
    .maybeSingle();
  if (error || !data || data.programa_id !== programaId) return null;
  const defs: DefinicaoFormulario[] = [
    (await definicaoPublicada(formularioId)).definicao,
  ];
  try {
    defs.push(lerDefinicao(data.rascunho));
  } catch {
    // Rascunho inválido: vale só o publicado.
  }
  const mapa = new Map<string, Pergunta>();
  for (const d of defs)
    for (const s of d.secoes) for (const p of s.perguntas) mapa.set(p.id, p);
  return mapa;
}

/** Criar ou editar um indicador (definido antes da coleta). */
export async function salvarIndicador(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = esquemaIndicador.safeParse(Object.fromEntries(form));
  if (!e.success) return { erro: primeiro(e.error) };
  if (!(await podeAgora(GERENCIAR))) return { erro: SEM_PERMISSAO };
  const d = e.data;
  const campos = await camposDoFormulario(d.formulario_id, d.programa_id);
  if (!campos) return { erro: "Formulário não encontrado neste programa." };
  const campo = d.campo_id ? campos.get(d.campo_id) : undefined;
  if (d.campo_id && !campo)
    return { erro: "O campo escolhido não existe mais no formulário." };
  if (d.calculo !== "contagem" && !campo)
    return { erro: "Escolha o campo do cálculo." };
  if ((d.calculo === "soma" || d.calculo === "media") && campo) {
    if (!NUMERICOS.includes(campo.tipo))
      return {
        erro: `"${campo.texto}" não é um campo de número: escolha outro ou use contagem.`,
      };
  }
  if (d.calculo === "percentual" && !d.percentual_valor)
    return { erro: "Informe a resposta contada no percentual." };
  const filtroCampo = d.filtro_campo ? campos.get(d.filtro_campo) : undefined;
  if (d.filtro_campo && !filtroCampo)
    return { erro: "O campo do filtro não existe no formulário." };
  if (filtroCampo && !d.filtro_valor)
    return { erro: "Informe o valor do filtro (ou tire o filtro)." };
  const p = await parametros();
  if (d.grupo && !p.grupos_impacto.includes(d.grupo))
    return { erro: "Escolha um grupo de impacto da lista dos Parâmetros." };
  // Campo em reais: o indicador é em reais (só com "Ver valores").
  const emReais = d.em_reais || campo?.tipo === "reais";
  const linha = {
    nome: d.nome,
    formulario_id: d.formulario_id,
    campo_id: d.campo_id || null,
    calculo: d.calculo,
    filtro:
      filtroCampo && d.filtro_valor
        ? ({ campo_id: filtroCampo.id, valor: d.filtro_valor } as Json)
        : null,
    percentual_valor:
      d.calculo === "percentual" ? (d.percentual_valor ?? null) : null,
    unidade: d.unidade,
    grupo: d.grupo,
    mostrar_painel: d.mostrar_painel,
    em_reais: emReais,
    ordem: d.ordem,
  };
  const db = await su();
  const r = d.id
    ? await db
        .from("programa_indicadores")
        .update(linha)
        .eq("id", d.id)
        .eq("programa_id", d.programa_id)
        .select("id")
    : await db
        .from("programa_indicadores")
        .insert({ ...linha, programa_id: d.programa_id })
        .select("id");
  if (r.error || !r.data?.length) {
    if (r.error) console.error("salvar indicador", r.error);
    return { erro: "Não foi possível salvar o indicador. Tente de novo." };
  }
  invalidar();
  return { ok: d.id ? "Indicador salvo." : "Indicador criado." };
}

const esquemaIndicadorAtivo = z.object({
  id: z.uuid("Indicador inválido."),
  ativo: z.enum(["true", "false"]),
});

/** Inativar ou reativar o indicador (o histórico não muda). */
export async function alternarIndicadorAtivo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = esquemaIndicadorAtivo.safeParse(Object.fromEntries(form));
  if (!e.success) return { erro: "Indicador inválido." };
  if (!(await podeAgora(GERENCIAR))) return { erro: SEM_PERMISSAO };
  const ativo = e.data.ativo === "true";
  const { data, error } = await (await su())
    .from("programa_indicadores")
    .update({ ativo })
    .eq("id", e.data.id)
    .select("id");
  if (error || !data.length) {
    if (error) console.error("ativar indicador", error);
    return { erro: "Não foi possível mudar a situação do indicador." };
  }
  invalidar();
  return { ok: ativo ? "Indicador reativado." : "Indicador inativado." };
}
