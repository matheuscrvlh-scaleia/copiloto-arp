import { formatarData, formatarDataHora, formatarNumero } from "@/lib/formato";
import {
  type Campo,
  ehOutro,
  recebeResposta,
  resumir,
  textoDaResposta,
  valoresQueDecidem,
} from "./campos";

// "Pergunte às respostas": o chat da tela de respostas (pedido da reunião de
// 05/11). Responde em português, sem IA externa (as respostas não saem do
// sistema), às perguntas mais comuns: quantas respostas (no total ou num
// período), quantos marcaram uma opção, média, maior e menor, opção mais
// escolhida, respostas de "Outro", resumo de uma pergunta e a última
// resposta. O que não entende devolve sugestões que funcionam.
// atalho: entende por palavras-chave, não frase livre; cobre as perguntas de
// contagem e resumo, não cruzamentos entre duas perguntas.

export interface Registro {
  enviada_em: string;
  respostas: Record<string, unknown>;
}

export interface RespostaDoChat {
  texto: string;
  /** Detalhe em lista (opções, últimas respostas…). */
  linhas?: string[];
  /** Sem entender: perguntas que funcionam. */
  sugestoes?: string[];
}

const PARADAS = new Set(
  "a o as os de da do das dos e em no na nos nas um uma uns umas que qual quais quanto quanta quantos quantas para por com sem se ou ao aos pela pelo foi foram sao ser esta este essa esse isso como mais menos muito pergunta perguntas resposta respostas responderam respondeu pessoas pessoa gente marcaram marcou escolheram escolheu disseram disse deram deu media nota notas total voce seu sua".split(
    " ",
  ),
);

/** Minúsculas, sem acento nem pontuação, espaços simples. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const palavras = (s: string) =>
  normalizar(s)
    .split(" ")
    .filter((p) => p.length >= 3 && !PARADAS.has(p));

/** O texto normalizado contém a expressão como palavras inteiras? */
const contem = (texto: string, expr: string) =>
  !!expr && ` ${texto} `.includes(` ${expr} `);

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------

const MESES = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const DIA = 86_400_000;
/** Brasília (UTC-3, sem horário de verão). */
const FUSO = 3 * 3_600_000;

/** Meia-noite de Brasília do dia de `d`, em UTC. */
const inicioDoDia = (d: Date) =>
  new Date(Math.floor((d.getTime() - FUSO) / DIA) * DIA + FUSO);

interface Periodo {
  de: Date;
  ate: Date;
  rotulo: string;
  /** Trecho da pergunta que falou do período (sai antes de achar opção). */
  trecho: string;
}

export function lerPeriodo(q: string, agora: Date): Periodo | null {
  const hoje = inicioDoDia(agora);
  const fim = new Date(agora.getTime() + 1);
  let m = q.match(/\bultimos (\d{1,3}) dias\b/);
  if (m) {
    const n = Number(m[1]);
    return {
      de: new Date(hoje.getTime() - (n - 1) * DIA),
      ate: fim,
      rotulo: `nos últimos ${n} dias`,
      trecho: m[0],
    };
  }
  m = q.match(/\b(hoje)\b/);
  if (m) return { de: hoje, ate: fim, rotulo: "hoje", trecho: m[0] };
  m = q.match(/\b(ontem)\b/);
  if (m)
    return {
      de: new Date(hoje.getTime() - DIA),
      ate: hoje,
      rotulo: "ontem",
      trecho: m[0],
    };
  m = q.match(/\b(?:(?:n?esta|n?essa|na) semana|ultima semana|semana)\b/);
  if (m)
    return {
      de: new Date(hoje.getTime() - 6 * DIA),
      ate: fim,
      rotulo: "nos últimos 7 dias",
      trecho: m[0],
    };
  m = q.match(new RegExp(`\\b(${MESES.join("|")})(?: de (\\d{4}))?\\b`));
  if (m) {
    const mes = MESES.indexOf(m[1] as string);
    const local = new Date(agora.getTime() - FUSO);
    let ano = m[2] ? Number(m[2]) : local.getUTCFullYear();
    if (!m[2] && mes > local.getUTCMonth()) ano -= 1;
    return {
      de: new Date(Date.UTC(ano, mes, 1) + FUSO),
      ate: new Date(Date.UTC(ano, mes + 1, 1) + FUSO),
      rotulo: `em ${m[1] === "marco" ? "março" : m[1]} de ${ano}`,
      trecho: m[0],
    };
  }
  m = q.match(/\b(?:n?este|n?esse|no) mes\b|\bmes\b/);
  if (m) {
    const local = new Date(agora.getTime() - FUSO);
    return {
      de: new Date(
        Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) + FUSO,
      ),
      ate: fim,
      rotulo: "neste mês",
      trecho: m[0],
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pergunta e opção citadas
// ---------------------------------------------------------------------------

interface Alvo {
  campo: Campo;
  n: number;
}

/** A pergunta do relatório citada: "pergunta 3" ou pelas palavras do título. */
function acharPergunta(q: string, perguntas: Alvo[]): Alvo | null {
  const num = q.match(/\bpergunta (\d{1,3})\b/);
  if (num) return perguntas[Number(num[1]) - 1] ?? null;
  const ditas = new Set(q.split(" "));
  let melhor: { alvo: Alvo; nota: number; acertos: number } | null = null;
  for (const alvo of perguntas) {
    const ps = palavras(alvo.campo.titulo);
    if (!ps.length) continue;
    const acertos = ps.filter((p) => ditas.has(p)).length;
    const nota = acertos / ps.length;
    if (
      acertos > 0 &&
      (!melhor ||
        nota > melhor.nota ||
        (nota === melhor.nota && acertos > melhor.acertos))
    )
      melhor = { alvo, nota, acertos };
  }
  return melhor && (melhor.nota >= 0.34 || melhor.acertos >= 2)
    ? melhor.alvo
    : null;
}

/** Opção citada (a mais longa que aparece inteira na pergunta). */
function acharOpcao(
  q: string,
  campo: Campo,
): { valor: string; rotulo: string } | null {
  let achada: { valor: string; rotulo: string } | null = null;
  for (const v of valoresQueDecidem(campo)) {
    const expr = normalizar(v.rotulo);
    if (contem(q, expr) && (!achada || expr.length > achada.rotulo.length))
      achada = v;
  }
  return achada;
}

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

const pct = (n: number, base: number) =>
  `${formatarNumero(base ? (n / base) * 100 : 0)}%`;

const plural = (n: number, um: string, varios: string) =>
  `${formatarNumero(n)} ${n === 1 ? um : varios}`;

const vazio = (v: unknown) =>
  v === undefined ||
  v === null ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0);

/** A resposta marcou este valor (opção, "sim"/"nao" ou nota)? */
function marcou(v: unknown, valor: string): boolean {
  const lista = Array.isArray(v) ? v : [v];
  return lista.some(
    (x) =>
      (x === true && valor === "sim") ||
      (x === false && valor === "nao") ||
      (typeof x === "number" && String(x) === valor) ||
      x === valor,
  );
}

export function sugestoes(campos: Campo[]): string[] {
  const perguntas = campos.filter(recebeResposta);
  const escolha = perguntas.find((c) =>
    ["unica", "lista", "multipla", "sim_nao"].includes(c.tipo),
  );
  const nota = perguntas.find(
    (c) => c.tipo === "escala" || c.tipo === "numero",
  );
  const primeira = escolha ? valoresQueDecidem(escolha)[0] : undefined;
  return [
    "Quantas pessoas responderam?",
    "Quantas respostas chegaram nesta semana?",
    ...(escolha && primeira
      ? [`Quantos marcaram ${primeira.rotulo} em “${escolha.titulo}”?`]
      : []),
    ...(escolha && escolha.tipo !== "sim_nao"
      ? [`Qual a opção mais escolhida em “${escolha.titulo}”?`]
      : []),
    ...(nota ? [`Qual a média de “${nota.titulo}”?`] : []),
    "Quando foi a última resposta?",
  ];
}

/**
 * Responde uma pergunta sobre as respostas do relatório. `registros` são
 * as respostas gravadas (qualquer ordem); as perguntas são as atuais.
 */
export function perguntar(
  pergunta: string,
  campos: Campo[],
  registros: Registro[],
  agora: Date = new Date(),
): RespostaDoChat {
  const original = normalizar(pergunta);
  const naoEntendi = (texto?: string): RespostaDoChat => ({
    texto:
      texto ??
      "Não entendi essa pergunta. Pergunte sobre quantidade, uma opção, média ou uma pergunta do relatório. Por exemplo:",
    sugestoes: sugestoes(campos),
  });
  if (!original) return naoEntendi();

  const periodo = lerPeriodo(original, agora);
  const q = periodo
    ? normalizar(` ${original} `.replace(` ${periodo.trecho} `, " "))
    : original;
  const lista = periodo
    ? registros.filter((r) => {
        const t = new Date(r.enviada_em).getTime();
        return t >= periodo.de.getTime() && t < periodo.ate.getTime();
      })
    : registros;
  const quando = periodo ? ` ${periodo.rotulo}` : "";
  const total = lista.length;

  // Última ou primeira resposta.
  if (/\b(ultima|ultimo|recente)\b/.test(q) || /\bquando\b/.test(q)) {
    const datas = lista.map((r) => r.enviada_em).sort();
    const primeira = /\b(primeira|primeiro)\b/.test(q);
    const d = primeira ? datas[0] : datas.at(-1);
    return d
      ? {
          texto: `A ${primeira ? "primeira" : "última"} resposta${quando} chegou em ${formatarDataHora(d)}.`,
        }
      : { texto: `Nenhuma resposta${quando}.` };
  }

  // Dia com mais respostas.
  if (/\bdia\b/.test(q) && /\bmais\b/.test(q)) {
    const porDia = new Map<string, number>();
    for (const r of lista) {
      const dia = new Date(new Date(r.enviada_em).getTime() - FUSO)
        .toISOString()
        .slice(0, 10);
      porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    }
    const [dia, n] = [...porDia].sort((a, b) => b[1] - a[1])[0] ?? [];
    return dia && n
      ? {
          texto: `O dia com mais respostas${quando} foi ${formatarData(dia)}, com ${plural(n, "resposta", "respostas")}.`,
        }
      : { texto: `Nenhuma resposta${quando}.` };
  }

  const perguntas: Alvo[] = campos
    .filter(recebeResposta)
    .map((campo, i) => ({ campo, n: i + 1 }));
  let alvo = acharPergunta(q, perguntas);
  let opcao = alvo ? acharOpcao(q, alvo.campo) : null;
  // Sem pergunta pelo título: a opção citada aponta a pergunta (só se uma
  // pergunta de escolha tiver essa opção; sim/não e notas são comuns demais).
  if (!alvo) {
    const comOpcao = perguntas
      .filter((p) => ["unica", "lista", "multipla"].includes(p.campo.tipo))
      .map((p) => ({ p, o: acharOpcao(q, p.campo) }))
      .filter((x) => x.o);
    if (comOpcao.length === 1 && comOpcao[0]) {
      alvo = comOpcao[0].p;
      opcao = comOpcao[0].o;
    }
  }
  // Média sem dizer de qual: a única pergunta de nota ou número.
  const querMedia = /\bmedia\b/.test(q);
  const querMaior = /\b(maior|maxim[ao]|mais alt[ao])\b/.test(q);
  const querMenor = /\b(menor|minim[ao]|mais baix[ao])\b/.test(q);
  if (!alvo && (querMedia || querMaior || querMenor)) {
    const numericas = perguntas.filter(
      (p) => p.campo.tipo === "escala" || p.campo.tipo === "numero",
    );
    if (numericas.length === 1) alvo = numericas[0] ?? null;
    else if (numericas.length > 1)
      return naoEntendi(
        `Há ${numericas.length} perguntas de nota ou número. Diga de qual: ${numericas.map((p) => `“${p.campo.titulo}”`).join(", ")}.`,
      );
  }

  if (!alvo) {
    if (/\b(quant[oa]s?|total|numero)\b/.test(q) || /\brespo/.test(original))
      return {
        texto: `${total === 1 ? "Chegou" : "Chegaram"} ${plural(total, "resposta", "respostas")}${quando}.`,
      };
    return naoEntendi();
  }

  const c = alvo.campo;
  const nome = `“${c.titulo}”`;
  const valores = lista.map((r) => r.respostas[c.id]);
  const respondidas = valores.filter((v) => !vazio(v)).length;
  if (!total) return { texto: `Nenhuma resposta${quando}.` };

  // Respostas de "Outro".
  if (/\boutros?\b/.test(q) && c.outro && !opcao) {
    const textos = valores.flatMap((v) =>
      (Array.isArray(v) ? v : [v]).filter(
        (x): x is string => typeof x === "string" && ehOutro(c, x),
      ),
    );
    return {
      texto: `${plural(textos.length, "pessoa escreveu", "pessoas escreveram")} em “Outro” de ${nome}${quando}.`,
      linhas: textos.slice(0, 10),
    };
  }

  // Quantos marcaram a opção.
  if (opcao) {
    const n = valores.filter((v) => marcou(v, opcao.valor)).length;
    return {
      texto: `${plural(n, "resposta", "respostas")} de ${formatarNumero(respondidas)} (${pct(n, respondidas)}) ${n === 1 ? "marcou" : "marcaram"} “${opcao.rotulo}” em ${nome}${quando}.${c.tipo === "multipla" ? " Nesta pergunta dá para marcar mais de uma opção." : ""}`,
    };
  }

  const r = resumir(c, valores);
  const respondeu = `${formatarNumero(respondidas)} de ${plural(total, "resposta", "respostas")}${quando} responderam ${nome}`;

  if (r.tipo === "nota" || r.tipo === "numero") {
    if (!r.respondidas) return { texto: `${respondeu}.` };
    const ns = valores.filter((v): v is number => typeof v === "number");
    if (querMaior)
      return {
        texto: `O maior valor em ${nome}${quando} foi ${formatarNumero(Math.max(...ns), 2)}.`,
      };
    if (querMenor)
      return {
        texto: `O menor valor em ${nome}${quando} foi ${formatarNumero(Math.min(...ns), 2)}.`,
      };
    return {
      texto: `A média de ${nome}${quando} é ${formatarNumero(r.media, r.tipo === "nota" ? 1 : 2)}, com ${plural(r.respondidas, "resposta", "respostas")}.`,
      linhas:
        r.tipo === "nota"
          ? r.itens
              .filter((i) => i.n)
              .map(
                (i) =>
                  `Nota ${i.rotulo}: ${formatarNumero(i.n)} (${pct(i.n, r.respondidas)})`,
              )
          : [
              `Menor: ${formatarNumero(r.min, 2)}`,
              `Maior: ${formatarNumero(r.max, 2)}`,
            ],
    };
  }

  if (r.tipo === "contagem") {
    const ordem = [...r.itens].sort((a, b) => b.n - a.n);
    const linhas = ordem.map(
      (i) => `${i.rotulo}: ${formatarNumero(i.n)} (${pct(i.n, r.respondidas)})`,
    );
    const topo = ordem[0];
    if (
      /\b(escolhid[ao]|votad[ao]|comum|marcad[ao]|frequente|citad[ao]|preferid[ao]|popular|venceu|ganhou)\b/.test(
        q,
      ) &&
      topo
    ) {
      const empatadas = ordem.filter((i) => i.n === topo.n);
      return {
        texto:
          topo.n === 0
            ? `Ninguém respondeu ${nome}${quando}.`
            : empatadas.length > 1
              ? `Empate em ${nome}${quando}: ${empatadas.map((i) => `“${i.rotulo}”`).join(", ")}, com ${formatarNumero(topo.n)} cada.`
              : `A mais escolhida em ${nome}${quando} foi “${topo.rotulo}”, com ${formatarNumero(topo.n)} de ${formatarNumero(r.respondidas)} (${pct(topo.n, r.respondidas)}).`,
        linhas,
      };
    }
    return { texto: `${respondeu}.`, linhas };
  }

  return {
    texto: `${respondeu}.${r.recentes.length ? " As mais recentes:" : ""}`,
    linhas: lista
      .slice()
      .sort((a, b) => b.enviada_em.localeCompare(a.enviada_em))
      .map((x) => textoDaResposta(c.tipo, x.respostas[c.id]))
      .filter(Boolean)
      .slice(0, 5),
  };
}
