"use server";

import { z } from "zod";
import { mensagemSegura } from "@/connectors/http";
import {
  buscarCep,
  buscarCnpj,
  type Empresa,
  type Endereco,
} from "@/connectors/publicos";
import { cnpjValido, soDigitos } from "@/lib/documentos";
import { ipDaRequisicao } from "@/server/os/portal-publico";

// Consultas de CEP e CNPJ para os formulários (internos e os públicos da
// ficha cadastral, por isso sem exigir login). Falha, entrada errada ou
// limite estourado devolvem null: a pessoa digita normalmente e segue.

const LIMITE = { consultas: 30, janelaMs: 10 * 60_000 };

// atalho: limite por IP na memória de cada instância (reinicia com ela);
// basta para segurar um robô sobre serviços gratuitos de terceiros.
const usos = new Map<string, number[]>();

async function dentroDoLimite(): Promise<boolean> {
  const ip = await ipDaRequisicao();
  const agora = Date.now();
  const recentes = (usos.get(ip) ?? []).filter(
    (t) => agora - t < LIMITE.janelaMs,
  );
  if (usos.size > 5000) usos.clear();
  if (recentes.length >= LIMITE.consultas) {
    usos.set(ip, recentes);
    return false;
  }
  usos.set(ip, [...recentes, agora]);
  return true;
}

const cep = z.string().max(20).transform(soDigitos).pipe(z.string().length(8));

const cnpj = z
  .string()
  .max(30)
  .transform(soDigitos)
  .pipe(z.string().length(14).refine(cnpjValido, "CNPJ inválido"));

/** Rua, bairro, cidade e UF do CEP; null se não achou ou o serviço caiu. */
export async function consultarCep(valor: string): Promise<Endereco | null> {
  const ok = cep.safeParse(valor);
  if (!ok.success || !(await dentroDoLimite())) return null;
  try {
    return await buscarCep(ok.data);
  } catch (erro) {
    console.error("consulta de CEP", mensagemSegura(erro));
    return null;
  }
}

/**
 * Razão social, nome fantasia, natureza jurídica, CNAE, capital, endereço e
 * sócios do CNPJ (dígitos conferidos antes); null se não achou ou caiu.
 */
export async function consultarCnpj(valor: string): Promise<Empresa | null> {
  const ok = cnpj.safeParse(valor);
  if (!ok.success || !(await dentroDoLimite())) return null;
  try {
    return await buscarCnpj(ok.data);
  } catch (erro) {
    console.error("consulta de CNPJ", mensagemSegura(erro));
    return null;
  }
}
