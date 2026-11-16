// Leituras ao vivo das ferramentas (Meta, Google, Asana, site) guardadas na
// memória do processo, como o "use cache" do sistema antigo: uma hora com
// sucesso e só segundos com falha, para a tela não esperar a API externa a
// cada abertura. Quem salva, testa ou sincroniza a integração chama
// `esquecerLeituras(tag)` (o updateTag de antes).

export type TagLeitura =
  | "meta"
  | "google"
  | "asana"
  | "eventos_site"
  | "benchmark_meta";

export const VALIDADE_LEITURA = {
  /** cacheLife("hours"). */
  horas: 3_600_000,
  /** cacheLife("minutes"). */
  minutos: 60_000,
  /** cacheLife("seconds"): a falha volta logo a ser tentada. */
  segundos: 1_000,
} as const;

const memorias: { tags: readonly TagLeitura[]; limpar: () => void }[] = [];

/**
 * Uma memória de leituras com as `tags` dela. A função devolvida dá o valor
 * guardado na `chave`, ou o lido agora: `ler` devolve o valor e por quanto
 * tempo ele vale; se `ler` lançar, nada fica guardado. Duas telas pedindo
 * ao mesmo tempo esperam a mesma leitura.
 */
export function memoria<T>(...tags: TagLeitura[]) {
  const guardadas = new Map<string, { ate: number; valor: Promise<T> }>();
  memorias.push({ tags, limpar: () => guardadas.clear() });

  return (
    chave: string,
    ler: () => Promise<{ valor: T; validade: number }>,
  ): Promise<T> => {
    const agora = Date.now();
    const ja = guardadas.get(chave);
    if (ja && ja.ate > agora) return ja.valor;
    for (const [k, g] of guardadas) if (g.ate <= agora) guardadas.delete(k);

    // Enquanto lê, vale: quem chegar agora espera a mesma promessa.
    const entrada: { ate: number; valor: Promise<T> } = {
      ate: Number.POSITIVE_INFINITY,
      valor: ler().then(
        (r) => {
          entrada.ate = Date.now() + r.validade;
          return r.valor;
        },
        (erro: unknown) => {
          if (guardadas.get(chave) === entrada) guardadas.delete(chave);
          throw erro;
        },
      ),
    };
    guardadas.set(chave, entrada);
    return entrada.valor;
  };
}

/** Joga fora as leituras com alguma das tags (o updateTag do antigo). */
export function esquecerLeituras(...tags: TagLeitura[]): void {
  for (const m of memorias)
    if (m.tags.some((t) => tags.includes(t))) m.limpar();
}
