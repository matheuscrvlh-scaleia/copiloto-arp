import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { ListaDeTextos } from "@/components/os/configuracoes/lista-editavel";
import { Selecao } from "@/components/selecao";
import { formatarNumero } from "@/lib/formato";
import {
  DIAS_DA_SEMANA,
  FONTES_SOLAR,
  type Grupo,
  INTERVALOS_DIARIO,
  ROTULOS_PARAMETROS as R,
} from "@/lib/operacoes/parametros";
import { salvarParametros } from "@/server/operacoes/acoes/parametros";
import type { Parametros } from "@/server/operacoes/base";
import { EditorDeExtras, EditorDoModelo } from "./editores";

// Formulário de cada grupo de Operações › Parâmetros (spec 4.12 e mockup).
// Os limites dos campos repetem os checks do banco; a ação confere de novo.

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const ajuda = "font-normal text-neutral-500";
const grade2 = "grid grid-cols-1 gap-4 md:grid-cols-2";
const grade3 = "grid grid-cols-1 gap-4 md:grid-cols-3";

/** Número com vírgula, como a pessoa digita. */
const br = (v: number | string, casas = 2) => {
  const n = Number(v);
  return formatarNumero(n, Number.isInteger(n) ? 0 : casas).replace(/\./g, "");
};

function Numero({
  name,
  valor,
  ajudaTexto,
  inteiro = false,
}: {
  name: keyof Parametros;
  valor: number;
  ajudaTexto?: string;
  inteiro?: boolean;
}) {
  return (
    <label className={rotulo}>
      {R[name]}
      <input
        name={name}
        required
        inputMode={inteiro ? "numeric" : "decimal"}
        defaultValue={inteiro ? String(valor) : br(valor)}
        className={classeCampo}
      />
      {ajudaTexto && <span className={ajuda}>{ajudaTexto}</span>}
    </label>
  );
}

function Texto({
  name,
  valor,
  max,
  ajudaTexto,
}: {
  name: keyof Parametros;
  valor: string;
  max: number;
  ajudaTexto?: string;
}) {
  return (
    <label className={rotulo}>
      {R[name]}
      <input
        name={name}
        required
        maxLength={max}
        defaultValue={valor}
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
  name: keyof Parametros;
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

function Formulario({
  grupo,
  "data-guia": guia,
  children,
}: {
  grupo: Grupo;
  /** Âncora do guia passo a passo, literal em quem chama (o teste dos guias lê o texto). */
  "data-guia": `op-parametros-${Grupo}`;
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

const modeloDaAgua = (v: unknown): Record<string, string> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(
        Object.entries(v).filter(
          (par): par is [string, string] => typeof par[1] === "string",
        ),
      )
    : {};

const extrasDaLimpeza = (v: unknown) =>
  Array.isArray(v)
    ? v.flatMap((e) =>
        e && typeof e === "object" && "descricao" in e
          ? [
              {
                descricao: String((e as { descricao: unknown }).descricao),
                valor_dia: br(
                  Number((e as { valor_dia?: unknown }).valor_dia ?? 0),
                ),
              },
            ]
          : [],
      )
    : [];

export function FormularioDoGrupo({
  grupo,
  p,
}: {
  grupo: Grupo;
  p: Parametros;
}) {
  switch (grupo) {
    case "agua":
      return (
        <Formulario grupo="agua" data-guia="op-parametros-agua">
          <div className={grade2}>
            <Numero
              name="agua_limite_m3"
              valor={p.agua_limite_m3}
              ajudaTexto="Consumo do mês acima disto vira alerta (padrão: 30 m³)."
            />
            <Texto
              name="agua_parceiro"
              valor={p.agua_parceiro}
              max={120}
              ajudaTexto="Nome ou e-mail do parceiro de gestão hídrica."
            />
            <Numero
              name="agua_tolerancia"
              valor={p.agua_tolerancia}
              ajudaTexto="Diferença aceita entre a soma das linhas e o resumo do arquivo (reais e m³)."
            />
          </div>
          <div className={grade3}>
            <Numero
              name="agua_variacao_pct"
              valor={p.agua_variacao_pct}
              ajudaTexto="Para mais ou para menos, contra a média do hidrômetro."
            />
            <Numero
              name="agua_variacao_meses"
              valor={p.agua_variacao_meses}
              inteiro
              ajudaTexto="De 1 a 12 meses anteriores."
            />
            <Numero
              name="agua_variacao_min_m3"
              valor={p.agua_variacao_min_m3}
              ajudaTexto="Evita alerta em consumo pequeno (0,5 → 1 m³ é +100%)."
            />
          </div>
          <Lista
            name="agua_blocos"
            valor={p.agua_blocos}
            item="bloco"
            exemplo="Bloco com 2 dígitos (ex.: 16)"
          />
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-neutral-600">
              {R.agua_modelo}
            </p>
            <EditorDoModelo
              name="agua_modelo"
              inicial={modeloDaAgua(p.agua_modelo)}
            />
          </div>
        </Formulario>
      );
    case "termo":
      return (
        <Formulario grupo="termo" data-guia="op-parametros-termo">
          <div className={grade2}>
            <Texto
              name="termo_razao_social"
              valor={p.termo_razao_social}
              max={200}
            />
            <Texto name="termo_cnpj" valor={p.termo_cnpj} max={18} />
            <Texto name="termo_endereco" valor={p.termo_endereco} max={300} />
            <Texto name="termo_cidade" valor={p.termo_cidade} max={80} />
            <Texto
              name="termo_qualificacao_cpf"
              valor={p.termo_qualificacao_cpf}
              max={200}
              ajudaTexto="Vai depois do nome do locatário pessoa física."
            />
            <Texto
              name="termo_qualificacao_cnpj"
              valor={p.termo_qualificacao_cnpj}
              max={200}
              ajudaTexto="Vai depois do nome do locatário pessoa jurídica."
            />
          </div>
          <Texto
            name="termo_nome_arquivo"
            valor={p.termo_nome_arquivo}
            max={200}
            ajudaTexto="Use [bloco], [sala] e [LOCATARIO] onde entram os dados da caixa."
          />
        </Formulario>
      );
    case "quadros":
      return (
        <Formulario grupo="quadros" data-guia="op-parametros-quadros">
          <div className={grade3}>
            <Lista
              name="energia_disjuntores"
              valor={p.energia_disjuntores}
              item="disjuntor"
              exemplo="Ex.: 63A Trifásico"
            />
            <Lista
              name="energia_ligacoes"
              valor={p.energia_ligacoes}
              item="ligação"
              exemplo="Ex.: Trifásica"
              ajudaTexto="A caixa aceita Monofásica, Bifásica e Trifásica."
            />
            <Lista
              name="energia_medidor_situacoes"
              valor={p.energia_medidor_situacoes}
              item="situação"
              exemplo="Ex.: Medidor retirado"
            />
          </div>
        </Formulario>
      );
    case "contas":
      return (
        <Formulario grupo="contas" data-guia="op-parametros-contas">
          <div className={grade2}>
            <Numero
              name="energia_alerta_pct"
              valor={p.energia_alerta_pct}
              ajudaTexto="Fatura com consumo acima da média de 12 meses por este percentual vira alerta."
            />
            <div className={rotulo}>
              <span>{R.solar_fonte}</span>
              <Selecao
                name="solar_fonte"
                rotulo={R.solar_fonte}
                obrigatorio
                valorInicial={p.solar_fonte}
                opcoes={Object.entries(FONTES_SOLAR).map(([valor, r]) => ({
                  valor,
                  rotulo: r,
                }))}
              />
              <span className={ajuda}>
                De onde vem a geração (a confirmar com a Sustentabilidade).
              </span>
            </div>
          </div>
        </Formulario>
      );
    case "limpeza":
      return (
        <Formulario grupo="limpeza" data-guia="op-parametros-limpeza">
          <div className={grade3}>
            <Texto name="limpeza_empresa" valor={p.limpeza_empresa} max={120} />
            <Numero
              name="limpeza_dia_util_envio"
              valor={p.limpeza_dia_util_envio}
              inteiro
              ajudaTexto="Dia útil do mês seguinte (de 1 a 20); depois dele sem envio, o painel alerta."
            />
          </div>
          <div className={grade3}>
            <Numero
              name="limpeza_func_base"
              valor={p.limpeza_func_base}
              inteiro
            />
            <Numero
              name="limpeza_func_area_comum"
              valor={p.limpeza_func_area_comum}
              inteiro
            />
            <Numero
              name="limpeza_func_rateados"
              valor={p.limpeza_func_rateados}
              inteiro
              ajudaTexto="Área comum + rateados não passa dos funcionários da base."
            />
          </div>
          <Lista
            name="limpeza_blocos"
            valor={p.limpeza_blocos}
            item="bloco"
            exemplo="Bloco com 2 dígitos (ex.: 12)"
          />
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-neutral-600">
              {R.limpeza_extras_padrao}
            </p>
            <EditorDeExtras
              name="limpeza_extras_padrao"
              inicial={extrasDaLimpeza(p.limpeza_extras_padrao)}
            />
          </div>
        </Formulario>
      );
    case "obras":
      return (
        <Formulario grupo="obras" data-guia="op-parametros-obras">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/50 p-3 text-sm">
            <span className="flex-1">
              O token do aplicativo Diário de Obra (Cadastros › Empresa › Gerar
              token) fica em Administração › Integrações, guardado cifrado.
            </span>
            <Link
              href="/admin/integracoes#diario_de_obras"
              data-guia="op-parametros-token-diario"
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
            >
              <ExternalLink className="size-4" aria-hidden />
              Abrir Integrações
            </Link>
          </div>
          <div className={grade3}>
            <div className={rotulo}>
              <span>{R.obras_intervalo_min}</span>
              <Selecao
                name="obras_intervalo_min"
                rotulo={R.obras_intervalo_min}
                obrigatorio
                valorInicial={String(p.obras_intervalo_min)}
                opcoes={Object.entries(INTERVALOS_DIARIO).map(([valor, r]) => ({
                  valor,
                  rotulo: r,
                }))}
              />
              <span className={ajuda}>
                A API aceita 150 consultas por minuto por empresa.
              </span>
            </div>
            <Numero
              name="obras_limite_desvio"
              valor={p.obras_limite_desvio}
              ajudaTexto="Avanço físico − prazo consumido abaixo disto é alerta (ex.: −10)."
            />
            <Numero
              name="obras_limite_orcamento_pct"
              valor={p.obras_limite_orcamento_pct}
              ajudaTexto="Realizado × previsto fora desta faixa (para mais ou para menos) é alerta."
            />
          </div>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="text-xs font-medium text-neutral-600">
              {R.obras_dias_relatorio}
            </legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {DIAS_DA_SEMANA.map(([n, nome]) => (
                <label key={n} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="obras_dias_relatorio"
                    value={n}
                    defaultChecked={p.obras_dias_relatorio.includes(n)}
                  />
                  {nome}
                </label>
              ))}
            </div>
          </fieldset>
        </Formulario>
      );
  }
}
