import { SeloStatus } from "@/components/dashboard/indicador";
import { type Coluna, Secao, Tabela } from "@/components/dashboard/tabela";
import { Fonte } from "@/components/dashboard/tela";
import {
  formatarData,
  formatarDataHora,
  formatarMes,
  formatarMoeda,
  formatarNumero,
} from "@/lib/formato";
import {
  nomeDaUnidade,
  PAPEIS,
  somarReais,
  type UnidadeEnergia,
} from "@/lib/operacoes/energisa-contas";
import type { FaturaDetalhe, ItemDaFatura } from "@/server/operacoes/contas";
import { kwh, LinkPdf } from "./comum";

// Detalhe de uma fatura: o que foi lido do cabeçalho e a tabela "Itens da
// Fatura" completa, com a conferência (soma dos itens = total).

const TIPOS: Record<string, string> = {
  consumo: "Consumo",
  injetada: "Crédito (energia injetada)",
  bandeira: "Bandeira",
  iluminacao: "Iluminação pública",
  outro: "Outro",
};

const num = (v: number | null, casas = 2) =>
  v === null ? "—" : formatarNumero(v, casas);
const reais = (v: number | null) => (v === null ? "—" : formatarMoeda(v));

function Campo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-neutral-500">{rotulo}</dt>
      <dd className="text-sm text-neutral-900">{children}</dd>
    </div>
  );
}

export function DetalheDaFatura({
  fatura: f,
  unidade,
  pdf,
}: {
  fatura: FaturaDetalhe;
  unidade: UnidadeEnergia | undefined;
  pdf: string | undefined;
}) {
  const soma = somarReais(f.itens.map((i) => i.valor));
  const bate = Math.round(soma * 100) === Math.round(f.total * 100);
  const colunas: Coluna<ItemDaFatura>[] = [
    {
      titulo: "Item",
      valor: (i) => (
        <span className="flex flex-col">
          <span className="font-medium">{i.descricao}</span>
          <span className="text-xs text-neutral-500">
            {TIPOS[i.tipo] ?? i.tipo}
            {i.origem &&
              ` · ${i.origem === "oUC" ? "de outra unidade (oUC)" : "da própria unidade (mUC)"}`}
            {i.mes_geracao && `, gerado em ${formatarMes(i.mes_geracao)}`}
          </span>
        </span>
      ),
    },
    { titulo: "Unid.", valor: (i) => i.unidade ?? "—" },
    { titulo: "Quant.", numero: true, valor: (i) => num(i.quantidade, 0) },
    {
      titulo: "Preço unit. (R$)",
      numero: true,
      valor: (i) => num(i.preco_unitario, 6),
    },
    {
      titulo: "Valor (R$)",
      numero: true,
      valor: (i) => (
        <span className={`font-medium ${i.valor < 0 ? "text-green-700" : ""}`}>
          {formatarNumero(i.valor, 2)}
        </span>
      ),
    },
    { titulo: "PIS/COFINS", numero: true, valor: (i) => num(i.pis_cofins) },
    { titulo: "Base ICMS", numero: true, valor: (i) => num(i.base_icms) },
    {
      titulo: "Alíq. ICMS",
      numero: true,
      valor: (i) =>
        i.aliquota_icms === null
          ? "—"
          : `${formatarNumero(i.aliquota_icms, 0)}%`,
    },
    { titulo: "ICMS", numero: true, valor: (i) => num(i.icms) },
    {
      titulo: "Tarifa unit. (R$)",
      numero: true,
      valor: (i) => num(i.tarifa_unitaria, 6),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Secao
        titulo="Dados da fatura"
        exemplo={f.exemplo && "fatura de exemplo (fictícia)"}
      >
        <dl
          data-guia="op-contas-detalhe-dados"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Campo rotulo="Unidade">
            {nomeDaUnidade(f.matricula, unidade)}
            <span className="block text-xs text-neutral-500">
              Matrícula {f.matricula}
              {unidade ? ` · ${PAPEIS[unidade.papel]}` : ""}
            </span>
          </Campo>
          <Campo rotulo="Endereço">{unidade?.endereco ?? "—"}</Campo>
          <Campo rotulo="Referência e vencimento">
            {formatarMes(f.referencia)} · vence {formatarData(f.vencimento)}
          </Campo>
          <Campo rotulo="Total">
            <span className="font-semibold">{formatarMoeda(f.total)}</span>
          </Campo>
          <Campo rotulo="Leituras">
            {formatarData(f.leitura_anterior_data)} a{" "}
            {formatarData(f.leitura_atual_data)}
            {f.dias !== null && ` (${f.dias} dias)`}
            <span className="block text-xs text-neutral-500">
              Próxima: {formatarData(f.proxima_leitura)}
            </span>
          </Campo>
          <Campo rotulo="Medidor">
            {f.medidor ?? "—"}
            {f.leitura_anterior !== null && f.leitura_atual !== null && (
              <span className="block text-xs text-neutral-500">
                {formatarNumero(f.leitura_anterior)} →{" "}
                {formatarNumero(f.leitura_atual)}
              </span>
            )}
          </Campo>
          <Campo rotulo="Consumo">{kwh(f.consumo_kwh)}</Campo>
          <Campo rotulo="Compensado">
            <span className="text-green-700">
              {kwh(f.compensado_kwh)} · {formatarMoeda(f.valor_compensado)}
            </span>
          </Campo>
          <Campo rotulo="Saldo de créditos">
            {kwh(f.saldo_kwh)}
            <span className="block text-xs text-neutral-500">
              A expirar no próximo ciclo: {kwh(f.expirar_kwh)}
            </span>
          </Campo>
          <Campo rotulo="Classificação">
            {f.classificacao_gd
              ? `${f.classificacao_gd.replace("_", " ")} · Lei 14.300/22`
              : "—"}
            {unidade?.classificacao && (
              <span className="block text-xs text-neutral-500">
                {unidade.classificacao}
                {unidade.ligacao ? ` · ${unidade.ligacao}` : ""}
              </span>
            )}
          </Campo>
          <Campo rotulo="Bandeira">
            {f.bandeira ?? "—"} · {formatarMoeda(f.valor_bandeira)}
          </Campo>
          {f.injetada_kwh !== null && (
            <Campo rotulo="Energia injetada na rede">
              {kwh(f.injetada_kwh)}
            </Campo>
          )}
          <Campo rotulo="Nota fiscal">{f.nota_fiscal ?? "—"}</Campo>
          {f.observacao && <Campo rotulo="Observação">{f.observacao}</Campo>}
          <Campo rotulo="Importada em">
            {formatarDataHora(f.importado_em)}
          </Campo>
          <Campo rotulo="PDF original">
            {pdf ? (
              <LinkPdf href={pdf} rotulo="Abrir o PDF original da fatura" />
            ) : (
              <span className="text-neutral-500">
                {f.exemplo ? "Fatura de exemplo, sem PDF" : "Não encontrado"}
              </span>
            )}
          </Campo>
        </dl>
      </Secao>

      <Secao
        titulo="Itens da fatura"
        descricao="Como na tabela da fatura; créditos (valores negativos) em verde"
      >
        <div className="mb-3">
          <SeloStatus
            status={bate ? "ok" : "fora"}
            rotulo={
              bate
                ? `Itens somam o total (${formatarMoeda(f.total)})`
                : `Itens somam ${formatarMoeda(soma)}; total ${formatarMoeda(f.total)}`
            }
          />
        </div>
        <div data-guia="op-contas-detalhe-itens">
          <Tabela
            colunas={colunas}
            linhas={f.itens}
            chave={(i) => i.id}
            rodape={[
              "Soma dos itens",
              "",
              "",
              "",
              formatarNumero(soma, 2),
              reais(f.pis_cofins),
              "",
              "",
              reais(f.icms),
              "",
            ]}
          />
        </div>
        <Fonte>
          Fatura da Energisa, tabela "Itens da Fatura" e linha "TOTAL"
          (PIS/COFINS e ICMS do rodapé vêm da linha TOTAL)
        </Fonte>
      </Secao>
    </div>
  );
}
