import {
  type DefinicaoFormulario,
  type MostrarSe,
  type Opcao,
  type Pergunta,
  ROTULO_TIPO,
  type Secao,
  TIPOS_COM_OPCOES,
  TIPOS_CONDICAO,
  type TipoPergunta,
} from "./tipos";

// Editor dos formulários específicos (spec 4.13). Operações puras sobre o
// rascunho: cada uma devolve a definição nova e a alteração para o log
// (`formulario_alteracoes`), ou um erro em português simples. Nunca muda a
// definição recebida.

/** Uso em todas as versões (`sustentabilidade.uso_do_formulario`). */
export interface Uso {
  perguntas: Record<string, number>;
  opcoes: Record<string, number>;
}

/**
 * Nomes dos indicadores de programa que usam cada campo (como fonte ou
 * filtro), só deste formulário: { campo_id: ["Volume reciclado", ...] }.
 */
export type IndicadoresPorCampo = Record<string, string[]>;

export interface ContextoEditor {
  uso: Uso;
  indicadoresPorCampo: IndicadoresPorCampo;
  /** Gera ids de pergunta, opção e seção (uuid no servidor). */
  novoId: () => string;
  /** Formulário de programa: fala em "lançamentos" em vez de "respostas". */
  programa?: boolean;
}

export interface Alteracao {
  descricao: string;
  antes: unknown;
  depois: unknown;
}

export interface Sucesso {
  definicao: DefinicaoFormulario;
  alteracao: Alteracao;
  /** O que a tela deve mostrar depois (indicadores afetados, dependentes). */
  avisos: string[];
}

export interface Falha {
  erro: string;
  /** Não pode excluir, mas pode inativar: a tela oferece "Inativar". */
  podeInativar?: boolean;
}

export type Resultado = Sucesso | Falha;
export type Direcao = "subir" | "descer";

export interface DadosOpcao {
  /** Opção já existente mantém o id; nova vem sem. */
  id?: string;
  texto: string;
  ativa?: boolean;
}

export interface DadosPergunta {
  numero: string;
  texto: string;
  ajuda?: string;
  tipo: TipoPergunta;
  obrigatoria?: boolean;
  opcoes?: DadosOpcao[];
  unidades?: string[];
  mostrar_se?: MostrarSe | null;
  fonte_indicador?: boolean;
}

export type MudancasPergunta = Partial<DadosPergunta> & { secao_id?: string };

const TRAVADA =
  "Campo automático do ENET: não pode ser excluído nem inativado.";
const TRAVADA_EDITAR =
  "Campo automático do ENET: só o texto de ajuda pode ser editado.";

// ---------------------------------------------------------------- auxiliares

export function todasAsPerguntas(def: DefinicaoFormulario): Pergunta[] {
  return def.secoes.flatMap((s) => s.perguntas);
}

interface Local {
  secao: Secao;
  indice: number;
  pergunta: Pergunta;
}

function achar(def: DefinicaoFormulario, id: string): Local | null {
  for (const secao of def.secoes) {
    const indice = secao.perguntas.findIndex((p) => p.id === id);
    const pergunta = secao.perguntas[indice];
    if (pergunta) return { secao, indice, pergunta };
  }
  return null;
}

function falha(erro: string, podeInativar?: boolean): Falha {
  return podeInativar === undefined ? { erro } : { erro, podeInativar };
}

function ok(
  definicao: DefinicaoFormulario,
  descricao: string,
  antes: unknown,
  depois: unknown,
  avisos: string[] = [],
): Sucesso {
  return { definicao, alteracao: { descricao, antes, depois }, avisos };
}

function copia<T>(v: T): T {
  return structuredClone(v);
}

function lista(itens: string[]): string {
  return itens.join(", ");
}

function quantos(n: number, ctx: ContextoEditor): string {
  const [um, varios] = ctx.programa
    ? ["lançamento", "lançamentos"]
    : ["resposta", "respostas"];
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
}

/** Número livre: o próprio, ou com sufixo ("12-c", "12-c2"...). */
function numeroLivre(base: string, usados: Set<string>, sufixo: string) {
  if (!usados.has(base)) return base;
  for (let i = 1; ; i++) {
    const n = `${base}-${sufixo}${i === 1 ? "" : i}`;
    if (!usados.has(n)) return n;
  }
}

/** Igualdade profunda sem depender da ordem das chaves (o jsonb reordena). */
function igual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    igual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/** Indicadores que deixam de receber dado se a pergunta sair. */
export function indicadoresDe(
  p: Pergunta,
  indicadoresPorCampo: IndicadoresPorCampo,
): string[] {
  const nomes = [...(indicadoresPorCampo[p.id] ?? [])];
  if (p.fonte_indicador)
    nomes.push(`Gráficos das respostas e painel (pergunta ${p.numero})`);
  return [...new Set(nomes)];
}

/** Perguntas que dependem desta ("mostrar só se"), direta ou em cadeia. */
export function dependentes(
  def: DefinicaoFormulario,
  perguntaId: string,
  soAtivas = true,
): Pergunta[] {
  const todas = todasAsPerguntas(def);
  const achadas = new Set<string>();
  const fila = [perguntaId];
  while (fila.length) {
    const atual = fila.shift();
    for (const p of todas) {
      if (p.mostrar_se?.pergunta_id !== atual) continue;
      if (p.id === perguntaId || achadas.has(p.id)) continue;
      if (soAtivas && !p.ativa) continue;
      achadas.add(p.id);
      fila.push(p.id);
    }
  }
  return todas.filter((p) => achadas.has(p.id));
}

/** Para a confirmação de "Inativar": o que vai junto e o que perde dado. */
export function consequenciasDeInativar(
  def: DefinicaoFormulario,
  perguntaId: string,
  indicadoresPorCampo: IndicadoresPorCampo,
): { dependentes: Pergunta[]; indicadores: string[] } {
  const p = achar(def, perguntaId)?.pergunta;
  if (!p) return { dependentes: [], indicadores: [] };
  const deps = dependentes(def, perguntaId);
  const indicadores = [p, ...deps].flatMap((x) =>
    indicadoresDe(x, indicadoresPorCampo),
  );
  return { dependentes: deps, indicadores: [...new Set(indicadores)] };
}

function inativarComDependentes(
  def: DefinicaoFormulario,
  perguntas: Pergunta[],
  ctx: ContextoEditor,
): { inativadas: Pergunta[]; avisos: string[] } {
  const ids = new Set(perguntas.map((p) => p.id));
  for (const p of perguntas)
    for (const d of dependentes(def, p.id)) ids.add(d.id);
  const inativadas = todasAsPerguntas(def).filter(
    (p) => ids.has(p.id) && p.ativa,
  );
  const indicadores = [
    ...new Set(
      inativadas.flatMap((p) => indicadoresDe(p, ctx.indicadoresPorCampo)),
    ),
  ];
  const origem = new Set(perguntas.map((p) => p.id));
  const juntas = inativadas.filter((p) => !origem.has(p.id));
  for (const p of inativadas) p.ativa = false;
  const avisos: string[] = [];
  if (indicadores.length)
    avisos.push(
      `Indicadores que deixam de receber dado novo: ${indicadores.join("; ")}. O histórico continua.`,
    );
  if (juntas.length)
    avisos.push(
      `Inativadas junto, porque dependem dela ("mostrar só se"): ${lista(juntas.map((p) => p.numero))}.`,
    );
  return { inativadas, avisos };
}

/** Regra "mostrar só se" de `p` é válida? (ref ativa, tipo e valor certos) */
function erroDaRegra(def: DefinicaoFormulario, p: Pergunta): string | null {
  const regra = p.mostrar_se;
  if (!regra) return null;
  if (regra.pergunta_id === p.id)
    return "A pergunta não pode depender dela mesma.";
  const local = achar(def, regra.pergunta_id);
  if (!local)
    return 'A regra "mostrar só se" aponta para uma pergunta que não existe.';
  const ref = local.pergunta;
  if (!ref.ativa || !local.secao.ativa)
    return `A regra "mostrar só se" aponta para a pergunta ${ref.numero}, que está inativa.`;
  if (!TIPOS_CONDICAO.includes(ref.tipo))
    return `A pergunta ${ref.numero} não é de opções nem de sim ou não; não serve de condição.`;
  const valorOk =
    ref.tipo === "uma" || ref.tipo === "varias"
      ? ref.opcoes.some((o) => o.ativa && o.id === regra.valor)
      : regra.valor === "sim" || regra.valor === "nao";
  if (!valorOk)
    return `A resposta escolhida na regra não existe ou está inativa na pergunta ${ref.numero}.`;
  const vistos = new Set<string>([p.id]);
  let atual: Pergunta | undefined = ref;
  while (atual?.mostrar_se) {
    if (vistos.has(atual.id) || atual.mostrar_se.pergunta_id === p.id)
      return "Regra circular: a pergunta acabaria dependendo dela mesma.";
    vistos.add(atual.id);
    atual = achar(def, atual.mostrar_se.pergunta_id)?.pergunta;
  }
  return null;
}

function minimoDeOpcoes(tipo: TipoPergunta): number {
  if (tipo === "uma" || tipo === "varias") return 2;
  if (tipo === "grade") return 1;
  return 0;
}

function erroDasOpcoes(p: Pergunta): string | null {
  const minimo = minimoDeOpcoes(p.tipo);
  if (!minimo) return null;
  if (p.opcoes.some((o) => !o.texto.trim())) return "Há opção sem texto.";
  const textos = p.opcoes.map((o) => o.texto.trim().toLowerCase());
  const repetida = p.opcoes.find(
    (_, i) => textos.indexOf(textos[i] ?? "") !== i,
  );
  if (repetida) return `Opção repetida: "${repetida.texto.trim()}".`;
  if (p.opcoes.filter((o) => o.ativa).length < minimo)
    return p.tipo === "grade"
      ? "Inclua pelo menos 1 linha ativa na tabela."
      : "Inclua pelo menos 2 opções ativas.";
  return null;
}

/** Conferência comum a criar e editar (a regra é conferida à parte). */
function erroDaPergunta(def: DefinicaoFormulario, p: Pergunta): string | null {
  if (!p.texto.trim()) return "Escreva a pergunta.";
  if (!p.numero.trim()) return "Informe o número.";
  if (todasAsPerguntas(def).some((x) => x.id !== p.id && x.numero === p.numero))
    return `Já existe uma pergunta com o nº ${p.numero}.`;
  if (p.tipo === "auto" && !p.travada)
    return "O tipo Automático (ENET) é só dos campos do sistema.";
  if (p.tipo === "numero_unidade" && !p.unidades.length)
    return "Informe pelo menos uma unidade aceita.";
  return erroDasOpcoes(p);
}

function montarOpcoes(dados: DadosOpcao[], ctx: ContextoEditor): Opcao[] {
  return dados
    .filter((o) => o.id || o.texto.trim())
    .map((o) => ({
      id: o.id ?? ctx.novoId(),
      texto: o.texto.trim(),
      ativa: o.ativa ?? true,
    }));
}

/** Perguntas cuja regra usa esta opção. */
function regrasComOpcao(
  def: DefinicaoFormulario,
  perguntaId: string,
  opcaoId: string,
): Pergunta[] {
  return todasAsPerguntas(def).filter(
    (p) =>
      p.mostrar_se?.pergunta_id === perguntaId &&
      p.mostrar_se.valor === opcaoId,
  );
}

// ---------------------------------------------------------------- perguntas

/** Cria no fim da seção. Número único; uma/várias com ≥ 2 opções ativas. */
export function criarPergunta(
  def: DefinicaoFormulario,
  secaoId: string,
  dados: DadosPergunta,
  ctx: ContextoEditor,
): Resultado {
  const d = copia(def);
  const secao = d.secoes.find((s) => s.id === secaoId);
  if (!secao) return falha("Seção não encontrada.");
  if (!secao.ativa)
    return falha(`A seção ${secao.nome} está inativa. Reative antes.`);
  const p: Pergunta = {
    id: ctx.novoId(),
    numero: dados.numero.trim(),
    texto: dados.texto.trim(),
    ajuda: (dados.ajuda ?? "").trim(),
    tipo: dados.tipo,
    obrigatoria: dados.obrigatoria ?? false,
    opcoes: TIPOS_COM_OPCOES.includes(dados.tipo)
      ? montarOpcoes(dados.opcoes ?? [], ctx)
      : [],
    unidades:
      dados.tipo === "numero_unidade"
        ? (dados.unidades ?? []).map((u) => u.trim()).filter(Boolean)
        : [],
    mostrar_se: dados.mostrar_se ?? null,
    fonte_indicador: dados.fonte_indicador ?? false,
    ativa: true,
    travada: false,
    auto: null,
  };
  const erro = erroDaPergunta(d, p) ?? erroDaRegra(d, p);
  if (erro) return falha(erro);
  secao.perguntas.push(p);
  return ok(d, `Pergunta ${p.numero} criada na seção ${secao.nome}`, null, p);
}

/**
 * Texto, ajuda, obrigatória, regra, opções e seção mudam a qualquer momento.
 * O tipo só muda se a pergunta nunca foi respondida. Travada: só a ajuda.
 */
export function editarPergunta(
  def: DefinicaoFormulario,
  perguntaId: string,
  mudancas: MudancasPergunta,
  ctx: ContextoEditor,
): Resultado {
  const d = copia(def);
  const local = achar(d, perguntaId);
  if (!local) return falha("Pergunta não encontrada.");
  const antes = copia(local.pergunta);
  const { secao_id, opcoes, ...campos } = mudancas;
  const p: Pergunta = { ...local.pergunta };
  if (campos.numero !== undefined) p.numero = campos.numero.trim();
  if (campos.texto !== undefined) p.texto = campos.texto.trim();
  if (campos.ajuda !== undefined) p.ajuda = campos.ajuda.trim();
  if (campos.tipo !== undefined) p.tipo = campos.tipo;
  if (campos.obrigatoria !== undefined) p.obrigatoria = campos.obrigatoria;
  if (campos.mostrar_se !== undefined) p.mostrar_se = campos.mostrar_se;
  if (campos.fonte_indicador !== undefined)
    p.fonte_indicador = campos.fonte_indicador;
  if (campos.unidades !== undefined)
    p.unidades = campos.unidades.map((u) => u.trim()).filter(Boolean);
  if (opcoes !== undefined) p.opcoes = montarOpcoes(opcoes, ctx);
  if (!TIPOS_COM_OPCOES.includes(p.tipo)) p.opcoes = [];
  if (p.tipo !== "numero_unidade") p.unidades = [];

  const mudaSecao = secao_id !== undefined && secao_id !== local.secao.id;
  const mudou = (k: keyof Pergunta) => !igual(antes[k], p[k]);
  const campos_ = (Object.keys(p) as (keyof Pergunta)[]).filter(mudou);
  if (!campos_.length && !mudaSecao) return falha("Nada mudou.");

  if (antes.travada && (mudaSecao || campos_.some((k) => k !== "ajuda")))
    return falha(TRAVADA_EDITAR);

  const usos = ctx.uso.perguntas[perguntaId] ?? 0;
  if (mudou("tipo")) {
    if (usos > 0)
      return falha(
        `Já tem ${quantos(usos, ctx)}. O tipo de resposta não pode mudar: inative esta pergunta e crie outra.`,
        true,
      );
    if (dependentes(d, perguntaId, false).length)
      return falha(
        'Outras perguntas dependem dela ("mostrar só se"). Ajuste essas regras antes de mudar o tipo.',
      );
  }

  // Opções tiradas da lista: só as nunca usadas e fora de regras.
  for (const o of antes.opcoes) {
    if (p.opcoes.some((x) => x.id === o.id)) continue;
    const usada = ctx.uso.opcoes[o.id] ?? 0;
    if (usada > 0)
      return falha(
        `A opção "${o.texto}" já foi usada em ${quantos(usada, ctx)}. Só pode ser inativada.`,
      );
    const regras = regrasComOpcao(d, perguntaId, o.id);
    if (regras.length)
      return falha(
        `A opção "${o.texto}" é condição das perguntas ${lista(regras.map((r) => r.numero))}. Ajuste essas regras antes.`,
      );
  }

  const erro =
    erroDaPergunta(d, p) ?? (mudou("mostrar_se") ? erroDaRegra(d, p) : null);
  if (erro) return falha(erro);

  let destino = local.secao;
  if (mudaSecao) {
    const nova = d.secoes.find((s) => s.id === secao_id);
    if (!nova) return falha("Seção não encontrada.");
    if (!nova.ativa) return falha(`A seção ${nova.nome} está inativa.`);
    local.secao.perguntas.splice(local.indice, 1);
    nova.perguntas.push(p);
    destino = nova;
  } else {
    local.secao.perguntas[local.indice] = p;
  }

  const nomes: Partial<Record<keyof Pergunta, string>> = {
    numero: "número",
    texto: "texto",
    ajuda: "ajuda",
    tipo: "tipo",
    obrigatoria: "obrigatória",
    mostrar_se: "mostrar só se",
    fonte_indicador: "fonte de indicador",
    unidades: "unidades",
    opcoes: "opções",
  };
  const oque = campos_.map((k) => nomes[k] ?? k);
  if (mudaSecao) oque.push(`seção (${destino.nome})`);
  return ok(d, `Pergunta ${p.numero} editada: ${lista(oque)}`, antes, copia(p));
}

/** Cópia logo abaixo, " (cópia)", sem uso nem fonte de indicador. */
export function duplicarPergunta(
  def: DefinicaoFormulario,
  perguntaId: string,
  ctx: ContextoEditor,
): Resultado {
  const d = copia(def);
  const local = achar(d, perguntaId);
  if (!local) return falha("Pergunta não encontrada.");
  const p = local.pergunta;
  if (p.travada)
    return falha("Campo automático do ENET: não pode ser duplicado.");
  const usados = new Set(todasAsPerguntas(d).map((x) => x.numero));
  const c: Pergunta = {
    ...copia(p),
    id: ctx.novoId(),
    numero: numeroLivre(p.numero, usados, "c"),
    texto: `${p.texto} (cópia)`,
    opcoes: p.opcoes.map((o) => ({ ...o, id: ctx.novoId() })),
    fonte_indicador: false,
    ativa: true,
  };
  local.secao.perguntas.splice(local.indice + 1, 0, c);
  return ok(d, `Pergunta ${p.numero} duplicada (cópia ${c.numero})`, null, c);
}

/** Sobe/desce; no limite da seção passa para a vizinha (travada não). */
export function moverPergunta(
  def: DefinicaoFormulario,
  perguntaId: string,
  direcao: Direcao,
  _ctx?: ContextoEditor,
): Resultado {
  const d = copia(def);
  const local = achar(d, perguntaId);
  if (!local) return falha("Pergunta não encontrada.");
  const { secao, indice, pergunta: p } = local;
  const passo = direcao === "subir" ? -1 : 1;
  const j = indice + passo;
  const outra = secao.perguntas[j];
  if (outra) {
    secao.perguntas[j] = p;
    secao.perguntas[indice] = outra;
    return ok(
      d,
      `Pergunta ${p.numero} mudou de posição`,
      { secao: secao.id, posicao: indice },
      { secao: secao.id, posicao: j },
    );
  }
  const vizinha = d.secoes[d.secoes.indexOf(secao) + passo];
  if (!vizinha) return falha("Já está no limite do formulário.");
  if (p.travada) return falha("Campo automático do ENET: não muda de seção.");
  if (!vizinha.ativa)
    return falha(`A seção ${vizinha.nome} está inativa. Reative antes.`);
  secao.perguntas.splice(indice, 1);
  if (direcao === "subir") vizinha.perguntas.push(p);
  else vizinha.perguntas.unshift(p);
  return ok(
    d,
    `Pergunta ${p.numero} movida para a seção ${vizinha.nome}`,
    { secao: secao.id, posicao: indice },
    {
      secao: vizinha.id,
      posicao: direcao === "subir" ? vizinha.perguntas.length - 1 : 0,
    },
  );
}

/** Sai do formulário na próxima versão; dependentes vão junto. */
export function inativarPergunta(
  def: DefinicaoFormulario,
  perguntaId: string,
  ctx: ContextoEditor,
): Resultado {
  const d = copia(def);
  const p = achar(d, perguntaId)?.pergunta;
  if (!p) return falha("Pergunta não encontrada.");
  if (p.travada) return falha(TRAVADA);
  if (!p.ativa) return falha("A pergunta já está inativa.");
  const { inativadas, avisos } = inativarComDependentes(d, [p], ctx);
  const deps = inativadas.filter((x) => x.id !== p.id);
  return ok(
    d,
    `Pergunta ${p.numero} inativada${deps.length ? ` (e dependentes ${lista(deps.map((x) => x.numero))})` : ""}`,
    { ativa: true, perguntas: inativadas.map((x) => x.id) },
    { ativa: false, perguntas: inativadas.map((x) => x.id) },
    avisos,
  );
}

/** Volta a pergunta inativa (seção precisa estar ativa). */
export function reativarPergunta(
  def: DefinicaoFormulario,
  perguntaId: string,
  _ctx?: ContextoEditor,
): Resultado {
  const d = copia(def);
  const local = achar(d, perguntaId);
  if (!local) return falha("Pergunta não encontrada.");
  const p = local.pergunta;
  if (p.ativa) return falha("A pergunta já está ativa.");
  if (!local.secao.ativa)
    return falha(
      `A seção ${local.secao.nome} está inativa. Reative a seção antes.`,
    );
  p.ativa = true;
  const erroRegra = erroDaRegra(d, p);
  return ok(
    d,
    `Pergunta ${p.numero} reativada`,
    { ativa: false },
    { ativa: true },
    erroRegra ? [`${erroRegra} Ajuste antes de publicar.`] : [],
  );
}

/**
 * Só sem uso em nenhuma versão, sem indicador e sem ninguém dependendo dela.
 * Se não puder, explica e oferece inativar.
 */
export function excluirPergunta(
  def: DefinicaoFormulario,
  perguntaId: string,
  ctx: ContextoEditor,
): Resultado {
  const d = copia(def);
  const local = achar(d, perguntaId);
  if (!local) return falha("Pergunta não encontrada.");
  const p = local.pergunta;
  if (p.travada) return falha(TRAVADA, false);
  const podeInativar = p.ativa;
  const usos = ctx.uso.perguntas[p.id] ?? 0;
  if (usos > 0)
    return falha(
      `Já tem ${quantos(usos, ctx)}. Para não perder o histórico, só pode ser inativada.`,
      podeInativar,
    );
  const indicadores = indicadoresDe(p, ctx.indicadoresPorCampo);
  if (indicadores.length)
    return falha(
      `É fonte de indicador (${indicadores.join("; ")}). Só pode ser inativada.`,
      podeInativar,
    );
  const deps = todasAsPerguntas(d).filter(
    (x) => x.mostrar_se?.pergunta_id === p.id,
  );
  if (deps.length)
    return falha(
      `As perguntas ${lista(deps.map((x) => x.numero))} dependem dela ("mostrar só se"). Ajuste essas regras antes, ou inative (elas vão junto).`,
      podeInativar,
    );
  local.secao.perguntas.splice(local.indice, 1);
  return ok(d, `Pergunta ${p.numero} excluída (${p.texto})`, p, null);
}

// ---------------------------------------------------------------- opções

function perguntaComOpcoes(
  d: DefinicaoFormulario,
  perguntaId: string,
): Pergunta | Falha {
  const p = achar(d, perguntaId)?.pergunta;
  if (!p) return falha("Pergunta não encontrada.");
  if (p.travada) return falha(TRAVADA_EDITAR);
  if (!TIPOS_COM_OPCOES.includes(p.tipo))
    return falha(
      `A pergunta ${p.numero} (${ROTULO_TIPO[p.tipo]}) não tem opções.`,
    );
  return p;
}

function textoDeOpcao(p: Pergunta, texto: string, ignorarId?: string) {
  const t = texto.trim();
  if (!t) return falha("Escreva o texto da opção.");
  if (
    p.opcoes.some(
      (o) =>
        o.id !== ignorarId && o.texto.trim().toLowerCase() === t.toLowerCase(),
    )
  )
    return falha(`A pergunta ${p.numero} já tem a opção "${t}".`);
  return t;
}

export function adicionarOpcao(
  def: DefinicaoFormulario,
  perguntaId: string,
  texto: string,
  ctx: ContextoEditor,
): Resultado {
  const d = copia(def);
  const p = perguntaComOpcoes(d, perguntaId);
  if ("erro" in p) return p;
  const t = textoDeOpcao(p, texto);
  if (typeof t !== "string") return t;
  const o: Opcao = { id: ctx.novoId(), texto: t, ativa: true };
  p.opcoes.push(o);
  return ok(d, `Opção "${t}" adicionada na pergunta ${p.numero}`, null, o);
}

export function editarOpcao(
  def: DefinicaoFormulario,
  perguntaId: string,
  opcaoId: string,
  texto: string,
  _ctx?: ContextoEditor,
): Resultado {
  const d = copia(def);
  const p = perguntaComOpcoes(d, perguntaId);
  if ("erro" in p) return p;
  const o = p.opcoes.find((x) => x.id === opcaoId);
  if (!o) return falha("Opção não encontrada.");
  const t = textoDeOpcao(p, texto, opcaoId);
  if (typeof t !== "string") return t;
  if (t === o.texto) return falha("Nada mudou.");
  const antes = o.texto;
  o.texto = t;
  return ok(
    d,
    `Opção "${antes}" da pergunta ${p.numero} passou a "${t}"`,
    antes,
    t,
  );
}

export function moverOpcao(
  def: DefinicaoFormulario,
  perguntaId: string,
  opcaoId: string,
  direcao: Direcao,
  _ctx?: ContextoEditor,
): Resultado {
  const d = copia(def);
  const p = perguntaComOpcoes(d, perguntaId);
  if ("erro" in p) return p;
  const i = p.opcoes.findIndex((x) => x.id === opcaoId);
  const o = p.opcoes[i];
  if (!o) return falha("Opção não encontrada.");
  const j = i + (direcao === "subir" ? -1 : 1);
  const outra = p.opcoes[j];
  if (!outra) return falha("Já está no limite.");
  p.opcoes[j] = o;
  p.opcoes[i] = outra;
  return ok(
    d,
    `Opção "${o.texto}" da pergunta ${p.numero} mudou de posição`,
    i,
    j,
  );
}

function erroAoTirarOpcao(
  d: DefinicaoFormulario,
  p: Pergunta,
  o: Opcao,
): string | null {
  const regras = regrasComOpcao(d, p.id, o.id).filter((x) => x.ativa);
  if (regras.length)
    return `As perguntas ${lista(regras.map((x) => x.numero))} só aparecem com esta opção ("mostrar só se"). Ajuste essas regras antes.`;
  const minimo = minimoDeOpcoes(p.tipo);
  if (o.ativa && p.opcoes.filter((x) => x.ativa).length - 1 < minimo)
    return p.tipo === "grade"
      ? `A pergunta ${p.numero} precisa de pelo menos 1 linha ativa.`
      : `A pergunta ${p.numero} precisa de pelo menos 2 opções ativas. Adicione outra antes.`;
  return null;
}

export function inativarOpcao(
  def: DefinicaoFormulario,
  perguntaId: string,
  opcaoId: string,
  _ctx?: ContextoEditor,
): Resultado {
  const d = copia(def);
  const p = perguntaComOpcoes(d, perguntaId);
  if ("erro" in p) return p;
  const o = p.opcoes.find((x) => x.id === opcaoId);
  if (!o) return falha("Opção não encontrada.");
  if (!o.ativa) return falha("A opção já está inativa.");
  const erro = erroAoTirarOpcao(d, p, o);
  if (erro) return falha(erro);
  o.ativa = false;
  return ok(
    d,
    `Opção "${o.texto}" da pergunta ${p.numero} inativada`,
    { ativa: true },
    { ativa: false },
  );
}

export function reativarOpcao(
  def: DefinicaoFormulario,
  perguntaId: string,
  opcaoId: string,
  _ctx?: ContextoEditor,
): Resultado {
  const d = copia(def);
  const p = perguntaComOpcoes(d, perguntaId);
  if ("erro" in p) return p;
  const o = p.opcoes.find((x) => x.id === opcaoId);
  if (!o) return falha("Opção não encontrada.");
  if (o.ativa) return falha("A opção já está ativa.");
  o.ativa = true;
  return ok(
    d,
    `Opção "${o.texto}" da pergunta ${p.numero} reativada`,
    { ativa: false },
    { ativa: true },
  );
}

/** Só a opção nunca usada; usada só pode ser inativada. */
export function excluirOpcao(
  def: DefinicaoFormulario,
  perguntaId: string,
  opcaoId: string,
  ctx: ContextoEditor,
): Resultado {
  const d = copia(def);
  const p = perguntaComOpcoes(d, perguntaId);
  if ("erro" in p) return p;
  const i = p.opcoes.findIndex((x) => x.id === opcaoId);
  const o = p.opcoes[i];
  if (!o) return falha("Opção não encontrada.");
  const usos = ctx.uso.opcoes[o.id] ?? 0;
  if (usos > 0)
    return falha(
      `A opção "${o.texto}" já foi usada em ${quantos(usos, ctx)}. Só pode ser inativada; as respostas antigas mantêm o texto original.`,
      o.ativa,
    );
  const todasRegras = regrasComOpcao(d, p.id, o.id);
  if (todasRegras.length)
    return falha(
      `A opção é condição das perguntas ${lista(todasRegras.map((x) => x.numero))}. Ajuste essas regras antes.`,
    );
  const erro = erroAoTirarOpcao(d, p, o);
  if (erro) return falha(erro);
  p.opcoes.splice(i, 1);
  return ok(d, `Opção "${o.texto}" da pergunta ${p.numero} excluída`, o, null);
}

// ---------------------------------------------------------------- seções

export function criarSecao(
  def: DefinicaoFormulario,
  nome: string,
  ctx: ContextoEditor,
): Resultado {
  const n = nome.trim();
  if (!n) return falha("Informe o nome da seção.");
  const d = copia(def);
  const s: Secao = { id: ctx.novoId(), nome: n, ativa: true, perguntas: [] };
  d.secoes.push(s);
  return ok(d, `Seção "${n}" criada`, null, { id: s.id, nome: n });
}

export function renomearSecao(
  def: DefinicaoFormulario,
  secaoId: string,
  nome: string,
  _ctx?: ContextoEditor,
): Resultado {
  const n = nome.trim();
  if (!n) return falha("Informe o nome da seção.");
  const d = copia(def);
  const s = d.secoes.find((x) => x.id === secaoId);
  if (!s) return falha("Seção não encontrada.");
  if (s.nome === n) return falha("Nada mudou.");
  const antes = s.nome;
  s.nome = n;
  return ok(d, `Seção "${antes}" renomeada para "${n}"`, antes, n);
}

export function moverSecao(
  def: DefinicaoFormulario,
  secaoId: string,
  direcao: Direcao,
  _ctx?: ContextoEditor,
): Resultado {
  const d = copia(def);
  const i = d.secoes.findIndex((x) => x.id === secaoId);
  const s = d.secoes[i];
  if (!s) return falha("Seção não encontrada.");
  const j = i + (direcao === "subir" ? -1 : 1);
  const outra = d.secoes[j];
  if (!outra) return falha("Já está no limite.");
  d.secoes[j] = s;
  d.secoes[i] = outra;
  return ok(d, `Seção ${s.nome} mudou de posição`, i, j);
}

/** Inativa a seção e todas as perguntas dela (e quem depende delas). */
export function inativarSecao(
  def: DefinicaoFormulario,
  secaoId: string,
  ctx: ContextoEditor,
): Resultado {
  const d = copia(def);
  const s = d.secoes.find((x) => x.id === secaoId);
  if (!s) return falha("Seção não encontrada.");
  if (!s.ativa) return falha("A seção já está inativa.");
  if (s.perguntas.some((p) => p.travada))
    return falha(
      `A seção ${s.nome} tem campos automáticos do ENET e não pode ser inativada.`,
    );
  s.ativa = false;
  const { inativadas, avisos } = inativarComDependentes(d, s.perguntas, ctx);
  return ok(
    d,
    `Seção ${s.nome} inativada (${inativadas.length} perguntas)`,
    { ativa: true, perguntas: inativadas.map((p) => p.id) },
    { ativa: false, perguntas: inativadas.map((p) => p.id) },
    avisos,
  );
}

/** Reativa só a seção; as perguntas voltam uma a uma (Reativar). */
export function reativarSecao(
  def: DefinicaoFormulario,
  secaoId: string,
  _ctx?: ContextoEditor,
): Resultado {
  const d = copia(def);
  const s = d.secoes.find((x) => x.id === secaoId);
  if (!s) return falha("Seção não encontrada.");
  if (s.ativa) return falha("A seção já está ativa.");
  s.ativa = true;
  const inativas = s.perguntas.filter((p) => !p.ativa).length;
  return ok(
    d,
    `Seção ${s.nome} reativada`,
    { ativa: false },
    { ativa: true },
    inativas
      ? [
          `As ${inativas} perguntas da seção continuam inativas; reative as que devem voltar.`,
        ]
      : [],
  );
}

/** Só seção vazia (nem pergunta inativa). */
export function excluirSecao(
  def: DefinicaoFormulario,
  secaoId: string,
  _ctx?: ContextoEditor,
): Resultado {
  const d = copia(def);
  const i = d.secoes.findIndex((x) => x.id === secaoId);
  const s = d.secoes[i];
  if (!s) return falha("Seção não encontrada.");
  if (s.perguntas.length)
    return falha(
      `A seção ${s.nome} tem ${s.perguntas.length} perguntas. Só uma seção vazia pode ser excluída; para tirar do formulário, use "Inativar seção".`,
      s.ativa && !s.perguntas.some((p) => p.travada),
    );
  d.secoes.splice(i, 1);
  return ok(d, `Seção ${s.nome} excluída`, { id: s.id, nome: s.nome }, null);
}

// ---------------------------------------------------------------- publicação

/** Erros que impedem publicar (lista vazia = pode publicar). */
export function conferirAntesDePublicar(
  def: DefinicaoFormulario,
  indicadoresPorCampo: IndicadoresPorCampo,
): string[] {
  const erros: string[] = [];
  const ativa = new Map<string, boolean>();
  for (const s of def.secoes)
    for (const p of s.perguntas) ativa.set(p.id, s.ativa && p.ativa);
  const todas = todasAsPerguntas(def);
  const repetidos = new Set<string>();

  for (const s of def.secoes) {
    for (const p of s.perguntas) {
      if (!ativa.get(p.id)) continue;
      const nome = p.numero.trim()
        ? `Pergunta ${p.numero}`
        : `Uma pergunta da seção ${s.nome}`;
      if (!p.numero.trim()) erros.push(`${nome} está sem número.`);
      else if (
        !repetidos.has(p.numero) &&
        todas.some((x) => x.id !== p.id && x.numero === p.numero)
      ) {
        repetidos.add(p.numero);
        erros.push(`Número ${p.numero} repetido.`);
      }
      if (!p.texto.trim()) erros.push(`${nome} sem texto.`);
      const minimo = minimoDeOpcoes(p.tipo);
      if (
        minimo &&
        p.opcoes.filter((o) => o.ativa && o.texto.trim()).length < minimo
      )
        erros.push(
          p.tipo === "grade"
            ? `${nome} precisa de pelo menos 1 linha ativa.`
            : `${nome} precisa de pelo menos 2 opções ativas.`,
        );
      if (p.tipo === "numero_unidade" && !p.unidades.length)
        erros.push(`${nome} precisa de pelo menos uma unidade.`);
      const regra = p.mostrar_se;
      if (regra) {
        const ref = todas.find((x) => x.id === regra.pergunta_id);
        const erro = erroDaRegra(def, p);
        if (!ref || !ativa.get(ref.id))
          erros.push(
            `${nome}: a regra "mostrar só se" aponta para uma pergunta inativa ou inexistente (${ref?.numero ?? regra.pergunta_id}).`,
          );
        else if (erro) erros.push(`${nome}: ${erro}`);
      }
    }
  }

  for (const [campoId, nomes] of Object.entries(indicadoresPorCampo)) {
    if (ativa.get(campoId)) continue;
    const campo = todas.find((x) => x.id === campoId);
    const qual = campo ? `campo ${campo.numero} inativo` : "campo excluído";
    for (const n of nomes)
      erros.push(
        `Indicador "${n}" ficará sem dado novo (${qual}). Ajuste ou inative o indicador.`,
      );
  }
  return erros;
}

export type Marca = "nova" | "editada";

/** Marcas do rascunho em relação à versão publicada, por pergunta. */
export function diferencas(
  publicada: DefinicaoFormulario,
  rascunho: DefinicaoFormulario,
): Record<string, Marca> {
  const antes = new Map<string, { p: Pergunta; secao: string }>();
  for (const s of publicada.secoes)
    for (const p of s.perguntas) antes.set(p.id, { p, secao: s.id });
  const marcas: Record<string, Marca> = {};
  for (const s of rascunho.secoes)
    for (const p of s.perguntas) {
      const a = antes.get(p.id);
      if (!a) marcas[p.id] = "nova";
      else if (a.secao !== s.id || !igual(a.p, p)) marcas[p.id] = "editada";
    }
  return marcas;
}

/**
 * Versão antiga como rascunho novo, sem apagar nada: o que existe na atual e
 * não na antiga (perguntas e opções) entra inativo, para não perder ids que
 * já têm respostas.
 */
export function restaurarVersao(
  antiga: DefinicaoFormulario,
  atual: DefinicaoFormulario,
): DefinicaoFormulario {
  const d = copia(antiga);
  const usados = new Set(todasAsPerguntas(d).map((p) => p.numero));
  for (const sAtual of atual.secoes) {
    for (const p of sAtual.perguntas) {
      const existente = achar(d, p.id)?.pergunta;
      if (existente) {
        for (const o of p.opcoes)
          if (!existente.opcoes.some((x) => x.id === o.id))
            existente.opcoes.push({ ...o, ativa: false });
        continue;
      }
      let destino = d.secoes.find((s) => s.id === sAtual.id);
      if (!destino) {
        destino = { ...copia(sAtual), ativa: false, perguntas: [] };
        d.secoes.push(destino);
      }
      const numero = numeroLivre(p.numero, usados, "r");
      usados.add(numero);
      destino.perguntas.push({ ...copia(p), numero, ativa: false });
    }
  }
  return d;
}
