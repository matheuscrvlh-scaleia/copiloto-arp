import { Trash2 } from "lucide-react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import {
  incluirFonteDePara,
  removerFonteDePara,
  salvarDePara,
} from "@/server/comercial/acoes/parametros";
import type { FonteDePara, Lista, Parametros } from "@/server/comercial/base";
import { FormBloco, rotulo } from "../campos";
import { ativosDa, ListasDoBloco, lista, opcoes, separador } from "./comum";

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
