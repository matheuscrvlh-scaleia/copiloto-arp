// Nome de arquivo para o caminho no disco (src/server/arquivos): sem acento,
// espaço, barra nem símbolo; minúsculo; nunca começa com ponto (arquivo
// oculto) nem com hífen. Guarda o fim do nome (a extensão) quando corta.

/** Tamanho máximo do nome no caminho. */
export const NOME_MAX = 120;

export function nomeSeguro(nome: string, padrao = "arquivo"): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(-NOME_MAX)
    .replace(/^[-.]+|[-.]+$/g, "");
  return limpo || padrao;
}
