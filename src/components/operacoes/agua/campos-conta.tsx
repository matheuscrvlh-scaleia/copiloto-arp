import { classeCampo } from "@/components/estilos";

// Campos da conta da concessionária (prévia e correção). Números aceitam
// "1.632,06" ou "1632.06"; o servidor valida de novo (lib/operacoes/agua-conta).

export interface ValoresConta {
  referencia?: string; // aaaa-mm
  matricula?: string;
  vencimento?: string | null;
  data_anterior?: string | null;
  data_atual?: string | null;
  leitura_anterior?: string | null;
  leitura_atual?: string | null;
  consumo_m3?: string | null;
  valor_agua?: string | null;
  valor_esgoto?: string | null;
  total?: string | null;
  observacao?: string | null;
}

/** Número do banco no formato da digitação ("1632.5" → "1.632,5"). */
export const paraCampo = (n: number | null, casas = 3) =>
  n === null
    ? ""
    : n.toLocaleString("pt-BR", {
        maximumFractionDigits: casas,
        minimumFractionDigits: casas === 2 ? 2 : 0,
      });

function Campo({
  rotulo,
  nome,
  valor,
  tipo = "text",
  dica,
  obrigatorio,
  sugerido,
  travado,
  numerico,
}: {
  rotulo: string;
  nome: keyof ValoresConta;
  valor?: string | null;
  tipo?: "text" | "date" | "month";
  dica?: string;
  obrigatorio?: boolean;
  sugerido?: boolean;
  travado?: boolean;
  numerico?: boolean;
}) {
  const id = `conta-${nome}`;
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-xs font-medium text-neutral-700"
      >
        {rotulo}
        {obrigatorio && (
          <span className="text-red-700" aria-hidden>
            *
          </span>
        )}
        {sugerido && (
          <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-sky-800">
            lido do PDF
          </span>
        )}
      </label>
      <input
        id={id}
        name={nome}
        type={tipo}
        defaultValue={valor ?? ""}
        required={obrigatorio}
        readOnly={travado}
        inputMode={numerico ? "decimal" : undefined}
        autoComplete="off"
        aria-describedby={dica ? `${id}-dica` : undefined}
        className={`${classeCampo} ${travado ? "bg-neutral-50 text-neutral-500" : ""}`}
      />
      {dica && (
        <p id={`${id}-dica`} className="text-xs text-neutral-500">
          {dica}
        </p>
      )}
    </div>
  );
}

export function CamposConta({
  valores,
  sugeridos = [],
  mesTravado = false,
}: {
  valores: ValoresConta;
  /** Campos que vieram da leitura do PDF (marcados para conferir). */
  sugeridos?: (keyof ValoresConta)[];
  /** Na correção, o mês não muda (desfaça e importe de novo). */
  mesTravado?: boolean;
}) {
  const s = (n: keyof ValoresConta) => sugeridos.includes(n);
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Conta
        </legend>
        <Campo
          rotulo="Mês de referência"
          nome="referencia"
          tipo="month"
          valor={valores.referencia}
          obrigatorio
          sugerido={s("referencia")}
          travado={mesTravado}
          dica={
            mesTravado
              ? "Para trocar o mês, desfaça e importe de novo."
              : undefined
          }
        />
        <Campo
          rotulo="Matrícula"
          nome="matricula"
          valor={valores.matricula}
          obrigatorio
          sugerido={s("matricula")}
        />
        <Campo
          rotulo="Vencimento"
          nome="vencimento"
          tipo="date"
          valor={valores.vencimento}
          sugerido={s("vencimento")}
        />
        <Campo
          rotulo="Total da conta (R$)"
          nome="total"
          valor={valores.total}
          obrigatorio
          numerico
          sugerido={s("total")}
          dica="Ex.: 1.234,56"
        />
      </fieldset>
      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Leitura do macromedidor
        </legend>
        <Campo
          rotulo="Data da leitura anterior"
          nome="data_anterior"
          tipo="date"
          valor={valores.data_anterior}
        />
        <Campo
          rotulo="Data da leitura atual"
          nome="data_atual"
          tipo="date"
          valor={valores.data_atual}
        />
        <Campo
          rotulo="Leitura anterior (m³)"
          nome="leitura_anterior"
          valor={valores.leitura_anterior}
          numerico
        />
        <Campo
          rotulo="Leitura atual (m³)"
          nome="leitura_atual"
          valor={valores.leitura_atual}
          numerico
        />
        <Campo
          rotulo="Consumo do mês (m³)"
          nome="consumo_m3"
          valor={valores.consumo_m3}
          numerico
          sugerido={s("consumo_m3")}
        />
      </fieldset>
      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Composição (se a conta separar)
        </legend>
        <Campo
          rotulo="Valor da água (R$)"
          nome="valor_agua"
          valor={valores.valor_agua}
          numerico
        />
        <Campo
          rotulo="Valor do esgoto (R$)"
          nome="valor_esgoto"
          valor={valores.valor_esgoto}
          numerico
        />
      </fieldset>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="conta-observacao"
          className="text-xs font-medium text-neutral-700"
        >
          Observação
        </label>
        <textarea
          id="conta-observacao"
          name="observacao"
          rows={2}
          maxLength={500}
          defaultValue={valores.observacao ?? ""}
          className={classeCampo}
        />
      </div>
    </div>
  );
}
