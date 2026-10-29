type Busca = Record<string, string | string[] | undefined>;

// O que toda aba do Radar recebe da página: filtros lidos, "hoje" e se a
// pessoa pode exportar. As abas são componentes do servidor.

export const BASE_RADAR = "/marketing/radar";
export const FONTE_ASANA = "Asana";

export interface PropsAba {
  busca: Busca;
  lembrado: string | null;
  hoje: string;
  dadosDe: string;
  exportar: boolean;
  /** Valor de um filtro de seleção ("" = padrão). */
  um: (chave: string) => string;
}

/** "—" apagado, para célula sem valor. */
export function Vazio({ texto = "—" }: { texto?: string }) {
  return <span className="text-neutral-400">{texto}</span>;
}

export const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;
