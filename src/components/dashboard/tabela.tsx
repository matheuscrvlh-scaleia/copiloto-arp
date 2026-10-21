import { TOM, type Tom } from "@/components/estilos";

export interface Coluna<T> {
  titulo: string;
  valor: (linha: T) => React.ReactNode;
  /** Números alinham à direita. */
  numero?: boolean;
}

/** Tabela com rolagem lateral dentro do quadro (nunca a página). */
export function Tabela<T>({
  colunas,
  linhas,
  chave,
  rodape,
  vazio = "Nenhum registro.",
}: {
  colunas: Coluna<T>[];
  linhas: T[];
  chave: (linha: T) => string;
  rodape?: React.ReactNode[];
  vazio?: string;
}) {
  if (linhas.length === 0) {
    return <p className="py-6 text-sm text-neutral-500">{vazio}</p>;
  }
  const alinhar = (c: Coluna<T>) =>
    c.numero ? "text-right tabular-nums" : "text-left";
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs text-neutral-500">
            {colunas.map((c) => (
              <th
                key={c.titulo}
                className={`px-2 py-2 font-medium ${alinhar(c)}`}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr
              key={chave(l)}
              className="border-b border-neutral-900/[0.06] transition-colors last:border-0 hover:bg-white/50"
            >
              {colunas.map((c) => (
                <td key={c.titulo} className={`px-2 py-2 ${alinhar(c)}`}>
                  {c.valor(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {rodape && (
          <tfoot>
            <tr className="border-t border-neutral-300 font-semibold">
              {rodape.map((v, i) => (
                <td
                  // biome-ignore lint/suspicious/noArrayIndexKey: posição da coluna é a identidade da célula
                  key={i}
                  className={`px-2 py-2 ${colunas[i] ? alinhar(colunas[i]) : ""}`}
                >
                  {v}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/**
 * Renderiza as células no servidor para a TabelaBusca (cliente), que não
 * recebe funções. `filtros` dá o valor da linha em cada filtro de seleção.
 */
export function paraBusca<T>(
  colunas: Coluna<T>[],
  linhas: T[],
  chave: (l: T) => string,
  busca: (l: T) => string,
  filtros?: (l: T) => Record<string, string>,
) {
  return {
    colunas: colunas.map(({ titulo, numero }) => ({ titulo, numero })),
    linhas: linhas.map((l) => ({
      chave: chave(l),
      busca: busca(l),
      celulas: colunas.map((c) => c.valor(l)),
      filtros: filtros?.(l),
    })),
  };
}

export function Secao({
  titulo,
  descricao,
  children,
  className = "",
  tom = "claro",
  id,
}: {
  /** Âncora (ex.: #beneficios) para os atalhos levarem ao bloco certo. */
  id?: string;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  className?: string;
  tom?: Tom;
}) {
  return (
    <section
      id={id}
      className={`${TOM[tom]} scroll-mt-6 rounded-[1.75rem] p-5 md:p-6 ${className}`}
    >
      <h2 className="text-base font-semibold">{titulo}</h2>
      {descricao && (
        <p className="mt-1 text-xs text-neutral-500">{descricao}</p>
      )}
      <div className="mt-4 min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function Nota({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-neutral-500">{children}</p>;
}
