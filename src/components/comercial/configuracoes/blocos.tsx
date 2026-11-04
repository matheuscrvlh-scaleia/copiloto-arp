import { CalendarX, Trash2 } from "lucide-react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import {
  CAMPOS_GARANTIA,
  GARANTIAS,
  INDICES,
  type ItemLista,
  listasDoBloco,
  type NomeLista,
} from "@/lib/comercial/parametros";
import { formatarData } from "@/lib/formato";
import {
  incluirFeriado,
  incluirFonteDePara,
  incluirTipoLuc,
  removerFaixaEvento,
  removerFeriado,
  removerFonteDePara,
  salvarDePara,
  salvarFaixaEvento,
  salvarTiposLuc,
} from "@/server/comercial/acoes/parametros";
import type {
  FaixaEvento,
  FonteDePara,
  Lista,
  Parametros,
  TipoLuc,
} from "@/server/comercial/base";
import {
  Campo,
  digitado,
  EditorLista,
  FormBloco,
  grade,
  Marcar,
  rotulo,
  Texto,
} from "./campos";

// Os blocos de Comercial › Configurações › Parâmetros, um por linha do quadro
// de 4.13. Cada formulário salva só o seu pedaço; a mudança vale nas telas na
// próxima atualização (a ação invalida a tag do cadastro).

const lista = "flex flex-col divide-y divide-neutral-900/[0.06]";
const opcoes = (vs: string[]) => vs.map((v) => ({ valor: v, rotulo: v }));
const separador = "mt-4 border-t border-neutral-900/[0.06] pt-4";

function itensDa(todas: Lista[], l: NomeLista): ItemLista[] {
  return todas
    .filter((x) => x.lista === l)
    .map((x) => ({
      id: x.id,
      valor: x.valor,
      ordem: x.ordem,
      ativo: x.ativo,
      extra: (x.extra ?? {}) as Record<string, unknown>,
    }));
}

/** As listas do bloco, cada uma com o seu editor. */
export function ListasDoBloco({
  bloco,
  listas,
}: {
  bloco: Parameters<typeof listasDoBloco>[0];
  listas: Lista[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {listasDoBloco(bloco).map((l) => (
        <EditorLista key={l} lista={l} itens={itensDa(listas, l)} />
      ))}
    </div>
  );
}

const ativosDa = (todas: Lista[], l: NomeLista) =>
  itensDa(todas, l)
    .filter((i) => i.ativo)
    .sort((a, b) => a.ordem - b.ordem)
    .map((i) => i.valor);

// ---------------------------------------------------------------------------
// Funil
// ---------------------------------------------------------------------------

export function BlocoFunil({
  parametros: p,
  fontes,
  listas,
  fontesDoRd,
  funisDoRd,
}: {
  parametros: Parametros;
  fontes: FonteDePara[];
  listas: Lista[];
  /** Fontes que aparecem nas oportunidades do RD. */
  fontesDoRd: string[];
  funisDoRd: string[];
}) {
  const ajustadas = ativosDa(listas, "fonte_ajustada");
  const comDePara = new Set(fontes.map((f) => f.fonte_rd));
  const semDePara = fontesDoRd.filter((f) => !comDePara.has(f));
  const funis = [...new Set([p.funil_padrao, ...funisDoRd])];
  return (
    <>
      <Secao
        titulo="Funil padrão"
        descricao="Funil do RD que o Funil comercial e o Painel abrem por padrão."
      >
        <FormBloco
          bloco="funil"
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,24rem)_auto]"
        >
          <label className={rotulo}>
            Funil padrão
            <Selecao
              name="funil_padrao"
              obrigatorio
              valorInicial={p.funil_padrao}
              opcoes={opcoes(funis)}
            />
          </label>
        </FormBloco>
      </Secao>

      <Secao
        titulo="De-para de fontes do RD"
        descricao="Agrupa as fontes do RD nas fontes ajustadas do Funil e do Painel. Fonte ajustada nova: inclua na lista “Fontes ajustadas” abaixo."
      >
        {semDePara.length > 0 && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-amber-400/15 px-3 py-2 text-sm text-amber-800"
          >
            {semDePara.length} fonte(s) do RD sem de-para: escolha a fonte
            ajustada de cada uma abaixo.
          </p>
        )}
        <div className={lista}>
          {[
            ...fontes.map((f) => ({
              fonte: f.fonte_rd,
              ajustada: f.fonte_ajustada,
              nova: false,
            })),
            ...semDePara.map((f) => ({ fonte: f, ajustada: "", nova: true })),
          ].map((f) => (
            <div key={f.fonte} className="flex flex-wrap items-end gap-3 py-3">
              <FormAcao
                acao={f.nova ? incluirFonteDePara : salvarDePara}
                rotulo={f.nova ? "Incluir" : "Salvar"}
                className="grid flex-1 grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto]"
              >
                {f.nova && (
                  <input type="hidden" name="fonte_rd" value={f.fonte} />
                )}
                <p className="pb-2 text-sm font-medium">
                  {f.fonte}
                  {f.nova && (
                    <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      sem de-para
                    </span>
                  )}
                </p>
                <label className={rotulo}>
                  Fonte ajustada
                  <Selecao
                    name={f.nova ? "fonte_ajustada" : `de.${f.fonte}`}
                    obrigatorio
                    valorInicial={f.ajustada}
                    placeholder="Escolha…"
                    opcoes={opcoes(
                      f.ajustada && !ajustadas.includes(f.ajustada)
                        ? [...ajustadas, f.ajustada]
                        : ajustadas,
                    )}
                  />
                </label>
              </FormAcao>
              {!f.nova && (
                <div className="pb-2">
                  <AcaoRapida
                    acao={removerFonteDePara}
                    campos={{ fonte_rd: f.fonte }}
                    rotulo={`Remover ${f.fonte}`}
                    icone={<Trash2 className="size-4" aria-hidden />}
                    confirmar={`Remover “${f.fonte}” do de-para? As oportunidades dessa fonte ficam sem fonte ajustada até ela voltar.`}
                    perigo
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <FormAcao
          acao={incluirFonteDePara}
          rotulo="Incluir fonte"
          rotuloEnviando="Incluindo…"
          className={`${separador} grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto]`}
        >
          <label className={rotulo}>
            Fonte nova do RD
            <input
              name="fonte_rd"
              required
              maxLength={200}
              placeholder="como aparece no RD"
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Fonte ajustada
            <Selecao
              name="fonte_ajustada"
              obrigatorio
              placeholder="Escolha…"
              opcoes={opcoes(ajustadas)}
            />
          </label>
        </FormAcao>
      </Secao>

      <ListasDoBloco bloco="funil" listas={listas} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Ocupação e carteira
// ---------------------------------------------------------------------------

export function BlocoOcupacao({
  parametros: p,
  tipos,
  tiposDoEnet,
}: {
  parametros: Parametros;
  tipos: TipoLuc[];
  /** Tipos de LUC que aparecem no ENET. */
  tiposDoEnet: string[];
}) {
  const cadastrados = new Set(tipos.map((t) => t.tipo));
  const novos = tiposDoEnet.filter((t) => !cadastrados.has(t));
  return (
    <>
      <Secao
        titulo="Ocupação e curva da carteira"
        descricao="A faixa B precisa ser maior que a faixa A. Transferência: saída e entrada do mesmo locatário dentro desse número de dias não contam como churn."
      >
        <FormBloco bloco="ocupacao" className={grade}>
          <Campo
            nome="transferencia_dias"
            valor={p.transferencia_dias}
            numero
          />
          <Campo nome="curva_a_pct" valor={p.curva_a_pct} numero />
          <Campo nome="curva_b_pct" valor={p.curva_b_pct} numero />
        </FormBloco>
      </Secao>

      <Secao
        titulo="Tipos de LUC que contam na ocupação"
        descricao="Desmarcados (ex.: áreas publicitárias e vagas) ficam fora da ocupação e do estoque."
      >
        {novos.length > 0 && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-amber-400/15 px-3 py-2 text-sm text-amber-800"
          >
            Tipos do ENET ainda não cadastrados: {novos.join(", ")}. Inclua
            abaixo para decidir se contam.
          </p>
        )}
        <FormAcao acao={salvarTiposLuc} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {tipos.map((t) => (
              <div key={t.tipo}>
                <input type="hidden" name="tipos" value={t.tipo} />
                <Marcar
                  nome={`conta.${t.tipo}`}
                  marcado={t.conta_ocupacao}
                  texto={t.tipo}
                />
              </div>
            ))}
          </div>
        </FormAcao>
        <FormAcao
          acao={incluirTipoLuc}
          rotulo="Incluir tipo"
          rotuloEnviando="Incluindo…"
          className={`${separador} grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,20rem)_auto_auto]`}
        >
          <label className={rotulo}>
            Tipo de LUC (como no ENET)
            <input
              name="tipo"
              required
              maxLength={80}
              list="tipos-enet-novos"
              className={classeCampo}
            />
            <datalist id="tipos-enet-novos">
              {novos.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <Marcar nome="conta_ocupacao" marcado texto="Conta na ocupação" />
        </FormAcao>
      </Secao>
    </>
  );
}

// ---------------------------------------------------------------------------
// Vencimentos e relacionamento
// ---------------------------------------------------------------------------

export function BlocoVencimentos({
  parametros: p,
  listas,
}: {
  parametros: Parametros;
  listas: Lista[];
}) {
  return (
    <>
      <Secao
        titulo="Faixas e lembretes"
        descricao="Vencimentos em até a faixa 1, entre a faixa 1 e a 2, e acima da 2 (a faixa 2 precisa ser maior). O lembrete de aniversário aparece no sistema X dias antes."
      >
        <FormBloco bloco="vencimentos" className={grade}>
          <Campo
            nome="vencimento_faixa1_dias"
            valor={p.vencimento_faixa1_dias}
            numero
          />
          <Campo
            nome="vencimento_faixa2_dias"
            valor={p.vencimento_faixa2_dias}
            numero
          />
          <Campo
            nome="lembrete_aniversario_dias"
            valor={p.lembrete_aniversario_dias}
            numero
          />
          <Campo
            nome="reajuste_previsto_dias"
            valor={p.reajuste_previsto_dias}
            numero
          />
        </FormBloco>
      </Secao>
      <ListasDoBloco bloco="vencimentos" listas={listas} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Contratos
// ---------------------------------------------------------------------------

const subtitulo = "text-sm font-semibold";

export function BlocoContratos({ parametros: p }: { parametros: Parametros }) {
  const obrigatorios = (p.obrigatorios_garantia ?? {}) as Record<
    string,
    string[]
  >;
  return (
    <Secao
      titulo="Contratos"
      descricao="Valores que o assistente de contrato e o distrato trazem preenchidos. O contrato guarda o valor usado; mudar aqui não altera contratos já gerados."
    >
      <FormBloco bloco="contratos" className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h3 className={subtitulo}>Empreendimento</h3>
          <div className={grade}>
            <Campo
              nome="empreendimento_nome"
              valor={p.empreendimento_nome}
              maxLength={120}
              classe="sm:col-span-2"
            />
            <Campo nome="endereco_cep" valor={p.endereco_cep} maxLength={9} />
            <Campo nome="endereco_uf" valor={p.endereco_uf} maxLength={2} />
            <Campo
              nome="endereco_logradouro"
              valor={p.endereco_logradouro}
              maxLength={160}
              classe="sm:col-span-2"
            />
            <Campo
              nome="endereco_numero"
              valor={p.endereco_numero}
              maxLength={20}
            />
            <Campo
              nome="endereco_complemento"
              valor={p.endereco_complemento}
              maxLength={80}
              obrigatorio={false}
            />
            <Campo
              nome="endereco_bairro"
              valor={p.endereco_bairro}
              maxLength={80}
            />
            <Campo
              nome="endereco_cidade"
              valor={p.endereco_cidade}
              maxLength={80}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className={subtitulo}>Valores e prazos</h3>
          <div className={grade}>
            <label className={rotulo}>
              Índice padrão
              <Selecao
                name="indice_padrao"
                obrigatorio
                valorInicial={p.indice_padrao}
                opcoes={Object.entries(INDICES).map(([valor, r]) => ({
                  valor,
                  rotulo: r,
                }))}
              />
            </label>
            <Campo
              nome="dia_vencimento_padrao"
              valor={p.dia_vencimento_padrao}
              numero
            />
            <Campo nome="caucao_alugueis" valor={p.caucao_alugueis} numero />
            <Campo
              nome="caucao_prazo_dias"
              valor={p.caucao_prazo_dias}
              numero
            />
            <Campo
              nome="capitalizacao_prazo_dias"
              valor={p.capitalizacao_prazo_dias}
              numero
            />
            <Campo nome="multa_alugueis" valor={p.multa_alugueis} numero />
            <Campo nome="nc004_versao" valor={p.nc004_versao} maxLength={30} />
            <Campo
              nome="vaga_promocional_padrao"
              valor={p.vaga_promocional_padrao}
              numero
            />
          </div>
          <Marcar
            nome="consumo_agua_padrao"
            marcado={p.consumo_agua_padrao}
            texto="Consumo de água incluso (padrão)"
          />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className={subtitulo}>Cláusula de obras e entrega</h3>
          <div className={grade}>
            <Campo
              nome="obras_tapume_dias"
              valor={p.obras_tapume_dias}
              numero
            />
            <Campo
              nome="obras_retirada_dias"
              valor={p.obras_retirada_dias}
              numero
            />
            <Campo
              nome="obras_projetos_dias"
              valor={p.obras_projetos_dias}
              numero
            />
            <Campo
              nome="entrega_prazo_implantacao_dias"
              valor={p.entrega_prazo_implantacao_dias}
              numero
            />
            <Campo
              nome="entrega_tipo_imovel"
              valor={p.entrega_tipo_imovel}
              maxLength={80}
            />
            <Campo
              nome="entrega_padrao"
              valor={p.entrega_padrao}
              maxLength={160}
              classe="sm:col-span-2 lg:col-span-3"
            />
          </div>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className={subtitulo}>Obrigatórios por garantia</legend>
          <p className="text-xs text-neutral-500">
            Campos que a Revisão do contrato exige preenchidos para cada tipo de
            garantia.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GARANTIAS.filter(
              (g) => Object.keys(CAMPOS_GARANTIA[g].campos).length,
            ).map((g) => (
              <div key={g} className="flex flex-col">
                <p className="mb-1 text-xs font-medium text-neutral-600">
                  {CAMPOS_GARANTIA[g].rotulo}
                </p>
                {Object.entries(
                  CAMPOS_GARANTIA[g].campos as Record<string, string>,
                ).map(([c, r]) => (
                  <Marcar
                    key={c}
                    nome={`garantia.${g}`}
                    valor={c}
                    marcado={(obrigatorios[g] ?? []).includes(c)}
                    texto={r}
                  />
                ))}
              </div>
            ))}
          </div>
        </fieldset>
      </FormBloco>
      <div className={separador}>
        <Nota>
          Modelos de contrato e de distrato (Word e PDF com cláusulas
          condicionais): a partir da V2.
        </Nota>
      </div>
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Ficha cadastral, Censo, Kit e Pesquisa (campos + listas)
// ---------------------------------------------------------------------------

export function BlocoFicha({
  parametros: p,
  listas,
}: {
  parametros: Parametros;
  listas: Lista[];
}) {
  return (
    <>
      <Secao
        titulo="Ficha cadastral"
        descricao="Textos do formulário público e por quantos dias o link vale."
      >
        <FormBloco bloco="ficha">
          <Texto
            nome="ficha_boas_vindas"
            valor={p.ficha_boas_vindas}
            linhas={6}
          />
          <Texto
            nome="ficha_termo_lgpd"
            valor={p.ficha_termo_lgpd}
            linhas={4}
          />
          <div className={grade}>
            <Campo
              nome="ficha_validade_dias"
              valor={p.ficha_validade_dias}
              numero
            />
          </div>
        </FormBloco>
      </Secao>
      <ListasDoBloco bloco="ficha" listas={listas} />
    </>
  );
}

export function BlocoCenso({
  parametros: p,
  listas,
}: {
  parametros: Parametros;
  listas: Lista[];
}) {
  return (
    <>
      <Secao
        titulo="Censo"
        descricao="Dias de uso no mês para estimar a mensalidade de quem informa o gasto por dia."
      >
        <FormBloco bloco="censo" className={grade}>
          <Campo
            nome="censo_dias_mensalidade"
            valor={p.censo_dias_mensalidade}
            numero
          />
        </FormBloco>
      </Secao>
      <ListasDoBloco bloco="censo" listas={listas} />
    </>
  );
}

export function BlocoKit({
  parametros: p,
  listas,
}: {
  parametros: Parametros;
  listas: Lista[];
}) {
  return (
    <>
      <Secao
        titulo="Kit de entrega"
        descricao="Quantos dias antes do vencimento de um documento o aviso aparece."
      >
        <FormBloco bloco="kit" className={grade}>
          <Campo nome="kit_aviso_dias" valor={p.kit_aviso_dias} numero />
        </FormBloco>
      </Secao>
      <ListasDoBloco bloco="kit" listas={listas} />
    </>
  );
}

export function BlocoPesquisa({
  parametros: p,
  listas,
}: {
  parametros: Parametros;
  listas: Lista[];
}) {
  return (
    <>
      <Secao
        titulo="Faixas de tamanho"
        descricao="Limites em m², crescentes, separados por ponto e vírgula. Ex.: 30; 50; 80; 100 vira até 30, 30 a 50, 50 a 80, 80 a 100 e acima de 100."
      >
        <FormBloco
          bloco="pesquisa"
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,24rem)_auto]"
        >
          <Campo
            nome="pesquisa_faixas_m2"
            valor={(p.pesquisa_faixas_m2 ?? []).map(digitado).join("; ")}
          />
        </FormBloco>
      </Secao>
      <ListasDoBloco bloco="pesquisa" listas={listas} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

const gradeFaixa =
  "grid flex-1 grid-cols-2 items-end gap-3 sm:grid-cols-[6rem_6rem_6rem_7rem_7rem_auto_auto]";

function CamposFaixa({ f }: { f?: FaixaEvento }) {
  const campo = (
    nome: string,
    r: string,
    v: number | string | undefined,
    numero = true,
  ) => (
    <label className={rotulo}>
      {r}
      <input
        name={nome}
        required
        inputMode={numero ? "decimal" : undefined}
        maxLength={numero ? undefined : 40}
        defaultValue={numero ? digitado(v ?? "") : (v ?? "")}
        className={`${classeCampo} ${numero ? "tabular-nums" : ""}`}
      />
    </label>
  );
  return (
    <>
      {campo("nome", "Faixa", f?.nome, false)}
      {campo("area_de", "De (m²)", f?.area_de)}
      {campo("area_ate", "Até (m²)", f?.area_ate)}
      {campo("valor_comum", "Dias comuns", f?.valor_comum)}
      {campo("valor_sazonal", "Datas sazonais", f?.valor_sazonal)}
      <Marcar nome="fixo" marcado={f?.fixo ?? false} texto="Fixo por dia" />
    </>
  );
}

export function BlocoEventos({
  parametros: p,
  faixas,
  listas,
}: {
  parametros: Parametros;
  faixas: FaixaEvento[];
  listas: Lista[];
}) {
  return (
    <>
      <Secao
        titulo="Tabela de preço"
        descricao="Valor por m² por dia, em reais, já com o reajuste do ano. A faixa marcada como fixa cobra o valor por dia (áreas pequenas). Faixas por m² não podem se sobrepor."
      >
        <div className={lista}>
          {faixas.map((f) => (
            <div key={f.id} className="flex flex-wrap items-end gap-3 py-3">
              <FormAcao acao={salvarFaixaEvento} className={gradeFaixa}>
                <input type="hidden" name="id" value={f.id} />
                <CamposFaixa f={f} />
              </FormAcao>
              <div className="pb-2">
                <AcaoRapida
                  acao={removerFaixaEvento}
                  campos={{ id: f.id }}
                  rotulo={`Remover a faixa ${f.nome}`}
                  icone={<Trash2 className="size-4" aria-hidden />}
                  confirmar={`Remover a faixa ${f.nome}? Simulações novas deixam de usar esse preço; propostas já geradas não mudam.`}
                  perigo
                />
              </div>
            </div>
          ))}
        </div>
        <FormAcao
          acao={salvarFaixaEvento}
          rotulo="Incluir faixa"
          rotuloEnviando="Incluindo…"
          className={`${separador} ${gradeFaixa}`}
        >
          <CamposFaixa />
        </FormAcao>
      </Secao>

      <Secao
        titulo="Cálculo e textos da proposta"
        descricao="Reajuste, desconto, dimensionamento de segurança e limpeza, e os textos que a proposta traz preenchidos."
      >
        <FormBloco bloco="eventos" className="flex flex-col gap-4">
          <div className={grade}>
            <Campo
              nome="evento_reajuste_pct"
              valor={p.evento_reajuste_pct}
              numero
            />
            <Campo
              nome="evento_desconto_pct"
              valor={p.evento_desconto_pct}
              numero
            />
            <Campo
              nome="evento_pessoas_por_seguranca"
              valor={p.evento_pessoas_por_seguranca}
              numero
            />
            <Campo
              nome="evento_m2_por_agente"
              valor={p.evento_m2_por_agente}
              numero
            />
            <Campo
              nome="evento_fechamento_dias_uteis"
              valor={p.evento_fechamento_dias_uteis}
              numero
            />
            <Campo
              nome="evento_validade_dias"
              valor={p.evento_validade_dias}
              numero
            />
            <Campo
              nome="evento_horario"
              valor={p.evento_horario}
              maxLength={80}
              classe="sm:col-span-2"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo
              nome="evento_condicao_pagamento"
              valor={p.evento_condicao_pagamento}
              maxLength={200}
            />
            <Campo
              nome="evento_area_texto"
              valor={p.evento_area_texto}
              maxLength={200}
            />
            <Campo
              nome="evento_montagem"
              valor={p.evento_montagem}
              maxLength={200}
            />
            <Campo
              nome="evento_desmontagem"
              valor={p.evento_desmontagem}
              maxLength={200}
            />
          </div>
          <Texto
            nome="evento_notas"
            valor={(p.evento_notas ?? []).join("\n")}
            linhas={4}
            dica="Uma nota por linha, na ordem da proposta."
          />
        </FormBloco>
      </Secao>

      <ListasDoBloco bloco="eventos" listas={listas} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Calendário
// ---------------------------------------------------------------------------

export function BlocoCalendario({
  nacionais,
  cadastrados,
  hoje,
}: {
  /** null: o serviço gratuito não respondeu. */
  nacionais: { data: string; nome: string }[] | null;
  cadastrados: { data: string; nome: string }[];
  hoje: string;
}) {
  const ano = hoje.slice(0, 4);
  const atuais = cadastrados.filter((f) => f.data >= `${ano}-01-01`);
  const datasNacionais = new Set((nacionais ?? []).map((f) => f.data));
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Secao
        titulo="Feriados nacionais"
        descricao="Vêm do serviço gratuito de feriados (BrasilAPI), só leitura."
      >
        {nacionais === null ? (
          <p className="text-sm text-amber-800">
            O serviço de feriados não respondeu agora. Os prazos seguem com os
            feriados cadastrados ao lado; tente de novo mais tarde.
          </p>
        ) : (
          <ul className="flex flex-col">
            {nacionais.map((f) => (
              <li
                key={f.data}
                className={`flex gap-3 border-b border-neutral-900/[0.06] py-1 text-sm ${f.data < hoje ? "text-neutral-500" : ""}`}
              >
                <span className="w-24 shrink-0 tabular-nums">
                  {formatarData(f.data)}
                </span>
                <span className="min-w-0 flex-1">{f.nome}</span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao
        titulo="Feriados de Nova Friburgo"
        descricao="Municipais e pontos facultativos que a ARP segue. É o mesmo cadastro dos Tickets: incluir ou remover aqui vale lá também."
      >
        <FormAcao
          acao={incluirFeriado}
          rotulo="Incluir feriado"
          variante="secundario"
          className="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-[11rem_minmax(0,1fr)_auto]"
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
        {atuais.length === 0 ? (
          <Nota>Nenhum feriado cadastrado a partir de {ano}.</Nota>
        ) : (
          <ul className="flex flex-col">
            {atuais.map((f) => (
              <li
                key={f.data}
                className={`flex items-center gap-3 border-b border-neutral-900/[0.06] py-1 text-sm ${f.data < hoje ? "text-neutral-500" : ""}`}
              >
                <span className="w-24 shrink-0 tabular-nums">
                  {formatarData(f.data)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {f.nome}
                  {datasNacionais.has(f.data) && (
                    <span className="ml-2 text-xs text-neutral-400">
                      também nacional
                    </span>
                  )}
                </span>
                <AcaoRapida
                  acao={removerFeriado}
                  campos={{ data: f.data }}
                  rotulo={`Remover ${f.nome}`}
                  icone={<CalendarX className="size-4" aria-hidden />}
                  confirmar={`Remover o feriado ${f.nome} (${formatarData(f.data)})? Vale também para os prazos dos Tickets.`}
                  perigo
                />
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}
