import type { z } from "zod";
import { CAMPOS_CENSO, ESQUEMA_CENSO } from "./censo";
import { CAMPOS_CONTRATOS, ESQUEMA_CONTRATOS } from "./contratos";
import { CAMPOS_EVENTOS, ESQUEMA_EVENTOS } from "./eventos";
import { CAMPOS_FICHA, ESQUEMA_FICHA } from "./ficha";
import { CAMPOS_FUNIL, ESQUEMA_FUNIL } from "./funil";
import { CAMPOS_KIT, ESQUEMA_KIT } from "./kit";
import { CAMPOS_OCUPACAO, ESQUEMA_OCUPACAO } from "./ocupacao";
import { CAMPOS_PESQUISA, ESQUEMA_PESQUISA } from "./pesquisa";
import type { Bloco, BlocoComCampos, CampoParametro } from "./quadro";
import { CAMPOS_VENCIMENTOS, ESQUEMA_VENCIMENTOS } from "./vencimentos";

// Esquema e rótulos de todos os blocos, montados dos arquivos de cada bloco
// na ordem do quadro (a ordem dos campos é a do formulário).

export const ESQUEMAS = {
  funil: ESQUEMA_FUNIL,
  ocupacao: ESQUEMA_OCUPACAO,
  vencimentos: ESQUEMA_VENCIMENTOS,
  contratos: ESQUEMA_CONTRATOS,
  ficha: ESQUEMA_FICHA,
  censo: ESQUEMA_CENSO,
  kit: ESQUEMA_KIT,
  eventos: ESQUEMA_EVENTOS,
  pesquisa: ESQUEMA_PESQUISA,
} as const satisfies Record<BlocoComCampos, z.ZodType>;

/** Rótulo de cada campo (formulário, erro e histórico) e o bloco dele. */
export const CAMPOS: Record<string, CampoParametro> = {
  ...CAMPOS_FUNIL,
  ...CAMPOS_OCUPACAO,
  ...CAMPOS_VENCIMENTOS,
  ...CAMPOS_CONTRATOS,
  ...CAMPOS_FICHA,
  ...CAMPOS_CENSO,
  ...CAMPOS_KIT,
  ...CAMPOS_EVENTOS,
  ...CAMPOS_PESQUISA,
};

/** Campos do bloco na ordem do formulário (para o histórico e os testes). */
export const camposDoBloco = (b: Bloco) =>
  Object.keys(CAMPOS).filter((c) => CAMPOS[c]?.bloco === b);

export type ErroDeCampo = { campo: string; erro: string };

/** Primeiro erro da validação, com o rótulo do campo. */
export function primeiroErro(e: z.ZodError): string {
  const issue = e.issues[0];
  const campo = String(issue?.path[0] ?? "");
  const rotulo = CAMPOS[campo]?.rotulo ?? ROTULOS_EXTRA[campo] ?? campo;
  return `${rotulo || "Campo"}: ${issue?.message ?? "inválido"}`;
}

const ROTULOS_EXTRA: Record<string, string> = {
  nome: "Nome",
  area_de: "De (m²)",
  area_ate: "Até (m²)",
  valor_comum: "Dias comuns",
  valor_sazonal: "Datas sazonais",
  fonte_rd: "Fonte no RD",
  fonte_ajustada: "Fonte ajustada",
  tipo: "Tipo de LUC",
  data: "Data",
};

/** Bloco de um formulário de parâmetros. */
export function validarBloco<B extends BlocoComCampos>(
  bloco: B,
  dados: Record<string, unknown>,
):
  | { ok: true; dados: z.infer<(typeof ESQUEMAS)[B]> }
  | { ok: false; erro: string } {
  const r = ESQUEMAS[bloco].safeParse(dados);
  return r.success
    ? { ok: true, dados: r.data as z.infer<(typeof ESQUEMAS)[B]> }
    : { ok: false, erro: primeiroErro(r.error) };
}
