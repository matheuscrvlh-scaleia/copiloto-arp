// Buckets e caminhos aceitos pelo armazenamento de arquivos. Sem
// "server-only" para os testes de unidade importarem direto.

/** Os buckets que já existiam no Supabase Storage; no disco, uma pasta cada. */
export const BUCKETS = [
  "os",
  "comercial",
  "marketing",
  "importacoes",
  "formularios",
] as const;

export type Bucket = (typeof BUCKETS)[number];

export function ehBucket(valor: unknown): valor is Bucket {
  return (
    typeof valor === "string" && (BUCKETS as readonly string[]).includes(valor)
  );
}

/**
 * Caminho relativo dentro do bucket ("pasta/sub/arquivo.pdf"). Recusa o que
 * escaparia da pasta ou se confundiria com os metadados: barra no começo,
 * barra invertida, caractere de controle, segmento vazio e segmento que
 * começa com ponto (inclui "." e "..").
 */
export function caminhoValido(caminho: unknown): caminho is string {
  if (typeof caminho !== "string") return false;
  if (!caminho || caminho.length > 1024) return false;
  for (const ch of caminho) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c === 127 || ch === "\\") return false;
  }
  return caminho
    .split("/")
    .every((s) => s.length > 0 && s.length <= 255 && !s.startsWith("."));
}

/** Último segmento do caminho (nome padrão ao baixar). */
export function nomeDoCaminho(caminho: string): string {
  return caminho.slice(caminho.lastIndexOf("/") + 1);
}
