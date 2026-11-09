"use client";

import { Link2 } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { corrigirVinculo, removerVinculo } from "@/server/operacoes/acoes/agua";
import { BOTAO_SECUNDARIO } from "./estilos";

// Correção do vínculo do hidrômetro (spec 4.4): a partir de um mês, o
// hidrômetro passa a contar para outra sala ou bloco, com o motivo e quem
// mudou (operacoes.agua_vinculos, com auditoria). Não muda o arquivo
// importado: as telas mostram o vínculo corrigido e o que veio no arquivo.

export function CorrigirVinculo({
  hidrometro,
  bloco,
  sala,
  mes,
}: {
  hidrometro: string;
  bloco: string;
  sala: string;
  /** "aaaa-mm" do último mês (padrão do "a partir de"). */
  mes: string;
}) {
  const [aberto, setAberto] = useState(false);
  if (!aberto)
    return (
      <button
        type="button"
        data-guia="op-agua-vinculo"
        onClick={() => setAberto(true)}
        className={BOTAO_SECUNDARIO}
      >
        <Link2 className="size-4" aria-hidden />
        Corrigir sala ou bloco
      </button>
    );
  return (
    <FormAcao
      acao={corrigirVinculo}
      rotulo="Salvar correção"
      rotuloEnviando="Salvando…"
      aoConcluir={() => setAberto(false)}
      className="flex flex-col gap-3 rounded-2xl bg-neutral-50 p-4"
    >
      <input type="hidden" name="hidrometro" value={hidrometro} />
      <p className="text-sm text-neutral-700">
        A partir do mês escolhido, o hidrômetro {hidrometro} conta para a sala e
        o bloco abaixo. O que veio no arquivo continua guardado.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">A partir de</span>
          <input
            type="month"
            name="desde"
            required
            defaultValue={mes}
            className={classeCampo}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Bloco</span>
          <input
            name="bloco"
            required
            inputMode="numeric"
            pattern="\d{1,2}"
            maxLength={2}
            defaultValue={bloco}
            className={classeCampo}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Sala</span>
          <input
            name="sala"
            required
            maxLength={120}
            defaultValue={sala}
            className={classeCampo}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Motivo</span>
        <textarea
          name="motivo"
          required
          minLength={3}
          maxLength={500}
          rows={2}
          placeholder="Ex.: hidrômetro trocado de sala na reforma do Bloco 05"
          className={`${classeCampo} font-[inherit]`}
        />
      </label>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="self-start text-xs font-medium text-neutral-600 underline-offset-4 hover:underline"
      >
        Cancelar
      </button>
    </FormAcao>
  );
}

export function RemoverVinculo({ id, desde }: { id: string; desde: string }) {
  return (
    <FormAcao
      acao={removerVinculo}
      rotulo="Remover"
      rotuloEnviando="Removendo…"
      variante="perigo"
      confirmar={`Remover a correção a partir de ${desde}? Volta a valer a sala e o bloco do arquivo.`}
    >
      <input type="hidden" name="id" value={id} />
    </FormAcao>
  );
}
