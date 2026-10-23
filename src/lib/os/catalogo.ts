import { type CampoExtra, TIPOS_CAMPO, type TipoCampo } from "./rotulos";

// Catálogo por setor (spec 4.5): campos extras e checklist de cada
// categoria, a ordem da lista e as subcategorias. Funções puras: a tela
// confere enquanto a pessoa edita e o servidor confere de novo ao salvar.

/** Limites de bom senso para uma tela de abertura (não são regra de negócio). */
export const MAX_CAMPOS = 30;
export const MAX_ITENS_CHECKLIST = 50;
export const MAX_OPCOES = 50;

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "Placa do veículo" → "placa_do_veiculo" (a chave gravada no chamado). */
export function chaveDoRotulo(rotulo: string): string {
  const chave = semAcento(rotulo)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/, "");
  return /^[a-z]/.test(chave) ? chave : `campo${chave ? `_${chave}` : ""}`;
}

/** Chave do rótulo que não repete nenhuma das `usadas` (placa, placa_2…). */
export function chaveUnica(rotulo: string, usadas: Iterable<string>): string {
  const ocupadas = new Set(usadas);
  const base = chaveDoRotulo(rotulo);
  if (!ocupadas.has(base)) return base;
  let n = 2;
  while (ocupadas.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const textoLimpo = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";

/** Lista de opções sem vazias nem repetidas (sem diferenciar maiúsculas). */
export function limparLista(itens: unknown, max = MAX_OPCOES): string[] {
  if (!Array.isArray(itens)) return [];
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const i of itens) {
    const t = textoLimpo(i, 120);
    const k = semAcento(t).toLowerCase();
    if (!t || vistos.has(k)) continue;
    vistos.add(k);
    saida.push(t);
  }
  return saida.slice(0, max);
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

/**
 * Confere os campos extras vindos da tela: rótulo e tipo obrigatórios,
 * lista com ao menos duas opções e chaves únicas. Campo já existente
 * mantém a chave (os chamados antigos guardam o valor por ela); campo novo
 * ganha a chave do rótulo.
 */
export function validarCamposExtras(entrada: unknown): Resultado<CampoExtra[]> {
  if (!Array.isArray(entrada)) return { ok: false, erro: "lista inválida" };
  if (entrada.length > MAX_CAMPOS)
    return { ok: false, erro: `no máximo ${MAX_CAMPOS} campos` };
  const usadas = new Set<string>();
  const campos: CampoExtra[] = [];
  for (const [i, c] of entrada.entries()) {
    const n = i + 1;
    if (!ehObjeto(c)) return { ok: false, erro: `campo ${n} inválido` };
    const rotulo = textoLimpo(c.rotulo, 80);
    if (!rotulo) return { ok: false, erro: `dê um nome ao campo ${n}` };
    if (typeof c.tipo !== "string" || !(c.tipo in TIPOS_CAMPO))
      return { ok: false, erro: `escolha o tipo de "${rotulo}"` };
    const tipo = c.tipo as TipoCampo;
    const pedida = typeof c.chave === "string" ? c.chave.trim() : "";
    const chave =
      pedida && /^[a-z][a-z0-9_]{0,39}$/.test(pedida) && !usadas.has(pedida)
        ? pedida
        : chaveUnica(rotulo, usadas);
    usadas.add(chave);
    const campo: CampoExtra = { chave, rotulo, tipo };
    if (tipo === "lista") {
      const opcoes = limparLista(c.opcoes);
      if (opcoes.length < 2)
        return {
          ok: false,
          erro: `"${rotulo}" precisa de pelo menos 2 opções`,
        };
      campo.opcoes = opcoes;
    }
    campo.obrigatorio = c.obrigatorio === true;
    campos.push(campo);
  }
  return { ok: true, valor: campos };
}

export interface ItemPadrao {
  texto: string;
  obrigatorio: boolean;
}

/** Checklist padrão: itens com texto, sem repetidos. */
export function validarChecklist(entrada: unknown): Resultado<ItemPadrao[]> {
  if (!Array.isArray(entrada)) return { ok: false, erro: "lista inválida" };
  if (entrada.length > MAX_ITENS_CHECKLIST)
    return { ok: false, erro: `no máximo ${MAX_ITENS_CHECKLIST} itens` };
  const vistos = new Set<string>();
  const itens: ItemPadrao[] = [];
  for (const [i, item] of entrada.entries()) {
    if (!ehObjeto(item)) return { ok: false, erro: `item ${i + 1} inválido` };
    const texto = textoLimpo(item.texto, 200);
    if (!texto) return { ok: false, erro: `escreva o item ${i + 1}` };
    const k = semAcento(texto).toLowerCase();
    if (vistos.has(k)) return { ok: false, erro: `"${texto}" está repetido` };
    vistos.add(k);
    itens.push({ texto, obrigatorio: item.obrigatorio === true });
  }
  return { ok: true, valor: itens };
}

// ---------------------------------------------------------------------------
// Ordem da lista
// ---------------------------------------------------------------------------

/** Move o item `indice` em `delta` posições (fica no lugar se não der). */
export function mover<T>(
  lista: readonly T[],
  indice: number,
  delta: number,
): T[] {
  const copia = [...lista];
  const destino = indice + delta;
  if (indice < 0 || indice >= copia.length) return copia;
  if (destino < 0 || destino >= copia.length) return copia;
  const [item] = copia.splice(indice, 1) as [T];
  copia.splice(destino, 0, item);
  return copia;
}

/**
 * Nova numeração depois de mover `id` (1, 2, 3…), só com o que mudou: a
 * lista vem na ordem da tela.
 */
export function reordenar(
  lista: readonly { id: string; ordem: number }[],
  id: string,
  delta: number,
): { id: string; ordem: number }[] {
  const indice = lista.findIndex((i) => i.id === id);
  if (indice < 0) return [];
  return mover(lista, indice, delta)
    .map((item, k) => ({ id: item.id, ordem: k + 1, antes: item.ordem }))
    .filter((i) => i.ordem !== i.antes)
    .map(({ id, ordem }) => ({ id, ordem }));
}

interface ItemDoCatalogo {
  id: string;
  pai_id: string | null;
  nome: string;
  ordem: number;
}

const porOrdem = (a: ItemDoCatalogo, b: ItemDoCatalogo) =>
  a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR");

/**
 * Categorias principais na ordem, cada uma com as subcategorias. Uma
 * subcategoria cujo pai não está na lista sobe como principal (nada some).
 */
export function arvore<T extends ItemDoCatalogo>(
  categorias: readonly T[],
): { categoria: T; filhas: T[] }[] {
  const ids = new Set(categorias.map((c) => c.id));
  const raizes = categorias
    .filter((c) => !c.pai_id || !ids.has(c.pai_id))
    .sort(porOrdem);
  return raizes.map((categoria) => ({
    categoria,
    filhas: categorias.filter((c) => c.pai_id === categoria.id).sort(porOrdem),
  }));
}

/** "Elétrica" → "Elétrica (cópia)", "Elétrica (cópia 2)"… sem repetir. */
export function nomeDaCopia(
  nome: string,
  existentes: Iterable<string>,
): string {
  const usados = new Set([...existentes].map((n) => n.toLowerCase()));
  const base = nome.replace(/ \(cópia(?: \d+)?\)$/, "");
  let candidato = `${base} (cópia)`;
  let n = 2;
  while (usados.has(candidato.toLowerCase()))
    candidato = `${base} (cópia ${n++})`;
  return candidato;
}

/** "2 dias úteis", "4 horas", "Sem prazo". */
export function textoDoPrazo(
  valor: number | null,
  unidade: "horas" | "dias_uteis",
): string {
  if (!valor) return "Sem prazo";
  if (unidade === "horas") return `${valor} ${valor === 1 ? "hora" : "horas"}`;
  return `${valor} ${valor === 1 ? "dia útil" : "dias úteis"}`;
}

/** Etiquetas mais usadas (contagem), da mais frequente para a menos. */
export function etiquetasMaisUsadas(
  listas: readonly (readonly string[])[],
  limite = 20,
): { etiqueta: string; vezes: number }[] {
  const conta = new Map<string, number>();
  for (const lista of listas)
    for (const e of new Set(lista.map((x) => x.trim()).filter(Boolean)))
      conta.set(e, (conta.get(e) ?? 0) + 1);
  return [...conta]
    .map(([etiqueta, vezes]) => ({ etiqueta, vezes }))
    .sort(
      (a, b) =>
        b.vezes - a.vezes || a.etiqueta.localeCompare(b.etiqueta, "pt-BR"),
    )
    .slice(0, limite);
}
