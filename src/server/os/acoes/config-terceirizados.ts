"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { normalizarCnpj } from "@/lib/os/configuracoes";
import { limparTelefone } from "@/lib/os/whatsapp";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { os } from "@/server/os/base";
import {
  exigir,
  inteiroOpcional,
  marcado,
  NADA_ALTERADO,
  texto,
  textoOpcional,
  uuidOpcional,
} from "@/server/os/config-acoes";

// Terceirizados (os.terceirizados) e contatos salvos para o WhatsApp
// (os.terceirizados ou os.parametros). Empresa e profissional não são
// apagados: ficam nas OS antigas; inativos, somem das escolhas.

const ROTULOS = {
  nome: "Nome",
  cnpj: "CNPJ",
  contato: "Contato",
  telefone: "Telefone",
  email: "E-mail",
  servicos: "Serviços",
  prazo_retorno_dias: "Prazo de retorno",
  empresa: "Empresa",
  observacao: "Observação",
};

const telefoneOpcional = textoOpcional(30).refine(
  (t) => t === null || limparTelefone(t) !== null,
  "telefone com DDD (10 ou 11 dígitos)",
);

const empresa = z.object({
  id: uuidOpcional,
  nome: texto(120, "informe o nome"),
  cnpj: z
    .string()
    .default("")
    .transform((v) => normalizarCnpj(v))
    .refine((v) => v !== undefined, "CNPJ inválido"),
  contato: textoOpcional(120),
  telefone: telefoneOpcional,
  email: z.preprocess(
    (v) =>
      String(v ?? "").trim() === "" ? null : String(v).trim().toLowerCase(),
    z.email("e-mail inválido").nullable(),
  ),
  servicos: textoOpcional(500),
  prazo_retorno_dias: inteiroOpcional(1, 365),
  ativo: marcado,
});

export async function salvarEmpresa(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.terceirizados");
  if (acesso.erro) return acesso.erro;
  const d = empresa.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { id, cnpj, ...resto } = d.data;
  const linha = { ...resto, cnpj: cnpj ?? null };
  const banco = await os();
  if (id) {
    const { data, error } = await banco
      .from("empresas")
      .update(linha)
      .eq("id", id)
      .select("id");
    if (error) return erroDoBanco(error);
    if (!data?.length) return NADA_ALTERADO;
  } else {
    const { error } = await banco.from("empresas").insert(linha);
    if (error) return erroDoBanco(error);
  }
  refresh();
  return { ok: id ? "Empresa salva." : "Empresa cadastrada." };
}

const profissional = z.object({
  id: uuidOpcional,
  empresa_id: z.uuid(),
  nome: texto(120, "informe o nome"),
  telefone: telefoneOpcional,
  ativo: marcado,
});

export async function salvarProfissional(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.terceirizados");
  if (acesso.erro) return acesso.erro;
  const d = profissional.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { id, ...linha } = d.data;
  const banco = await os();
  if (id) {
    const { data, error } = await banco
      .from("profissionais")
      .update(linha)
      .eq("id", id)
      .select("id");
    if (error) return erroDoBanco(error);
    if (!data?.length) return NADA_ALTERADO;
  } else {
    const { error } = await banco.from("profissionais").insert(linha);
    if (error) return erroDoBanco(error);
  }
  refresh();
  return { ok: id ? "Profissional salvo." : "Profissional incluído." };
}

const contato = z.object({
  id: uuidOpcional,
  nome: texto(120, "informe o nome"),
  telefone: texto(30, "informe o telefone").refine(
    (t) => limparTelefone(t) !== null,
    "telefone com DDD (10 ou 11 dígitos)",
  ),
  empresa: textoOpcional(120),
  observacao: textoOpcional(500),
});

export async function salvarContato(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.terceirizados", "os.parametros");
  if (acesso.erro) return acesso.erro;
  const d = contato.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { id, ...linha } = d.data;
  const banco = await os();
  if (id) {
    const { data, error } = await banco
      .from("contatos")
      .update(linha)
      .eq("id", id)
      .select("id");
    if (error) return erroDoBanco(error);
    if (!data?.length) return NADA_ALTERADO;
  } else {
    const { error } = await banco.from("contatos").insert(linha);
    if (error) return erroDoBanco(error);
  }
  refresh();
  return { ok: id ? "Contato salvo." : "Contato salvo na lista." };
}

/** Contato não é ligado a nenhum chamado: pode ser removido de verdade. */
export async function removerContato(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.terceirizados", "os.parametros");
  if (acesso.erro) return acesso.erro;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return primeiroErro(id.error);
  const { data, error } = await (await os())
    .from("contatos")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return NADA_ALTERADO;
  refresh();
  return {};
}
