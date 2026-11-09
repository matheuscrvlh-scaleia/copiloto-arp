"use client";

import { Pencil, Plus } from "lucide-react";
import { useId, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { BOTAO_SECUNDARIO, Janela } from "@/components/os/chamado/janela";
import { salvarQuadro } from "@/server/operacoes/acoes/quadros";

// Cadastro do quadro (spec 4.5): nome, bloco, projeto da Energisa,
// subestação, roteiro base, armário, espaços (metade de cada lado),
// disjuntor geral e observações. As fotos da sala têm botão próprio.

export interface ValoresDoQuadro {
  id?: string;
  codigo: string;
  nome: string;
  bloco: string;
  projeto: string;
  subestacao: string;
  roteiro_base: string;
  armario: string;
  disjuntor_geral: string;
  espacos: string;
  ordem: string;
  observacoes: string;
}

const CAMPOS: {
  nome: keyof ValoresDoQuadro;
  rotulo: string;
  dica?: string;
  max: number;
  tipo?: "number";
}[] = [
  { nome: "nome", rotulo: "Nome", dica: "Ex.: Bloco 04 & 03", max: 80 },
  { nome: "bloco", rotulo: "Bloco", dica: "Ex.: 04", max: 2 },
  {
    nome: "projeto",
    rotulo: "Projeto da Energisa",
    dica: "Ex.: PE 00615 00 649",
    max: 160,
  },
  { nome: "subestacao", rotulo: "Subestação", dica: "Ex.: ET 12062", max: 80 },
  {
    nome: "roteiro_base",
    rotulo: "Roteiro base da Energisa",
    dica: "Ex.: 14-250-645",
    max: 40,
  },
  { nome: "armario", rotulo: "Armário", dica: "Ex.: 16", max: 40 },
  {
    nome: "disjuntor_geral",
    rotulo: "Disjuntor geral",
    dica: "Ex.: 150A tripolar",
    max: 60,
  },
  {
    nome: "espacos",
    rotulo: "Espaços no painel",
    dica: "Metade de cada lado (ex.: 24)",
    max: 3,
    tipo: "number",
  },
  { nome: "ordem", rotulo: "Ordem na lista", max: 3, tipo: "number" },
];

export function BotaoDoQuadro({ valores }: { valores: ValoresDoQuadro }) {
  const [aberta, setAberta] = useState(false);
  const id = useId();
  const novo = !valores.id;
  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        data-guia={novo ? "op-energia-novo-quadro" : "op-energia-editar-quadro"}
        className={BOTAO_SECUNDARIO}
      >
        {novo ? (
          <Plus className="size-4" aria-hidden />
        ) : (
          <Pencil className="size-4" aria-hidden />
        )}
        {novo ? "Novo quadro" : "Editar quadro"}
      </button>
      <Janela
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo={novo ? "Novo quadro de medidores" : `Editar ${valores.nome}`}
        descricao="Cada sala de medidores vira um quadro, desenhado como o painel."
        largura="lg"
      >
        <FormAcao
          acao={salvarQuadro}
          rotulo={novo ? "Criar quadro" : "Salvar"}
          aoConcluir={() => setAberta(false)}
          className="flex flex-col gap-4"
        >
          {valores.id && <input type="hidden" name="id" value={valores.id} />}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {novo && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${id}-codigo`}
                  className="text-xs font-medium text-neutral-600"
                >
                  Código
                </label>
                <input
                  id={`${id}-codigo`}
                  name="codigo"
                  required
                  maxLength={20}
                  pattern="[a-zA-Z0-9\-]+"
                  placeholder="Ex.: b13"
                  className={classeCampo}
                />
              </div>
            )}
            {CAMPOS.map((c) => (
              <div key={c.nome} className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${id}-${c.nome}`}
                  className="text-xs font-medium text-neutral-600"
                >
                  {c.rotulo}
                </label>
                <input
                  id={`${id}-${c.nome}`}
                  name={c.nome}
                  type={c.tipo ?? "text"}
                  required={c.nome === "nome" || c.nome === "bloco"}
                  maxLength={c.tipo ? undefined : c.max}
                  min={c.tipo ? 0 : undefined}
                  step={c.nome === "espacos" ? 2 : undefined}
                  defaultValue={valores[c.nome]}
                  placeholder={c.dica}
                  className={classeCampo}
                />
              </div>
            ))}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label
                htmlFor={`${id}-obs`}
                className="text-xs font-medium text-neutral-600"
              >
                Observações
              </label>
              <textarea
                id={`${id}-obs`}
                name="observacoes"
                rows={3}
                maxLength={2000}
                defaultValue={valores.observacoes}
                className={classeCampo}
              />
            </div>
          </div>
        </FormAcao>
      </Janela>
    </>
  );
}
