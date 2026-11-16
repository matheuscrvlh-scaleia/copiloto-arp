import type { Empresa, Endereco } from "@arp/shared/conectores/publicos";
import { cnpjValido, soDigitos } from "@arp/shared/documentos";
import { z } from "zod";
import { mensagemSegura } from "@/connectors/http";
import { buscarCep, buscarCnpj } from "@/connectors/publicos";
import type { Origem } from "@/contexto";
import { log } from "@/infra/log";

// Consultas de CEP e CNPJ para os formulários internos (com sessão) e para a
// ficha cadastral pública (a rota pública confere o token antes de chamar).
// Falha, entrada errada ou limite estourado devolvem null: a pessoa digita
// normalmente e segue.

const LIMITE = { consultas: 30, janelaMs: 10 * 60_000 };

// atalho: limite por IP na memória de cada instância (reinicia com ela);
// basta para segurar um robô sobre serviços gratuitos de terceiros.
const usos = new Map<string, number[]>();

function dentroDoLimite(ip: string): boolean {
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
export async function consultarCep(
  valor: string,
  origem: Origem,
): Promise<Endereco | null> {
  const ok = cep.safeParse(valor);
  if (!ok.success || !dentroDoLimite(origem.ip)) return null;
  try {
    return await buscarCep(ok.data);
  } catch (erro) {
    log.error({ erro: mensagemSegura(erro) }, "consulta de CEP");
    return null;
  }
}

/**
 * Razão social, nome fantasia, natureza jurídica, CNAE, capital, endereço e
 * sócios do CNPJ (dígitos conferidos antes); null se não achou ou caiu.
 */
export async function consultarCnpj(
  valor: string,
  origem: Origem,
): Promise<Empresa | null> {
  const ok = cnpj.safeParse(valor);
  if (!ok.success || !dentroDoLimite(origem.ip)) return null;
  try {
    return await buscarCnpj(ok.data);
  } catch (erro) {
    log.error({ erro: mensagemSegura(erro) }, "consulta de CNPJ");
    return null;
  }
}
