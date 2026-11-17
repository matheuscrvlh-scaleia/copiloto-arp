import {
  type DefinicaoFormulario,
  NIVEIS_GRADE,
  type Pergunta,
  type Respostas,
} from "@arp/shared/sustentabilidade/formulario/tipos";
import {
  progresso,
  secoesComPerguntas,
} from "@arp/shared/sustentabilidade/formulario/visibilidade";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";

// Pré-visualização (4.13): o formulário como a entrevistadora vê no tablet
// ou o parceiro vê pelo link, com as regras "mostrar só se" funcionando.
// Nada do que se marca aqui é gravado.

const OPCAO =
  "rounded-full border px-3 py-1.5 text-sm transition has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white";

export function PreviaDoFormulario({
  definicao,
  modo,
}: {
  definicao: DefinicaoFormulario;
  modo: "tablet" | "parceiro";
}) {
  const [respostas, setRespostas] = useState<Respostas>({});
  const mudar = (id: string, valor: unknown) =>
    setRespostas((r) => ({ ...r, [id]: valor }));
  const secoes = secoesComPerguntas(definicao, respostas);
  const p = progresso(definicao, respostas);

  return (
    <div data-guia="previa" className="flex flex-col gap-4">
      <p className="text-xs text-neutral-500">
        Como{" "}
        {modo === "tablet"
          ? "a entrevistadora vê no tablet"
          : "o parceiro vê pelo link"}
        . Marque respostas para ver as regras “mostrar só se”; nada é gravado.
      </p>
      {modo === "tablet" && p.total > 0 && (
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-900/10">
            <div
              className="h-full bg-neutral-900 transition-all"
              style={{ width: `${(p.respondidas / p.total) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {p.respondidas} de {p.total} respondidas
            {p.escondidas ? ` · ${p.escondidas} escondidas pelas regras` : ""}
          </p>
        </div>
      )}
      {secoes.length === 0 && (
        <p className="text-neutral-500">Nenhuma pergunta ativa para mostrar.</p>
      )}
      {secoes.map(({ secao, perguntas }) => (
        <section
          key={secao.id}
          className="flex flex-col gap-4 rounded-2xl bg-white/60 p-4"
        >
          <h3 className="text-base font-semibold">{secao.nome}</h3>
          {perguntas.map((q) => (
            <Campo
              key={q.id}
              p={q}
              valor={respostas[q.id]}
              mudar={(v) => mudar(q.id, v)}
              naoSeAplica={modo === "tablet"}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function Campo({
  p,
  valor,
  mudar,
  naoSeAplica,
}: {
  p: Pergunta;
  valor: unknown;
  mudar: (v: unknown) => void;
  naoSeAplica: boolean;
}) {
  const na =
    typeof valor === "object" && valor !== null && "na" in (valor as object);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 font-medium">
        {p.numero}. {p.texto}
        {p.obrigatoria && <span className="text-red-600"> *</span>}
      </legend>
      {p.ajuda && <p className="text-xs text-neutral-500">{p.ajuda}</p>}
      {na ? (
        <p className="text-sm text-neutral-500">Não se aplica</p>
      ) : (
        <Entrada p={p} valor={valor} mudar={mudar} />
      )}
      {naoSeAplica && p.tipo !== "auto" && (
        <label className="mt-1 inline-flex items-center gap-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={na}
            onChange={(e) => mudar(e.target.checked ? { na: true } : undefined)}
          />
          Não se aplica
        </label>
      )}
    </fieldset>
  );
}

function Entrada({
  p,
  valor,
  mudar,
}: {
  p: Pergunta;
  valor: unknown;
  mudar: (v: unknown) => void;
}) {
  const ativas = p.opcoes.filter((o) => o.ativa);
  const nome = `previa-${p.id}`;
  switch (p.tipo) {
    case "auto":
      return (
        <input
          className={classeCampo}
          disabled
          value="Preenchido pelo sistema (ENET)"
          aria-label={p.texto}
        />
      );
    case "texto_longo":
      return (
        <textarea
          className={classeCampo}
          rows={3}
          aria-label={p.texto}
          onChange={(e) => mudar(e.target.value)}
        />
      );
    case "numero":
    case "reais":
      return (
        <input
          className={`${classeCampo} max-w-48`}
          type="number"
          inputMode="decimal"
          placeholder={p.tipo === "reais" ? "R$ 0,00" : undefined}
          aria-label={p.texto}
          onChange={(e) => mudar(e.target.value)}
        />
      );
    case "numero_unidade":
      return (
        <div className="flex flex-wrap gap-2">
          <input
            className={`${classeCampo} max-w-36`}
            type="number"
            inputMode="decimal"
            aria-label={`${p.texto}: quantidade`}
            onChange={(e) => mudar(e.target.value)}
          />
          <select className={`${classeCampo} w-auto`} aria-label="Unidade">
            {p.unidades.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
      );
    case "uma":
    case "varias":
      return (
        <div className="flex flex-wrap gap-2">
          {ativas.map((o) => {
            const lista = Array.isArray(valor) ? (valor as string[]) : [];
            const marcado =
              p.tipo === "uma" ? valor === o.id : lista.includes(o.id);
            return (
              <label key={o.id} className={OPCAO}>
                <input
                  className="sr-only"
                  type={p.tipo === "uma" ? "radio" : "checkbox"}
                  name={nome}
                  checked={marcado}
                  onChange={() =>
                    mudar(
                      p.tipo === "uma"
                        ? o.id
                        : marcado
                          ? lista.filter((x) => x !== o.id)
                          : [...lista, o.id],
                    )
                  }
                />
                {o.texto}
              </label>
            );
          })}
        </div>
      );
    case "data":
    case "hora":
      return (
        <input
          className={`${classeCampo} max-w-48`}
          type={p.tipo === "data" ? "date" : "time"}
          aria-label={p.texto}
          onChange={(e) => mudar(e.target.value)}
        />
      );
    case "sim_nao":
    case "sim_nao_quantidade":
    case "sim_nao_descricao": {
      const r = (valor as { r?: string } | undefined)?.r;
      return (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {(["sim", "nao"] as const).map((v) => (
              <label key={v} className={OPCAO}>
                <input
                  className="sr-only"
                  type="radio"
                  name={nome}
                  checked={r === v}
                  onChange={() => mudar({ r: v })}
                />
                {v === "sim" ? "Sim" : "Não"}
              </label>
            ))}
          </div>
          {r === "sim" && p.tipo !== "sim_nao" && (
            <input
              className={`${classeCampo} max-w-72`}
              type={p.tipo === "sim_nao_quantidade" ? "number" : "text"}
              placeholder={
                p.tipo === "sim_nao_quantidade" ? "Quantidade" : "Descreva"
              }
              aria-label={
                p.tipo === "sim_nao_quantidade" ? "Quantidade" : "Descrição"
              }
            />
          )}
        </div>
      );
    }
    case "grade":
      return (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="px-1 py-1 text-left font-medium" />
                {NIVEIS_GRADE.map((n) => (
                  <th key={n.id} className="px-1 py-1 font-medium">
                    {n.texto}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ativas.map((o) => (
                <tr key={o.id} className="border-t border-neutral-900/[0.06]">
                  <td className="px-1 py-1.5">{o.texto}</td>
                  {NIVEIS_GRADE.map((n) => (
                    <td key={n.id} className="px-1 py-1.5 text-center">
                      <input
                        type="radio"
                        name={`${nome}-${o.id}`}
                        aria-label={`${o.texto}: ${n.texto}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "anexo":
      return (
        <input
          className="text-sm"
          type="file"
          disabled
          aria-label={`${p.texto} (anexo)`}
        />
      );
    case "lista_cadastro":
      return (
        <input
          className={classeCampo}
          placeholder="Digite o nome (sugere os já cadastrados)"
          aria-label={p.texto}
          onChange={(e) => mudar(e.target.value)}
        />
      );
    default:
      return (
        <input
          className={classeCampo}
          aria-label={p.texto}
          onChange={(e) => mudar(e.target.value)}
        />
      );
  }
}
