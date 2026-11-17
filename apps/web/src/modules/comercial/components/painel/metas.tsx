import {
  gabaritoDeMetas,
  lerGabaritoDeMetas,
} from "@arp/shared/comercial/gabaritos";
import { formatarNumero } from "@arp/shared/formato";
import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { notificar } from "@/components/notificacoes";
import { baixarGabarito, lerPrimeiraAba } from "@/lib/gabarito";
import { salvarMetas } from "@/modules/comercial/api/painel";

// Grade de metas do Painel comercial: indicador × mês do ano. Célula vazia
// = sem meta naquele mês (o Painel mostra o Plan vazio). "Baixar gabarito"
// traz a planilha do ano (com o que já está cadastrado); "Importar planilha"
// preenche a grade com ela, e a pessoa confere antes de salvar.

const BOTAO =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60";

export interface LinhaGradeMetas {
  indicador: string;
  /** Nome do campo de cada mês (1 a 12). */
  campos: string[];
  nome: string;
  unidade: string;
  menorMelhor: boolean;
  /** Valor atual de cada mês, já escrito no padrão brasileiro ("" = vazio). */
  valores: string[];
}

export function GradeMetas({
  ano,
  meses,
  linhas,
  metas,
}: {
  ano: number;
  meses: readonly string[];
  linhas: LinhaGradeMetas[];
  /** Metas gravadas (para o gabarito já vir preenchido). */
  metas: { indicador: string; vigente_desde: string; meta: number }[];
}) {
  const grade = useRef<HTMLDivElement>(null);
  const [lendo, setLendo] = useState(false);

  async function importar(arquivo: File | undefined) {
    if (!arquivo) return;
    setLendo(true);
    try {
      const lidas = lerGabaritoDeMetas(await lerPrimeiraAba(arquivo), ano);
      let n = 0;
      for (const [campo, v] of lidas.valores) {
        const input = grade.current?.querySelector<HTMLInputElement>(
          `input[name="${CSS.escape(campo)}"]`,
        );
        if (!input) continue;
        input.value = formatarNumero(v, Number.isInteger(v) ? 0 : 2);
        n++;
      }
      if (lidas.avisos.length)
        notificar("erro", lidas.avisos.slice(0, 3).join(" "));
      notificar(
        n ? "ok" : "info",
        n
          ? `${n} célula(s) preenchidas da planilha. Confira e clique em Salvar metas.`
          : "Nenhum valor da planilha entrou na grade.",
      );
    } catch {
      notificar(
        "erro",
        "Não consegui ler a planilha. Use o .xlsx do gabarito.",
      );
    } finally {
      setLendo(false);
    }
  }

  return (
    <div ref={grade} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={BOTAO}
          onClick={() => void baixarGabarito(gabaritoDeMetas(ano, metas))}
        >
          <Download className="size-4" aria-hidden />
          Baixar gabarito {ano}
        </button>
        <label className={BOTAO} aria-disabled={lendo}>
          <Upload className="size-4" aria-hidden />
          {lendo ? "Lendo…" : "Importar planilha"}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={lendo}
            onChange={(e) => {
              void importar(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <span className="text-xs text-neutral-500">
          A planilha só preenche a grade; nada é gravado até salvar.
        </span>
      </div>
      <FormAcao
        acao={salvarMetas}
        rotulo="Salvar metas"
        rotuloEnviando="Salvando…"
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="ano" value={ano} />
        <div className="-mx-2 max-h-[70vh] overflow-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-white/90 backdrop-blur">
              <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                <th className="sticky left-0 z-30 bg-white/90 px-2 py-2 text-left font-medium backdrop-blur">
                  Indicador
                </th>
                {meses.map((m) => (
                  <th key={m} className="px-1 py-2 text-right font-medium">
                    {m}/{String(ano).slice(2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr
                  key={l.indicador}
                  className="border-b border-neutral-900/[0.06]"
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 min-w-56 bg-white/90 px-2 py-2 text-left font-medium backdrop-blur"
                  >
                    {l.nome}
                    <span className="block text-[11px] font-normal text-neutral-500">
                      {l.unidade}
                      {l.menorMelhor ? " · menor é melhor" : ""}
                    </span>
                  </th>
                  {l.campos.map((campo, i) => (
                    <td key={campo} className="px-1 py-1.5">
                      <div className="w-28">
                        <input
                          name={campo}
                          inputMode="decimal"
                          defaultValue={l.valores[i]}
                          aria-label={`${l.nome}, ${meses[i]}/${ano}`}
                          className={`${classeCampo} px-2 text-right tabular-nums`}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormAcao>
    </div>
  );
}
