"use client";

import { useState } from "react";
import { Selecao } from "@/components/selecao";

// Setor e categoria do plano preventivo: a OS nasce no setor do plano, então
// a lista de categorias mostra só as desse setor. Trocar o setor limpa uma
// categoria que não é dele.

interface Categoria {
  id: string;
  nome: string;
  setorId: string;
  preventiva: boolean;
}

export function SetorECategoria({
  setores,
  categorias,
  setorInicial,
  categoriaInicial,
  rotulo,
  children,
}: {
  setores: { id: string; nome: string }[];
  categorias: Categoria[];
  setorInicial: string;
  categoriaInicial: string;
  /** Classe do rótulo dos campos. */
  rotulo: string;
  /** O campo ao lado do setor (o responsável). */
  children: React.ReactNode;
}) {
  const [setor, setSetor] = useState(setorInicial);
  const [categoria, setCategoria] = useState(categoriaInicial);
  const doSetor = categorias.filter((c) => c.setorId === setor);
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={rotulo}>
          Setor
          <Selecao
            name="setor_id"
            obrigatorio
            valor={setor}
            aoMudar={(v) => {
              setSetor(v);
              if (
                !categorias.some((c) => c.id === categoria && c.setorId === v)
              )
                setCategoria("");
            }}
            opcoes={setores.map((s) => ({ valor: s.id, rotulo: s.nome }))}
          />
        </label>
        {children}
      </div>
      <label className={rotulo}>
        Categoria da OS
        <Selecao
          name="categoria_id"
          valor={categoria}
          aoMudar={setCategoria}
          opcoes={[
            { valor: "", rotulo: "Sem categoria" },
            ...doSetor.map((c) => ({
              valor: c.id,
              rotulo: c.nome,
              descricao: c.preventiva ? "Preventiva" : undefined,
            })),
          ]}
        />
      </label>
    </>
  );
}
