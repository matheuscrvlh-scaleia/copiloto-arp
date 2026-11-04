import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { Protegido } from "@/components/protegido";
import { removerExemplos } from "@/server/comercial/acoes/parametros";

export const metadata: Metadata = { title: "Dados de exemplo do Comercial" };

export default function Page() {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-56" />
        </TelaCarregando>
      }
    >
      <Protegido permissao="comercial.parametros.editar">
        <Secao
          titulo="Remover dados de exemplo"
          descricao="Apaga os registros de exemplo que vieram com o sistema para demonstração: respostas, convites, rodadas e temas do Censo, contatos com locatários, contratos e rascunhos, fichas cadastrais, propostas de evento e imóveis da pesquisa. O que foi criado ou importado de verdade fica."
        >
          <div className="flex flex-col gap-4">
            <Nota>
              Não apaga parâmetros, listas, faixas, feriados, metas nem o kit de
              entrega. Os dados do RD Station e do ENET continuam de exemplo até
              esses sistemas serem ligados ao Centralizador: eles não ficam
              guardados aqui.
            </Nota>
            <FormAcao
              acao={removerExemplos}
              rotulo="Remover dados de exemplo"
              rotuloEnviando="Removendo…"
              variante="perigo"
              confirmar="Remover todos os dados de exemplo do Comercial? Não dá para desfazer."
            />
          </div>
        </Secao>
      </Protegido>
    </Suspense>
  );
}
