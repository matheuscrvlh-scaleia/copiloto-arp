import {
  type Conjuge,
  caixaAlta,
  type DadosContrato,
  ESTADOS_CIVIS,
  type EstadoCivil,
  type Fiador,
  novoFiador,
  type PessoaFisica,
  type Representante,
} from "./contrato";
import {
  type ConjugeDoContrato,
  type EnderecoFicha,
  formatarTelefone,
  type PartesDaFicha,
  type PessoaDoContrato,
} from "./ficha";

// Ficha cadastral escolhida → campos da etapa Partes (locatário) ou do
// fiador na etapa Garantia. A leitura da ficha (o que foi preenchido e o que
// conferir) é da ficha.ts; aqui só se passa para os campos do contrato.

const civil = (rotulo: string): EstadoCivil | "" =>
  (Object.entries(ESTADOS_CIVIS).find(([, r]) => r === rotulo)?.[0] as
    | EstadoCivil
    | undefined) ?? "";

const tel = (d: string) => (d ? formatarTelefone(d) : "");

const endereco = (e: EnderecoFicha) => ({
  cep: e.cep,
  logradouro: caixaAlta(e.logradouro),
  numero: caixaAlta(e.numero),
  complemento: caixaAlta(e.complemento),
  bairro: caixaAlta(e.bairro),
  cidade: caixaAlta(e.cidade),
  uf: caixaAlta(e.uf),
});

function pessoa(p: PessoaDoContrato): PessoaFisica {
  return {
    nome: caixaAlta(p.nome),
    cpf: p.cpf,
    doc_tipo: caixaAlta(p.documentoTipo),
    doc_numero: caixaAlta(p.documentoNumero),
    orgao: caixaAlta(p.orgaoExpedidor),
    orgao_uf: caixaAlta(p.orgaoUf),
    expedicao: p.dataExpedicao,
    nascimento: p.dataNascimento,
    nacionalidade: caixaAlta(p.nacionalidade),
    estado_civil: civil(p.estadoCivil),
    profissao: caixaAlta(p.profissao),
    email: p.email,
    telefone: tel(p.telefone),
    endereco: endereco(p.endereco),
  };
}

function conjuge(c: ConjugeDoContrato | null, vazio: Conjuge): Conjuge {
  if (!c) return vazio;
  return {
    nome: caixaAlta(c.nome),
    cpf: c.cpf,
    doc_tipo: caixaAlta(c.documentoTipo),
    doc_numero: caixaAlta(c.documentoNumero),
    orgao: caixaAlta(c.orgaoExpedidor),
    orgao_uf: caixaAlta(c.orgaoUf),
    expedicao: c.dataExpedicao,
    nascimento: c.dataNascimento,
    nacionalidade: caixaAlta(c.nacionalidade),
    profissao: caixaAlta(c.profissao),
    telefone: tel(c.telefone),
    telefone_secundario: tel(c.telefoneSecundario),
    email: c.email,
  };
}

/** Os campos da etapa Partes preenchidos pela ficha (o resto fica). */
export function partesDaFicha(
  f: PartesDaFicha,
  atual: DadosContrato["partes"],
  nomeDaFicha: string,
): DadosContrato["partes"] {
  const out: DadosContrato["partes"] = {
    ...structuredClone(atual),
    origem: "ficha",
    ficha_id: f.fichaId,
    ficha_nome: caixaAlta(nomeDaFicha),
    tipo: f.tipoParte,
  };
  if (f.pessoaFisica) out.pf = pessoa(f.pessoaFisica);
  out.conjuge = conjuge(f.conjuge, atual.conjuge);
  const r = f.renda;
  out.renda = {
    ...out.renda,
    empresa: caixaAlta(r.empresa),
    empresa_endereco: endereco(r.enderecoEmpresa),
    empresa_telefone: tel(r.telefoneEmpresa),
    renda: r.rendaMensal,
    referencia_nome: caixaAlta(r.referenciaPessoal),
    outras_rendas: caixaAlta(r.outrasRendas),
    patrimonio: r.patrimonio
      .map((x) => (x.startsWith("Outro") ? "Outro" : x))
      .filter(
        (x): x is "Veículos" | "Imóvel próprio" | "Outro" =>
          x === "Veículos" || x === "Imóvel próprio" || x === "Outro",
      ),
    patrimonio_outro: caixaAlta(
      r.patrimonio.find((x) => x.startsWith("Outro: "))?.slice(7) ?? "",
    ),
    paga_aluguel: r.pagaAluguel,
    aluguel_referencia_nome: caixaAlta(r.referenciaAluguel),
  };
  const j = f.pessoaJuridica;
  if (j)
    out.pj = {
      razao_social: caixaAlta(j.razaoSocial),
      cnpj: j.cnpj,
      natureza: caixaAlta(j.naturezaJuridica),
      ie:
        j.inscricaoEstadual === "ISENTO" ? "" : caixaAlta(j.inscricaoEstadual),
      ie_isento: j.inscricaoEstadual === "ISENTO",
      im:
        j.inscricaoMunicipal === "NÃO TEM"
          ? ""
          : caixaAlta(j.inscricaoMunicipal),
      im_nao_tem: j.inscricaoMunicipal === "NÃO TEM",
      cnae: caixaAlta(j.cnaePrincipal),
      ramo: caixaAlta(j.ramoAtuacao),
      capital_social: j.capitalSocial,
      ultima_alteracao: j.ultimaAlteracaoSocial,
      email: j.email,
      telefone: tel(j.telefone),
      endereco: endereco(j.endereco),
    };
  if (f.representantes.length)
    out.representantes = f.representantes.map(
      (x): Representante => ({
        nome: caixaAlta(x.nome),
        cpf: x.cpf,
        rg: caixaAlta(x.documentoNumero),
        orgao: caixaAlta(x.orgaoExpedidor),
        rg_uf: caixaAlta(x.orgaoUf),
        cargo: caixaAlta(x.cargo),
        nacionalidade: caixaAlta(x.nacionalidade),
        estado_civil: civil(x.estadoCivil),
        profissao: caixaAlta(x.profissao),
        endereco: endereco(x.endereco),
      }),
    );
  if (f.destinacao.nomeFantasia || f.destinacao.atividades)
    out.destinacao = {
      nome_fantasia:
        caixaAlta(f.destinacao.nomeFantasia) || out.destinacao.nome_fantasia,
      atividades:
        caixaAlta(f.destinacao.atividades) || out.destinacao.atividades,
    };
  return out;
}

/** Fiador PF a partir da ficha do tipo Fiador (com o cônjuge, se casado). */
export function fiadorDaFicha(
  f: PartesDaFicha,
  atual: Fiador | undefined,
  nomeDaFicha: string,
): Fiador {
  const base = atual ? structuredClone(atual) : novoFiador();
  return {
    ...base,
    tipo: "pf",
    ficha_id: f.fichaId,
    ficha_nome: caixaAlta(nomeDaFicha),
    pf: f.pessoaFisica ? pessoa(f.pessoaFisica) : base.pf,
    conjuge: conjuge(f.conjuge, base.conjuge),
  };
}
