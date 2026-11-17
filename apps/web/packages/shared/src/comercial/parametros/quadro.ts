export const BLOCOS = {
  funil: "Funil",
  ocupacao: "Ocupação e carteira",
  vencimentos: "Vencimentos e relacionamento",
  contratos: "Contratos",
  ficha: "Ficha cadastral",
  censo: "Censo",
  kit: "Kit de entrega",
  eventos: "Eventos",
  pesquisa: "Pesquisa de mercado",
  calendario: "Calendário",
} as const;
export type Bloco = keyof typeof BLOCOS;
export const ORDEM_BLOCOS = Object.keys(BLOCOS) as Bloco[];

/** Blocos com campos na linha única de comercial.parametros. */
export type BlocoComCampos = Exclude<Bloco, "calendario">;

/** Rótulo de um campo de comercial.parametros e o bloco dele. */
export interface CampoParametro {
  rotulo: string;
  bloco: Bloco;
}
