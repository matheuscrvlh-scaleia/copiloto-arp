import Link from "next/link";
import { Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import { CONFIGURACOES_RH } from "@/config/navigation";
import {
  formatarData,
  formatarMes,
  formatarMoeda,
  formatarNumero,
} from "@/lib/formato";
import { ROTULO_CONTRATO } from "@/lib/rh/rubricas";
import {
  type Beneficio,
  beneficiosCadastrados,
  colaboradoresAtivos,
  REGRAS_DEPENDENTE,
  TIPOS_BENEFICIO,
  tabelasDoPlano,
  type Vinculo,
  vinculosDeBeneficio,
} from "@/server/rh/beneficios";
import { folhasDoCusto } from "@/server/rh/dados";
import {
  removerVinculo,
  salvarBeneficio,
  vincularBeneficio,
  vincularPelaFolha,
} from "./actions";

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const valorBr = (v: number | null) => (v === null ? "" : formatarNumero(v, 2));

/** Cadastro de benefícios e de quem recebe cada um (rh.beneficios). */
export async function Beneficios() {
  const [beneficios, vinculos, colaboradores, tabelas, folhas] =
    await Promise.all([
      beneficiosCadastrados(),
      vinculosDeBeneficio(),
      colaboradoresAtivos(),
      tabelasDoPlano(),
      folhasDoCusto(),
    ]);
  // Vínculo novo começa no mês da última folha, para entrar no custo dela.
  const desdeSugerido = folhas[0]?.competencia ?? null;
  const opcoesColaborador = colaboradores.map((c) => ({
    valor: c.id,
    rotulo: c.nome,
    descricao: [
      c.matricula ? `matrícula ${c.matricula}` : null,
      c.tipo_contrato ? ROTULO_CONTRATO[c.tipo_contrato] : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  return (
    <Secao
      id="beneficios"
      titulo="Benefícios"
      descricao="Cada benefício uma vez, e quem recebe. Custo = valor do benefício − o que o funcionário paga na folha (rubricas de desconto) + a parte da empresa nos dependentes. Benefício sem desconto (seguro, massagem) entra pelo valor cheio."
    >
      <div className="flex flex-col gap-3">
        {beneficios.length === 0 && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Nenhum benefício cadastrado: o custo ainda sai sem plano, VR, VT e
            os demais. Comece pelo plano de saúde (tipo “Plano de saúde”, sem
            valor, rubricas 307 e 8111; dependente 490) e depois envie a tabela
            de faixas em{" "}
            <Link
              href={`${CONFIGURACOES_RH.importacoes}#plano`}
              className="font-medium underline underline-offset-4"
            >
              Importações
            </Link>
            .
          </p>
        )}

        {beneficios.map((b) => (
          <CartaoBeneficio
            key={b.id}
            beneficio={b}
            vinculos={vinculos.filter((v) => v.beneficio_id === b.id)}
            temTabela={tabelas.some((t) => t.beneficio === b.nome)}
            opcoesColaborador={opcoesColaborador}
            desdeSugerido={desdeSugerido}
          />
        ))}

        <details className="group rounded-2xl border border-dashed border-neutral-900/15 px-4 py-3 open:bg-white/50">
          <summary className="cursor-pointer text-sm font-medium">
            + Novo benefício
          </summary>
          <div className="mt-4">
            <FormBeneficio />
          </div>
        </details>
      </div>
    </Secao>
  );
}

function CartaoBeneficio({
  beneficio: b,
  vinculos,
  temTabela,
  opcoesColaborador,
  desdeSugerido,
}: {
  beneficio: Beneficio;
  vinculos: Vinculo[];
  temTabela: boolean;
  opcoesColaborador: { valor: string; rotulo: string; descricao: string }[];
  desdeSugerido: string | null;
}) {
  const ativos = vinculos.filter((v) => v.ate === null);
  const pelaFaixa = b.valor_padrao === null;
  return (
    <details className="rounded-2xl bg-white/50 px-4 py-3 ring-1 ring-neutral-900/[0.06]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-semibold">{b.nome}</span>
        <span className="rounded-full bg-neutral-900/[0.06] px-2.5 py-0.5 text-xs text-neutral-600">
          {TIPOS_BENEFICIO[b.tipo]}
        </span>
        <span className="text-xs text-neutral-500">
          {pelaFaixa
            ? temTabela
              ? "valor pela faixa etária"
              : "valor pela faixa: falta enviar a tabela"
            : `${formatarMoeda(b.valor_padrao)}/mês`}
        </span>
        <span className="ml-auto text-xs text-neutral-500">
          {ativos.length} {ativos.length === 1 ? "pessoa" : "pessoas"}
          {!b.ativo && " · inativo"}
        </span>
      </summary>

      <div className="mt-4 flex flex-col gap-6">
        <FormBeneficio beneficio={b} />

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">Quem recebe</p>
            {b.rubricas_desconto.length > 0 && (
              <FormAcao
                acao={vincularPelaFolha}
                rotulo={`Vincular quem tem ${b.rubricas_desconto.join("/")} na folha`}
                rotuloEnviando="Vinculando…"
                variante="secundario"
                className="flex flex-wrap items-center gap-3"
              >
                <input type="hidden" name="beneficio_id" value={b.id} />
              </FormAcao>
            )}
          </div>

          {vinculos.length === 0 ? (
            <p className="text-sm text-neutral-500">Ninguém vinculado ainda.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-900/[0.06] text-sm">
              {vinculos.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2"
                >
                  <span className="min-w-40 flex-1 font-medium">{v.nome}</span>
                  <span className="text-xs text-neutral-500">
                    desde {formatarData(v.desde)}
                    {v.ate ? ` até ${formatarData(v.ate)}` : ""}
                  </span>
                  <span className="w-32 text-right text-xs tabular-nums text-neutral-600">
                    {v.valor_manual !== null
                      ? `${formatarMoeda(v.valor_manual)} (manual)`
                      : ""}
                  </span>
                  <FormAcao
                    acao={removerVinculo}
                    rotulo="Remover"
                    rotuloEnviando="Removendo…"
                    variante="perigo"
                    confirmar={`Remover ${v.nome} de ${b.nome}?`}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="id" value={v.id} />
                  </FormAcao>
                </li>
              ))}
            </ul>
          )}

          <FormAcao
            acao={vincularBeneficio}
            rotulo="Vincular"
            rotuloEnviando="Vinculando…"
            className="grid items-end gap-3 rounded-2xl bg-neutral-900/[0.03] p-3 sm:grid-cols-[1fr_10rem_10rem_auto]"
          >
            <input type="hidden" name="beneficio_id" value={b.id} />
            <label className={rotulo}>
              Colaborador
              <Selecao
                name="colaborador_id"
                obrigatorio
                rotulo="Colaborador"
                placeholder="Escolha…"
                opcoes={opcoesColaborador}
              />
            </label>
            <label className={rotulo}>
              Desde
              <input
                type="date"
                name="desde"
                required
                defaultValue={desdeSugerido ?? ""}
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              Valor manual (R$)
              <input
                name="valor_manual"
                inputMode="decimal"
                placeholder={pelaFaixa ? "pela faixa" : "padrão"}
                className={classeCampo}
              />
            </label>
          </FormAcao>
          {desdeSugerido && (
            <p className="text-xs text-neutral-500">
              “Desde” sugerido: mês da última folha (
              {formatarMes(desdeSugerido)}
              ), para o benefício já entrar no custo dela.
            </p>
          )}
        </div>
      </div>
    </details>
  );
}

function FormBeneficio({ beneficio: b }: { beneficio?: Beneficio }) {
  return (
    <FormAcao
      acao={salvarBeneficio}
      rotulo={b ? "Salvar benefício" : "Cadastrar"}
      className="flex flex-col gap-4"
    >
      {b && <input type="hidden" name="id" value={b.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={rotulo}>
          Nome
          <input
            name="nome"
            required
            defaultValue={b?.nome ?? ""}
            placeholder="Ex.: Unimed"
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Tipo
          <Selecao
            name="tipo"
            obrigatorio
            rotulo="Tipo do benefício"
            valorInicial={b?.tipo ?? ""}
            opcoes={Object.entries(TIPOS_BENEFICIO).map(([valor, r]) => ({
              valor,
              rotulo: r,
            }))}
          />
        </label>
        <label className={rotulo}>
          Valor mensal (R$)
          <input
            name="valor_padrao"
            inputMode="decimal"
            defaultValue={valorBr(b?.valor_padrao ?? null)}
            placeholder="vazio no plano: sai da faixa"
            className={classeCampo}
          />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked={b?.ativo ?? true}
            className="size-4 accent-neutral-900"
          />
          Ativo
        </label>
        <label className={rotulo}>
          Rubricas do titular (desconto)
          <input
            name="rubricas_desconto"
            defaultValue={b?.rubricas_desconto.join(", ") ?? ""}
            placeholder="ex.: 307, 8111"
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Rubricas dos dependentes
          <input
            name="rubricas_desconto_dependente"
            defaultValue={b?.rubricas_desconto_dependente.join(", ") ?? ""}
            placeholder="ex.: 490"
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Empresa paga do dependente
          <Selecao
            name="dependente_regra"
            rotulo="Quanto a empresa paga do dependente"
            valorInicial={b?.dependente_regra ?? "nao_paga"}
            opcoes={Object.entries(REGRAS_DEPENDENTE).map(([valor, r]) => ({
              valor,
              rotulo: r,
            }))}
          />
        </label>
        <label className={rotulo}>
          % ou valor do dependente
          <input
            name="dependente_valor"
            inputMode="decimal"
            defaultValue={valorBr(b?.dependente_valor ?? null)}
            placeholder="se a empresa paga"
            className={classeCampo}
          />
        </label>
      </div>
    </FormAcao>
  );
}
