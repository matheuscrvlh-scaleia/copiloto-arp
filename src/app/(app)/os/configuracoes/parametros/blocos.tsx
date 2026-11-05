import { CalendarX, Info, Plus, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { Situacao } from "@/components/admin/ui";
import { Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { UltimasAlteracoes } from "@/components/os/configuracoes/alteracoes";
import { ListaDeTextos } from "@/components/os/configuracoes/lista-editavel";
import { Selecao } from "@/components/selecao";
import { formatarData, formatarMoeda, formatarNumero } from "@/lib/formato";
import {
  DIAS_DA_SEMANA,
  textoDosDias,
  valorPorHora,
  valorVigente,
} from "@/lib/os/configuracoes";
import { ROTAS_OS } from "@/lib/os/rotas";
import { FAIXAS_SINAL_PADRAO } from "@/lib/os/sinal";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import {
  corrigirVigencia,
  incluirFeriado,
  incluirVigencia,
  removerAtivoCategoria,
  removerFeriado,
  removerVigencia,
  salvarAtivoCategoria,
  salvarAtivos,
  salvarCiclo,
  salvarOperacoes,
  salvarTecnico,
} from "@/server/os/acoes/config-parametros";
import { parametros, pessoas, setores } from "@/server/os/base";
import {
  ativoCategorias,
  feriados,
  type Tecnico,
  tecnicos,
  ultimasAlteracoes,
} from "@/server/os/configuracoes";

// Blocos de números e cadastros: ciclo do chamado (com feriados),
// operações (técnicos e valor por minuto) e ativos (sinal de troca).

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const ajuda = "font-normal text-neutral-500";
const subtitulo = "text-sm font-semibold text-neutral-900";
const separador = "flex flex-col gap-4 border-t border-neutral-200/70 pt-5";

const hhmm = (t: string) => t.slice(0, 5);
const valorMinuto = (v: number) => `R$ ${formatarNumero(v, 4)}`;

// ---------------------------------------------------------------------------
// Ciclo
// ---------------------------------------------------------------------------

export async function BlocoCiclo() {
  const [p, lista, alteracoes] = await Promise.all([
    parametros(),
    feriados(),
    ultimasAlteracoes(["os.parametros", "os.feriados"], {
      campos: [
        "aceite_dias_uteis",
        "aviso_vencimento_horas",
        "confirmacao_alerta_dias",
        "dias_uteis",
        "expediente_inicio",
        "expediente_fim",
      ],
    }),
  ]);
  const hoje = hojeEmBrasilia(new Date());
  const ano = hoje.slice(0, 4);
  const proximos = lista.filter((f) => f.data >= `${ano}-01-01`);
  const anteriores = lista.filter((f) => f.data < `${ano}-01-01`).reverse();
  const porAno = Map.groupBy(proximos, (f) => f.data.slice(0, 4));

  return (
    <Secao
      id="ciclo"
      titulo="Ciclo do chamado"
      descricao="Prazos do ciclo, dias úteis e expediente. Dias úteis contam só os dias marcados, sem os feriados."
    >
      <div className="flex flex-col gap-5">
        <FormAcao acao={salvarCiclo} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className={rotulo}>
              Aceite automático (dias úteis)
              <input
                name="aceite_dias_uteis"
                type="number"
                min={0}
                max={60}
                required
                defaultValue={p.aceite_dias_uteis}
                className={classeCampo}
              />
              <span className={ajuda}>
                Concluído sem resposta de quem pediu fecha sozinho depois disso.
              </span>
            </label>
            <label className={rotulo}>
              Aviso de vencimento (horas antes)
              <input
                name="aviso_vencimento_horas"
                type="number"
                min={1}
                max={240}
                required
                defaultValue={p.aviso_vencimento_horas}
                className={classeCampo}
              />
              <span className={ajuda}>
                O prazo fica amarelo e o responsável é avisado.
              </span>
            </label>
            <label className={rotulo}>
              Confirmação parada (dias)
              <input
                name="confirmacao_alerta_dias"
                type="number"
                min={1}
                max={60}
                required
                defaultValue={p.confirmacao_alerta_dias}
                className={classeCampo}
              />
              <span className={ajuda}>
                Alerta a quem pediu quando o concluído espera a confirmação.
              </span>
            </label>
          </div>
          <fieldset className="m-0 flex flex-col gap-1.5 p-0">
            <legend className="mb-1.5 text-xs font-medium text-neutral-600">
              Dias úteis ({textoDosDias(p.dias_uteis)})
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_DA_SEMANA.map((d) => (
                <label
                  key={d.dia}
                  className="cursor-pointer rounded-full px-3 py-1.5 text-sm text-neutral-700 ring-1 ring-neutral-900/10 transition has-[:checked]:bg-neutral-900 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neutral-900/40"
                >
                  <input
                    type="checkbox"
                    name="dias_uteis"
                    value={d.dia}
                    defaultChecked={p.dias_uteis.includes(d.dia)}
                    className="sr-only"
                  />
                  <span aria-hidden>{d.curto}</span>
                  <span className="sr-only">{d.nome}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
            <label className={rotulo}>
              Expediente começa
              <input
                name="expediente_inicio"
                type="time"
                required
                defaultValue={hhmm(p.expediente_inicio)}
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              Termina
              <input
                name="expediente_fim"
                type="time"
                required
                defaultValue={hhmm(p.expediente_fim)}
                className={classeCampo}
              />
            </label>
          </div>
          <p className="text-xs text-neutral-500">
            Prazo em dias úteis vence no fim do expediente.
          </p>
        </FormAcao>

        <div className={separador}>
          <div>
            <h3 className={subtitulo}>Feriados</h3>
            <p className="text-xs text-neutral-500">
              Os nacionais e o estadual já estão aqui. Inclua os municipais de
              Nova Friburgo e os pontos facultativos que a ARP seguir.
            </p>
          </div>
          <FormAcao
            acao={incluirFeriado}
            rotulo="Incluir feriado"
            variante="secundario"
            className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[11rem_minmax(0,1fr)_auto]"
          >
            <label className={rotulo}>
              Data
              <input name="data" type="date" required className={classeCampo} />
            </label>
            <label className={rotulo}>
              Nome
              <input
                name="nome"
                required
                maxLength={80}
                placeholder="ex.: Aniversário de Nova Friburgo"
                className={classeCampo}
              />
            </label>
          </FormAcao>
          {[...porAno].map(([a, dias]) => (
            <div key={a}>
              <p className="mb-1 text-xs font-medium text-neutral-500">{a}</p>
              <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {dias.map((f) => (
                  <li
                    key={f.data}
                    className={`flex items-center gap-3 border-b border-neutral-900/[0.06] py-1 text-sm ${f.data < hoje ? "text-neutral-500" : ""}`}
                  >
                    <span className="w-24 shrink-0 tabular-nums">
                      {formatarData(f.data)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{f.nome}</span>
                    <AcaoRapida
                      acao={removerFeriado}
                      campos={{ data: f.data }}
                      rotulo={`Remover ${f.nome}`}
                      icone={<CalendarX className="size-4" aria-hidden />}
                      confirmar={`Remover o feriado ${f.nome} (${formatarData(f.data)})? Os prazos que caírem nele voltam a contar o dia.`}
                      perigo
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {anteriores.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-neutral-500">
                {anteriores.length} feriados de anos anteriores
              </summary>
              <ul className="mt-2 grid grid-cols-1 gap-x-6 text-sm text-neutral-500 sm:grid-cols-2">
                {anteriores.map((f) => (
                  <li key={f.data} className="flex gap-3 py-0.5">
                    <span className="w-24 shrink-0 tabular-nums">
                      {formatarData(f.data)}
                    </span>
                    <span className="truncate">{f.nome}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <UltimasAlteracoes lista={alteracoes} tabela="os.parametros" />
      </div>
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Operações
// ---------------------------------------------------------------------------

export async function BlocoOperacoes() {
  const [p, lista, listaPessoas, listaSetores, alteracoes] = await Promise.all([
    parametros(),
    tecnicos(),
    pessoas(),
    setores(),
    ultimasAlteracoes(["os.parametros", "os.tecnicos", "os.tecnico_valores"], {
      campos: [
        "almoco_inicio",
        "almoco_fim",
        "teto_terceirizado",
        "terceirizado_prazo_dias",
        "causas_falha",
      ],
    }),
  ]);
  const hoje = hojeEmBrasilia(new Date());
  const ativos = lista.filter((t) => !t.desligado_em || t.desligado_em > hoje);
  const desligados = lista.filter(
    (t) => t.desligado_em && t.desligado_em <= hoje,
  );
  const opcoesPessoas = [
    { valor: "", rotulo: "Sem usuário" },
    ...listaPessoas.map((x) => ({ valor: x.id, rotulo: x.nome })),
  ];
  const opcoesSetores = [
    { valor: "", rotulo: "Sem setor" },
    ...listaSetores.map((s) => ({ valor: s.id, rotulo: s.nome })),
  ];
  const nomePessoa = new Map(listaPessoas.map((x) => [x.id, x.nome]));
  const nomeSetor = new Map(listaSetores.map((s) => [s.id, s.nome]));

  return (
    <Secao
      id="operacoes"
      titulo="Operações"
      descricao="Técnicos e valor por minuto (custo da mão de obra das OS), almoço padrão das sessões, terceirizados e causas de falha."
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div>
            <h3 className={subtitulo}>Técnicos e valor por minuto</h3>
            <p className="mt-1 flex items-start gap-1.5 text-xs text-neutral-500">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Cada valor vale a partir da data de início. Mudar o valor não
              recalcula OS antigas: cada sessão usa o valor vigente no dia dela.
              Para mudar, inclua um valor novo com a data em que passa a valer.
            </p>
          </div>
          {ativos.length === 0 && (
            <p className="text-sm text-neutral-500">Nenhum técnico ativo.</p>
          )}
          <ul className="flex flex-col gap-2">
            {ativos.map((t) => (
              <li key={t.id}>
                <CartaoTecnico
                  t={t}
                  hoje={hoje}
                  usuario={
                    t.usuario_id ? nomePessoa.get(t.usuario_id) : undefined
                  }
                  setor={t.setor_id ? nomeSetor.get(t.setor_id) : undefined}
                  opcoesPessoas={opcoesPessoas}
                  opcoesSetores={opcoesSetores}
                />
              </li>
            ))}
          </ul>
          {desligados.length > 0 && (
            <details className="rounded-2xl px-1">
              <summary className="cursor-pointer text-xs text-neutral-500">
                {desligados.length}{" "}
                {desligados.length === 1
                  ? "técnico desligado"
                  : "técnicos desligados"}{" "}
                (continuam nas OS antigas)
              </summary>
              <ul className="mt-2 flex flex-col gap-2">
                {desligados.map((t) => (
                  <li key={t.id}>
                    <CartaoTecnico
                      t={t}
                      hoje={hoje}
                      usuario={
                        t.usuario_id ? nomePessoa.get(t.usuario_id) : undefined
                      }
                      setor={t.setor_id ? nomeSetor.get(t.setor_id) : undefined}
                      opcoesPessoas={opcoesPessoas}
                      opcoesSetores={opcoesSetores}
                    />
                  </li>
                ))}
              </ul>
            </details>
          )}
          <details className="group rounded-2xl border border-dashed border-neutral-300 px-4 py-3 open:border-solid open:bg-white/50">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <Plus
                className="size-4 transition group-open:rotate-45"
                aria-hidden
              />
              Novo técnico
            </summary>
            <div className="mt-4">
              <FormTecnico
                opcoesPessoas={opcoesPessoas}
                opcoesSetores={opcoesSetores}
              />
            </div>
          </details>
        </div>

        <FormAcao acao={salvarOperacoes} className={separador}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className={rotulo}>
              Almoço padrão começa
              <input
                name="almoco_inicio"
                type="time"
                required
                defaultValue={hhmm(p.almoco_inicio)}
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              Almoço termina
              <input
                name="almoco_fim"
                type="time"
                required
                defaultValue={hhmm(p.almoco_fim)}
                className={classeCampo}
              />
              <span className={ajuda}>
                Sugerido nas sessões que passam pelo almoço.
              </span>
            </label>
            <label className={rotulo}>
              Teto do terceirizado (R$)
              <input
                name="teto_terceirizado"
                inputMode="decimal"
                defaultValue={
                  p.teto_terceirizado === null
                    ? ""
                    : formatarNumero(p.teto_terceirizado, 2)
                }
                placeholder="sem teto"
                className={classeCampo}
              />
              <span className={ajuda}>
                Acima disso, o orçamento precisa de aprovação.
              </span>
            </label>
            <label className={rotulo}>
              Retorno do terceirizado (dias úteis)
              <input
                name="terceirizado_prazo_dias"
                type="number"
                min={1}
                max={90}
                required
                defaultValue={p.terceirizado_prazo_dias}
                className={classeCampo}
              />
              <span className={ajuda}>
                Padrão quando a empresa e a categoria não definem um.
              </span>
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-neutral-600">
              Causas de falha (escolhidas ao concluir uma OS corretiva)
            </p>
            <ListaDeTextos
              name="causas_falha"
              inicial={p.causas_falha}
              rotuloItem="causa"
              placeholder="Nova causa (ex.: Infiltração)"
            />
          </div>
        </FormAcao>
        <UltimasAlteracoes lista={alteracoes} tabela="os.tecnico_valores" />
      </div>
    </Secao>
  );
}

function CartaoTecnico({
  t,
  hoje,
  usuario,
  setor,
  opcoesPessoas,
  opcoesSetores,
}: {
  t: Tecnico;
  hoje: string;
  usuario?: string;
  setor?: string;
  opcoesPessoas: { valor: string; rotulo: string }[];
  opcoesSetores: { valor: string; rotulo: string }[];
}) {
  const vigente = valorVigente(
    t.valores.map((v) => ({ ...v, valor_minuto: Number(v.valor_minuto) })),
    hoje,
  );
  const desligado = !!t.desligado_em && t.desligado_em <= hoje;
  return (
    <details className="group rounded-2xl border border-neutral-900/[0.06] bg-white/60">
      <summary className="flex cursor-pointer list-none flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-900/[0.06] text-neutral-700">
            <UserRound className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2 font-medium">
              {t.nome}
              {desligado && (
                <Situacao tipo="neutro">
                  Desligado em {formatarData(t.desligado_em)}
                </Situacao>
              )}
              {!desligado && t.desligado_em && (
                <Situacao tipo="rodando">
                  Sai em {formatarData(t.desligado_em)}
                </Situacao>
              )}
            </span>
            <span className="block text-xs text-neutral-500">
              {[
                setor ?? "Sem setor",
                usuario ? `usuário ${usuario}` : "sem usuário",
              ].join(" · ")}
            </span>
          </span>
        </span>
        <span className="pl-12 text-sm tabular-nums sm:pl-0 sm:text-right">
          {vigente ? (
            <>
              <span className="font-medium">
                {valorMinuto(vigente.valor_minuto)}/min
              </span>
              <span className="block text-xs text-neutral-500">
                {formatarMoeda(valorPorHora(vigente.valor_minuto))}/hora
              </span>
            </>
          ) : (
            <span className="text-amber-900">Sem valor por minuto</span>
          )}
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-neutral-900/[0.06] p-3">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[22rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="px-1 py-1 font-medium">Vale a partir de</th>
                <th className="px-1 py-1 text-right font-medium">Por minuto</th>
                <th className="px-1 py-1 text-right font-medium">Por hora</th>
                <th className="px-1 py-1">
                  <span className="sr-only">Situação</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {t.valores.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-1 py-2 text-xs text-neutral-500"
                  >
                    Nenhum valor ainda: as OS deste técnico ficam sem custo de
                    mão de obra.
                  </td>
                </tr>
              )}
              {t.valores.map((v) => (
                <tr key={v.id} className="border-t border-neutral-900/[0.06]">
                  <td className="px-1 py-1.5 tabular-nums">
                    {formatarData(v.vigente_desde)}
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums">
                    {valorMinuto(Number(v.valor_minuto))}
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums">
                    {formatarMoeda(valorPorHora(Number(v.valor_minuto)))}
                  </td>
                  <td className="px-1 py-1.5 text-right">
                    {v.id === vigente?.id ? (
                      <Situacao tipo="ok">Vigente</Situacao>
                    ) : v.vigente_desde > hoje ? (
                      <span className="inline-flex items-center gap-1">
                        <Situacao tipo="rodando">Futuro</Situacao>
                        <AcaoRapida
                          acao={removerVigencia}
                          campos={{ id: v.id }}
                          rotulo="Remover valor futuro"
                          icone={<Trash2 className="size-4" aria-hidden />}
                          confirmar="Remover este valor que ainda não começou a valer?"
                          perigo
                        />
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-500">Anterior</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FormAcao
          acao={incluirVigencia}
          rotulo="Incluir valor"
          variante="secundario"
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[11rem_11rem_auto]"
        >
          <input type="hidden" name="tecnico_id" value={t.id} />
          <label className={rotulo}>
            Vale a partir de
            <input
              name="vigente_desde"
              type="date"
              required
              defaultValue={hoje}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Valor por minuto (R$)
            <input
              name="valor_minuto"
              inputMode="decimal"
              required
              placeholder="ex.: 0,5833"
              className={classeCampo}
            />
          </label>
        </FormAcao>
        {t.valores.some((v) => v.vigente_desde <= hoje) && (
          <FormAcao
            acao={corrigirVigencia}
            rotulo="Corrigir valor"
            variante="secundario"
            confirmar="Corrigir este valor? As OS do período dele serão recalculadas."
            className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[11rem_11rem_auto]"
          >
            <label className={rotulo}>
              Corrigir o valor de
              <Selecao
                name="id"
                rotulo="Valor a corrigir"
                obrigatorio
                valorInicial={vigente?.id ?? ""}
                opcoes={t.valores
                  .filter((v) => v.vigente_desde <= hoje)
                  .map((v) => ({
                    valor: v.id,
                    rotulo: `${formatarData(v.vigente_desde)} · ${valorMinuto(Number(v.valor_minuto))}`,
                  }))}
              />
            </label>
            <label className={rotulo}>
              Valor certo (R$/min)
              <input
                name="valor_minuto"
                inputMode="decimal"
                required
                placeholder="ex.: 0,5000"
                className={classeCampo}
              />
            </label>
          </FormAcao>
        )}
        <div className="border-t border-neutral-900/[0.06] pt-3">
          <FormTecnico
            t={t}
            opcoesPessoas={opcoesPessoas}
            opcoesSetores={opcoesSetores}
          />
        </div>
      </div>
    </details>
  );
}

function FormTecnico({
  t,
  opcoesPessoas,
  opcoesSetores,
}: {
  t?: Tecnico;
  opcoesPessoas: { valor: string; rotulo: string }[];
  opcoesSetores: { valor: string; rotulo: string }[];
}) {
  return (
    <FormAcao
      acao={salvarTecnico}
      rotulo={t ? "Salvar técnico" : "Incluir técnico"}
      className="flex flex-col gap-3"
    >
      {t && <input type="hidden" name="id" value={t.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={rotulo}>
          Nome
          <input
            name="nome"
            required
            maxLength={120}
            defaultValue={t?.nome}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Usuário do sistema
          <Selecao
            name="usuario_id"
            valorInicial={t?.usuario_id ?? ""}
            opcoes={opcoesPessoas}
          />
        </label>
        <label className={rotulo}>
          Setor
          <Selecao
            name="setor_id"
            valorInicial={t?.setor_id ?? ""}
            opcoes={opcoesSetores}
          />
        </label>
        <label className={rotulo}>
          Desligamento
          <input
            name="desligado_em"
            type="date"
            defaultValue={t?.desligado_em ?? ""}
            className={classeCampo}
          />
          <span className={ajuda}>Sai dos painéis a partir da data.</span>
        </label>
      </div>
    </FormAcao>
  );
}

// ---------------------------------------------------------------------------
// Ativos
// ---------------------------------------------------------------------------

const FAIXAS = [
  {
    titulo: "Peso da manutenção",
    explicacao:
      "Custo das OS do ativo nos últimos 12 meses ÷ valor de reposição. Gastar 60% do preço de um novo em um ano é sinal de troca.",
    unidade: "% do valor de reposição",
    avaliar: "sinal_peso_avaliar",
    trocar: "sinal_peso_trocar",
    sugerido: [FAIXAS_SINAL_PADRAO.pesoAvaliar, FAIXAS_SINAL_PADRAO.pesoTrocar],
  },
  {
    titulo: "Corretivas em 12 meses",
    explicacao:
      "Quantas OS corretivas o ativo teve no último ano (preventivas não contam).",
    unidade: "OS corretivas",
    avaliar: "sinal_corretivas_avaliar",
    trocar: "sinal_corretivas_trocar",
    sugerido: [
      FAIXAS_SINAL_PADRAO.corretivasAvaliar,
      FAIXAS_SINAL_PADRAO.corretivasTrocar,
    ],
  },
  {
    titulo: "Idade",
    explicacao:
      "Tempo desde a compra, em % da vida útil (a do ativo ou a padrão da categoria).",
    unidade: "% da vida útil",
    avaliar: "sinal_idade_avaliar_pct",
    trocar: "sinal_idade_trocar_pct",
    sugerido: [
      FAIXAS_SINAL_PADRAO.idadeAvaliarPct,
      FAIXAS_SINAL_PADRAO.idadeTrocarPct,
    ],
  },
] as const;

export async function BlocoAtivos() {
  const [p, categoriasAtivo, alteracoes] = await Promise.all([
    parametros(),
    ativoCategorias(),
    ultimasAlteracoes(["os.parametros", "os.ativo_categorias"], {
      campos: [
        "sinal_peso_avaliar",
        "sinal_peso_trocar",
        "sinal_corretivas_avaliar",
        "sinal_corretivas_trocar",
        "sinal_idade_avaliar_pct",
        "sinal_idade_trocar_pct",
        "preventiva_antecedencia_dias",
        "recorrencia_antecedencia_dias",
        "garantia_aviso_dias",
      ],
    }),
  ]);
  const valor = (campo: (typeof FAIXAS)[number]["avaliar" | "trocar"]) =>
    formatarNumero(
      Number(p[campo]),
      Number.isInteger(Number(p[campo])) ? 0 : 1,
    );

  return (
    <Secao
      id="ativos"
      titulo="Ativos"
      descricao="Categorias de ativo, as faixas do sinal de troca (manter, avaliar, trocar) e a antecedência das preventivas e dos lembretes."
    >
      <div className="flex flex-col gap-5">
        <FormAcao acao={salvarAtivos} className="flex flex-col gap-4">
          <div>
            <h3 className={subtitulo}>Sinal de troca</h3>
            <p className="text-xs text-neutral-500">
              O sinal é o pior dos três critérios: abaixo de “avaliar”, manter;
              entre os dois, avaliar; a partir de “trocar”, trocar.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {FAIXAS.map((f) => (
              <fieldset
                key={f.titulo}
                className="m-0 grid grid-cols-1 gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/50 p-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem]"
              >
                <legend className="sr-only">{f.titulo}</legend>
                <div>
                  <p className="text-sm font-medium">{f.titulo}</p>
                  <p className="text-xs text-neutral-500">{f.explicacao}</p>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    Sugerido: avaliar {f.sugerido[0]}, trocar {f.sugerido[1]} (
                    {f.unidade})
                  </p>
                </div>
                <label className={rotulo}>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-2 rounded-full bg-amber-500"
                    />
                    Avaliar a partir de
                  </span>
                  <input
                    name={f.avaliar}
                    inputMode="decimal"
                    required
                    defaultValue={valor(f.avaliar)}
                    className={classeCampo}
                  />
                </label>
                <label className={rotulo}>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-2 rounded-full bg-red-600"
                    />
                    Trocar a partir de
                  </span>
                  <input
                    name={f.trocar}
                    inputMode="decimal"
                    required
                    defaultValue={valor(f.trocar)}
                    className={classeCampo}
                  />
                </label>
              </fieldset>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className={rotulo}>
              Antecedência das preventivas (dias)
              <input
                name="preventiva_antecedencia_dias"
                type="number"
                min={0}
                max={90}
                required
                defaultValue={p.preventiva_antecedencia_dias}
                className={classeCampo}
              />
              <span className={ajuda}>
                A OS preventiva é criada sozinha este tanto antes da data do
                plano.
              </span>
            </label>
            <label className={rotulo}>
              Antecedência dos lembretes recorrentes (dias)
              <input
                name="recorrencia_antecedencia_dias"
                type="number"
                min={0}
                max={60}
                required
                defaultValue={p.recorrencia_antecedencia_dias}
                className={classeCampo}
              />
              <span className={ajuda}>
                O próximo chamado da série nasce este tanto antes.
              </span>
            </label>
            <label className={rotulo}>
              Aviso de garantia vencendo (dias antes)
              <input
                name="garantia_aviso_dias"
                type="number"
                min={0}
                max={365}
                required
                defaultValue={p.garantia_aviso_dias}
                className={classeCampo}
              />
              <span className={ajuda}>
                A ficha do ativo avisa este tanto antes do fim da garantia.
              </span>
            </label>
          </div>
        </FormAcao>

        <div className={separador}>
          <div>
            <h3 className={subtitulo}>Categorias de ativo</h3>
            <p className="text-xs text-neutral-500">
              A vida útil padrão vale para o ativo que não tiver a própria.
              Também dá para editar em{" "}
              <Link
                href={`${ROTAS_OS.ativos}/categorias`}
                className="underline"
              >
                Ativos › Categorias
              </Link>
              .
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {categoriasAtivo.map((c) => (
              // Remover fica fora do form de salvar: form dentro de form não
              // existe no HTML (quebrava a hidratação e o envio).
              <li key={c.id} className="flex items-end gap-2">
                <FormAcao
                  acao={salvarAtivoCategoria}
                  rotulo="Salvar"
                  variante="secundario"
                  className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_7rem] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]"
                >
                  <input type="hidden" name="id" value={c.id} />
                  <label className={rotulo}>
                    <span className="sr-only">Nome</span>
                    <input
                      name="nome"
                      required
                      maxLength={80}
                      defaultValue={c.nome}
                      className={classeCampo}
                    />
                  </label>
                  <label className={rotulo}>
                    <span className="sr-only">Vida útil (anos)</span>
                    <span className="relative">
                      <input
                        name="vida_util_padrao_anos"
                        inputMode="decimal"
                        defaultValue={
                          c.vida_util_padrao_anos === null
                            ? ""
                            : formatarNumero(
                                Number(c.vida_util_padrao_anos),
                                Number.isInteger(
                                  Number(c.vida_util_padrao_anos),
                                )
                                  ? 0
                                  : 1,
                              )
                        }
                        placeholder="—"
                        className={`${classeCampo} pr-12`}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-neutral-400">
                        anos
                      </span>
                    </span>
                  </label>
                </FormAcao>
                <AcaoRapida
                  acao={removerAtivoCategoria}
                  campos={{ id: c.id }}
                  rotulo={`Remover ${c.nome}`}
                  icone={<Trash2 className="size-4" aria-hidden />}
                  confirmar={`Remover a categoria ${c.nome}? Os ativos dela ficam sem categoria (e sem a vida útil padrão).`}
                  perigo
                />
              </li>
            ))}
          </ul>
          <FormAcao
            acao={salvarAtivoCategoria}
            rotulo="Incluir categoria"
            variante="secundario"
            className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]"
          >
            <label className={rotulo}>
              Nova categoria
              <input
                name="nome"
                required
                maxLength={80}
                placeholder="ex.: Bebedouro"
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              Vida útil (anos)
              <input
                name="vida_util_padrao_anos"
                inputMode="decimal"
                className={classeCampo}
              />
            </label>
          </FormAcao>
        </div>
        <UltimasAlteracoes lista={alteracoes} tabela="os.ativo_categorias" />
      </div>
    </Secao>
  );
}
