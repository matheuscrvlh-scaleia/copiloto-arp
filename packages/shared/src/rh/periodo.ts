import { competenciaDe, fimDoMes, isoLocal } from "../formato";

// Datas das telas do RH usadas pela API e pela tela (filtros.ts do antigo).

/** Último dia considerado no mês: ontem, se for o mês corrente. */
export function fimConsiderado(competencia: string, hoje = new Date()): string {
  const ontem = isoLocal(
    new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1),
  );
  const fim = fimDoMes(competencia);
  return fim < ontem ? fim : ontem;
}

/** Competência do mês anterior. */
export function mesAnterior(competencia: string): string {
  const [a = 0, m = 1] = competencia.split("-").map(Number);
  return competenciaDe(new Date(a, m - 2, 1));
}
