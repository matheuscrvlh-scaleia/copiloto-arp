import { cnpjValido, cpfValido, soDigitos, UFS } from "@/lib/documentos";
import { lerValorBr } from "@/lib/formato";
import {
  DOCUMENTOS_IDENTIFICACAO,
  documentoDaFicha,
  ESTADOS_CIVIS,
  LUC_NAO_SEI,
  NATUREZAS_JURIDICAS,
  nomeDaFicha,
  PATRIMONIOS,
  pedeConjuge,
  type RespostasFicha,
  respostasSchema,
  type TipoFicha,
} from "./ficha";

// Importação das respostas do Google Forms cadastral (spec 4.13): uma linha
// por envio, colunas na ordem das perguntas 1 a 48 (coluna 1 = data e hora).
// O cabeçalho é conferido coluna a coluna (diferente bloqueia e diz qual);
// o Forms não separa endereço, documento e órgão, então eles entram em
// texto e a etapa Partes pede para conferir. CPF/CNPJ que já tem ficha
// avisa e mostra a ficha atual.

export type Celula = string | number | boolean | Date | null | undefined;

interface ColunaForms {
  /** Pergunta (null = carimbo de data e hora). */
  pergunta: number | null;
  titulo: string;
  /** O cabeçalho (sem acento e caixa) contém um destes trechos. */
  chaves: string[];
}

const col = (
  pergunta: number | null,
  titulo: string,
  ...chaves: string[]
): ColunaForms => ({ pergunta, titulo, chaves });

/** As 49 colunas do Forms: data e hora e as perguntas 1 a 48. */
export const COLUNAS_FORMS: ColunaForms[] = [
  col(null, "Carimbo de data/hora", "data"),
  col(1, "E-mail", "mail"),
  col(2, "Consentimento LGPD", "lgpd", "consentimento", "13.709"),
  col(3, "Imóvel pretendido", "imovel"),
  col(4, "Que tipo de formulário você seguirá?", "formulario", "tipo"),
  col(5, "Razão social", "razao social"),
  col(6, "CNPJ", "cnpj"),
  col(7, "Natureza jurídica", "natureza"),
  col(8, "Inscrição estadual", "estadual"),
  col(9, "Inscrição municipal", "municipal"),
  col(10, "CNAE principal", "cnae"),
  col(11, "Ramo de atuação", "ramo"),
  col(12, "Endereço completo (com CEP)", "endereco"),
  col(13, "Capital social atual", "capital"),
  col(14, "Última alteração social", "alteracao"),
  col(15, "Nome completo", "nome"),
  col(16, "CPF", "cpf"),
  col(17, "Documento de identificação", "documento", "identificacao"),
  col(18, "Órgão expedidor", "orgao", "expedidor"),
  col(19, "Data de expedição", "expedicao"),
  col(20, "Data de nascimento", "nascimento"),
  col(21, "Nacionalidade", "nacionalidade"),
  col(22, "Estado civil", "estado civil"),
  col(23, "Endereço completo (com CEP)", "endereco"),
  col(24, "Telefone (com DDD)", "telefone", "celular"),
  col(25, "Telefone secundário", "telefone", "celular"),
  col(26, "E-mail", "mail"),
  col(27, "Nome completo do cônjuge", "nome"),
  col(28, "CPF do cônjuge", "cpf"),
  col(
    29,
    "Documento de identificação do cônjuge",
    "documento",
    "identificacao",
  ),
  col(30, "Data de expedição do cônjuge", "expedicao"),
  col(31, "Órgão expedidor do cônjuge", "orgao", "expedidor"),
  col(32, "Data de nascimento do cônjuge", "nascimento"),
  col(33, "Nacionalidade do cônjuge", "nacionalidade"),
  col(34, "Profissão ou ocupação do cônjuge", "profiss", "ocupacao"),
  col(35, "Telefone do cônjuge", "telefone", "celular"),
  col(36, "Telefone secundário do cônjuge", "telefone", "celular"),
  col(37, "E-mail do cônjuge", "mail"),
  col(38, "Profissão", "profiss"),
  col(39, "Empresa", "empresa"),
  col(40, "Endereço completo da empresa (com CEP)", "endereco"),
  col(41, "Telefone da empresa", "telefone"),
  col(42, "E-mail da empresa", "mail"),
  col(43, "Renda mensal", "renda"),
  col(44, "Referência pessoal", "referencia"),
  col(45, "Outras rendas e origem", "rendas", "origem"),
  col(46, "Patrimônio", "patrimonio"),
  col(47, "Paga aluguel?", "aluguel"),
  col(48, "Envio (nome completo)", "nome", "envio", "veracidade"),
];

const normal = (v: string) =>
  v
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Texto da célula (Date vira "aaaa-mm-dd hh:mm:ss"). */
function textoDa(c: Celula): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date)
    return Number.isNaN(c.getTime())
      ? ""
      : c.toISOString().slice(0, 19).replace("T", " ");
  return String(c).trim();
}

export interface ProblemaDoCabecalho {
  coluna: number;
  esperado: string;
  veio: string;
}

/** Colunas que faltam ou mudaram (vazio = cabeçalho certo). */
export function conferirCabecalho(cabecalho: Celula[]): ProblemaDoCabecalho[] {
  const problemas: ProblemaDoCabecalho[] = [];
  COLUNAS_FORMS.forEach((c, i) => {
    const veio = textoDa(cabecalho[i]);
    const n = normal(veio);
    if (!n || !c.chaves.some((k) => n.includes(k)))
      problemas.push({
        coluna: i + 1,
        esperado: c.titulo,
        veio: veio || "(falta)",
      });
  });
  for (let i = COLUNAS_FORMS.length; i < cabecalho.length; i++) {
    const veio = textoDa(cabecalho[i]);
    if (veio) problemas.push({ coluna: i + 1, esperado: "(nenhuma)", veio });
  }
  return problemas;
}

// ---------------------------------------------------------------------------
// Leitura das células
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

const dois = (n: number) => String(n).padStart(2, "0");

/** Número de série do Excel (dias desde 30/12/1899) → Date em UTC. */
const doExcel = (n: number) => new Date(Math.round((n - 25569) * 86_400_000));

/** "dd/mm/aaaa", "aaaa-mm-dd", "7 de janeiro de 2019", Date ou série → "aaaa-mm-dd". */
export function lerData(c: Celula): string {
  if (c instanceof Date)
    return Number.isNaN(c.getTime()) ? "" : c.toISOString().slice(0, 10);
  if (typeof c === "number" && c > 1000 && c < 100_000)
    return doExcel(c).toISOString().slice(0, 10);
  const t = normal(textoDa(c));
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${dois(Number(m[2]))}-${dois(Number(m[1]))}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})(?:º|o)? de ([a-z]+) de (\d{4})/);
  if (m) {
    const mes = MESES.indexOf(m[2] ?? "");
    if (mes >= 0) return `${m[3]}-${dois(mes + 1)}-${dois(Number(m[1]))}`;
  }
  return "";
}

/** Carimbo do Forms ("dd/mm/aaaa hh:mm:ss", Date ou série) → ISO em Brasília. */
export function lerCarimbo(c: Celula): string | null {
  if (c instanceof Date)
    return Number.isNaN(c.getTime()) ? null : c.toISOString();
  if (typeof c === "number" && c > 1000 && c < 100_000) {
    // A série do Excel não tem fuso: é a hora de Brasília escrita na planilha.
    const local = doExcel(c).toISOString().slice(0, 19);
    return new Date(`${local}-03:00`).toISOString();
  }
  const t = textoDa(c);
  const dia = lerData(t);
  if (!dia) return null;
  const h = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const hora = h ? `${dois(Number(h[1]))}:${h[2]}:${h[3] ?? "00"}` : "12:00:00";
  const d = new Date(`${dia}T${hora}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** CEP no meio do texto do endereço. */
const cepDe = (t: string) =>
  t
    .match(/\b(\d{5})-?(\d{3})\b/)
    ?.slice(1)
    .join("") ?? "";

function enderecoDe(t: string) {
  const uf =
    t.toUpperCase().match(/\b([A-Z]{2})\b(?!.*\b[A-Z]{2}\b)/)?.[1] ?? "";
  return {
    cep: cepDe(t),
    logradouro: t,
    uf: (UFS as readonly string[]).includes(uf) ? uf : "",
  };
}

/** "RG 12.345.678-9" → tipo da lista e número. */
function documentoDe(t: string) {
  const n = normal(t);
  const tipo =
    DOCUMENTOS_IDENTIFICACAO.find((d) => n.startsWith(normal(d))) ??
    (/\bcnh\b/.test(n) ? "CNH" : /\brg\b/.test(n) ? "RG" : t ? "Outro" : "");
  const numero = t.replace(/^\s*(rg|cnh|certid[aã]o|passaporte)\b[\s:-]*/i, "");
  return { doc_tipo: tipo, doc_numero: numero };
}

/** "DETRAN/RJ", "SSP-RJ", "IFP RJ" → órgão e UF. */
function orgaoDe(t: string) {
  const m = t.toUpperCase().match(/^(.*?)[\s/-]+([A-Z]{2})$/);
  if (m && (UFS as readonly string[]).includes(m[2] ?? ""))
    return { orgao: (m[1] ?? "").trim(), orgao_uf: m[2] };
  return { orgao: t, orgao_uf: "" };
}

function estadoCivilDe(t: string): string {
  const n = normal(t);
  if (!n) return "";
  if (n.includes("uniao") || n.includes("convivente")) return ESTADOS_CIVIS[1];
  if (n.startsWith("casad")) return ESTADOS_CIVIS[0];
  if (n.startsWith("solteir")) return ESTADOS_CIVIS[2];
  if (n.startsWith("divorciad") || n.startsWith("separad"))
    return ESTADOS_CIVIS[3];
  if (n.startsWith("viuv")) return ESTADOS_CIVIS[4];
  return "";
}

export function tipoDe(t: string): TipoFicha | null {
  const n = normal(t);
  if (n.includes("juridica")) return "pj";
  if (n.includes("fisica")) return "pf";
  if (n.includes("fiador")) return "fiador";
  return null;
}

function naturezaDe(t: string): string {
  const n = normal(t).replace(/\s/g, "");
  return (
    NATUREZAS_JURIDICAS.find((x) => normal(x).replace(/\s/g, "") === n) ?? ""
  );
}

const valorDe = (c: Celula): number | null => {
  if (typeof c === "number") return c >= 0 ? c : null;
  const v = lerValorBr(textoDa(c).replace(/[^\d.,-]/g, ""));
  return v === null || Number.isNaN(v) || v < 0 ? null : v;
};

/** "Nome - (22) 99999-8888" → nome e telefone. */
function nomeETelefone(t: string) {
  const tel = soDigitos(t.match(/[\d()\s.-]{10,}/)?.[0] ?? "").slice(-11);
  const nome = t
    .replace(/[\d()+.-]{2,}[\d()\s.-]*/g, " ")
    .replace(/[,;:/|]+/g, " ")
    .trim();
  return { nome, telefone: tel.length >= 10 ? tel : "" };
}

const isento = (t: string) =>
  /^(isent|n\/?h|nao (tem|possui)|-)/.test(normal(t));

// ---------------------------------------------------------------------------
// Linha → ficha
// ---------------------------------------------------------------------------

export interface FichaImportada {
  /** Linha da planilha (a 1 é o cabeçalho). */
  linha: number;
  /** ISO do carimbo (vira gerada, consentimento e recebida). */
  enviadaEm: string;
  tipo: TipoFicha;
  nome: string;
  /** CPF ou CNPJ, só dígitos ("" se não veio ou não confere). */
  documento: string;
  luc: string | null;
  respostas: RespostasFicha;
  assinatura: string;
  avisos: string[];
  /** CPF/CNPJ repetido no arquivo ou que já tem ficha. */
  duplicada: boolean;
  /** Ficha atual com o mesmo CPF/CNPJ. */
  fichaExistente: string | null;
}

export interface AvisoDaImportacao {
  linha: number;
  texto: string;
  /** Ficha atual com o mesmo CPF/CNPJ (para a tela mostrar). */
  fichaId?: string;
}

export interface PreviaDasFichas {
  /** Linhas com conteúdo (sem o cabeçalho). */
  linhas: number;
  fichas: FichaImportada[];
  /** Linhas que não entram (sem data ou sem aceite da LGPD). */
  ignoradas: AvisoDaImportacao[];
  /** CPF/CNPJ repetido no arquivo ou que já tem ficha. */
  duplicadas: number;
  /** Fichas com pelo menos um aviso. */
  comAviso: number;
  avisos: AvisoDaImportacao[];
}

export type ResultadoDaLeitura =
  | { ok: true; previa: PreviaDasFichas }
  | { ok: false; erro: string; cabecalho: ProblemaDoCabecalho[] };

/** Ficha atual por CPF/CNPJ (só dígitos). */
export type FichasExistentes = Map<string, { id: string; nome: string | null }>;

function lerLinha(
  linha: Celula[],
  numero: number,
): FichaImportada | AvisoDaImportacao {
  const t = (pergunta: number) => textoDa(linha[pergunta]);
  const enviadaEm = lerCarimbo(linha[0]);
  if (!enviadaEm)
    return {
      linha: numero,
      texto: "Sem data e hora do envio: a linha não entra.",
    };
  if (!t(2))
    return {
      linha: numero,
      texto: "Sem o aceite da LGPD: a linha não entra.",
    };
  const tipo = tipoDe(t(4));
  if (!tipo)
    return {
      linha: numero,
      texto: `Tipo de formulário "${t(4) || "(vazio)"}" fora da lista: a linha não entra.`,
    };
  const avisos: string[] = [];
  const casado = estadoCivilDe(t(22));
  if (t(22) && !casado) avisos.push(`Estado civil "${t(22)}" fora da lista.`);

  const conjuge = pedeConjuge(casado)
    ? {
        nome: t(27),
        cpf: t(28),
        ...documentoDe(t(29)),
        expedicao: lerData(linha[30]),
        ...orgaoDe(t(31)),
        nascimento: lerData(linha[32]),
        nacionalidade: t(33) || undefined,
        profissao: t(34),
        telefone: t(35),
        telefone2: t(36),
        email: t(37),
      }
    : {};
  const ref = nomeETelefone(t(44));
  const aluguel = normal(t(47));
  const pagaAluguel = aluguel ? !/^n(ao)?\b/.test(aluguel) : null;
  const refAluguel = nomeETelefone(t(47).replace(/^\s*sim[\s,.:-]*/i, ""));
  const patrimonio = t(46)
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
  const conhecidos = patrimonio
    .map((x) => PATRIMONIOS.find((p) => normal(p) === normal(x)))
    .filter((x): x is (typeof PATRIMONIOS)[number] => !!x);
  const outros = patrimonio.filter(
    (x) => !PATRIMONIOS.some((p) => normal(p) === normal(x)),
  );

  const entrada = {
    email: t(1),
    aceite: true,
    luc: t(3) ? t(3).toUpperCase().slice(0, 20) : LUC_NAO_SEI,
    tipo,
    empresa:
      tipo === "pj"
        ? {
            cnpj: t(6),
            razao_social: t(5),
            natureza: naturezaDe(t(7)),
            ie: isento(t(8)) ? "" : t(8),
            ie_isento: isento(t(8)),
            im: isento(t(9)) ? "" : t(9),
            im_nao_tem: isento(t(9)),
            cnae: t(10),
            ramo: t(11),
            endereco: enderecoDe(t(12)),
            capital_social: valorDe(linha[13]),
            ultima_alteracao: lerData(linha[14]),
          }
        : {},
    pessoas: [
      {
        nome: t(15),
        cpf: t(16),
        ...documentoDe(t(17)),
        ...orgaoDe(t(18)),
        expedicao: lerData(linha[19]),
        nascimento: lerData(linha[20]),
        nacionalidade: t(21) || undefined,
        estado_civil: casado,
        endereco: enderecoDe(t(23)),
        telefone: t(24),
        telefone2: t(25),
        email: t(26),
        conjuge,
      },
    ],
    renda: {
      profissao: t(38),
      empresa: t(39),
      endereco: enderecoDe(t(40)),
      telefone: t(41),
      email: t(42),
      renda: valorDe(linha[43]),
      referencia_nome: ref.nome,
      referencia_telefone: ref.telefone,
      outras_rendas: t(45),
      patrimonio: [
        ...new Set([
          ...conhecidos,
          ...(outros.length ? (["Outro"] as const) : []),
        ]),
      ],
      patrimonio_outro: outros.join(", "),
      paga_aluguel: pagaAluguel,
      aluguel_nome: pagaAluguel ? refAluguel.nome : "",
      aluguel_telefone: pagaAluguel ? refAluguel.telefone : "",
    },
    assinatura: t(48),
  };

  const lidas = respostasSchema.safeParse(entrada);
  if (!lidas.success)
    return {
      linha: numero,
      texto: `Linha com valores que não dá para ler (${lidas.error.issues[0]?.path.join(".") ?? "?"}).`,
    };
  const r = lidas.data;
  if (tipo === "pj" && r.empresa.cnpj && !cnpjValido(r.empresa.cnpj))
    avisos.push("CNPJ com dígitos que não conferem.");
  if (t(7) && tipo === "pj" && !r.empresa.natureza)
    avisos.push(`Natureza jurídica "${t(7)}" fora da lista.`);
  const titular = r.pessoas[0];
  if (titular?.cpf && !cpfValido(titular.cpf))
    avisos.push("CPF com dígitos que não conferem.");
  if (!r.email) avisos.push("Sem e-mail.");

  const doc = documentoDaFicha(r);
  return {
    linha: numero,
    enviadaEm,
    tipo,
    nome: nomeDaFicha(r),
    documento:
      doc && (doc.length === 11 ? cpfValido(doc) : cnpjValido(doc)) ? doc : "",
    luc: r.luc === LUC_NAO_SEI ? null : r.luc,
    respostas: r,
    assinatura: r.assinatura,
    avisos,
    duplicada: false,
    fichaExistente: null,
  };
}

/**
 * Lê a planilha do Forms (linhas[0] = cabeçalho). Cabeçalho diferente
 * bloqueia; CPF/CNPJ repetido no arquivo ou que já tem ficha avisa.
 */
export function lerFichasDoForms(
  linhas: Celula[][],
  existentes: FichasExistentes,
): ResultadoDaLeitura {
  const [cabecalho, ...corpo] = linhas;
  if (!cabecalho)
    return { ok: false, erro: "O arquivo está vazio.", cabecalho: [] };
  const problemas = conferirCabecalho(cabecalho);
  if (problemas.length)
    return {
      ok: false,
      erro: `O cabeçalho não é o do Forms cadastral: ${problemas.length} ${problemas.length === 1 ? "coluna faltou ou mudou" : "colunas faltaram ou mudaram"}.`,
      cabecalho: problemas,
    };

  const fichas: FichaImportada[] = [];
  const ignoradas: AvisoDaImportacao[] = [];
  const avisos: AvisoDaImportacao[] = [];
  const noArquivo = new Map<string, number>();
  let duplicadas = 0;
  let linhasComConteudo = 0;

  corpo.forEach((l, i) => {
    if (!l.some((c) => textoDa(c))) return;
    linhasComConteudo++;
    const numero = i + 2;
    const lida = lerLinha(l, numero);
    if (!("respostas" in lida)) {
      ignoradas.push(lida);
      return;
    }
    if (lida.documento) {
      const atual = existentes.get(lida.documento);
      const antes = noArquivo.get(lida.documento);
      if (atual) {
        duplicadas++;
        lida.duplicada = true;
        lida.fichaExistente = atual.id;
        avisos.push({
          linha: numero,
          texto: `${lida.documento.length === 11 ? "CPF" : "CNPJ"} já tem ficha (${atual.nome ?? "sem nome"}).`,
          fichaId: atual.id,
        });
        lida.avisos.push("CPF ou CNPJ já tem ficha no sistema.");
      } else if (antes) {
        duplicadas++;
        lida.duplicada = true;
        lida.avisos.push(`Mesmo CPF ou CNPJ da linha ${antes}.`);
      }
      if (!antes) noArquivo.set(lida.documento, numero);
    }
    for (const texto of lida.avisos)
      if (!texto.startsWith("CPF ou CNPJ já tem ficha"))
        avisos.push({ linha: numero, texto });
    fichas.push(lida);
  });

  return {
    ok: true,
    previa: {
      linhas: linhasComConteudo,
      fichas,
      ignoradas,
      duplicadas,
      comAviso: fichas.filter((f) => f.avisos.length).length,
      avisos,
    },
  };
}
