import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import { CONFIGURACOES_RH } from "@/config/navigation";
import {
  competenciaDe,
  formatarData,
  formatarMes,
  formatarMoeda,
  formatarNumero,
} from "@/lib/formato";
import { valorPelaFaixa, vigenteEm } from "@/lib/rh/custo";
import { faixaTexto } from "@/lib/rh/plano";
import { ROTULO_CONTRATO } from "@/lib/rh/rubricas";
import {
  removerVinculo,
  removerVinculoContrato,
  salvarBeneficio,
  salvarValorManual,
  vincularBeneficio,
  vincularContrato,
  vincularPelaFolha,
} from "@/server/rh/acoes/cadastros";
import {
  type Beneficio,
  beneficiosCadastrados,
  colaboradoresAtivos,
  REGRAS_DEPENDENTE,
  type TabelaCadastrada,
  TIPOS_BENEFICIO,
  tabelasDoPlano,
  type Vinculo,
  type VinculoContrato,
  vinculosDeBeneficio,
  vinculosPorContrato,
} from "@/server/rh/beneficios";
import { folhasDoCusto } from "@/server/rh/dados";

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const valorBr = (v: number | null) => (v === null ? "" : formatarNumero(v, 2));

/** Tipos de contrato que recebem benefício (sócio fica fora do custo). */
const CONTRATOS_NO_PLURAL: Record<string, string> = {
  clt: "CLT",
  aprendiz: "jovens aprendizes",
  estagiario: "estagiários",
  pj: "PJ",
};
const todosOs = (tipo: string) =>
  `Todos os ${CONTRATOS_NO_PLURAL[tipo] ?? tipo}`;

/** Cadastro de benefícios e de quem recebe cada um (rh.beneficios). */
export async function Beneficios() {
  const [beneficios, vinculos, contratos, colaboradores, tabelas, folhas] =
    await Promise.all([
      beneficiosCadastrados(),
      vinculosDeBeneficio(),
      vinculosPorContrato(),
      colaboradoresAtivos(),
      tabelasDoPlano(),
      folhasDoCusto(),
    ]);
  const pessoasDoContrato = new Map<string, number>();
  for (const c of colaboradores)
    if (c.tipo_contrato)
      pessoasDoContrato.set(
        c.tipo_contrato,
        (pessoasDoContrato.get(c.tipo_contrato) ?? 0) + 1,
      );
  // Vínculo novo começa no mês da última folha, para entrar no custo dela.
  const desdeSugerido = folhas[0]?.competencia ?? null;
  const mesAtual = competenciaDe(new Date());
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
            contratos={contratos.filter((c) => c.beneficio_id === b.id)}
            pessoasDoContrato={pessoasDoContrato}
            tabelas={tabelas.filter((t) => t.beneficio_id === b.id)}
            mesAtual={mesAtual}
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

/**
 * Valor do mês como o custo calcula: manual > padrão > faixa pela idade. Com
 * valor manual, mostra também o que sairia sem ele, para conferir.
 */
function ValorDoMes({
  beneficio: b,
  vinculo: v,
  faixas,
  mes,
}: {
  beneficio: Beneficio;
  vinculo: Vinculo;
  faixas: TabelaCadastrada["faixas"] | null;
  mes: string;
}) {
  let automatico: React.ReactNode;
  if (b.valor_padrao !== null) {
    automatico = `padrão ${formatarMoeda(b.valor_padrao)}`;
  } else {
    const r = valorPelaFaixa(faixas, v.nascimento, mes);
    automatico =
      r.valor !== null && r.faixa && r.idade !== undefined ? (
        <>
          {r.idade} anos · faixa{" "}
          {faixaTexto(r.faixa.idade_min, r.faixa.idade_max)} ·{" "}
          <span className="tabular-nums text-neutral-900">
            {formatarMoeda(r.valor)}
          </span>
        </>
      ) : (
        <span className="text-amber-700">
          {r.idade !== undefined ? `${r.idade} anos · ` : ""}
          {r.pendencia}
        </span>
      );
  }
  if (v.valor_manual === null) return automatico;
  return (
    <>
      <span className="font-medium tabular-nums text-neutral-900">
        {formatarMoeda(v.valor_manual)} manual
      </span>{" "}
      <span className="text-neutral-400">(sem ele: {automatico})</span>
    </>
  );
}

function CartaoBeneficio({
  beneficio: b,
  vinculos,
  contratos,
  pessoasDoContrato,
  tabelas,
  mesAtual,
  opcoesColaborador,
  desdeSugerido,
}: {
  beneficio: Beneficio;
  vinculos: Vinculo[];
  contratos: VinculoContrato[];
  /** Pessoas no cadastro (sem desligamento) por tipo de contrato. */
  pessoasDoContrato: Map<string, number>;
  tabelas: TabelaCadastrada[];
  /** Competência do valor mostrado em cada pessoa (aaaa-mm-01). */
  mesAtual: string;
  opcoesColaborador: { valor: string; rotulo: string; descricao: string }[];
  desdeSugerido: string | null;
}) {
  const ativos = vinculos.filter((v) => v.ate === null);
  const contratosAtivos = contratos.filter((c) => c.ate === null);
  const pelaFaixa = b.valor_padrao === null;
  const temTabela = tabelas.length > 0;
  const faixas = vigenteEm(tabelas, mesAtual)?.faixas ?? null;
  return (
    <details className="group rounded-2xl bg-white/50 px-4 py-3 ring-1 ring-neutral-900/[0.06]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
        <ChevronRight
          className="size-4 text-neutral-500 transition-transform group-open:rotate-90"
          aria-hidden
        />
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
          {[
            ...contratosAtivos.map((c) => todosOs(c.tipo_contrato)),
            `${ativos.length} ${ativos.length === 1 ? "pessoa" : "pessoas"}`,
          ].join(" + ")}
          {!b.ativo && " · inativo"}
        </span>
        <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white group-open:hidden">
          Editar e vincular
        </span>
      </summary>

      <div className="mt-4 flex flex-col gap-6">
        <FormBeneficio beneficio={b} />

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Por tipo de contrato</p>
            <p className="text-xs text-neutral-500">
              Todos com o contrato no Copiloto RH recebem, inclusive quem for
              admitido depois. Quem também está vinculado abaixo fica com o
              vínculo da pessoa (e o valor manual dela).
            </p>
          </div>
          {contratos.length > 0 && (
            <ul className="flex flex-col divide-y divide-neutral-900/[0.06] text-sm">
              {contratos.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2"
                >
                  <div className="min-w-56 flex-1">
                    <p className="font-medium">{todosOs(c.tipo_contrato)}</p>
                    <p className="text-xs text-neutral-500">
                      desde {formatarData(c.desde)}
                      {c.ate ? ` até ${formatarData(c.ate)}` : ""} ·{" "}
                      {formatarNumero(
                        pessoasDoContrato.get(c.tipo_contrato) ?? 0,
                      )}{" "}
                      no cadastro hoje
                    </p>
                  </div>
                  <FormAcao
                    acao={removerVinculoContrato}
                    rotulo="Remover"
                    rotuloEnviando="Removendo…"
                    variante="perigo"
                    confirmar={`Tirar ${b.nome} de ${todosOs(c.tipo_contrato).toLowerCase()}?`}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="id" value={c.id} />
                  </FormAcao>
                </li>
              ))}
            </ul>
          )}
          <FormAcao
            acao={vincularContrato}
            rotulo="Vincular contrato"
            rotuloEnviando="Vinculando…"
            className="grid items-end gap-3 rounded-2xl bg-neutral-900/[0.03] p-3 sm:grid-cols-[1fr_10rem_auto]"
          >
            <input type="hidden" name="beneficio_id" value={b.id} />
            <label className={rotulo}>
              Tipo de contrato
              <Selecao
                name="tipo_contrato"
                obrigatorio
                rotulo="Tipo de contrato"
                placeholder="Escolha…"
                opcoes={Object.keys(CONTRATOS_NO_PLURAL)
                  .filter(
                    (tipo) =>
                      !contratosAtivos.some((c) => c.tipo_contrato === tipo),
                  )
                  .map((valor) => ({
                    valor,
                    rotulo: todosOs(valor),
                    descricao: `${formatarNumero(pessoasDoContrato.get(valor) ?? 0)} no cadastro`,
                  }))}
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
          </FormAcao>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">Pessoas específicas</p>
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
            <>
              <p className="text-xs text-neutral-500">
                Valor de {formatarMes(mesAtual)}
                {pelaFaixa
                  ? ", pela idade de cada pessoa na tabela vigente"
                  : ""}
                . O valor manual vale no lugar dele; apague e salve para voltar
                {pelaFaixa ? " à faixa" : " ao padrão"}.
              </p>
              <ul className="flex flex-col divide-y divide-neutral-900/[0.06] text-sm">
                {vinculos.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2"
                  >
                    <div className="min-w-56 flex-1">
                      <p className="font-medium">{v.nome}</p>
                      <p className="text-xs text-neutral-500">
                        desde {formatarData(v.desde)}
                        {v.ate ? ` até ${formatarData(v.ate)}` : ""} ·{" "}
                        <ValorDoMes
                          beneficio={b}
                          vinculo={v}
                          faixas={faixas}
                          mes={mesAtual}
                        />
                      </p>
                    </div>
                    <FormAcao
                      acao={salvarValorManual}
                      rotulo="Salvar"
                      variante="secundario"
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="id" value={v.id} />
                      <input
                        name="valor_manual"
                        inputMode="decimal"
                        aria-label={`Valor manual de ${v.nome} (R$)`}
                        defaultValue={valorBr(v.valor_manual)}
                        placeholder={pelaFaixa ? "pela faixa" : "padrão"}
                        className={`${classeCampo} w-32`}
                      />
                    </FormAcao>
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
            </>
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
