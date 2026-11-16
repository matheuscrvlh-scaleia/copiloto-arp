import type {
  ContaLida,
  DadosBenchmark,
} from "@arp/shared/marketing/contratos/base";
import { mensagemSegura } from "@/connectors/http";
import type { Contexto } from "@/contexto";
import { log } from "@/infra/log";
import {
  IntegracaoNaoConfigurada,
  meta,
} from "@/modules/sync/credenciais.service";
import { exigirModulo, podeAgora } from "./acesso";
import * as base from "./base.service";
import { memoria, VALIDADE_LEITURA } from "./memoria";

// Números públicos do Instagram da ARP e das referências do Benchmark, lidos
// pela conta da ARP na Meta (business_discovery). Uma hora na memória; a
// falha de uma conta (pessoal, usuário errado) vira aviso só na linha dela.

function avisoDe(erro: unknown): string {
  if (erro instanceof IntegracaoNaoConfigurada) return erro.message;
  const m = mensagemSegura(erro);
  if (/business_discovery|110|Invalid user/i.test(m))
    return "O Instagram não entregou esta conta: confira o usuário (precisa ser conta comercial ou de criador).";
  log.error({ err: erro }, "benchmark da meta");
  return `A Meta não respondeu: ${m.slice(0, 160)}`;
}

interface Contas {
  arp: ContaLida | null;
  contas: Record<string, ContaLida>;
}

const memoriaDasContas = memoria<Contas>("benchmark_meta", "meta");

/** A falha volta como dado (guardada só por segundos). */
function lerContas(usuarios: string[]): Promise<Contas> {
  return memoriaDasContas(JSON.stringify(usuarios), async () => {
    try {
      const { api, instagram } = await meta();
      if (!instagram)
        return {
          valor: { arp: null, contas: {} },
          validade: VALIDADE_LEITURA.minutos,
        };
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
      const contas: Record<string, ContaLida> = {};
      usuarios.forEach((u, i) => {
        const lida = outras[i];
        if (lida) contas[u] = lida;
      });
      return {
        valor: { arp: arp ?? null, contas },
        validade: VALIDADE_LEITURA.horas,
      };
    } catch (erro) {
      return {
        valor: { arp: { ok: false, aviso: avisoDe(erro) }, contas: {} },
        validade: VALIDADE_LEITURA.segundos,
      };
    }
  });
}

/** A ARP e as referências ativas. null: sem a permissão de Reputação. */
export async function dadosBenchmark(
  ctx: Contexto,
): Promise<DadosBenchmark | null> {
  exigirModulo(ctx);
  if (!(await podeAgora(ctx, "marketing.reputacao"))) return null;
  const refs = (await base.referencias(ctx)).filter((r) => r.ativo);
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
      leitura: r.instagram ? (contas[r.instagram.toLowerCase()] ?? null) : null,
    })),
    ...(arp?.ok === false ? { aviso: arp.aviso } : {}),
  };
}
