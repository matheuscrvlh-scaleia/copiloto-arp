import { Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import {
  CAMPOS,
  type ItemLista,
  LISTAS,
  marcaDaLista,
  type NomeLista,
} from "@/lib/comercial/parametros";
import {
  salvarLista,
  salvarParametros,
} from "@/server/comercial/acoes/parametros";

// Peças dos formulários de Parâmetros: campo com rótulo do catálogo
// (lib/comercial/parametros), caixa de marcar e o editor de lista (um valor
// por linha).

export const rotulo =
  "flex flex-col gap-1 text-xs font-medium text-neutral-600";
export const grade =
  "grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4";

/** Número do banco como se digita (vírgula decimal). */
export const digitado = (v: number | string | null | undefined) =>
  v === null || v === undefined ? "" : String(v).replace(".", ",");

export function Campo({
  nome,
  valor,
  numero = false,
  maxLength,
  classe = "",
  dica,
  obrigatorio = true,
  tipo = "text",
}: {
  nome: string;
  valor: string | number | null;
  numero?: boolean;
  maxLength?: number;
  classe?: string;
  dica?: string;
  obrigatorio?: boolean;
  tipo?: "text" | "date";
}) {
  return (
    <label className={`${rotulo} ${classe}`}>
      {CAMPOS[nome]?.rotulo ?? nome}
      <input
        name={nome}
        type={tipo}
        required={obrigatorio}
        inputMode={numero ? "decimal" : undefined}
        maxLength={maxLength}
        defaultValue={numero ? digitado(valor) : (valor ?? "")}
        className={`${classeCampo} ${numero ? "tabular-nums" : ""}`}
      />
      {dica && <span className="font-normal text-neutral-400">{dica}</span>}
    </label>
  );
}

export function Texto({
  nome,
  valor,
  linhas = 4,
  maxLength = 4000,
  classe = "",
  dica,
}: {
  nome: string;
  valor: string;
  linhas?: number;
  maxLength?: number;
  classe?: string;
  dica?: string;
}) {
  return (
    <label className={`${rotulo} ${classe}`}>
      {CAMPOS[nome]?.rotulo ?? nome}
      <textarea
        name={nome}
        rows={linhas}
        maxLength={maxLength}
        defaultValue={valor}
        className={classeCampo}
      />
      {dica && <span className="font-normal text-neutral-400">{dica}</span>}
    </label>
  );
}

export function Marcar({
  nome,
  marcado,
  texto,
  valor,
}: {
  nome: string;
  marcado: boolean;
  texto: string;
  valor?: string;
}) {
  return (
    <label className="flex items-center gap-2 py-1 text-sm">
      <input
        type="checkbox"
        name={nome}
        value={valor}
        defaultChecked={marcado}
        className="size-4 accent-neutral-900"
      />
      {texto}
    </label>
  );
}

/** Formulário de um bloco da linha de parâmetros. */
export function FormBloco({
  bloco,
  children,
  className = "flex flex-col gap-4",
}: {
  bloco: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <FormAcao acao={salvarParametros} className={className}>
      <input type="hidden" name="bloco" value={bloco} />
      {children}
    </FormAcao>
  );
}

/**
 * Lista editável: um valor por linha, na ordem da tela. Tirar uma linha
 * desativa o valor (o que já foi gravado com ele continua com o nome).
 */
export function EditorLista({
  lista,
  itens,
  descricao,
}: {
  lista: NomeLista;
  itens: ItemLista[];
  descricao?: string;
}) {
  const doLista = [...itens].sort((a, b) => a.ordem - b.ordem);
  const ativos = doLista.filter((i) => i.ativo);
  const inativos = doLista.filter((i) => !i.ativo);
  const marca = marcaDaLista(lista);
  return (
    <Secao
      titulo={LISTAS[lista].rotulo}
      descricao={
        descricao ??
        "Um por linha, na ordem em que aparecem nas telas. Tirar uma linha desativa o valor; o que já foi registrado com ele continua com o mesmo nome."
      }
    >
      <FormAcao acao={salvarLista} className="flex flex-col gap-3">
        <input type="hidden" name="lista" value={lista} />
        <textarea
          name="valores"
          aria-label={LISTAS[lista].rotulo}
          rows={Math.min(12, Math.max(4, ativos.length + 1))}
          defaultValue={ativos.map((i) => i.valor).join("\n")}
          className={classeCampo}
        />
        {marca && ativos.length > 0 && (
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs font-medium text-neutral-600">
              {marca.rotulo}
              {marca.dica && (
                <span className="ml-1 font-normal text-neutral-400">
                  {marca.dica}
                </span>
              )}
            </legend>
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {ativos.map((i) => (
                <Marcar
                  key={i.id}
                  nome="marcados"
                  valor={i.valor}
                  marcado={i.extra?.[marca.chave] === true}
                  texto={i.valor}
                />
              ))}
            </div>
            <span className="text-xs text-neutral-400">
              Valor novo entra desmarcado: salve e marque em seguida.
            </span>
          </fieldset>
        )}
        {inativos.length > 0 && (
          <p className="text-xs text-neutral-500">
            Fora da lista: {inativos.map((i) => i.valor).join(", ")}. Para
            voltar, escreva de novo.
          </p>
        )}
      </FormAcao>
    </Secao>
  );
}
