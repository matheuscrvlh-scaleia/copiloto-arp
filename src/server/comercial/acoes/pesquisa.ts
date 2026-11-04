"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import type {
  Aba,
  EstadoConfirmacao,
  EstadoPrevia,
} from "@/lib/comercial/importacao";
import {
  chaveDoImovel,
  type ImovelImportado,
  lerPesquisa,
} from "@/lib/comercial/pesquisa-importacao";
import { lerValorBr } from "@/lib/formato";
import { com, valoresDaLista } from "@/server/comercial/base";
import {
  confirmarImportacao,
  ErroImportacao,
  type Gravacao,
  prepararPrevia,
} from "@/server/comercial/importacoes";
import { lerTudo } from "@/server/supabase-paginas";

// Gravações da Pesquisa de mercado (spec 4.16), com a sessão: o RLS
// confere comercial.pesquisa.editar. Cadastro e correção de um imóvel e a
// importação da aba Base de Dados (a tela de Importações, em Configurações,
// chama previaImportacaoPesquisa e confirmarImportacaoPesquisa). Só locação.

const SEM_PERMISSAO =
  "Você não tem permissão para editar a pesquisa de mercado.";

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);
const valor = z.preprocess(
  (v) => (typeof v === "string" ? lerValorBr(v) : v),
  z.number().min(0).max(100_000_000).nullable(),
);

const imovel = z.object({
  id: z.uuid().nullable(),
  data_pesquisa: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da pesquisa."),
  cep: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(
      z.union([
        z.literal(""),
        z.string().length(8, "CEP com 8 dígitos (ou deixe em branco)."),
      ]),
    )
    .transform((v) => (v ? `${v.slice(0, 5)}-${v.slice(5)}` : null)),
  endereco: z
    .string()
    .trim()
    .min(1, "Informe o endereço ou referência.")
    .max(300),
  bairro: z.string().trim().min(1, "Escolha o bairro.").max(80),
  tipo: z.string().trim().min(1, "Escolha o tipo.").max(80),
  area_m2: valor.pipe(z.number().positive("Informe a área (m²).")),
  aluguel: valor.pipe(z.number({ message: "Informe o aluguel." })),
  condominio: valor,
  iptu: valor,
  vagas: valor.pipe(z.number().int().nullable()),
  observacao: opcional(1000),
  fonte: opcional(1000).pipe(
    z
      .string()
      .regex(/^https?:\/\//i, "A fonte é o link do anúncio (http…).")
      .nullable(),
  ),
});

const primeiroErro = (e: z.ZodError) => {
  const m = e.issues[0]?.message;
  return m && !/^(Invalid|Too|Expected)/.test(m)
    ? m
    : "Confira os campos do imóvel.";
};

export async function salvarImovel(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const campo = (k: string) => form.get(k) ?? "";
  const e = imovel.safeParse({
    id: form.get("id") || null,
    data_pesquisa: campo("data_pesquisa"),
    cep: campo("cep"),
    endereco: campo("endereco"),
    bairro: campo("bairro"),
    tipo: campo("tipo"),
    area_m2: campo("area_m2"),
    aluguel: campo("aluguel"),
    condominio: campo("condominio"),
    iptu: campo("iptu"),
    vagas: campo("vagas"),
    observacao: campo("observacao"),
    fonte: campo("fonte"),
  });
  if (!e.success) return { erro: primeiroErro(e.error) };
  const { id, ...v } = e.data;
  const db = await com();
  const [bairros, tipos, atual] = await Promise.all([
    valoresDaLista("pesquisa_bairro"),
    valoresDaLista("pesquisa_tipo"),
    id
      ? db
          .from("pesquisa_imoveis")
          .select("bairro, tipo")
          .eq("id", id)
          .maybeSingle()
      : Promise.resolve(null),
  ]);
  // Na correção, o valor antigo segue valendo mesmo se saiu da lista.
  if (!bairros.includes(v.bairro) && atual?.data?.bairro !== v.bairro)
    return { erro: "Bairro fora da lista dos parâmetros." };
  if (!tipos.includes(v.tipo) && atual?.data?.tipo !== v.tipo)
    return { erro: "Tipo fora da lista dos parâmetros." };

  const linha = {
    ...v,
    aluguel: v.aluguel as number,
    area_m2: v.area_m2 as number,
  };
  if (id) {
    const { data, error } = await db
      .from("pesquisa_imoveis")
      .update(linha)
      .eq("id", id)
      .select("id");
    if (error) return { erro: erroDoBanco(error) };
    if (!data?.length) return { erro: SEM_PERMISSAO };
    refresh();
    return { ok: "Imóvel corrigido. A alteração ficou no histórico." };
  }
  const { error } = await db.from("pesquisa_imoveis").insert(linha);
  if (error) return { erro: erroDoBanco(error) };
  redirect("/comercial/pesquisa");
}

function erroDoBanco(error: { code?: string; message: string }): string {
  if (error.code === "42501") return SEM_PERMISSAO;
  if (error.code === "23514") return "Confira os valores do imóvel.";
  console.error("pesquisa de mercado", error);
  return "Não foi possível salvar o imóvel. Tente de novo.";
}

// ---------------------------------------------------------------------------
// Importação da aba Base de Dados (Configurações › Importações)
// ---------------------------------------------------------------------------

/** Lê o arquivo com as listas dos parâmetros e o que já está na pesquisa. */
async function lerPesquisaDoArquivo(abas: Aba[]) {
  const db = await com();
  const [bairros, tipos, existentes] = await Promise.all([
    valoresDaLista("pesquisa_bairro"),
    valoresDaLista("pesquisa_tipo"),
    lerTudo(() =>
      db
        .from("pesquisa_imoveis")
        .select("id, data_pesquisa, endereco, area_m2, aluguel, importacao_id")
        .order("id"),
    ),
  ]);
  const manuais = new Set<string>();
  const importados = new Set<string>();
  for (const i of existentes)
    (i.importacao_id ? importados : manuais).add(
      chaveDoImovel({
        ...i,
        area_m2: Number(i.area_m2),
        aluguel: Number(i.aluguel),
      }),
    );
  return lerPesquisa(abas, { bairros, tipos }, { manuais, importados });
}

const gravarPesquisa: Gravacao<ImovelImportado | null> = async (
  linhas,
  ctx,
) => {
  const imoveis = linhas
    .map((l) => l.dados)
    .filter((d): d is ImovelImportado => d !== null);
  if (!imoveis.length)
    throw new ErroImportacao("Nenhum imóvel novo para importar.");
  const { data, error } = await (await com())
    .from("pesquisa_imoveis")
    .insert(
      imoveis.map((i) => ({
        ...i,
        criado_por: ctx.usuarioId,
        importacao_id: ctx.importacaoId,
      })),
    )
    .select("id");
  if (error) {
    if (error.code === "42501") throw new ErroImportacao(SEM_PERMISSAO);
    throw error;
  }
  return data?.length ?? 0;
};

export async function previaImportacaoPesquisa(
  _: EstadoPrevia,
  form: FormData,
): Promise<EstadoPrevia> {
  return prepararPrevia("pesquisa", form, lerPesquisaDoArquivo);
}

export async function confirmarImportacaoPesquisa(
  _: EstadoConfirmacao,
  form: FormData,
): Promise<EstadoConfirmacao> {
  return confirmarImportacao(
    "pesquisa",
    form,
    lerPesquisaDoArquivo,
    gravarPesquisa,
  );
}
