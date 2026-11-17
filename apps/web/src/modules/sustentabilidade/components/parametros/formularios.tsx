import { formatarData, formatarNumero } from "@arp/shared/formato";
import type { ParametrosSu as Parametros } from "@arp/shared/sustentabilidade/contratos/base";
import {
  CHAVES_COM_META,
  INDICADORES_DO_PAINEL,
  infoDoIndicador,
  MARCOS_DO_PAINEL,
} from "@arp/shared/sustentabilidade/painel-indicadores";
import {
  campoDaMeta,
  DATAS_DE_INAUGURACAO,
  type GrupoComColunas,
  ROTULOS_PARAMETROS as R,
} from "@arp/shared/sustentabilidade/painel-parametros";
import { Nota, Secao, Tabela } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Link } from "@/lib/navegacao";
import { ListaDeTextos } from "@/modules/os/components/configuracoes/lista-editavel";
import type {
  EquivalenciaCadastrada,
  LinhaDeSetor,
  MarcoDoPainel,
  VigenciaDeCo2,
  VigenciaDoRcc,
} from "../../api-config";
import {
  novaVigenciaCo2,
  novaVigenciaRcc,
  salvarEquivalencias,
  salvarMarcos,
  salvarMetas,
  salvarParametros,
  salvarValidadesPorSetor,
} from "../../api-config";
import { TabelaEditavel } from "./tabela-editavel";

// Formulário de cada aba de Configurações › Parâmetros (spec 4.11 e mockup).
// Os limites dos campos repetem os checks do banco; a ação confere de novo.

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const ajuda = "font-normal text-neutral-500";
const grade3 = "grid grid-cols-1 gap-4 md:grid-cols-3";

/** Número com vírgula e sem separador de milhar, como a pessoa digita. */
const br = (v: number | string, casas = 2) =>
  new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: casas,
    useGrouping: false,
  }).format(Number(v));

function Inteiro({
  name,
  valor,
  ajudaTexto,
}: {
  name: string;
  valor: number;
  ajudaTexto?: string;
}) {
  return (
    <label className={rotulo}>
      {R[name]}
      <input
        name={name}
        required
        inputMode="numeric"
        defaultValue={String(valor)}
        className={classeCampo}
      />
      {ajudaTexto && <span className={ajuda}>{ajudaTexto}</span>}
    </label>
  );
}

function Lista({
  name,
  valor,
  item,
  exemplo,
  ajudaTexto,
}: {
  name: string;
  valor: string[];
  item: string;
  exemplo: string;
  ajudaTexto?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-neutral-600">{R[name]}</p>
      {ajudaTexto && <p className="text-xs text-neutral-500">{ajudaTexto}</p>}
      <ListaDeTextos
        name={name}
        inicial={valor}
        rotuloItem={item}
        placeholder={exemplo}
      />
    </div>
  );
}

function FormularioDaAba({
  grupo,
  "data-guia": guia,
  children,
}: {
  grupo: GrupoComColunas;
  /** Âncora do guia passo a passo. */
  "data-guia": `su-parametros-${GrupoComColunas}`;
  children: React.ReactNode;
}) {
  return (
    <FormAcao
      acao={salvarParametros}
      className="flex flex-col gap-5"
      rotulo="Salvar"
    >
      <input type="hidden" name="grupo" value={grupo} />
      <div data-guia={guia} className="flex flex-col gap-5">
        {children}
      </div>
    </FormAcao>
  );
}

// ---------------------------------------------------------------------------
// Entrevistas
// ---------------------------------------------------------------------------

export function FormEntrevistas({
  p,
  setores,
}: {
  p: Parametros;
  setores: LinhaDeSetor[];
}) {
  return (
    <>
      <Secao
        titulo="Entrevistas"
        descricao="Prazos, avisos e quais contratos entram na lista de entrevistas."
      >
        <FormularioDaAba
          grupo="entrevistas"
          data-guia="su-parametros-entrevistas"
        >
          <div className={grade3}>
            <Inteiro
              name="meses_primeira_entrevista"
              valor={p.meses_primeira_entrevista}
              ajudaTexto="Padrão 6 meses depois da ativação."
            />
            <Inteiro
              name="validade_padrao_meses"
              valor={p.validade_padrao_meses}
              ajudaTexto="Vale para quem não tem setor ou tem setor fora da tabela abaixo."
            />
            <Inteiro
              name="aviso_dias"
              valor={p.aviso_dias}
              ajudaTexto="Padrão 30 dias antes do fim da validade."
            />
          </div>
          <label className={`${rotulo} md:max-w-sm`}>
            {R.data_inauguracao}
            <select
              name="data_inauguracao"
              defaultValue={p.data_inauguracao}
              className={classeCampo}
            >
              {Object.entries(DATAS_DE_INAUGURACAO).map(([v, nome]) => (
                <option key={v} value={v}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <Lista
            name="tipos_loja_dispensados"
            valor={p.tipos_loja_dispensados}
            item="tipo de loja"
            exemplo="Ex.: Área Publicitária"
            ajudaTexto="Contratos desses tipos não entram na lista nem na cobertura. Sugestão do spec: Área Publicitária."
          />
          <Lista
            name="motivos_dispensa"
            valor={p.motivos_dispensa}
            item="motivo"
            exemplo="Ex.: Contrato temporário"
            ajudaTexto="Aparecem na hora de dispensar uma entrevista."
          />
        </FormularioDaAba>
      </Secao>

      <Secao
        titulo="Validade por setor econômico"
        descricao="Quantos meses a entrevista vale em cada setor (pergunta 3 do questionário). Setor fora da tabela usa a validade padrão."
      >
        <FormAcao
          acao={salvarValidadesPorSetor}
          className="flex flex-col gap-4"
          rotulo="Salvar validades"
        >
          <div data-guia="su-parametros-setores">
            <TabelaEditavel
              name="setores"
              rotuloDoItem="setor"
              vazio="Nenhum setor na tabela: vale a validade padrão para todos."
              inicial={setores.map((s) => ({
                setor: s.setor,
                meses: String(s.meses),
              }))}
              novaLinha={{ setor: "", meses: String(p.validade_padrao_meses) }}
              colunas={[
                {
                  chave: "setor",
                  rotulo: "Setor",
                  tipo: "texto",
                  placeholder: "Ex.: Saúde",
                  max: 80,
                },
                {
                  chave: "meses",
                  rotulo: "Validade (meses)",
                  tipo: "numero",
                  largura: "w-40",
                  max: 3,
                },
              ]}
            />
          </div>
        </FormAcao>
        <p className="mt-3 rounded-2xl bg-amber-400/15 px-4 py-3 text-xs text-amber-950">
          A confirmar com a ARP: os valores por setor ainda não foram fechados
          (citados: 2 anos como padrão; 2 meses para alimentação; 3 para
          veterinária; 2 ou 3 anos sem consenso). Começam todos no padrão. O
          “Repetir” do Chamados não é usado aqui: o módulo calcula a data e cria
          o próximo chamado sozinho.
        </p>
      </Secao>
    </>
  );
}

// ---------------------------------------------------------------------------
// Clube
// ---------------------------------------------------------------------------

export function FormClube({ p }: { p: Parametros }) {
  return (
    <Secao
      titulo="Clube SustentArp"
      descricao="Termo, formas de participação e de contribuição, tipos de ação."
    >
      <FormularioDaAba grupo="clube" data-guia="su-parametros-clube">
        <div className={grade3}>
          <Inteiro
            name="termo_validade_meses"
            valor={p.termo_validade_meses}
            ajudaTexto="Padrão 12 meses a partir da assinatura."
          />
          <Inteiro
            name="termo_aviso_dias"
            valor={p.termo_aviso_dias}
            ajudaTexto="Dias antes do fim em que vira “Termo a vencer” e abre o chamado de renovação."
          />
        </div>
        <Lista
          name="clube_formas"
          valor={p.clube_formas}
          item="forma"
          exemplo="Ex.: Pagante"
        />
        <Lista
          name="formas_contribuicao"
          valor={p.formas_contribuicao}
          item="forma"
          exemplo="Ex.: PIX"
        />
        <Lista
          name="tipos_acao"
          valor={p.tipos_acao}
          item="tipo"
          exemplo="Ex.: Oficina"
        />
      </FormularioDaAba>
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Coletores
// ---------------------------------------------------------------------------

export function FormColetores({
  p,
  setores,
}: {
  p: Parametros;
  setores: { id: string; nome: string }[];
}) {
  return (
    <Secao
      titulo="Coletores"
      descricao="Limite de alerta da ocupação e quem recebe o chamado de recolhimento."
    >
      <FormularioDaAba grupo="coletores" data-guia="su-parametros-coletores">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Inteiro
            name="limite_ocupacao_pct"
            valor={p.limite_ocupacao_pct}
            ajudaTexto="Coletor nesse nível ou acima abre o chamado de recolhimento. Padrão 90%."
          />
          <label className={rotulo}>
            {R.recolhimento_setor_id}
            <select
              name="recolhimento_setor_id"
              defaultValue={p.recolhimento_setor_id ?? ""}
              className={classeCampo}
            >
              <option value="">
                Setor Operações (ou Sustentabilidade, se não houver)
              </option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
            <span className={ajuda}>
              Equipe interna do Chamados; o parceiro nunca recebe chamado.
            </span>
          </label>
        </div>
        <p className="text-xs text-neutral-500">
          A lista de coletores (local, cor, contêineres e capacidade) fica na
          aba{" "}
          <Link
            href="/sustentabilidade/configuracoes/coletores"
            className="font-medium underline underline-offset-4"
          >
            Coletores
          </Link>
          . Antes de usar uma lista própria, confira se os coletores não podem
          ser ativos do Chamados (a confirmar com a área).
        </p>
      </FormularioDaAba>
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// RCC
// ---------------------------------------------------------------------------

export function FormRcc({
  p,
  vigencias,
  comPrecos,
}: {
  p: Parametros;
  vigencias: VigenciaDoRcc[];
  comPrecos: boolean;
}) {
  const atual = vigencias[0];
  return (
    <>
      <Secao
        titulo="RCC · empresas coletoras"
        descricao="As empresas que aparecem ao lançar a nota."
      >
        <FormularioDaAba grupo="rcc" data-guia="su-parametros-rcc">
          <Lista
            name="rcc_empresas"
            valor={p.rcc_empresas}
            item="empresa"
            exemplo="Ex.: Coletora de entulho"
          />
        </FormularioDaAba>
      </Secao>

      <Secao
        titulo="Fator e preço da caçamba"
        descricao="Cada mudança cria uma vigência nova; a anterior fica como estava. Só as notas lançadas a partir da data usam os novos valores."
      >
        <div
          data-guia="su-parametros-rcc-vigencia"
          className="flex flex-col gap-5"
        >
          <Tabela
            colunas={[
              {
                titulo: "Vigente desde",
                valor: (v: VigenciaDoRcc) => formatarData(v.vigenteDesde),
              },
              {
                titulo: "Toneladas por caçamba",
                numero: true,
                valor: (v: VigenciaDoRcc) =>
                  v.toneladasPorCacamba
                    ? formatarNumero(v.toneladasPorCacamba, 2)
                    : "—",
              },
              {
                titulo: "Volume da caçamba (m³)",
                numero: true,
                valor: (v: VigenciaDoRcc) =>
                  v.volumeM3 ? formatarNumero(v.volumeM3, 2) : "—",
              },
              ...(comPrecos
                ? [
                    {
                      titulo: "Caçamba classe A (R$)",
                      numero: true,
                      valor: (v: VigenciaDoRcc) =>
                        v.precoA === null ? "—" : formatarNumero(v.precoA, 2),
                    },
                    {
                      titulo: "Caçamba classe B (R$)",
                      numero: true,
                      valor: (v: VigenciaDoRcc) =>
                        v.precoB === null ? "—" : formatarNumero(v.precoB, 2),
                    },
                  ]
                : []),
            ]}
            linhas={vigencias}
            chave={(v) => v.vigenteDesde}
            vazio="Nenhuma vigência cadastrada."
          />
          <FormAcao
            acao={novaVigenciaRcc}
            className="flex flex-col gap-4"
            rotulo="Criar vigência"
            rotuloEnviando="Criando…"
          >
            <p className="text-sm font-medium">Nova vigência</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <label className={rotulo}>
                Vigente desde
                <input
                  type="date"
                  name="vigente_desde"
                  required
                  className={classeCampo}
                />
              </label>
              <label className={rotulo}>
                Toneladas por caçamba
                <input
                  name="toneladas_por_cacamba"
                  required
                  inputMode="decimal"
                  defaultValue={atual ? br(atual.toneladasPorCacamba, 3) : "8"}
                  className={classeCampo}
                />
              </label>
              <label className={rotulo}>
                Volume da caçamba (m³)
                <input
                  name="volume_m3"
                  required
                  inputMode="decimal"
                  defaultValue={atual ? br(atual.volumeM3, 3) : "5"}
                  className={classeCampo}
                />
              </label>
              {comPrecos && (
                <>
                  <label className={rotulo}>
                    Preço da caçamba classe A (R$)
                    <input
                      name="preco_a"
                      inputMode="decimal"
                      defaultValue={
                        atual?.precoA != null ? br(atual.precoA, 2) : ""
                      }
                      className={classeCampo}
                    />
                  </label>
                  <label className={rotulo}>
                    Preço da caçamba classe B (R$)
                    <input
                      name="preco_b"
                      inputMode="decimal"
                      defaultValue={
                        atual?.precoB != null ? br(atual.precoB, 2) : ""
                      }
                      className={classeCampo}
                    />
                  </label>
                </>
              )}
            </div>
            <Nota>
              Vigência que começa no meio do mês vale a partir do mês seguinte.
              {comPrecos
                ? " Deixe os preços em branco para mudar só o fator."
                : " Os preços da caçamba só aparecem para quem pode ver valores."}
            </Nota>
          </FormAcao>
        </div>
      </Secao>
    </>
  );
}

// ---------------------------------------------------------------------------
// Programas
// ---------------------------------------------------------------------------

export function FormProgramas({
  p,
  custos,
}: {
  p: Parametros;
  /** Custos padrão do tour; null sem "Ver valores". */
  custos: { album: number; copo: number } | null;
}) {
  return (
    <Secao
      titulo="Programas"
      descricao="Áreas e grupos de impacto, custo do tour, dia da cobrança do parceiro e unidades das perguntas."
    >
      <FormularioDaAba grupo="programas" data-guia="su-parametros-programas">
        <Lista
          name="areas_impacto"
          valor={p.areas_impacto}
          item="área"
          exemplo="Ex.: Ambiental"
        />
        <Lista
          name="grupos_impacto"
          valor={p.grupos_impacto}
          item="grupo"
          exemplo="Ex.: Volume reciclado"
          ajudaTexto="O painel soma por grupo de impacto, não pelo nome do programa. O Painel usa os grupos Volume reciclado, Pessoas impactadas, Oficinas e Produtores locais."
        />
        <div className={grade3}>
          <Inteiro
            name="cobranca_dia"
            valor={p.cobranca_dia}
            ajudaTexto="De 1 a 28. Sem lançamento até esse dia, abre o chamado “Cobrar lançamento do parceiro”."
          />
          {custos ? (
            <>
              <label className={rotulo}>
                {R.tour_custo_album}
                <input
                  name="tour_custo_album"
                  required
                  inputMode="decimal"
                  defaultValue={br(custos.album, 2)}
                  className={classeCampo}
                />
                <span className={ajuda}>Em reais. Padrão 2,48.</span>
              </label>
              <label className={rotulo}>
                {R.tour_custo_copo}
                <input
                  name="tour_custo_copo"
                  required
                  inputMode="decimal"
                  defaultValue={br(custos.copo, 2)}
                  className={classeCampo}
                />
                <span className={ajuda}>Em reais. Padrão 2,92.</span>
              </label>
            </>
          ) : (
            <p className="self-end text-xs text-neutral-500 md:col-span-2">
              Os custos do tour (álbum e copo) só aparecem para quem pode ver
              valores.
            </p>
          )}
        </div>
        <Lista
          name="unidades"
          valor={p.unidades}
          item="unidade"
          exemplo="Ex.: saco de 5 L"
          ajudaTexto="Unidades das perguntas “número + unidade” do questionário e dos programas."
        />
      </FormularioDaAba>
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Painel: marco inicial, metas e equivalências
// ---------------------------------------------------------------------------

export function FormPainel({
  ano,
  anosDasMetas,
  marcos,
  metas,
  equivalencias,
  fatoresCo2,
  comValores,
}: {
  ano: number;
  anosDasMetas: number[];
  marcos: MarcoDoPainel[];
  metas: Map<string, number>;
  equivalencias: EquivalenciaCadastrada[];
  fatoresCo2: VigenciaDeCo2[];
  comValores: boolean;
}) {
  const ROTA = "/sustentabilidade/configuracoes/parametros?aba=painel";
  const marcosEditaveis = marcos.filter((m) => m.indicador in MARCOS_DO_PAINEL);
  return (
    <>
      <Secao
        titulo="Marco inicial"
        descricao="Total de cada indicador nos anos antes do sistema (ex.: volume reciclado, energia e RCC até dez/2025). O “desde o início” soma o marco com os anos no sistema."
      >
        <FormAcao
          acao={salvarMarcos}
          className="flex flex-col gap-4"
          rotulo="Salvar marcos"
        >
          <div data-guia="su-parametros-marcos">
            <TabelaEditavel
              name="marcos"
              rotuloDoItem="marco"
              vazio="Nenhum marco: o painel soma só o que está no sistema."
              inicial={marcosEditaveis.map((m) => ({
                indicador: m.indicador,
                ano: String(m.ano),
                valor: br(m.valor, 4),
              }))}
              novaLinha={{
                indicador: "volume_reciclado",
                ano: String(ano - 1),
                valor: "",
              }}
              colunas={[
                {
                  chave: "indicador",
                  rotulo: "Indicador",
                  tipo: "select",
                  opcoes: Object.entries(MARCOS_DO_PAINEL).map(([v, r]) => ({
                    valor: v,
                    rotulo: r,
                  })),
                },
                {
                  chave: "ano",
                  rotulo: "Ano",
                  tipo: "numero",
                  largura: "w-28",
                  max: 4,
                },
                {
                  chave: "valor",
                  rotulo: "Marco",
                  tipo: "numero",
                  largura: "w-44",
                  max: 20,
                },
              ]}
            />
          </div>
        </FormAcao>
      </Secao>

      <Secao
        titulo={`Metas de ${ano}`}
        descricao="Meta do ano inteiro de cada indicador, valendo a partir de 1º de janeiro. Em branco, o indicador fica sem meta. O limite da ocupação dos coletores vem da aba Coletores, não daqui."
      >
        <nav
          aria-label="Ano das metas"
          className="mb-4 flex flex-wrap items-center gap-2 text-sm"
        >
          {anosDasMetas.map((a) => (
            <Link
              key={a}
              href={`${ROTA}&ano=${a}`}
              scroll={false}
              aria-current={a === ano ? "page" : undefined}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 font-medium text-neutral-700 transition hover:border-neutral-400 aria-[current=page]:border-neutral-900 aria-[current=page]:bg-neutral-900 aria-[current=page]:text-white"
            >
              {a}
            </Link>
          ))}
        </nav>
        <FormAcao
          acao={salvarMetas}
          className="flex flex-col gap-4"
          rotulo={`Salvar metas de ${ano}`}
        >
          <input type="hidden" name="ano" value={ano} />
          <div
            data-guia="su-parametros-metas"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {CHAVES_COM_META.filter(
              (c) => comValores || !infoDoIndicador(c).reais,
            ).map((c) => {
              const i = INDICADORES_DO_PAINEL[c];
              const valor = metas.get(c);
              return (
                <label key={c} className={rotulo}>
                  {i.nome} ({i.unidade})
                  <input
                    name={campoDaMeta(c)}
                    inputMode="decimal"
                    defaultValue={valor === undefined ? "" : br(valor, 2)}
                    placeholder="Sem meta"
                    className={`${classeCampo} text-right tabular-nums`}
                  />
                  <span className={ajuda}>
                    {i.direcao === "maior_melhor"
                      ? "Quanto maior, melhor."
                      : "Quanto menor, melhor."}
                  </span>
                </label>
              );
            })}
          </div>
        </FormAcao>
      </Secao>

      <Secao
        titulo="Fator de emissão (CO₂ evitado)"
        descricao="O CO₂ evitado do painel é a geração solar de cada mês × o fator vigente no mês. Use o fator médio de emissão do Sistema Interligado Nacional publicado pelo MCTI (t CO₂/MWh, o mesmo número que kg CO₂/kWh). Cada mudança cria uma vigência nova; a anterior fica como estava."
      >
        <div data-guia="su-parametros-co2" className="flex flex-col gap-5">
          <Tabela
            colunas={[
              {
                titulo: "Vigente desde",
                valor: (v: VigenciaDeCo2) => formatarData(v.vigenteDesde),
              },
              {
                titulo: "kg de CO₂ por kWh",
                numero: true,
                valor: (v: VigenciaDeCo2) => formatarNumero(v.kgPorKwh, 5),
              },
            ]}
            linhas={fatoresCo2}
            chave={(v) => v.vigenteDesde}
            vazio="Nenhum fator cadastrado: o CO₂ evitado fica sem dado."
          />
          <FormAcao
            acao={novaVigenciaCo2}
            className="flex flex-col gap-4"
            rotulo="Criar vigência"
            rotuloEnviando="Criando…"
          >
            <p className="text-sm font-medium">Novo fator</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className={rotulo}>
                Vigente desde
                <input
                  type="date"
                  name="vigente_desde"
                  required
                  className={classeCampo}
                />
              </label>
              <label className={rotulo}>
                kg de CO₂ por kWh
                <input
                  name="kg_por_kwh"
                  required
                  inputMode="decimal"
                  defaultValue={
                    fatoresCo2[0] ? br(fatoresCo2[0].kgPorKwh, 5) : ""
                  }
                  className={classeCampo}
                />
              </label>
            </div>
            <Nota>
              Vigência que começa no meio do mês vale a partir do mês seguinte.
              Para o painel mostrar o CO₂ de um ano inteiro, o fator precisa
              valer desde janeiro.
            </Nota>
          </FormAcao>
        </div>
      </Secao>

      <Secao
        titulo="Equivalências"
        descricao="Fatores que convertem o volume reciclado em equivalentes (ex.: árvores por tonelada reciclada). Só aparecem no painel depois de confirmados com a área."
      >
        <FormAcao
          acao={salvarEquivalencias}
          className="flex flex-col gap-4"
          rotulo="Salvar equivalências"
        >
          <div data-guia="su-parametros-equivalencias">
            <TabelaEditavel
              name="equivalencias"
              rotuloDoItem="equivalência"
              vazio="Nenhuma equivalência cadastrada."
              inicial={equivalencias.map((q) => ({
                nome: q.nome,
                fator: br(q.fator, 6),
                unidade: q.unidade ?? "",
                confirmado: q.confirmado,
              }))}
              novaLinha={{
                nome: "",
                fator: "",
                unidade: "",
                confirmado: false,
              }}
              colunas={[
                {
                  chave: "nome",
                  rotulo: "Nome",
                  tipo: "texto",
                  placeholder: "Ex.: Árvores preservadas",
                  max: 80,
                },
                {
                  chave: "fator",
                  rotulo: "Fator por tonelada",
                  tipo: "numero",
                  largura: "w-36",
                  max: 20,
                },
                {
                  chave: "unidade",
                  rotulo: "Unidade",
                  tipo: "texto",
                  largura: "w-40",
                  placeholder: "árvores",
                  max: 40,
                },
                {
                  chave: "confirmado",
                  rotulo: "Confirmado com a área",
                  tipo: "check",
                  largura: "w-40",
                },
              ]}
            />
          </div>
        </FormAcao>
        <p className="mt-3 rounded-2xl bg-amber-400/15 px-4 py-3 text-xs text-amber-950">
          A confirmar com a área: os fatores ainda não foram fechados (seção 10
          do spec). Marque “Confirmado” só depois da validação.
        </p>
      </Secao>
    </>
  );
}
