import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { mensagemSegura } from "@/connectors/http";
import type { ContaPublica } from "@/lib/marketing/benchmark";
import { podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";
import { IntegracaoNaoConfigurada, meta } from "@/server/integracoes";
import { type Referencia, referenciasBenchmark } from "./base";

// Números públicos do Instagram da ARP e das referências do Benchmark, lidos
// pela conta da ARP na Meta (business_discovery). Uma hora no cache; a falha
// de uma conta (pessoal, usuário errado) vira aviso só na linha dela.

export type ContaLida =
  | { ok: true; conta: ContaPublica }
  | { ok: false; aviso: string };

export interface DadosBenchmark {
  arp: ContaLida | null;
  referencias: { referencia: Referencia; leitura: ContaLida | null }[];
  /** Por que nada foi lido (Meta sem acesso). */
  aviso?: string;
}

function avisoDe(erro: unknown): string {
  if (erro instanceof IntegracaoNaoConfigurada) return erro.message;
  const m = mensagemSegura(erro);
  if (/business_discovery|110|Invalid user/i.test(m))
    return "O Instagram não entregou esta conta: confira o usuário (precisa ser conta comercial ou de criador).";
  console.error("benchmark da meta", erro);
  return `A Meta não respondeu: ${m.slice(0, 160)}`;
}

/** Erro dentro de "use cache" sai sem a mensagem: a falha volta como dado. */
async function lerContas(
  usuarios: string[],
): Promise<{ arp: ContaLida | null; contas: Record<string, ContaLida> }> {
  "use cache";
  cacheTag(TAG.marketing.benchmarkMeta, TAG.marketing.meta);
  try {
    const { api, instagram } = await meta();
    if (!instagram) {
      cacheLife("minutes");
      return { arp: null, contas: {} };
    }
    const ler = async (u: string): Promise<ContaLida> => {
      try {
        return { ok: true, conta: await api.contaPublica(instagram, u) };
      } catch (erro) {
        return { ok: false, aviso: avisoDe(erro) };
      }
    };
    const proprio = await api.instagram(instagram);
    const [arp, ...outras] = await Promise.all([
      ler(proprio.username),
      ...usuarios.map(ler),
    ]);
    cacheLife("hours");
    return {
      arp: arp ?? null,
      contas: Object.fromEntries(
        usuarios.map((u, i) => [u, outras[i] as ContaLida]),
      ),
    };
  } catch (erro) {
    cacheLife("seconds");
    return { arp: { ok: false, aviso: avisoDe(erro) }, contas: {} };
  }
}

/** A ARP e as referências ativas. null: sem a permissão de Reputação. */
export const dadosBenchmark = cache(
  async (): Promise<DadosBenchmark | null> => {
    if (!(await podeAgora("marketing.reputacao"))) return null;
    const refs = (await referenciasBenchmark()).filter((r) => r.ativo);
    const usuarios = [
      ...new Set(
        refs.flatMap((r) => (r.instagram ? [r.instagram.toLowerCase()] : [])),
      ),
    ].sort();
    const { arp, contas } = await lerContas(usuarios);
    return {
      arp,
      referencias: refs.map((r) => ({
        referencia: r,
        leitura: r.instagram
          ? (contas[r.instagram.toLowerCase()] ?? null)
          : null,
      })),
      ...(arp?.ok === false ? { aviso: arp.aviso } : {}),
    };
  },
);
