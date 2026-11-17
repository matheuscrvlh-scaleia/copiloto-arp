// Sugestões do começo da conversa nas telas do Marketing: as quatro coisas
// que a IA faz com o contexto da marca. As que pedem um tema ou um texto
// (`completar`) vão para o campo, para a pessoa terminar; as outras enviam.

export interface Sugestao {
  texto: string;
  completar: boolean;
}

export const SUGESTOES_DE_MARKETING: readonly Sugestao[] = [
  { texto: "Me dê ideias de conteúdo sobre: ", completar: true },
  {
    texto: "Escreva uma legenda de Instagram, com variações, sobre: ",
    completar: true,
  },
  { texto: "Revise este texto pelo tom da marca:\n\n", completar: true },
  {
    texto:
      "Monte o calendário de conteúdo do próximo mês, com os eventos da agenda.",
    completar: false,
  },
];

export const ehTelaDeMarketing = (caminho: string) =>
  caminho === "/marketing" || caminho.startsWith("/marketing/");
