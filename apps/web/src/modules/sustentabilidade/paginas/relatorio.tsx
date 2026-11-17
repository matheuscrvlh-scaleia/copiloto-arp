import { NOMES_DOS_MESES } from "@arp/shared/sustentabilidade/painel-indicadores";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link, useParametro } from "@/lib/navegacao";
import { BotaoRelatorioDoMes } from "../components/painel/relatorio";

// /sustentabilidade/relatorio/2026-10: o endereço antigo do "Relatório de
// Sustentabilidade do mês" (era um route.ts que devolvia o PDF direto). Gerar
// o relatório conclui o chamado recorrente do mês, e a API não tem GET que
// grava: aqui a pessoa confirma com um clique e o PDF abre em outra aba.

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export default function Relatorio() {
  const mes = useParametro("mes");
  const m = MES.exec(mes);
  const nome = m ? (NOMES_DOS_MESES[Number(m[2]) - 1] ?? "") : "";
  return (
    <>
      <PageHeader
        title="Relatório de Sustentabilidade do mês"
        description="Uma página no papel timbrado com os indicadores do ano até o mês e a comparação com o ano anterior."
      />
      <Protegido permissao="sustentabilidade.painel">
        <Cartao>
          {m ? (
            <div className="flex flex-col items-start gap-4">
              <p className="text-sm text-neutral-600">
                Relatório de {nome} de {m[1]}. Ao gerar o do mês atual ou do mês
                passado, o chamado “Relatório de Sustentabilidade do mês” é
                concluído.
              </p>
              <BotaoRelatorioDoMes mes={mes} rotulo="Gerar o relatório (PDF)" />
            </div>
          ) : (
            <p className="text-sm text-neutral-600">
              Mês inválido. Use aaaa-mm.
            </p>
          )}
          <p className="mt-4 text-sm">
            <Link
              href="/sustentabilidade"
              className="underline underline-offset-4"
            >
              Voltar ao Painel
            </Link>
          </p>
        </Cartao>
      </Protegido>
    </>
  );
}
