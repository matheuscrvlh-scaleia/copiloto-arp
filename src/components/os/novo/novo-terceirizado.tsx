"use client";

import { Building2 } from "lucide-react";
import { useState, useTransition } from "react";
import { classeCampo } from "@/components/estilos";
import { BOTAO_PRIMARIO, Janela } from "@/components/os/chamado/janela";
import { criarTerceirizadoRapido } from "@/server/os/acoes/config-terceirizados";
import { BOTAO_FLUTUANTE } from "./nova-categoria";

// Botão flutuante do primeiro passo: qualquer pessoa do módulo cadastra a
// empresa terceirizada (fica para escolher na execução da OS). Editar,
// desativar e os profissionais ficam nas Configurações (os.terceirizados).

const CAMPOS = [
  { name: "nome", rotulo: "Nome da empresa", max: 120, obrigatorio: true },
  { name: "cnpj", rotulo: "CNPJ", max: 18, modo: "numeric" },
  { name: "contato", rotulo: "Contato", max: 120 },
  { name: "telefone", rotulo: "Telefone", max: 30, modo: "tel" },
  { name: "servicos", rotulo: "Serviços", max: 500 },
] as const;

export function NovoTerceirizado() {
  const [aberta, setAberta] = useState(false);
  const [aviso, setAviso] = useState("");
  return (
    <>
      {aviso && (
        <output className="self-center rounded-full bg-white px-3 py-1.5 text-xs text-neutral-700 shadow-sm">
          {aviso}
        </output>
      )}
      <button
        type="button"
        onClick={() => {
          setAviso("");
          setAberta(true);
        }}
        className={BOTAO_FLUTUANTE}
      >
        <Building2 className="size-4" aria-hidden />
        Criar terceirizado
      </button>
      <Janela
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Novo terceirizado"
        descricao="Fica disponível para todos na execução da OS. Para editar ou cadastrar profissionais, fale com quem cuida dos terceirizados."
      >
        <Formulario
          aoCriar={(ok) => {
            setAberta(false);
            setAviso(ok);
          }}
        />
      </Janela>
    </>
  );
}

function Formulario({ aoCriar }: { aoCriar: (ok: string) => void }) {
  const [erro, setErro] = useState("");
  const [enviando, iniciar] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const dados = Object.fromEntries(
          new FormData(e.currentTarget),
        ) as Record<string, string>;
        setErro("");
        iniciar(async () => {
          const r = await criarTerceirizadoRapido(dados);
          if (r.erro) setErro(r.erro);
          else aoCriar(r.ok ?? "Terceirizado cadastrado.");
        });
      }}
    >
      {CAMPOS.map((c, i) => (
        <label
          key={c.name}
          className="flex flex-col gap-1.5 text-sm font-medium text-neutral-800"
        >
          {c.rotulo}
          <input
            name={c.name}
            // biome-ignore lint/a11y/noAutofocus: primeiro campo da janela
            autoFocus={i === 0}
            required={"obrigatorio" in c}
            maxLength={c.max}
            inputMode={"modo" in c ? c.modo : undefined}
            className={classeCampo}
          />
        </label>
      ))}
      {erro && (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className={`${BOTAO_PRIMARIO} self-end`}
      >
        {enviando ? "Cadastrando…" : "Cadastrar"}
      </button>
    </form>
  );
}
