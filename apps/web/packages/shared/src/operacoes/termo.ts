// Termo de autorização de energia (spec 4.6): o texto do modelo dos termos
// já emitidos, palavra por palavra, com os campos preenchidos; a data por
// extenso; a qualificação padrão pelo documento; e o nome do arquivo pelo
// modelo dos parâmetros. O mesmo texto vai para a prévia, o PDF e o Word.
// Funções puras.

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** "2026-10-08" → "08 de outubro de 2026". */
export function dataPorExtenso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const mes = m ? MESES[Number(m[2]) - 1] : undefined;
  if (!m || !mes || Number(m[3]) < 1 || Number(m[3]) > 31)
    throw new RangeError(`data inválida: ${iso}`);
  return `${m[3]} de ${mes} de ${m[1]}`;
}

/** Tipo do documento pela quantidade de dígitos (11 CPF, 14 CNPJ). */
export function tipoDoDocumento(
  doc: string | null | undefined,
): "CPF" | "CNPJ" | null {
  const n = (doc ?? "").replace(/\D/g, "").length;
  return n === 11 ? "CPF" : n === 14 ? "CNPJ" : null;
}

/** Qualificação padrão pelo documento (parâmetros); vazio se não dá para saber. */
export function qualificacaoPadrao(
  doc: string | null | undefined,
  p: { termo_qualificacao_cpf: string; termo_qualificacao_cnpj: string },
): string {
  const t = tipoDoDocumento(doc);
  return t === "CPF"
    ? p.termo_qualificacao_cpf
    : t === "CNPJ"
      ? p.termo_qualificacao_cnpj
      : "";
}

/**
 * "[CPF ou CNPJ]" do modelo: o tipo e o número ("CNPJ 12.345.678/0001-90").
 * Se o documento já diz o tipo, ou não dá para saber, fica como veio.
 */
export function documentoNoTexto(doc: string): string {
  const d = doc.trim();
  if (/^(cpf|cnpj)\b/i.test(d)) return d;
  const t = tipoDoDocumento(d);
  return t ? `${t} ${d}` : d;
}

/** "12" ou "Bloco 12" → "Bloco 12" (como no termo). */
export function blocoNoTermo(bloco: string): string {
  const b = bloco.trim();
  return /^\d+$/.test(b) ? `Bloco ${b.padStart(2, "0")}` : b;
}

/** "104" → "Sala 104"; "Loja 12" fica como está. */
export function salaNoTermo(sala: string): string {
  const s = sala.trim();
  return /^\d/.test(s) ? `Sala ${s}` : s;
}

export interface DadosDoTermo {
  /** aaaa-mm-dd */
  dataEmissao: string;
  locatario: string;
  documento: string;
  qualificacao: string;
  /** "Bloco 12" */
  bloco: string;
  /** "1º pavimento (térreo)" */
  pavimento: string;
  /** "Sala 104" */
  sala: string;
  projeto: string;
  amperes: number | null;
  ligacao: string;
  armario: string;
  rota: string;
  observacaoTecnica: string;
}

/** Dados da ARP no termo (parâmetros termo_*). */
export interface DadosDaArp {
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  cidade: string;
}

export interface TextoDoTermo {
  /** "Nova Friburgo, 08 de outubro de 2026." (alinhada à direita) */
  data: string;
  titulo: string;
  /** Parágrafos justificados, na ordem. */
  paragrafos: string[];
  /** Duas assinaturas, uma embaixo da outra. */
  assinaturas: { nome: string; documento: string }[];
}

export const TITULO_DO_TERMO = "TERMO DE AUTORIZAÇÃO";

const ou = (v: string | number | null | undefined) =>
  v === null || v === undefined || String(v).trim() === ""
    ? "—"
    : String(v).trim();

/**
 * Texto do termo (modelo dos termos emitidos; as partes entre colchetes da
 * spec vêm dos campos). A observação técnica só entra quando preenchida. O
 * histórico de ocupantes nunca entra (nem é recebido aqui).
 */
export function textoDoTermo(d: DadosDoTermo, arp: DadosDaArp): TextoDoTermo {
  const locatario = d.locatario.trim().toLocaleUpperCase("pt-BR");
  const corpo =
    `Pelo presente Termo, ${arp.razaoSocial}, pessoa jurídica de direito privado, ` +
    `inscrita no CNPJ/MF sob o nº ${arp.cnpj}, situada na ${arp.endereco}, neste ato ` +
    "representada na forma do seu contrato social, vem conceder AUTORIZAÇÃO a " +
    `${locatario}, inscrito(a) no ${documentoNoTexto(d.documento)}, a fim de que ` +
    "este(a) requeira junto à Concessionária Energisa a instalação e ligação do " +
    `medidor de energia no ${d.bloco.trim()}, ${d.pavimento.trim()}, parte, ${d.sala.trim()}, ` +
    "locado pela mesma, situado no endereço acima mencionado.";
  const obs =
    `OBS – Projeto ${ou(d.projeto)} – disjuntor de ${ou(d.amperes)} amperes, ` +
    `Ligação ${ou(d.ligacao)}, ARMÁRIO ${ou(d.armario)}, ROTA ${ou(d.rota)}.`;
  const tecnica = d.observacaoTecnica.trim();
  return {
    data: `${arp.cidade}, ${dataPorExtenso(d.dataEmissao)}.`,
    titulo: TITULO_DO_TERMO,
    paragrafos: tecnica ? [corpo, obs, tecnica] : [corpo, obs],
    assinaturas: [
      { nome: arp.razaoSocial, documento: arp.cnpj },
      { nome: locatario, documento: d.documento.trim() },
    ],
  };
}

/** O que falta para emitir (campos do modelo em branco). */
export function faltaNoTermo(d: DadosDoTermo): string[] {
  const falta: string[] = [];
  const vazio = (v: string | number | null) =>
    v === null || String(v).trim() === "";
  if (vazio(d.locatario)) falta.push("Locatário");
  if (vazio(d.documento)) falta.push("CPF ou CNPJ");
  if (vazio(d.bloco)) falta.push("Bloco");
  if (vazio(d.pavimento)) falta.push("Pavimento");
  if (vazio(d.sala)) falta.push("Sala ou loja");
  if (vazio(d.projeto)) falta.push("Projeto da Energisa");
  if (vazio(d.amperes)) falta.push("Disjuntor (amperes)");
  if (vazio(d.ligacao)) falta.push("Ligação");
  if (vazio(d.armario)) falta.push("Armário");
  if (vazio(d.rota)) falta.push("Rota");
  return falta;
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Nome do arquivo pelo modelo dos parâmetros (termo_nome_arquivo), sem a
 * extensão: "[bloco]" vira o número do bloco, "[sala]" a unidade e
 * "[LOCATARIO]" o nome em maiúsculas. Sem acento e sem os caracteres que o
 * Windows não aceita, para abrir em qualquer computador.
 */
export function nomeDoArquivoDoTermo(
  modelo: string,
  campos: { bloco: string; sala: string; locatario: string },
): string {
  const bloco = (/\d+/.exec(campos.bloco)?.[0] ?? campos.bloco).padStart(
    2,
    "0",
  );
  const sala = campos.sala.replace(/^\s*(sala|loja)\s+/i, "").trim();
  const nome = modelo
    .replace(/\[bloco\]/gi, bloco)
    .replace(/\[sala\]/gi, sala)
    .replace(
      /\[locat[aá]rio\]/gi,
      campos.locatario.trim().toLocaleUpperCase("pt-BR"),
    );
  // Caractere de controle (quebra de linha, tabulação) vira espaço.
  const visivel = Array.from(semAcento(nome), (ch) =>
    ch.charCodeAt(0) < 32 ? " " : ch,
  ).join("");
  const limpo = visivel
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  return (limpo || "TERMO DE AUTORIZACAO DE ENERGIA").slice(0, 150).trim();
}
