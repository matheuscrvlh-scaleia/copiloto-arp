import { Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import {
  formatarData,
  formatarMes,
  formatarMoeda,
  formatarNumero,
} from "@/lib/formato";
import {
  type ValorLancado,
  valorLancadoNoMes,
  valorPelaFaixa,
} from "@/lib/rh/custo";
import { faixaTexto } from "@/lib/rh/plano";
import {
  removerVinculo,
  removerVinculoContrato,
  salvarValorManual,
  vincularBeneficio,
  vincularContrato,
  vincularPelaFolha,
} from "@/server/rh/acoes/cadastros";
import type {
  Beneficio,
  TabelaCadastrada,
  Vinculo,
} from "@/server/rh/beneficios";
import {
  CONTRATOS_NO_PLURAL,
  type DadosDosBeneficios,
  type doBeneficio,
  todosOs,
} from "./dados-beneficio";

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const valorBr = (v: number | null) => (v === null ? "" : formatarNumero(v, 2));
const formAdicionar =
  "grid items-end gap-3 rounded-2xl bg-neutral-900/[0.03] p-3";

/**
 * Valor do mês como o custo calcula: lançado no mês (benefício que varia por
 * mês) ou manual > padrão > faixa pela idade. Com valor manual, mostra também
 * o que sairia sem ele, para conferir.
 */
function ValorDoMes({
  beneficio: b,
  vinculo: v,
  faixas,
  lancados,
  mes,
}: {
  beneficio: Beneficio;
  vinculo: Vinculo;
  faixas: TabelaCadastrada["faixas"] | null;
  lancados: ValorLancado[];
  mes: string;
}) {
  if (b.valor_por_mes) {
    const r = valorLancadoNoMes(lancados, mes);
    if (r.valor === null)
      return <span className="text-amber-700">{r.pendencia}</span>;
    return (
      <>
        <span className="tabular-nums text-neutral-900">
          {formatarMoeda(r.valor)}
        </span>
        {r.aviso && <span className="text-amber-700"> · {r.aviso}</span>}
      </>
    );
  }
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

/** Aba "Quem recebe": por tipo de contrato e pessoas específicas. */
export function QuemRecebe({
  beneficio: b,
  info,
  dados: d,
}: {
  beneficio: Beneficio;
  info: ReturnType<typeof doBeneficio>;
  dados: DadosDosBeneficios;
}) {
  const { vinculos, contratos, porMes, pelaFaixa } = info;
  const contratosAtivos = contratos.filter((c) => c.ate === null);
  const livres = Object.keys(CONTRATOS_NO_PLURAL).filter(
    (tipo) => !contratosAtivos.some((c) => c.tipo_contrato === tipo),
  );
  const desde = d.desdeSugerido;

  return (
    <div className="flex flex-col gap-4">
      <Secao
        titulo="Por tipo de contrato"
        descricao="Todos com o contrato no Copiloto RH recebem, inclusive quem for admitido depois. Quem também está em Pessoas fica com o vínculo da pessoa (e o valor manual dela)."
      >
        <div className="flex flex-col gap-3">
          {contratos.length > 0 && (
            <ul className="flex flex-col divide-y divide-neutral-900/[0.06] text-sm">
              {contratos.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div>
                    <p className="font-medium">{todosOs(c.tipo_contrato)}</p>
                    <p className="text-xs text-neutral-500">
                      desde {formatarData(c.desde)}
                      {c.ate ? ` até ${formatarData(c.ate)}` : ""} ·{" "}
                      {formatarNumero(
                        d.pessoasDoContrato.get(c.tipo_contrato) ?? 0,
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
          {livres.length > 0 && (
            <FormAcao
              acao={vincularContrato}
              rotulo="Vincular contrato"
              rotuloEnviando="Vinculando…"
              className={`${formAdicionar} sm:grid-cols-[1fr_10rem_auto]`}
            >
              <input type="hidden" name="beneficio_id" value={b.id} />
              <label className={rotulo}>
                Tipo de contrato
                <Selecao
                  name="tipo_contrato"
                  obrigatorio
                  rotulo="Tipo de contrato"
                  placeholder="Escolha…"
                  opcoes={livres.map((valor) => ({
                    valor,
                    rotulo: todosOs(valor),
                    descricao: `${formatarNumero(d.pessoasDoContrato.get(valor) ?? 0)} no cadastro`,
                  }))}
                />
              </label>
              <label className={rotulo}>
                Desde
                <input
                  type="date"
                  name="desde"
                  required
                  defaultValue={desde ?? ""}
                  className={classeCampo}
                />
              </label>
            </FormAcao>
          )}
        </div>
      </Secao>

      <Secao
        titulo={`Pessoas (${vinculos.length})`}
        descricao={
          porMes
            ? `Valor de ${formatarMes(d.mesAtual)}, lançado na aba Valores do mês.`
            : `Valor de ${formatarMes(d.mesAtual)}${pelaFaixa ? ", pela idade de cada pessoa na tabela vigente" : ""}. O valor manual vale no lugar dele; apague e salve para voltar ${pelaFaixa ? "à faixa" : "ao padrão"}.`
        }
      >
        <div className="flex flex-col gap-3">
          <FormAcao
            acao={vincularBeneficio}
            rotulo="Adicionar"
            rotuloEnviando="Adicionando…"
            className={`${formAdicionar} ${porMes ? "sm:grid-cols-[1fr_10rem_auto]" : "sm:grid-cols-[1fr_10rem_10rem_auto]"}`}
          >
            <input type="hidden" name="beneficio_id" value={b.id} />
            <label className={rotulo}>
              Adicionar pessoa
              <Selecao
                name="colaborador_id"
                obrigatorio
                busca
                rotulo="Colaborador"
                placeholder="Buscar pelo nome…"
                opcoes={d.opcoesColaborador}
              />
            </label>
            <label className={rotulo}>
              Desde
              <input
                type="date"
                name="desde"
                required
                defaultValue={desde ?? ""}
                className={classeCampo}
              />
            </label>
            {!porMes && (
              <label className={rotulo}>
                Valor manual (R$)
                <input
                  name="valor_manual"
                  inputMode="decimal"
                  placeholder={pelaFaixa ? "pela faixa" : "padrão"}
                  className={classeCampo}
                />
              </label>
            )}
          </FormAcao>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
            <p>
              {desde
                ? `“Desde” sugerido: mês da última folha (${formatarMes(desde)}), para já entrar no custo dela.`
                : null}
            </p>
            {b.rubricas_desconto.length > 0 && (
              <FormAcao
                acao={vincularPelaFolha}
                rotulo={`Adicionar quem tem ${b.rubricas_desconto.join("/")} na folha`}
                rotuloEnviando="Adicionando…"
                variante="secundario"
                className="flex flex-wrap items-center gap-3"
              >
                <input type="hidden" name="beneficio_id" value={b.id} />
              </FormAcao>
            )}
          </div>

          {vinculos.length === 0 ? (
            <p className="py-4 text-center text-sm text-neutral-500">
              Ninguém vinculado pela pessoa.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-900/[0.06] text-sm">
              {vinculos.map((v) => (
                <li
                  key={v.id}
                  className="grid items-center gap-x-4 gap-y-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{v.nome}</p>
                    <p className="text-xs text-neutral-500">
                      desde {formatarData(v.desde)}
                      {v.ate ? ` até ${formatarData(v.ate)}` : ""} ·{" "}
                      <ValorDoMes
                        beneficio={b}
                        vinculo={v}
                        faixas={info.faixas}
                        lancados={info.lancados.filter(
                          (l) => l.colaborador_id === v.colaborador_id,
                        )}
                        mes={d.mesAtual}
                      />
                    </p>
                  </div>
                  {porMes ? (
                    <span />
                  ) : (
                    <FormAcao
                      acao={salvarValorManual}
                      rotulo="Salvar"
                      variante="secundario"
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="id" value={v.id} />
                      <div className="w-32">
                        <input
                          name="valor_manual"
                          inputMode="decimal"
                          aria-label={`Valor manual de ${v.nome} (R$)`}
                          defaultValue={valorBr(v.valor_manual)}
                          placeholder={pelaFaixa ? "pela faixa" : "padrão"}
                          className={`${classeCampo} text-right tabular-nums`}
                        />
                      </div>
                    </FormAcao>
                  )}
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
        </div>
      </Secao>
    </div>
  );
}
