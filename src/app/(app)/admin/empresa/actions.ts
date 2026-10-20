"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { cnpjValido, soDigitos, UFS } from "@/lib/documentos";
import { createClient } from "@/lib/supabase/server";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { pode } from "@/server/auth";

// Dados da empresa: passam pelo RLS (admin.empresa) e caem na auditoria.

const opcional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : String(v).trim()),
    schema.nullable(),
  );

const empresa = z.object({
  nome: z.string().trim().min(2, "informe o nome").max(60, "máximo de 60"),
  razao_social: opcional(z.string().max(150, "máximo de 150")),
  cnpj: opcional(
    z.string().transform(soDigitos).refine(cnpjValido, "dígitos não conferem"),
  ),
  email: opcional(z.email("e-mail inválido")),
  telefone: opcional(z.string().max(30, "máximo de 30")),
  site: opcional(z.url({ protocol: /^https?$/, error: "use http(s)://…" })),
  endereco: opcional(z.string().max(200, "máximo de 200")),
  cidade: opcional(z.string().max(80, "máximo de 80")),
  uf: opcional(z.enum(UFS, "escolha a UF")),
  cep: opcional(
    z
      .string()
      .transform(soDigitos)
      .refine((v) => v.length === 8, "8 dígitos"),
  ),
});

const ROTULOS = {
  nome: "Nome",
  razao_social: "Razão social",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  site: "Site",
  endereco: "Endereço",
  cidade: "Cidade",
  uf: "UF",
  cep: "CEP",
};

export async function salvarEmpresa(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("admin.empresa")))
    return { erro: "Você não tem permissão para editar a empresa." };
  const d = empresa.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { error } = await (await createClient())
    .schema("core")
    .from("empresa")
    .update(d.data)
    .eq("id", true);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Salvo." };
}
