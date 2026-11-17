import { formatarEndereco, formatarTelefone } from "./ficha-blocos";
import { mesmoNome } from "./ficha-conferencia";
import {
  type EnderecoFicha,
  lerRespostas,
  limparPorTipo,
  lucDaFicha,
  type PessoaFicha,
  pedeConjuge,
  pessoaVazia,
  TIPOS_FICHA,
  type TipoFicha,
} from "./ficha-respostas";

// ---------------------------------------------------------------------------
// Ficha → etapa Partes do contrato (spec 4.11, etapa 2)
// ---------------------------------------------------------------------------

export interface PessoaDoContrato {
  nome: string;
  /** Só dígitos. */
  cpf: string;
  documentoTipo: string;
  documentoNumero: string;
  orgaoExpedidor: string;
  orgaoUf: string;
  /** "aaaa-mm-dd" ou "". */
  dataExpedicao: string;
  dataNascimento: string;
  nacionalidade: string;
  estadoCivil: string;
  profissao: string;
  email: string;
  /** Só dígitos. */
  telefone: string;
  telefoneSecundario: string;
  endereco: EnderecoFicha;
}

export interface ConjugeDoContrato {
  nome: string;
  cpf: string;
  documentoTipo: string;
  documentoNumero: string;
  orgaoExpedidor: string;
  orgaoUf: string;
  dataExpedicao: string;
  dataNascimento: string;
  nacionalidade: string;
  profissao: string;
  email: string;
  telefone: string;
  telefoneSecundario: string;
}

export interface RendaDoContrato {
  empresa: string;
  enderecoEmpresa: EnderecoFicha;
  telefoneEmpresa: string;
  rendaMensal: number | null;
  /** "NOME · (22) 99999-8888" ou "". */
  referenciaPessoal: string;
  outrasRendas: string;
  patrimonio: string[];
  pagaAluguel: boolean | null;
  referenciaAluguel: string;
}

export interface EmpresaDoContrato {
  razaoSocial: string;
  nomeFantasia: string;
  /** Só dígitos. */
  cnpj: string;
  naturezaJuridica: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  cnaePrincipal: string;
  ramoAtuacao: string;
  capitalSocial: number | null;
  ultimaAlteracaoSocial: string;
  email: string;
  telefone: string;
  endereco: EnderecoFicha;
}

export interface RepresentanteDoContrato extends PessoaDoContrato {
  cargo: string;
  conjuge: ConjugeDoContrato | null;
}

export interface PartesDaFicha {
  fichaId: string;
  /** Locatário (PF ou PJ) ou fiador (sempre PF na ficha). */
  papel: "locatario" | "fiador";
  tipoParte: "pf" | "pj";
  /** LUC pretendido (nulo = "Ainda não sei"). */
  luc: string | null;
  /** Locatário PF ou fiador. */
  pessoaFisica: PessoaDoContrato | null;
  /** Cônjuge do locatário PF ou do fiador. */
  conjuge: ConjugeDoContrato | null;
  pessoaJuridica: EmpresaDoContrato | null;
  /** Sócios administradores (PJ), na ordem da ficha. */
  representantes: RepresentanteDoContrato[];
  renda: RendaDoContrato;
  /** Cláusula de destinação: nome fantasia e atividades (ramo). */
  destinacao: { nomeFantasia: string; atividades: string };
  /** Quadro "o que foi preenchido". */
  preenchidos: string[];
  /** Quadro "conferências necessárias". */
  conferencias: string[];
}

function pessoaDoContrato(x: PessoaFicha, profissao: string): PessoaDoContrato {
  return {
    nome: x.nome,
    cpf: x.cpf,
    documentoTipo: x.doc_tipo,
    documentoNumero: x.doc_numero,
    orgaoExpedidor: x.orgao,
    orgaoUf: x.orgao_uf,
    dataExpedicao: x.expedicao,
    dataNascimento: x.nascimento,
    nacionalidade: x.nacionalidade,
    estadoCivil: x.estado_civil,
    profissao,
    email: x.email,
    telefone: x.telefone,
    telefoneSecundario: x.telefone2,
    endereco: x.endereco,
  };
}

function conjugeDoContrato(x: PessoaFicha): ConjugeDoContrato | null {
  if (!pedeConjuge(x.estado_civil)) return null;
  const j = x.conjuge;
  return {
    nome: j.nome,
    cpf: j.cpf,
    documentoTipo: j.doc_tipo,
    documentoNumero: j.doc_numero,
    orgaoExpedidor: j.orgao,
    orgaoUf: j.orgao_uf,
    dataExpedicao: j.expedicao,
    dataNascimento: j.nascimento,
    nacionalidade: j.nacionalidade,
    profissao: j.profissao,
    email: j.email,
    telefone: j.telefone,
    telefoneSecundario: j.telefone2,
  };
}

const juntar = (...v: string[]) => v.filter(Boolean).join(" · ");

/**
 * Campos da etapa Partes a partir da ficha, com o que foi preenchido e o
 * que a pessoa precisa conferir (dois telefones, dois e-mails, mais de um
 * endereço, nome do envio diferente, ficha do Google Forms).
 */
export function dadosDaFichaParaContrato(ficha: {
  id: string;
  tipo: string | null;
  origem: string;
  respostas: unknown;
}): PartesDaFicha {
  const lidas = lerRespostas(ficha.respostas);
  const tipo = (TIPOS_FICHA as readonly string[]).includes(ficha.tipo ?? "")
    ? (ficha.tipo as TipoFicha)
    : lidas.tipo || "pf";
  const r = limparPorTipo({ ...lidas, tipo });
  const d = r.renda;
  const titular = r.pessoas[0] ?? pessoaVazia();
  const preenchidos: string[] = [];
  const conferencias: string[] = [];

  const renda: RendaDoContrato = {
    empresa: d.empresa,
    enderecoEmpresa: d.endereco,
    telefoneEmpresa: d.telefone,
    rendaMensal: d.renda,
    referenciaPessoal: juntar(
      d.referencia_nome,
      d.referencia_telefone && formatarTelefone(d.referencia_telefone),
    ),
    outrasRendas: d.outras_rendas,
    patrimonio: d.patrimonio.map((x) =>
      x === "Outro" && d.patrimonio_outro ? `Outro: ${d.patrimonio_outro}` : x,
    ),
    pagaAluguel: d.paga_aluguel,
    referenciaAluguel: juntar(
      d.aluguel_nome,
      d.aluguel_telefone && formatarTelefone(d.aluguel_telefone),
    ),
  };

  const doisTelefones = (
    x: { telefone: string; telefone2: string },
    quem: string,
  ) => {
    if (x.telefone && x.telefone2 && x.telefone !== x.telefone2)
      conferencias.push(
        `${quem}: a ficha tem dois telefones (${formatarTelefone(x.telefone)} e ${formatarTelefone(x.telefone2)}). Confira qual vai no contrato.`,
      );
  };
  if (r.email && titular.email && r.email !== titular.email)
    conferencias.push(
      `A ficha tem dois e-mails (${r.email} e ${titular.email}). Confira qual vai no contrato.`,
    );
  if (r.assinatura && titular.nome && !mesmoNome(r.assinatura, titular.nome))
    conferencias.push(
      `O nome do envio (${r.assinatura}) é diferente do nome da pergunta 15 (${titular.nome}).`,
    );
  if (ficha.origem === "google_forms")
    conferencias.push(
      "Ficha importada do Google Forms: endereço, documento e órgão expedidor vieram em texto livre. Confira os campos separados.",
    );

  let pessoaFisica: PessoaDoContrato | null = null;
  let conjuge: ConjugeDoContrato | null = null;
  let pessoaJuridica: EmpresaDoContrato | null = null;
  let representantes: RepresentanteDoContrato[] = [];

  if (tipo === "pj") {
    const e = r.empresa;
    pessoaJuridica = {
      razaoSocial: e.razao_social,
      nomeFantasia: e.nome_fantasia,
      cnpj: e.cnpj,
      naturezaJuridica: e.natureza,
      inscricaoEstadual: e.ie_isento ? "ISENTO" : e.ie,
      inscricaoMunicipal: e.im_nao_tem ? "NÃO TEM" : e.im,
      cnaePrincipal: e.cnae,
      ramoAtuacao: e.ramo,
      capitalSocial: e.capital_social,
      ultimaAlteracaoSocial: e.ultima_alteracao,
      email: r.email,
      telefone: titular.telefone,
      endereco: e.endereco,
    };
    representantes = r.pessoas.map((x, i) => ({
      ...pessoaDoContrato(x, i === 0 ? d.profissao : ""),
      cargo: "SÓCIO ADMINISTRADOR",
      conjuge: conjugeDoContrato(x),
    }));
    preenchidos.push(
      "Pessoa jurídica: razão social, CNPJ, natureza jurídica, inscrições, CNAE, ramo, capital social, última alteração e endereço",
      representantes.length > 1
        ? `${representantes.length} representantes legais (sócios administradores)`
        : "Representante legal (sócio administrador)",
    );
    if (representantes.some((x) => x.conjuge))
      preenchidos.push("Cônjuge do sócio administrador");
    conferencias.push(
      "O telefone da empresa veio do sócio administrador e o e-mail, da pergunta 1. Confira.",
    );
    if (representantes.length > 1)
      conferencias.push(
        `A ficha tem ${representantes.length} sócios administradores: confira quem assina o contrato.`,
      );
    if (!d.profissao)
      conferencias.push("Profissão do sócio administrador em branco na ficha.");
    r.pessoas.forEach((x, i) => {
      doisTelefones(x, `Sócio ${i + 1}`);
      if (
        x.endereco.cep &&
        e.endereco.cep &&
        formatarEndereco(x.endereco) !== formatarEndereco(e.endereco)
      )
        conferencias.push(
          `Sócio ${i + 1}: o endereço residencial é diferente do endereço da empresa. O contrato qualifica cada um com o seu.`,
        );
    });
    conferencias.push("Informe o cargo ou a função de cada representante.");
  } else {
    pessoaFisica = pessoaDoContrato(titular, d.profissao);
    conjuge = conjugeDoContrato(titular);
    preenchidos.push(
      `${tipo === "fiador" ? "Fiador(a)" : "Pessoa física"}: nome, CPF, documento, órgão expedidor, datas, nacionalidade, estado civil, profissão, e-mail, telefone e endereço`,
      "Dados de renda: empresa, renda mensal, referências, patrimônio e aluguel",
    );
    if (conjuge) preenchidos.push("Cônjuge ou convivente");
    doisTelefones(titular, tipo === "fiador" ? "Fiador(a)" : "Locatário(a)");
    if (
      d.endereco.cep &&
      titular.endereco.cep &&
      formatarEndereco(d.endereco) !== formatarEndereco(titular.endereco)
    )
      conferencias.push(
        "A ficha tem dois endereços (residencial e da empresa). O contrato usa o residencial.",
      );
    if (!d.profissao) conferencias.push("Profissão em branco na ficha.");
  }
  if (conjuge?.telefoneSecundario)
    doisTelefones(
      { telefone: conjuge.telefone, telefone2: conjuge.telefoneSecundario },
      "Cônjuge",
    );

  return {
    fichaId: ficha.id,
    papel: tipo === "fiador" ? "fiador" : "locatario",
    tipoParte: tipo === "pj" ? "pj" : "pf",
    luc: lucDaFicha(r),
    pessoaFisica,
    conjuge,
    pessoaJuridica,
    representantes,
    renda,
    destinacao: {
      nomeFantasia: tipo === "pj" ? r.empresa.nome_fantasia : "",
      atividades: tipo === "pj" ? r.empresa.ramo : "",
    },
    preenchidos,
    conferencias,
  };
}
