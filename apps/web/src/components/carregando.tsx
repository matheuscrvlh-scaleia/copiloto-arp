// Carregamento das telas: blocos lisos no formato e no lugar dos cartões de
// verdade, com um brilho em degradê correndo da esquerda para a direita
// (globals.css, .carregando). Cada tela monta o seu fallback com estas
// peças, espelhando o próprio layout, e os dados entram no lugar.

/** Tela inteira carregando: anuncia aos leitores de tela uma vez só. */
export function TelaCarregando({ children }: { children: React.ReactNode }) {
  return (
    <output className="flex flex-col gap-6">
      <span className="sr-only">Carregando dados…</span>
      {children}
    </output>
  );
}

/** Bloco no lugar de um cartão (seção, gráfico, tabela). */
export function CartaoCarregando({
  className = "",
  altura = "h-64",
}: {
  className?: string;
  /** Altura do cartão, em classe (ex.: "h-[650px]"), igual à da tela pronta. */
  altura?: string;
}) {
  return (
    <div
      aria-hidden
      className={`carregando rounded-[1.75rem] ${altura} ${className}`}
    />
  );
}

/** Linha de blocos no lugar dos indicadores. */
export function IndicadoresCarregando({
  quantidade,
  className = "sm:grid-cols-2 xl:grid-cols-4",
}: {
  quantidade: number;
  /** Colunas da grade, iguais às da tela pronta. */
  className?: string;
}) {
  return (
    <div aria-hidden className={`grid grid-cols-1 gap-4 ${className}`}>
      {Array.from({ length: quantidade }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: blocos fixos, a posição é a identidade
          key={i}
          className="carregando h-40 rounded-[1.75rem]"
        />
      ))}
    </div>
  );
}

/** Pílulas no lugar dos filtros de mês e departamento. */
export function FiltrosCarregando() {
  return (
    <div aria-hidden className="flex flex-wrap items-center gap-2">
      <span className="carregando h-10 w-40 rounded-full" />
      <span className="carregando h-10 w-64 max-w-full rounded-full" />
    </div>
  );
}

/** Fallback padrão: um bloco grande (telas sem fallback próprio). */
export function Carregando() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-80" />
    </TelaCarregando>
  );
}
