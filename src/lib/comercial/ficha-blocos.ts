import { formatarCep, formatarCnpj, formatarCpf } from "@/lib/documentos";
import { formatarData, formatarNumero } from "@/lib/formato";
import {
  type ConjugeFicha,
  type EnderecoFicha,
  LUC_NAO_SEI,
  type PessoaFicha,
  pedeConjuge,
  type RespostasFicha,
  ROTULO_TIPO,
} from "./ficha-respostas";

// ---------------------------------------------------------------------------
// Ficha em blocos (detalhe e PDF)
// ---------------------------------------------------------------------------

/** 22999998888 → (22) 99999-8888 */
export function formatarTelefone(d: string): string {
  if (d.length === 11)
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

/** Endereço numa linha: "RUA X, 120, SALA 2 · CENTRO · NOVA FRIBURGO/RJ · CEP 28610-000". */
export function formatarEndereco(e: EnderecoFicha): string {
  const rua = [e.logradouro, e.numero, e.complemento]
    .filter(Boolean)
    .join(", ");
  const cidade = [e.cidade, e.uf].filter(Boolean).join("/");
  return [rua, e.bairro, cidade, e.cep ? `CEP ${formatarCep(e.cep)}` : ""]
    .filter(Boolean)
    .join(" · ");
}

export interface ItemDoBloco {
  pergunta: number | null;
  rotulo: string;
  valor: string;
}

export interface BlocoDaFicha {
  titulo: string;
  itens: ItemDoBloco[];
}

const ou = (v: string) => v || "—";
const dataOu = (v: string) => (v ? formatarData(v) : "—");
const reais = (v: number | null) => (v === null ? "—" : formatarNumero(v, 2));
const tel = (v: string) => (v ? formatarTelefone(v) : "—");

function itensDaIdentificacao(
  x: PessoaFicha | ConjugeFicha,
  n: number[],
): ItemDoBloco[] {
  const doc = [x.doc_tipo, x.doc_numero].filter(Boolean).join(" ");
  const orgao = [x.orgao, x.orgao_uf].filter(Boolean).join("/");
  return [
    { pergunta: n[0] ?? null, rotulo: "Nome completo", valor: ou(x.nome) },
    { pergunta: n[1] ?? null, rotulo: "CPF", valor: ou(formatarCpf(x.cpf)) },
    {
      pergunta: n[2] ?? null,
      rotulo: "Documento de identificação",
      valor: ou(doc),
    },
    { pergunta: n[3] ?? null, rotulo: "Órgão expedidor", valor: ou(orgao) },
    {
      pergunta: n[4] ?? null,
      rotulo: "Data de expedição",
      valor: dataOu(x.expedicao),
    },
    {
      pergunta: n[5] ?? null,
      rotulo: "Data de nascimento",
      valor: dataOu(x.nascimento),
    },
    {
      pergunta: n[6] ?? null,
      rotulo: "Nacionalidade",
      valor: ou(x.nacionalidade),
    },
  ];
}

/** Todos os dados em blocos, na ordem das perguntas (detalhe e PDF). */
export function blocosDaFicha(
  r: RespostasFicha,
  lucRotulo: (luc: string) => string = (l) => l,
): BlocoDaFicha[] {
  const blocos: BlocoDaFicha[] = [
    {
      titulo: "Formulário",
      itens: [
        { pergunta: 1, rotulo: "E-mail", valor: ou(r.email) },
        {
          pergunta: 2,
          rotulo: "Consentimento LGPD",
          valor: r.aceite ? "Aceito" : "Não aceito",
        },
        {
          pergunta: 3,
          rotulo: "Imóvel pretendido",
          valor:
            r.luc === LUC_NAO_SEI
              ? "Ainda não sei"
              : r.luc
                ? lucRotulo(r.luc)
                : "—",
        },
        {
          pergunta: 4,
          rotulo: "Tipo de formulário",
          valor: r.tipo ? ROTULO_TIPO[r.tipo] : "—",
        },
      ],
    },
  ];
  if (!r.tipo) return blocos;

  if (r.tipo === "pj") {
    const e = r.empresa;
    blocos.push({
      titulo: "Pessoa jurídica",
      itens: [
        { pergunta: 6, rotulo: "CNPJ", valor: ou(formatarCnpj(e.cnpj)) },
        { pergunta: 5, rotulo: "Razão social", valor: ou(e.razao_social) },
        { pergunta: null, rotulo: "Nome fantasia", valor: ou(e.nome_fantasia) },
        { pergunta: 7, rotulo: "Natureza jurídica", valor: ou(e.natureza) },
        {
          pergunta: 8,
          rotulo: "Inscrição estadual",
          valor: e.ie_isento ? "ISENTO" : ou(e.ie),
        },
        {
          pergunta: 9,
          rotulo: "Inscrição municipal",
          valor: e.im_nao_tem ? "NÃO TEM" : ou(e.im),
        },
        { pergunta: 10, rotulo: "CNAE principal", valor: ou(e.cnae) },
        { pergunta: 11, rotulo: "Ramo de atuação", valor: ou(e.ramo) },
        {
          pergunta: 12,
          rotulo: "Endereço",
          valor: ou(formatarEndereco(e.endereco)),
        },
        {
          pergunta: 13,
          rotulo: "Capital social atual",
          valor: reais(e.capital_social),
        },
        {
          pergunta: 14,
          rotulo: "Última alteração social",
          valor: dataOu(e.ultima_alteracao),
        },
      ],
    });
  }

  const pessoas = r.tipo === "pj" ? r.pessoas : r.pessoas.slice(0, 1);
  pessoas.forEach((x, i) => {
    blocos.push({
      titulo:
        r.tipo === "pj"
          ? pessoas.length > 1
            ? `Sócio administrador ${i + 1}`
            : "Sócio administrador"
          : r.tipo === "fiador"
            ? "Fiador(a)"
            : "Locatário(a)",
      itens: [
        ...itensDaIdentificacao(x, [15, 16, 17, 18, 19, 20, 21]),
        { pergunta: 22, rotulo: "Estado civil", valor: ou(x.estado_civil) },
        {
          pergunta: 23,
          rotulo: "Endereço",
          valor: ou(formatarEndereco(x.endereco)),
        },
        { pergunta: 24, rotulo: "Telefone", valor: tel(x.telefone) },
        {
          pergunta: 25,
          rotulo: "Telefone secundário",
          valor: tel(x.telefone2),
        },
        { pergunta: 26, rotulo: "E-mail", valor: ou(x.email) },
      ],
    });
    if (pedeConjuge(x.estado_civil)) {
      const j = x.conjuge;
      blocos.push({
        titulo:
          pessoas.length > 1
            ? `Cônjuge ou convivente do sócio ${i + 1}`
            : "Cônjuge ou convivente",
        itens: [
          ...itensDaIdentificacao(j, [27, 28, 29, 31, 30, 32, 33]),
          {
            pergunta: 34,
            rotulo: "Profissão ou ocupação",
            valor: ou(j.profissao),
          },
          { pergunta: 35, rotulo: "Telefone", valor: tel(j.telefone) },
          {
            pergunta: 36,
            rotulo: "Telefone secundário",
            valor: tel(j.telefone2),
          },
          { pergunta: 37, rotulo: "E-mail", valor: ou(j.email) },
        ],
      });
    }
  });

  const d = r.renda;
  const patrimonio = d.patrimonio
    .map((x) =>
      x === "Outro" && d.patrimonio_outro ? `Outro: ${d.patrimonio_outro}` : x,
    )
    .join(", ");
  blocos.push(
    {
      titulo: "Dados profissionais e renda",
      itens: [
        { pergunta: 38, rotulo: "Profissão", valor: ou(d.profissao) },
        { pergunta: 39, rotulo: "Empresa", valor: ou(d.empresa) },
        {
          pergunta: 40,
          rotulo: "Endereço da empresa",
          valor: ou(formatarEndereco(d.endereco)),
        },
        { pergunta: 41, rotulo: "Telefone da empresa", valor: tel(d.telefone) },
        { pergunta: 42, rotulo: "E-mail da empresa", valor: ou(d.email) },
        { pergunta: 43, rotulo: "Renda mensal", valor: reais(d.renda) },
        {
          pergunta: 44,
          rotulo: "Referência pessoal",
          valor: ou(
            [
              d.referencia_nome,
              d.referencia_telefone && formatarTelefone(d.referencia_telefone),
            ]
              .filter(Boolean)
              .join(" · "),
          ),
        },
        {
          pergunta: 45,
          rotulo: "Outras rendas e origem",
          valor: ou(d.outras_rendas),
        },
        { pergunta: 46, rotulo: "Patrimônio", valor: ou(patrimonio) },
        {
          pergunta: 47,
          rotulo: "Paga aluguel?",
          valor:
            d.paga_aluguel === null
              ? "—"
              : d.paga_aluguel
                ? `Sim · ${[d.aluguel_nome, d.aluguel_telefone && formatarTelefone(d.aluguel_telefone)].filter(Boolean).join(" · ")}`
                : "Não",
        },
      ],
    },
    {
      titulo: "Envio",
      itens: [
        {
          pergunta: 48,
          rotulo: "Nome completo (envio)",
          valor: ou(r.assinatura),
        },
      ],
    },
  );
  return blocos;
}
