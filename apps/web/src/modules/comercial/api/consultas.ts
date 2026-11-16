import {
  respostaCep,
  respostaCnpj,
} from "@arp/shared/comercial/contratos/consultas";
import type { Empresa, Endereco } from "@arp/shared/conectores/publicos";
import { api } from "@/lib/api";

// CEP e CNPJ dos formulários: falha, entrada errada ou limite devolvem null
// (a pessoa digita normalmente). Com `token` (ficha pública, parte B) a
// consulta vai pela rota pública da ficha.

const rota = (tipo: "cep" | "cnpj", valor: string, token?: string | null) =>
  token
    ? `/ficha/${encodeURIComponent(token)}/consultas/${tipo}/${encodeURIComponent(valor)}`
    : `/comercial/consultas/${tipo}/${encodeURIComponent(valor)}`;

/** Rua, bairro, cidade e UF do CEP; null se não achou ou o serviço caiu. */
export async function consultarCep(
  valor: string,
  token?: string | null,
): Promise<Endereco | null> {
  try {
    return (await api.get(rota("cep", valor, token), { esquema: respostaCep }))
      .endereco;
  } catch {
    return null;
  }
}

/** Dados públicos do CNPJ; null se não achou ou o serviço caiu. */
export async function consultarCnpj(
  valor: string,
  token?: string | null,
): Promise<Empresa | null> {
  try {
    return (
      await api.get(rota("cnpj", valor, token), { esquema: respostaCnpj })
    ).empresa;
  } catch {
    return null;
  }
}
