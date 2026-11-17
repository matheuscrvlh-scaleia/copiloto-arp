// Tipos das consultas públicas (CEP, CNPJ) que as regras do Comercial usam.
// O conector (apps/api/src/connectors/publicos) devolve estes formatos.

export interface Endereco {
  /** Só dígitos. */
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface Socio {
  nome: string;
  qualificacao: string;
}

export interface Empresa {
  /** Só dígitos. */
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  naturezaJuridica: string;
  /** "4781400 - Comércio varejista de artigos do vestuário e acessórios". */
  cnaePrincipal: string;
  capitalSocial: number | null;
  situacao: string;
  endereco: Endereco & { numero: string; complemento: string };
  socios: Socio[];
}
