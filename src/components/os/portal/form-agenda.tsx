"use client";

import { salvarAgenda } from "@/app/(app)/os/portal/actions";
import { Secao } from "@/components/admin/ui";
import { classeCampo } from "@/components/estilos";
import { EnvioDaAcao, FormAcao } from "@/components/form-acao";
import { DIAS_CURTOS } from "@/lib/os/portal";

// Regras de uma agenda (telhado, vistorias, doca): janela do dia, duração
// de cada horário, limite por dia e dias da semana. Valem para os próximos
// horários; o que já foi marcado continua.

export interface DadosAgenda {
  id?: string;
  nome: string;
  hora_inicio: string;
  hora_fim: string;
  duracao_min: number;
  limite_por_dia: number;
  antecedencia_dias: number;
  dias_semana: number[];
  orientacao: string | null;
  ativo: boolean;
}

const NOVA: DadosAgenda = {
  nome: "",
  hora_inicio: "08:00",
  hora_fim: "12:00",
  duracao_min: 60,
  limite_por_dia: 2,
  antecedencia_dias: 30,
  dias_semana: [1, 2, 3, 4, 5],
  orientacao: null,
  ativo: true,
};

export function FormAgenda({ agenda }: { agenda?: DadosAgenda }) {
  const a = agenda ?? NOVA;
  return (
    <FormAcao
      acao={salvarAgenda}
      rotulo={a.id ? "Salvar agenda" : "Criar agenda"}
      botaoNoFim={false}
    >
      <input type="hidden" name="id" value={a.id ?? ""} />
      <Secao titulo="Agenda" descricao="Ex.: Telhado, Vistorias, Doca.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="nome"
              className="text-xs font-medium text-neutral-600"
            >
              Nome *
            </label>
            <input
              id="nome"
              name="nome"
              required
              maxLength={60}
              defaultValue={a.nome}
              className={classeCampo}
            />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={a.ativo}
              className="size-4 accent-neutral-900"
            />
            Aceitando horários
          </label>
        </div>
      </Secao>
      <Secao
        titulo="Horários"
        descricao="O lojista só vê horários livres dentro da janela, nos dias marcados, até o limite do dia e até a antecedência informada."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {(
            [
              ["hora_inicio", "Das", "time", a.hora_inicio.slice(0, 5)],
              ["hora_fim", "Até", "time", a.hora_fim.slice(0, 5)],
              ["duracao_min", "Cada horário (min)", "number", a.duracao_min],
              ["limite_por_dia", "Limite por dia", "number", a.limite_por_dia],
              [
                "antecedencia_dias",
                "Marca até (dias à frente)",
                "number",
                a.antecedencia_dias,
              ],
            ] as const
          ).map(([nome, rotulo, tipo, valor]) => (
            <div key={nome} className="flex flex-col gap-1.5">
              <label
                htmlFor={nome}
                className="text-xs font-medium text-neutral-600"
              >
                {rotulo} *
              </label>
              <input
                id={nome}
                name={nome}
                type={tipo}
                required
                min={
                  tipo === "number"
                    ? nome === "duracao_min"
                      ? 15
                      : 1
                    : undefined
                }
                max={nome === "antecedencia_dias" ? 180 : undefined}
                step={nome === "duracao_min" ? 15 : undefined}
                defaultValue={valor}
                className={`${classeCampo} tabular-nums`}
              />
            </div>
          ))}
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-neutral-600">
            Dias da semana *
          </legend>
          <div className="flex flex-wrap gap-2">
            {DIAS_CURTOS.map((d, i) => (
              <label
                key={d}
                className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-sm transition has-checked:border-neutral-900 has-checked:bg-neutral-900 has-checked:text-white has-focus-visible:ring-4 has-focus-visible:ring-neutral-900/10"
              >
                <input
                  type="checkbox"
                  name="dias_semana"
                  value={i}
                  defaultChecked={a.dias_semana.includes(i)}
                  className="sr-only"
                />
                {d}
              </label>
            ))}
          </div>
        </fieldset>
      </Secao>
      <Secao
        titulo="Orientação"
        descricao="Aparece para o lojista na hora de marcar."
      >
        <textarea
          name="orientacao"
          aria-label="Orientação ao lojista"
          rows={3}
          maxLength={200}
          defaultValue={a.orientacao ?? ""}
          className={classeCampo}
        />
      </Secao>
      <EnvioDaAcao className="pt-2" />
    </FormAcao>
  );
}
