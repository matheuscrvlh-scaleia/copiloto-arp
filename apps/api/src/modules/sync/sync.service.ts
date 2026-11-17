import { formatarNumero } from "@arp/shared/formato";
import { ehSistema } from "@arp/shared/integracoes";
import type { Contexto } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao } from "@/erros";
import { log } from "@/infra/log";
import { esquecerLeituras } from "@/modules/marketing/memoria";
import { sincronizarCopiloto } from "./copiloto-rh.service";
import {
  credencialEmUso,
  growatt,
  meta,
  podeConfigurar,
  rdStation,
} from "./credenciais.service";
import { primeiraLeitura, sincronizarGrowatt } from "./growatt.service";
import { sincronizarMeta } from "./meta.service";
import { sincronizarRdCrm } from "./rd-crm.service";
import { sincronizarRd } from "./rd-station.service";
import { sincronizarSecullum } from "./secullum.service";
import { sincronizarWps } from "./wps.service";

// "Sincronizar agora" (Administração › Configurações › Integrações e as Integrações do
// Marketing e do Sustentabilidade). Segue as mesmas travas da rotina agendada: uma de cada vez
// (integracao.sync_runs) e, no Secullum, o limite de 100 cálculos por hora.
// As demoradas rodam depois de responder; o resultado fica no histórico. O
// registro do pedido (core.logs) é de quem chama.

const SEM_PERMISSAO = "Você não tem permissão para configurar integrações.";

export async function sincronizarAgora(
  ctx: Contexto,
  sistema: string,
): Promise<{ mensagem: string }> {
  if (!ehSistema(sistema)) throw new ErroDeNegocio("Integração desconhecida.");
  if (!(await podeConfigurar(ctx, sistema)))
    throw new ErroDePermissao(SEM_PERMISSAO);

  switch (sistema) {
    case "secullum":
      await semCredencial(() => credencialEmUso("secullum"));
      depois("secullum", sincronizarSecullum);
      return {
        mensagem:
          "Sincronização iniciada. Leva alguns minutos; acompanhe no histórico.",
      };
    case "copiloto_rh": {
      // O Copiloto responde em segundos: roda na hora e mostra o resumo.
      const r = await comMensagem(sincronizarCopiloto);
      const avisos = r.avisos.length ? ` · ${r.avisos.length} avisos` : "";
      return {
        mensagem: `${r.colaboradores} colaboradores do Copiloto (${r.ativos} ativos, ${r.desligados} desligados)${r.novos ? ` · ${r.novos} novos` : ""}${r.dependentes !== null ? ` · ${r.dependentes} dependentes` : ""}${avisos}.`,
      };
    }
    case "wps":
      // A WPS leva até minutos por dia lido (pagamentos com detalhe ~90 s):
      // roda em segundo plano; o resultado aparece no histórico.
      await semCredencial(() => credencialEmUso("wps"));
      depois("wps", sincronizarWps);
      return {
        mensagem:
          "Sincronização do estacionamento iniciada. Leva alguns minutos; acompanhe no histórico.",
      };
    case "mkt_rd_station":
      // A primeira leitura passa de um minuto; se o prazo acabar, a próxima
      // continua de onde parou.
      await semCredencial(rdStation);
      depois("rd station", sincronizarRd);
      return {
        mensagem:
          "Leitura do RD iniciada. Leva alguns minutos; as telas do Marketing passam a mostrar os leads reais.",
      };
    case "rd_crm":
      depois("rd crm", sincronizarRdCrm);
      return {
        mensagem:
          "Leitura do RD Station CRM iniciada. Leva alguns minutos; acompanhe no histórico.",
      };
    case "mkt_meta":
      // A primeira leitura das métricas diárias do Instagram faz uma chamada
      // por dia. Anúncios e posts são lidos ao vivo.
      await semCredencial(meta);
      esquecerLeituras("meta");
      depois("meta", sincronizarMeta);
      return {
        mensagem:
          "Leitura da Meta iniciada. Leva um ou dois minutos; as Redes passam a mostrar Instagram e Facebook reais.",
      };
    case "sus_growatt": {
      await semCredencial(growatt);
      // A primeira leitura busca o histórico da usina (uma consulta a cada
      // 8 dias): roda depois de responder. As outras saem em segundos.
      if (await primeiraLeitura()) {
        depois("growatt", sincronizarGrowatt);
        return {
          mensagem:
            "Leitura do histórico da usina iniciada. Leva alguns minutos; acompanhe no histórico.",
        };
      }
      const r = await comMensagem(sincronizarGrowatt);
      const avisos = r.avisos.length ? ` · ${r.avisos.length} avisos` : "";
      return {
        mensagem: `${r.dias} dias da usina ${r.usina} (${r.de} a ${r.ate}): ${formatarNumero(r.kwh)} kWh${avisos}.`,
      };
    }
    default:
      throw new ErroDeNegocio(
        "A sincronização desta integração ainda não existe.",
      );
  }
}

/** Confere a credencial antes de responder; sem ela, o motivo vai para a tela. */
async function semCredencial(conferir: () => Promise<unknown>) {
  try {
    await conferir();
  } catch (erro) {
    throw new ErroDeNegocio(
      erro instanceof Error ? erro.message : "Sem credencial.",
    );
  }
}

async function comMensagem<T>(tarefa: () => Promise<T>): Promise<T> {
  try {
    return await tarefa();
  } catch (erro) {
    throw new ErroDeNegocio(erro instanceof Error ? erro.message : "Falhou.");
  }
}

/** Roda depois de responder. O erro fica em integracao.sync_runs e no log. */
function depois(nome: string, tarefa: () => Promise<unknown>) {
  void tarefa().catch((err) =>
    log.error({ err, sincronizacao: nome }, "sincronização (manual) falhou"),
  );
}
