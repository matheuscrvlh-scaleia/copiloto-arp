import {
  ehPermissaoDePrograma,
  MODULOS_DE_PERMISSAO,
  PERMISSOES,
  type Permissao,
  type PermissaoDePrograma,
} from "@/lib/permissions";

// Parte pura das telas de cargos e usuários: junta o catálogo fixo
// (PERMISSOES) com as permissões "Programa – lançar", que existem só em
// core.permissoes (uma por programa, criada pelo banco).

/** Qualquer permissão que as telas de Administração manipulam. */
export type CodigoPermissao = Permissao | PermissaoDePrograma;

/** Uma permissão de programa como está em core.permissoes. */
export interface ProgramaPermissao {
  codigo: PermissaoDePrograma;
  descricao: string;
}

/** Só o catálogo fixo (hasOwn: "toString" e afins não são permissão). */
export const ehPermissaoFixa = (p: string): p is Permissao =>
  Object.hasOwn(PERMISSOES, p);

/** Fixa ou de programa (a existência da de programa o banco confere). */
export const ehCodigoConhecido = (p: string): p is CodigoPermissao =>
  ehPermissaoFixa(p) || ehPermissaoDePrograma(p);

export function rotuloDaPermissao(
  p: CodigoPermissao,
  programas: readonly ProgramaPermissao[],
): string {
  if (ehPermissaoFixa(p)) return PERMISSOES[p];
  return programas.find((x) => x.codigo === p)?.descricao ?? p;
}

export interface GrupoDePermissao {
  prefixo: string;
  titulo: string;
  fixas: Permissao[];
  /** Só o módulo Sustentabilidade tem. */
  programas: ProgramaPermissao[];
}

const FIXAS = Object.keys(PERMISSOES) as Permissao[];

/** Os módulos na ordem das telas, cada um com as fixas e as de programa. */
export function gruposDePermissao(
  programas: readonly ProgramaPermissao[],
): GrupoDePermissao[] {
  return MODULOS_DE_PERMISSAO.map((m) => ({
    prefixo: m.prefixo,
    titulo: m.titulo,
    fixas: FIXAS.filter((p) => p.startsWith(m.prefixo)),
    programas: programas.filter((p) => p.codigo.startsWith(m.prefixo)),
  }));
}

/** Todos os códigos do grupo, fixas primeiro. */
export const codigosDoGrupo = (g: GrupoDePermissao): CodigoPermissao[] => [
  ...g.fixas,
  ...g.programas.map((p) => p.codigo),
];

/**
 * "Tem todas": cada fixa e cada permissão de programa que existe agora.
 * Programa novo que o cargo não tem tira o destaque, de propósito.
 */
export function temTodasAsPermissoes(
  permissoes: readonly string[],
  programas: readonly ProgramaPermissao[],
): boolean {
  const tem = new Set(permissoes);
  return (
    FIXAS.every((p) => tem.has(p)) && programas.every((p) => tem.has(p.codigo))
  );
}

/**
 * O que gravar ao salvar: conceder o que veio e falta; revogar o que tem e
 * não veio. Permissão de programa só é revogada se estava na tela (`vistas`):
 * programa criado depois de a tela abrir não some do cargo no salvar.
 */
export function planoDePermissoes(
  tem: Iterable<string>,
  querer: Iterable<string>,
  vistas: Iterable<string>,
): { conceder: string[]; revogar: string[] } {
  const atual = new Set(tem);
  const novo = new Set(querer);
  const naTela = new Set(vistas);
  return {
    conceder: [...novo].filter((p) => !atual.has(p)),
    revogar: [...atual].filter(
      (p) => !novo.has(p) && (!ehPermissaoDePrograma(p) || naTela.has(p)),
    ),
  };
}

/** As permissões de programa pedidas que não existem em core.permissoes. */
export function programasInexistentes(
  pedidas: readonly string[],
  existentes: Iterable<string>,
): string[] {
  const existe = new Set(existentes);
  return [...new Set(pedidas)].filter(
    (p) => ehPermissaoDePrograma(p) && !existe.has(p),
  );
}
