"use client";

import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { type Acao, FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import {
  avisoSemDados,
  FORMAS_ACESSO,
  locatarioRepetido,
} from "@/lib/marketing/parametros";

// Inclusão e edição de um locatário monitorado, com as conferências na hora
// (spec 4.12): nome repetido (não deixa salvar; a ação confere de novo) e
// link do Google sem perfil (salva com aviso "sem dados").

export interface LocatarioEditavel {
  id: string;
  nome: string;
  categoria: string;
  perfil_url: string | null;
  forma_acesso: string;
  ativo: boolean;
  entrada_em: string;
  saida_em: string | null;
}

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

export function FormLocatario({
  acao,
  locatario,
  outros,
  categorias,
  hoje,
  aoConcluir,
}: {
  acao: Acao;
  /** Sem ele, é inclusão. */
  locatario?: LocatarioEditavel;
  /** Todos os cadastrados (para conferir nome repetido). */
  outros: { id: string; nome: string }[];
  /** Categorias já usadas (sugestões). */
  categorias: string[];
  /** "aaaa-mm-dd": entrada padrão da inclusão. */
  hoje: string;
  /** Chamada quando salva (fecha a janela). */
  aoConcluir?: () => void;
}) {
  const l = locatario;
  const [nome, setNome] = useState(l?.nome ?? "");
  const [perfil, setPerfil] = useState(l?.perfil_url ?? "");
  const [forma, setForma] = useState(l?.forma_acesso ?? "sem_acesso");
  const repetido = locatarioRepetido(nome, outros, l?.id);
  const semDados = avisoSemDados({ perfil_url: perfil, forma_acesso: forma });
  const lista = `categorias-${l?.id ?? "novo"}`;

  return (
    <FormAcao
      acao={acao}
      rotulo={l ? "Salvar" : "Incluir"}
      rotuloEnviando={l ? "Salvando…" : "Incluindo…"}
      className="flex flex-col gap-3"
      aoConcluir={aoConcluir}
    >
      {l && <input type="hidden" name="id" value={l.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={rotulo}>
          Nome
          <input
            name="nome"
            required
            maxLength={120}
            defaultValue={l?.nome}
            onChange={(e) => setNome(e.target.value)}
            aria-invalid={repetido ? true : undefined}
            className={`${classeCampo} ${repetido ? "border-red-400" : ""}`}
          />
        </label>
        <label className={rotulo}>
          Categoria
          <input
            name="categoria"
            required
            maxLength={80}
            list={lista}
            defaultValue={l?.categoria}
            placeholder="ex.: Gastronomia"
            className={classeCampo}
          />
          <datalist id={lista}>
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className={`${rotulo} sm:col-span-2`}>
          Link do perfil no Google
          <input
            name="perfil_url"
            inputMode="url"
            maxLength={1000}
            defaultValue={l?.perfil_url ?? ""}
            onChange={(e) => setPerfil(e.target.value)}
            placeholder="https://maps.app.goo.gl/…"
            className={classeCampo}
          />
        </label>
        <label className={`${rotulo} sm:col-span-2`}>
          Forma de acesso
          <Selecao
            name="forma_acesso"
            obrigatorio
            valor={forma}
            aoMudar={setForma}
            opcoes={Object.entries(FORMAS_ACESSO).map(([valor, r]) => ({
              valor,
              rotulo: r,
            }))}
          />
        </label>
        <label className={rotulo}>
          Entrada na lista
          <input
            type="date"
            name="entrada_em"
            required
            defaultValue={l?.entrada_em ?? hoje}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Saída da lista
          <input
            type="date"
            name="saida_em"
            defaultValue={l?.saida_em ?? ""}
            className={classeCampo}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="ativo"
          defaultChecked={l?.ativo ?? true}
          className="size-4 accent-neutral-900"
        />
        Ativo (aparece na Reputação)
      </label>
      {repetido && (
        <p role="alert" className="text-xs font-medium text-red-700">
          Locatário repetido: já existe “{repetido}”. Não dá para salvar com
          este nome.
        </p>
      )}
      {semDados && (
        <p className="text-xs text-amber-700">
          {semDados} Dá para salvar assim.
        </p>
      )}
    </FormAcao>
  );
}
