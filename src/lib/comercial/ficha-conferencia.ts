import { cnpjValido, cpfValido } from "@/lib/documentos";
import {
  type ConjugeFicha,
  type EnderecoFicha,
  emailValido,
  type PessoaFicha,
  pedeConjuge,
  type RespostasFicha,
  respostasSchema,
  telefoneValido,
} from "./ficha-respostas";

// ---------------------------------------------------------------------------
// Conferência do envio
// ---------------------------------------------------------------------------

export interface Problema {
  /** Caminho do campo, ex.: "pessoas.0.cpf". */
  campo: string;
  /** Número da pergunta (0 = documentos). */
  pergunta: number;
  mensagem: string;
}

const semAcento = (v: string) =>
  v
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

/** Mesmo nome, sem ligar para acento, caixa e espaços. */
export const mesmoNome = (a: string, b: string) =>
  semAcento(a) === semAcento(b);

function conferirEndereco(
  e: EnderecoFicha,
  campo: string,
  pergunta: number,
  p: Problema[],
) {
  const falta = (sub: string, msg: string) =>
    p.push({ campo: `${campo}.${sub}`, pergunta, mensagem: msg });
  if (e.cep.length !== 8) falta("cep", "Informe o CEP (8 números).");
  if (!e.logradouro) falta("logradouro", "Informe o logradouro.");
  if (!e.numero) falta("numero", "Informe o número (ou S/N).");
  if (!e.bairro) falta("bairro", "Informe o bairro.");
  if (!e.cidade) falta("cidade", "Informe a cidade.");
  if (!e.uf) falta("uf", "Escolha a UF.");
}

function conferirIdentificacao(
  x: PessoaFicha | ConjugeFicha,
  campo: string,
  n: {
    nome: number;
    cpf: number;
    doc: number;
    orgao: number;
    expedicao: number;
    nascimento: number;
    nacionalidade: number;
  },
  hoje: string,
  p: Problema[],
) {
  const falta = (sub: string, pergunta: number, mensagem: string) =>
    p.push({ campo: `${campo}.${sub}`, pergunta, mensagem });
  if (x.nome.split(" ").length < 2)
    falta("nome", n.nome, "Informe o nome completo.");
  if (!x.cpf) falta("cpf", n.cpf, "Informe o CPF.");
  else if (!cpfValido(x.cpf))
    falta("cpf", n.cpf, "CPF com número errado. Confira os 11 dígitos.");
  if (!x.doc_tipo)
    falta("doc_tipo", n.doc, "Escolha o documento de identificação.");
  if (!x.doc_numero)
    falta("doc_numero", n.doc, "Informe o número do documento.");
  if (!x.orgao) falta("orgao", n.orgao, "Informe o órgão expedidor.");
  if (!x.orgao_uf) falta("orgao_uf", n.orgao, "Escolha a UF do órgão.");
  if (!x.expedicao || x.expedicao > hoje)
    falta("expedicao", n.expedicao, "Informe a data de expedição.");
  if (!x.nascimento || x.nascimento >= hoje)
    falta("nascimento", n.nascimento, "Informe a data de nascimento.");
  if (!x.nacionalidade)
    falta("nacionalidade", n.nacionalidade, "Informe a nacionalidade.");
}

/**
 * O que falta ou está errado para enviar, na ordem das perguntas. `hoje`
 * ("aaaa-mm-dd") barra datas no futuro.
 */
export function problemasDoEnvio(r: RespostasFicha, hoje: string): Problema[] {
  const p: Problema[] = [];
  const falta = (campo: string, pergunta: number, mensagem: string) =>
    p.push({ campo, pergunta, mensagem });

  if (!emailValido(r.email)) falta("email", 1, "Informe um e-mail válido.");
  if (!r.aceite)
    falta(
      "aceite",
      2,
      "Sem o aceite do termo da LGPD não é possível seguir com a ficha.",
    );
  if (!r.luc)
    falta("luc", 3, 'Escolha o imóvel pretendido ou "Ainda não sei".');
  if (!r.tipo) {
    falta("tipo", 4, "Escolha o tipo de formulário.");
    return p;
  }

  if (r.tipo === "pj") {
    const e = r.empresa;
    if (!e.cnpj) falta("empresa.cnpj", 6, "Informe o CNPJ.");
    else if (!cnpjValido(e.cnpj))
      falta(
        "empresa.cnpj",
        6,
        "CNPJ com número errado. Confira os 14 dígitos.",
      );
    if (!e.razao_social)
      falta("empresa.razao_social", 5, "Informe a razão social.");
    if (!e.natureza)
      falta("empresa.natureza", 7, "Escolha a natureza jurídica.");
    if (!e.ie && !e.ie_isento)
      falta(
        "empresa.ie",
        8,
        'Informe a inscrição estadual ou marque "Isento".',
      );
    if (!e.im && !e.im_nao_tem)
      falta(
        "empresa.im",
        9,
        'Informe a inscrição municipal ou marque "Não tem".',
      );
    if (!e.cnae) falta("empresa.cnae", 10, "Informe o CNAE principal.");
    if (!e.ramo) falta("empresa.ramo", 11, "Informe o ramo de atuação.");
    conferirEndereco(e.endereco, "empresa.endereco", 12, p);
    if (e.ultima_alteracao > hoje)
      falta("empresa.ultima_alteracao", 14, "A data não pode ser no futuro.");
  }

  const pessoas = r.tipo === "pj" ? r.pessoas : r.pessoas.slice(0, 1);
  const cpfs = new Set<string>();
  const repetido = (cpf: string, campo: string, pergunta: number) => {
    if (!cpf) return;
    if (cpfs.has(cpf))
      falta(campo, pergunta, "CPF repetido: já está em outra pessoa da ficha.");
    cpfs.add(cpf);
  };
  pessoas.forEach((x, i) => {
    const c = `pessoas.${i}`;
    conferirIdentificacao(
      x,
      c,
      {
        nome: 15,
        cpf: 16,
        doc: 17,
        orgao: 18,
        expedicao: 19,
        nascimento: 20,
        nacionalidade: 21,
      },
      hoje,
      p,
    );
    repetido(x.cpf, `${c}.cpf`, 16);
    if (!x.estado_civil)
      falta(`${c}.estado_civil`, 22, "Escolha o estado civil.");
    conferirEndereco(x.endereco, `${c}.endereco`, 23, p);
    if (!telefoneValido(x.telefone))
      falta(`${c}.telefone`, 24, "Informe o telefone com DDD.");
    if (x.telefone2 && !telefoneValido(x.telefone2))
      falta(`${c}.telefone2`, 25, "Telefone secundário incompleto.");
    if (!emailValido(x.email))
      falta(`${c}.email`, 26, "Informe um e-mail válido.");

    if (pedeConjuge(x.estado_civil)) {
      const j = x.conjuge;
      const cj = `${c}.conjuge`;
      conferirIdentificacao(
        j,
        cj,
        {
          nome: 27,
          cpf: 28,
          doc: 29,
          expedicao: 30,
          orgao: 31,
          nascimento: 32,
          nacionalidade: 33,
        },
        hoje,
        p,
      );
      repetido(j.cpf, `${cj}.cpf`, 28);
      if (!j.profissao)
        falta(`${cj}.profissao`, 34, "Informe a profissão ou ocupação.");
      if (!telefoneValido(j.telefone))
        falta(`${cj}.telefone`, 35, "Informe o telefone com DDD.");
      if (j.telefone2 && !telefoneValido(j.telefone2))
        falta(`${cj}.telefone2`, 36, "Telefone secundário incompleto.");
      if (!emailValido(j.email))
        falta(`${cj}.email`, 37, "Informe um e-mail válido.");
    }
  });

  const d = r.renda;
  if (!d.empresa) falta("renda.empresa", 39, "Informe a empresa.");
  conferirEndereco(d.endereco, "renda.endereco", 40, p);
  if (!telefoneValido(d.telefone))
    falta("renda.telefone", 41, "Informe o telefone da empresa com DDD.");
  if (d.email && !emailValido(d.email))
    falta("renda.email", 42, "E-mail da empresa inválido.");
  if (d.renda === null) falta("renda.renda", 43, "Informe a renda mensal.");
  if (d.referencia_telefone && !telefoneValido(d.referencia_telefone))
    falta(
      "renda.referencia_telefone",
      44,
      "Telefone da referência incompleto.",
    );
  if (d.patrimonio.includes("Outro") && !d.patrimonio_outro)
    falta("renda.patrimonio_outro", 46, 'Diga qual é o "Outro" patrimônio.');
  if (d.paga_aluguel) {
    if (!d.aluguel_nome)
      falta(
        "renda.aluguel_nome",
        47,
        "Informe o nome da referência do aluguel.",
      );
    if (!telefoneValido(d.aluguel_telefone))
      falta("renda.aluguel_telefone", 47, "Informe o telefone da referência.");
  }

  if (r.assinatura.split(" ").length < 2)
    falta("assinatura", 48, "Escreva seu nome completo para enviar.");
  return p;
}

/** Avisos que não impedem o envio (a pessoa confirma e segue). */
export function avisosDoEnvio(r: RespostasFicha): string[] {
  const nome = r.pessoas[0]?.nome ?? "";
  if (r.assinatura && nome && !mesmoNome(r.assinatura, nome))
    return [
      `O nome do envio (${r.assinatura}) está diferente do nome da pergunta 15 (${nome}). Confira antes de enviar.`,
    ];
  return [];
}

/** O envio pelo Zod: respostas completas e conferidas, por tipo. */
export function esquemaDoEnvio(hoje: string) {
  return respostasSchema.superRefine((r, ctx) => {
    for (const x of problemasDoEnvio(r, hoje))
      ctx.addIssue({
        code: "custom",
        path: x.campo.split(".").map((s) => (/^\d+$/.test(s) ? Number(s) : s)),
        message: x.mensagem,
      });
  });
}

// ---------------------------------------------------------------------------
// Documentos comprobatórios (listas ficha_documento_* dos parâmetros)
// ---------------------------------------------------------------------------

export interface DocumentoExigido {
  documento: string;
  obrigatorio: boolean;
}

/** Documentos obrigatórios ainda sem arquivo. */
export function documentosFaltando(
  exigidos: DocumentoExigido[],
  enviados: string[],
): string[] {
  const tem = new Set(enviados.map(semAcento));
  return exigidos
    .filter((d) => d.obrigatorio && !tem.has(semAcento(d.documento)))
    .map((d) => d.documento);
}
