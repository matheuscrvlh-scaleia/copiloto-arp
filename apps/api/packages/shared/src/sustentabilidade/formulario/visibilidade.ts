import type { DefinicaoFormulario, Pergunta, Respostas, Secao } from "./tipos";

// "Mostrar só se": quais perguntas aparecem para as respostas dadas até agora.
// Só importa tipos de ./tipos (que importa daqui), para não haver ciclo.

/** Sem resposta: nada, texto em branco, lista vazia ou objeto vazio. */
export function respostaVazia(valor: unknown): boolean {
  if (valor === undefined || valor === null) return true;
  if (typeof valor === "string") return valor.trim() === "";
  if (Array.isArray(valor)) return valor.length === 0;
  if (typeof valor === "object") return Object.keys(valor).length === 0;
  return false;
}

/** A resposta dada em `ref` satisfaz o valor da regra? */
function satisfaz(ref: Pergunta, resposta: unknown, valor: string): boolean {
  switch (ref.tipo) {
    case "uma":
      return resposta === valor;
    case "varias":
      return Array.isArray(resposta) && resposta.includes(valor);
    case "sim_nao":
    case "sim_nao_quantidade":
    case "sim_nao_descricao":
      return (
        typeof resposta === "object" &&
        resposta !== null &&
        (resposta as { r?: unknown }).r === valor
      );
    default:
      return resposta !== undefined && String(resposta) === valor;
  }
}

function indice(def: DefinicaoFormulario) {
  const m = new Map<string, { p: Pergunta; secaoAtiva: boolean }>();
  for (const s of def.secoes)
    for (const p of s.perguntas) m.set(p.id, { p, secaoAtiva: s.ativa });
  return m;
}

/**
 * Pergunta aparece? Ativa, em seção ativa e, se tiver regra, a pergunta de que
 * depende também aparece e tem a resposta da regra. Regra para pergunta
 * inexistente ou inativa esconde (a publicação bloqueia esse caso).
 */
export function perguntaVisivel(
  p: Pergunta,
  respostas: Respostas,
  def: DefinicaoFormulario,
): boolean {
  const mapa = indice(def);
  const vistos = new Set<string>();
  let atual: Pergunta | undefined = p;
  while (atual) {
    if (vistos.has(atual.id)) return false; // regra circular
    vistos.add(atual.id);
    const item = mapa.get(atual.id);
    if (!atual.ativa || (item && !item.secaoAtiva)) return false;
    const regra: Pergunta["mostrar_se"] = atual.mostrar_se;
    if (!regra) return true;
    const ref: Pergunta | undefined = mapa.get(regra.pergunta_id)?.p;
    if (!ref || !satisfaz(ref, respostas[ref.id], regra.valor)) return false;
    atual = ref;
  }
  return true;
}

/** Perguntas que aparecem, na ordem do formulário. */
export function perguntasVisiveis(
  def: DefinicaoFormulario,
  respostas: Respostas,
): Pergunta[] {
  return def.secoes.flatMap((s) =>
    s.perguntas.filter((p) => perguntaVisivel(p, respostas, def)),
  );
}

/** Seções com pelo menos uma pergunta visível ("uma seção por tela"). */
export function secoesComPerguntas(
  def: DefinicaoFormulario,
  respostas: Respostas,
): { secao: Secao; perguntas: Pergunta[] }[] {
  return def.secoes
    .map((secao) => ({
      secao,
      perguntas: secao.perguntas.filter((p) =>
        perguntaVisivel(p, respostas, def),
      ),
    }))
    .filter((s) => s.perguntas.length > 0);
}

/** Só as respostas das perguntas visíveis (o que se grava ao salvar). */
export function respostasVisiveis(
  def: DefinicaoFormulario,
  respostas: Respostas,
): Respostas {
  const fica: Respostas = {};
  for (const p of perguntasVisiveis(def, respostas))
    if (p.id in respostas) fica[p.id] = respostas[p.id];
  return fica;
}

/**
 * Barra de progresso. Campos automáticos (ENET) não contam: já vêm prontos.
 * `escondidas` = perguntas ativas que a regra "mostrar só se" escondeu.
 * "Não se aplica" conta como respondida.
 */
export function progresso(
  def: DefinicaoFormulario,
  respostas: Respostas,
): { respondidas: number; total: number; escondidas: number } {
  let respondidas = 0;
  let total = 0;
  let escondidas = 0;
  for (const s of def.secoes) {
    if (!s.ativa) continue;
    for (const p of s.perguntas) {
      if (!p.ativa || p.tipo === "auto") continue;
      if (!perguntaVisivel(p, respostas, def)) {
        escondidas++;
        continue;
      }
      total++;
      if (!respostaVazia(respostas[p.id])) respondidas++;
    }
  }
  return { respondidas, total, escondidas };
}
