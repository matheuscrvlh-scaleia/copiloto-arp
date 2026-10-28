"use client";

import { Plus } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { classeCampo } from "@/components/estilos";
import { BOTAO_PRIMARIO, Janela } from "@/components/os/chamado/janela";
import { EscolhaIcone } from "@/components/os/configuracoes/escolhas";
import { Selecao } from "@/components/selecao";
import { TIPOS, type TipoChamado } from "@/lib/os/rotulos";
import { criarCategoriaRapida } from "@/server/os/acoes/config-catalogo";
import { PILULA_OPCAO } from "./repetir";
import type { CategoriaDoFormulario, DadosDoFormulario } from "./tipos";

// Botão flutuante do primeiro passo: qualquer pessoa do módulo cria uma
// categoria simples (nome, setor, tipo e ícone) e já segue com ela. Editar e
// excluir ficam nas Configurações (os.catalogo).

export const BOTAO_FLUTUANTE =
  "pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-neutral-900 py-2.5 pr-5 pl-4 text-sm font-medium text-white shadow-[0_12px_28px_-10px_rgb(0_0_0/0.5)] transition hover:-translate-y-px hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca";

export function NovaCategoria({
  dados,
  nomeInicial,
  aoCriar,
}: {
  dados: DadosDoFormulario;
  nomeInicial: string;
  aoCriar: (c: CategoriaDoFormulario) => void;
}) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        className={BOTAO_FLUTUANTE}
      >
        <Plus className="size-4" aria-hidden />
        Criar categoria
      </button>
      <Janela
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Nova categoria"
        descricao="Fica disponível para todos. Para editar ou excluir depois, fale com quem cuida do catálogo."
      >
        <Formulario
          dados={dados}
          nomeInicial={nomeInicial}
          aoCriar={(c) => {
            setAberta(false);
            aoCriar(c);
          }}
        />
      </Janela>
    </>
  );
}

function Formulario({
  dados,
  nomeInicial,
  aoCriar,
}: {
  dados: DadosDoFormulario;
  nomeInicial: string;
  aoCriar: (c: CategoriaDoFormulario) => void;
}) {
  const id = useId();
  const [nome, setNome] = useState(nomeInicial);
  const [setorId, setSetorId] = useState(
    dados.meusSetores[0] ?? dados.setores[0]?.id ?? "",
  );
  const [tipo, setTipo] = useState<TipoChamado>("solicitacao");
  const [icone, setIcone] = useState("tag");
  const [erro, setErro] = useState("");
  const [enviando, iniciar] = useTransition();
  const cor = dados.setores.find((s) => s.id === setorId)?.cor ?? "#525252";

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setErro("");
        iniciar(async () => {
          const r = await criarCategoriaRapida({ nome, setorId, icone, tipo });
          if ("erro" in r) setErro(r.erro);
          else aoCriar(r.categoria);
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-800">
        Nome
        <input
          // biome-ignore lint/a11y/noAutofocus: único campo a digitar da janela
          autoFocus
          required
          maxLength={80}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Ar-condicionado"
          className={classeCampo}
        />
      </label>

      <fieldset className="m-0 flex flex-col gap-1.5 p-0">
        <legend className="mb-1.5 text-sm font-medium text-neutral-800">
          Setor
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {dados.setores.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === setorId}
              onClick={() => setSetorId(s.id)}
              className={PILULA_OPCAO}
            >
              {s.nome}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${id}-tipo`}
          className="text-sm font-medium text-neutral-800"
        >
          Tipo
        </label>
        <Selecao
          id={`${id}-tipo`}
          valor={tipo}
          aoMudar={(v) => setTipo(v as TipoChamado)}
          opcoes={(Object.keys(TIPOS) as TipoChamado[]).map((t) => ({
            valor: t,
            rotulo: TIPOS[t],
          }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-800">Ícone</span>
        <EscolhaIcone
          name="icone"
          valorInicial={icone}
          cor={cor}
          aoMudar={setIcone}
        />
      </div>

      {erro && (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando || !nome.trim() || !setorId}
        className={`${BOTAO_PRIMARIO} self-end`}
      >
        {enviando ? "Criando…" : "Criar e usar"}
      </button>
    </form>
  );
}
