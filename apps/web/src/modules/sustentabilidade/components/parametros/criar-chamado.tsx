import {
  CHAMADOS_FIXOS,
  type ChamadoFixo,
  DIAS_DA_SEMANA,
} from "@arp/shared/sustentabilidade/painel-parametros";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { criarChamadoRecorrente } from "../../api-config";

/**
 * "Criar chamado recorrente": o primeiro chamado já nasce com o Repetir e o
 * responsável escolhidos; depois se ajusta direto no chamado, como manda o
 * spec. Semanal pede o dia da semana; mensal, o dia do mês.
 */
export function CriarChamadoRecorrente({
  tipo,
  candidatos,
  diaPadrao,
}: {
  tipo: ChamadoFixo;
  candidatos: { id: string; nome: string }[];
  /** Dia da semana (0 a 6) ou do mês (1 a 31) que a tela sugere. */
  diaPadrao: number;
}) {
  const def = CHAMADOS_FIXOS[tipo];
  const [responsavel, setResponsavel] = useState("");
  if (!candidatos.length)
    return (
      <p className="text-sm text-neutral-500">
        Ninguém tem a permissão desta área ainda. Dê a permissão a quem vai
        cuidar dela (Administração › Usuários) para poder criar o chamado.
      </p>
    );
  return (
    <FormAcao
      acao={criarChamadoRecorrente}
      rotulo="Criar chamado recorrente"
      rotuloEnviando="Criando…"
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="tipo" value={tipo} />
      <label className="flex min-w-52 flex-col gap-1 text-xs font-medium text-neutral-600">
        Responsável
        <select
          name="responsavel"
          required
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          className={classeCampo}
        >
          <option value="">Escolha…</option>
          {candidatos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      {def.frequencia === "semanal" ? (
        <label className="flex w-40 flex-col gap-1 text-xs font-medium text-neutral-600">
          Dia da semana
          <select
            name="dia_semana"
            defaultValue={String(diaPadrao)}
            className={classeCampo}
          >
            {DIAS_DA_SEMANA.map(([n, nome]) => (
              <option key={n} value={n}>
                {nome}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="flex w-40 flex-col gap-1 text-xs font-medium text-neutral-600">
          Dia do mês
          <input
            name="dia_mes"
            type="number"
            min={1}
            max={31}
            required
            defaultValue={diaPadrao}
            className={classeCampo}
          />
        </label>
      )}
    </FormAcao>
  );
}
