import {
  type ArquivoDoPacote,
  ESQUEMAS,
  esquemaManifesto,
  type LeitorDeBackup,
  type LinhaRecusada,
  type PacoteImportacao,
  type Registro,
  TIPOS_DE_REGISTRO,
  type TipoDeRegistro,
} from "./importacao-modelo";

// Leitores da importação (spec 4.14). O do pacote ZIP com JSON/CSV
// (LAYOUT_DO_PACOTE) já funciona; o do Backup Geral do O.S Arp 4.42 é o
// ponto de extensão para quando o formato chegar. Os arquivos chegam já
// abertos (ZIPs expandidos pelo servidor): aqui só se lê e valida.

export class ErroPacote extends Error {}

// ---------------------------------------------------------------------------
// Texto e CSV
// ---------------------------------------------------------------------------

/** UTF-8 (com ou sem BOM); se não for, a página de código do Windows. */
export function decodificar(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(
      bytes,
    );
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** "Data de Abertura" → "data_de_abertura" (cabeçalho do CSV). */
export function chaveDaColuna(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * CSV do Excel ou de outro sistema: separador ; , ou tab (o que aparecer
 * mais no cabeçalho), aspas com "" dentro, quebra de linha dentro de aspas.
 */
export function lerCsv(texto: string): Record<string, string>[] {
  const t = texto.replace(/^﻿/, "");
  const fimDoCabecalho = t.search(/\r?\n/);
  const cabecalho = fimDoCabecalho < 0 ? t : t.slice(0, fimDoCabecalho);
  const sep = [";", ",", "\t"].reduce((a, b) =>
    cabecalho.split(b).length > cabecalho.split(a).length ? b : a,
  );
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"' && campo === "") aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  const [cab, ...resto] = linhas.filter((l) => l.some((v) => v.trim() !== ""));
  if (!cab) return [];
  const chaves = cab.map(chaveDaColuna);
  return resto.map((l) =>
    Object.fromEntries(chaves.map((k, i) => [k, l[i] ?? ""])),
  );
}

// ---------------------------------------------------------------------------
// Arquivos do pacote
// ---------------------------------------------------------------------------

/** "Fotos\\OS 12\\Antes.JPG" → "fotos/os 12/antes.jpg" (para comparar). */
export function caminhoNormal(nome: string): string {
  return nome
    .replace(/\\/g, "/")
    .replace(/^\.?\/+/, "")
    .normalize("NFC")
    .toLowerCase();
}

const base = (nome: string) => caminhoNormal(nome).split("/").at(-1) ?? "";

/**
 * Acha o arquivo citado nos dados: o caminho exato, dentro de "fotos/", ou
 * só pelo nome (o sistema antigo guarda às vezes só o nome).
 */
export function indiceDeArquivos(arquivos: ArquivoDoPacote[]) {
  const porCaminho = new Map<string, ArquivoDoPacote>();
  const porNome = new Map<string, ArquivoDoPacote[]>();
  for (const a of arquivos) {
    const c = caminhoNormal(a.nome);
    porCaminho.set(c, a);
    // Pacote com uma pasta raiz ("backup/fotos/x.jpg"): também sem ela.
    const semRaiz = c.split("/").slice(1).join("/");
    if (semRaiz && !porCaminho.has(semRaiz)) porCaminho.set(semRaiz, a);
    const n = base(a.nome);
    porNome.set(n, [...(porNome.get(n) ?? []), a]);
  }
  return (citado: string): ArquivoDoPacote | null => {
    const c = caminhoNormal(citado);
    const exato = porCaminho.get(c) ?? porCaminho.get(`fotos/${c}`);
    if (exato) return exato;
    const mesmos = porNome.get(base(citado)) ?? [];
    return mesmos.length === 1 ? (mesmos[0] ?? null) : null;
  };
}

/** Arquivo de dados de um tipo: "tecnicos.json", "dados/tecnicos.csv"… */
function arquivoDoTipo(
  arquivos: ArquivoDoPacote[],
  tipo: TipoDeRegistro,
): ArquivoDoPacote | null {
  const candidatos = arquivos.filter((a) => {
    const n = base(a.nome);
    return n === `${tipo}.json` || n === `${tipo}.csv`;
  });
  if (candidatos.length > 1)
    throw new ErroPacote(
      `O pacote tem mais de um arquivo de ${TIPOS_DE_REGISTRO[tipo].toLowerCase()} (${candidatos.map((c) => c.nome).join(", ")}). Deixe só um.`,
    );
  return candidatos[0] ?? null;
}

/** Lista de objetos do arquivo (JSON: a lista, ou { <tipo>: [...] }). */
async function linhasDoArquivo(
  a: ArquivoDoPacote,
  tipo: string,
): Promise<unknown[]> {
  const textoDoArquivo = decodificar(await a.ler());
  if (a.nome.toLowerCase().endsWith(".csv")) return lerCsv(textoDoArquivo);
  let json: unknown;
  try {
    json = JSON.parse(textoDoArquivo.replace(/^﻿/, ""));
  } catch {
    throw new ErroPacote(`${a.nome} não é um JSON válido.`);
  }
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const dentro = (json as Record<string, unknown>)[tipo];
    if (Array.isArray(dentro)) return dentro;
  }
  throw new ErroPacote(`${a.nome} deveria ser uma lista de registros.`);
}

/** Valida linha a linha: a que não serve vira "recusada" (com o motivo). */
async function lerTipo<T extends TipoDeRegistro>(
  arquivos: ArquivoDoPacote[],
  tipo: T,
  recusadas: LinhaRecusada[],
): Promise<Registro<T>[]> {
  const arquivo = arquivoDoTipo(arquivos, tipo);
  if (!arquivo) return [];
  const linhas = await linhasDoArquivo(arquivo, tipo);
  const esquema = ESQUEMAS[tipo];
  const validos: Registro<T>[] = [];
  linhas.forEach((l, i) => {
    const r = esquema.safeParse(l);
    if (r.success) validos.push(r.data as Registro<T>);
    else {
      const p = r.error.issues[0];
      recusadas.push({
        tipo,
        arquivo: arquivo.nome,
        // Linha da planilha: o cabeçalho é a 1.
        linha: arquivo.nome.toLowerCase().endsWith(".csv") ? i + 2 : i + 1,
        motivo: `${p?.path.join(".") || "registro"}: ${p?.message ?? "inválido"}`,
      });
    }
  });
  return validos;
}

// ---------------------------------------------------------------------------
// Leitores
// ---------------------------------------------------------------------------

const ehManifesto = (a: ArquivoDoPacote) => base(a.nome) === "manifesto.json";

/** Pacote no formato intermediário (LAYOUT_DO_PACOTE). */
export const LEITOR_PACOTE: LeitorDeBackup = {
  chave: "pacote",
  nome: "Pacote de importação (JSON/CSV)",
  reconhece: (arquivos) => arquivos.some(ehManifesto),
  async ler(arquivos) {
    const manifestos = arquivos.filter(ehManifesto);
    if (manifestos.length !== 1)
      throw new ErroPacote(
        manifestos.length
          ? "O pacote tem mais de um manifesto.json. Envie um pacote só."
          : "Falta o manifesto.json com os totais do sistema atual.",
      );
    let bruto: unknown;
    try {
      bruto = JSON.parse(
        decodificar(await (manifestos[0] as ArquivoDoPacote).ler()).replace(
          /^﻿/,
          "",
        ),
      );
    } catch {
      throw new ErroPacote("O manifesto.json não é um JSON válido.");
    }
    const m = esquemaManifesto.safeParse(bruto);
    if (!m.success)
      throw new ErroPacote(
        `manifesto.json: ${m.error.issues[0]?.path.join(".")} ${m.error.issues[0]?.message}`,
      );

    const recusadas: LinhaRecusada[] = [];
    const registros = {} as PacoteImportacao["registros"];
    for (const tipo of Object.keys(TIPOS_DE_REGISTRO) as TipoDeRegistro[])
      Object.assign(registros, {
        [tipo]: await lerTipo(arquivos, tipo, recusadas),
      });
    return { manifesto: m.data, registros, recusadas, arquivos };
  },
};

/**
 * PONTO DE EXTENSÃO — Backup Geral do O.S Arp 4.42 (banco e pasta de
 * fotos, como o sistema atual gera). Quando a ARP passar o formato: em
 * `reconhece`, identificar os arquivos do backup (ex.: extensão do banco);
 * em `ler`, abrir o banco, montar cada registro no formato de
 * importacao-modelo.ts (os mesmos esquemas validam) e devolver as fotos em
 * `arquivos`. O resto da importação (prévia, conferências, gravação e
 * desfazer) não muda. Até lá, gere o pacote do LAYOUT_DO_PACOTE.
 */
export const LEITOR_BACKUP_GERAL: LeitorDeBackup = {
  chave: "backup_geral",
  nome: "Backup Geral do O.S Arp 4.42",
  reconhece: () => false,
  async ler() {
    throw new ErroPacote(
      "O leitor do Backup Geral ainda não foi escrito: o formato do backup não chegou. Envie o pacote de importação (JSON/CSV).",
    );
  },
};

export const LEITORES: LeitorDeBackup[] = [LEITOR_PACOTE, LEITOR_BACKUP_GERAL];

/** O primeiro leitor que entende os arquivos. */
export function escolherLeitor(
  arquivos: ArquivoDoPacote[],
  leitores = LEITORES,
): LeitorDeBackup {
  const leitor = leitores.find((l) => l.reconhece(arquivos));
  if (!leitor)
    throw new ErroPacote(
      "Não reconheci o formato. Envie o pacote de importação com o manifesto.json (veja o formato abaixo).",
    );
  return leitor;
}
