import type { Detalhe } from "@/components/modal-detalhe";
import type { ColaboradorQuadro } from "./calculos";
import { tabelaDoQuadro } from "./detalhes";

// Headcount: colaboradores ativos agrupados por departamento, cargo ou tipo
// de contrato. Cargo e contrato vêm da folha; quem só está no ponto entra
// como "Sem informação".

export const SEM_INFORMACAO = "Sem informação";

export const ROTULO_CONTRATO: Record<string, string> = {
  clt: "CLT",
  aprendiz: "Jovem aprendiz",
  estagiario: "Estagiário",
  pj: "PJ",
  pro_labore: "Pró-labore",
};

/** Ordem fixa dos contratos: a cor de cada um não muda entre meses. */
export const ORDEM_CONTRATO = [
  "clt",
  "aprendiz",
  "estagiario",
  "pj",
  "pro_labore",
] as const;

/** "Serviços " e "SERVICOS" são o mesmo grupo. */
const chaveDe = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const acentos = (t: string) => (t.match(/[^ -~]/g) ?? []).length;

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "em"]);

/** "AUXILIAR DE SERVIÇOS GERAIS II" → "Auxiliar de Serviços Gerais II". */
export function emTitulo(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => {
      if (/^[ivx]+$/.test(p)) return p.toUpperCase();
      if (i > 0 && MINUSCULAS.has(p)) return p;
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(" ");
}

export interface GrupoHeadcount {
  chave: string;
  rotulo: string;
  pessoas: ColaboradorQuadro[];
}

/**
 * Agrupa por um campo, do maior grupo para o menor. Entre as grafias de um
 * mesmo grupo, fica a que tem acento ("Serviços", não "Servicos").
 */
export function agrupar(
  ativos: ColaboradorQuadro[],
  campo: (c: ColaboradorQuadro) => string | null | undefined,
  rotular: (valor: string) => string = emTitulo,
): GrupoHeadcount[] {
  const grupos = new Map<string, GrupoHeadcount & { original: string }>();
  for (const c of ativos) {
    const v = campo(c)?.trim();
    const chave = v ? chaveDe(v) : SEM_INFORMACAO;
    const g = grupos.get(chave);
    if (!g) {
      grupos.set(chave, {
        chave,
        rotulo: v ? rotular(v) : SEM_INFORMACAO,
        original: v ?? "",
        pessoas: [c],
      });
      continue;
    }
    g.pessoas.push(c);
    if (v && acentos(v) > acentos(g.original)) {
      g.original = v;
      g.rotulo = rotular(v);
    }
  }
  return [...grupos.values()]
    .map(({ original: _, ...g }) => g)
    .sort(
      (a, b) =>
        b.pessoas.length - a.pessoas.length ||
        a.rotulo.localeCompare(b.rotulo, "pt-BR"),
    );
}

/** Os `n` maiores grupos e o resto junto em "Outros (k)". */
export function maioresEOutros(
  grupos: GrupoHeadcount[],
  n: number,
  nomeDoGrupo: string,
): GrupoHeadcount[] {
  if (grupos.length <= n + 1) return grupos;
  const resto = grupos.slice(n);
  return [
    ...grupos.slice(0, n),
    {
      chave: "__outros",
      rotulo: `Outros (${resto.length} ${nomeDoGrupo})`,
      pessoas: resto.flatMap((g) => g.pessoas),
    },
  ];
}

/** Modal com as pessoas de um grupo. */
export function detalheDoGrupo(
  g: GrupoHeadcount,
  o: { secao: string; ate: string; subtitulo: string; total: number },
): Detalhe {
  return {
    secao: o.secao,
    titulo: g.rotulo,
    subtitulo: o.subtitulo,
    resumo: [
      { rotulo: "Pessoas", valor: String(g.pessoas.length) },
      {
        rotulo: "Do headcount",
        valor: `${Math.round((g.pessoas.length / Math.max(o.total, 1)) * 100)}%`,
      },
    ],
    tabelas: [
      tabelaDoQuadro(
        [...g.pessoas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        o.ate,
      ),
    ],
  };
}
