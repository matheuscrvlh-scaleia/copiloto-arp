import { ehSistema, INTEGRACOES } from "@arp/shared/integracoes";
import { useSuspenseQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { Suspense } from "react";
import { TelaCarregando } from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { Protegido } from "@/components/protegido";
import { Link } from "@/lib/navegacao";
import { consultaDasIntegracoes } from "@/modules/admin/api";
import { HistoricoDasIntegracoes } from "@/modules/admin/components/historico-integracoes";
import { CartaoIntegracao } from "@/modules/admin/components/integracao";

// Sustentabilidade › Configurações › Integrações: o acesso à Growatt (portal
// do inversor da usina solar), salvo e testado aqui como em Administração ›
// Integrações (cifrado no servidor; o token nunca volta para a tela). A
// geração lida vai para Operações (operacoes.solar_inversor_dias) e aparece
// no Painel e na Energia solar quando a fonte da geração é o inversor.

const PARAMETROS_DA_FONTE = "/operacoes/configuracoes/parametros?aba=contas";

export default function Page() {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <span
            aria-hidden
            className="carregando h-40 w-full rounded-[1.75rem]"
          />
        </TelaCarregando>
      }
    >
      <Protegido permissao="sustentabilidade.parametros">
        <Tela />
      </Protegido>
    </Suspense>
  );
}

function Tela() {
  const {
    data: { cofre, integracoes, historico },
  } = useSuspenseQuery(consultaDasIntegracoes("sustentabilidade"));
  const doModulo = historico.filter(
    (h) =>
      ehSistema(h.sistema) &&
      INTEGRACOES[h.sistema].modulo === "sustentabilidade",
  );

  return (
    <div className="flex flex-col gap-6">
      <Secao
        tom="escuro"
        titulo="Geração solar pelo inversor"
        descricao="A geração da usina é lida do portal da Growatt todo dia às 7h10 (os últimos 8 dias, porque o dia de hoje ainda está em andamento). Só leitura: nada é alterado no inversor."
      >
        <ul className="flex flex-col gap-2 text-sm">
          <li>1. Salve o token e o id da usina abaixo e clique em Testar.</li>
          <li>
            2. Em{" "}
            <Link
              href={PARAMETROS_DA_FONTE}
              className="underline underline-offset-2"
            >
              Operações › Configurações › Parâmetros
            </Link>
            , escolha “portal do inversor” como fonte da geração solar.
          </li>
          <li>
            3. A geração aparece no{" "}
            <Link
              href="/sustentabilidade"
              className="underline underline-offset-2"
            >
              Painel de Sustentabilidade
            </Link>{" "}
            e na{" "}
            <Link
              href="/operacoes/energia/solar"
              className="underline underline-offset-2"
            >
              Energia solar
            </Link>
            .
          </li>
        </ul>
      </Secao>

      {!cofre && (
        <p
          role="alert"
          className="flex items-start gap-3 rounded-[1.75rem] bg-amber-50 p-5 text-sm text-amber-900"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Falta a chave <code className="font-mono">INTEGRACOES_CHAVE</code>{" "}
            nas variáveis do servidor. Sem ela não dá para salvar tokens.
          </span>
        </p>
      )}

      {integracoes.map((i) => (
        <CartaoIntegracao key={i.sistema} i={i} cofre={cofre} />
      ))}

      <Nota>
        A primeira leitura busca o histórico desde a criação da usina no portal
        (uma consulta a cada 8 dias) e leva alguns minutos.
      </Nota>

      <HistoricoDasIntegracoes
        linhas={doModulo}
        descricao="As leituras mais recentes, automáticas ou pedidas em Sincronizar agora."
      />
    </div>
  );
}
