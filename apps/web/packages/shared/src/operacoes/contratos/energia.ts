import { z } from "zod";
import { LADOS, STATUS_CAIXA } from "../energia";
import { avisoSchema, TIPOS_ITEM } from "../energisa";

// Contratos da energia: as contas da área comum (faturas da Energisa), a
// consulta da energia solar, a importação das faturas e os quadros de
// medidores com o termo de autorização (spec 4.5 e 4.6).

const data = z.string();
const instante = z.string();
const papel = z.enum(["consome", "gera", "gera_e_consome"]);

// ---------------------------------------------------------------------------
// Contas da área comum e energia solar
// ---------------------------------------------------------------------------

export const unidadeEnergia = z.object({
  matricula: z.string(),
  apelido: z.string().nullable(),
  endereco: z.string().nullable(),
  classificacao: z.string().nullable(),
  ligacao: z.string().nullable(),
  papel,
  ativa: z.boolean(),
  exemplo: z.boolean(),
});

/** GET /operacoes/energia/unidades */
export const respostaUnidadesDeEnergia = z.object({
  unidades: z.array(unidadeEnergia),
});

/** GET /operacoes/energia/contas/meses: meses com fatura, do mais novo ao mais antigo. */
export const respostaMesesComFatura = z.object({ meses: z.array(data) });

/**
 * GET /operacoes/energia/solar/inversor: geração de cada mês ("aaaa-mm-01")
 * lida do inversor (Growatt), só os meses com algum dia lido, e o último dia.
 */
export const respostaGeracaoDoInversor = z.object({
  meses: z.array(z.object({ mes: data, kwh: z.number() })),
  ultimoDia: data.nullable(),
});
export type RespostaGeracaoDoInversor = z.infer<
  typeof respostaGeracaoDoInversor
>;

export const faturaConta = z.object({
  id: z.string(),
  matricula: z.string(),
  referencia: data,
  vencimento: data.nullable(),
  medidor: z.string().nullable(),
  consumo_kwh: z.number(),
  valor_consumo: z.number(),
  compensado_kwh: z.number(),
  valor_compensado: z.number(),
  injetada_kwh: z.number().nullable(),
  bandeira: z.string().nullable(),
  valor_bandeira: z.number(),
  iluminacao_publica: z.number(),
  icms: z.number(),
  pis_cofins: z.number(),
  total: z.number(),
  saldo_kwh: z.number().nullable(),
  expirar_kwh: z.number().nullable(),
  classificacao_gd: z.string().nullable(),
  arquivo: z.string().nullable(),
  exemplo: z.boolean(),
});

/**
 * GET /operacoes/energia/contas/faturas?mes=aaaa-mm-01: as faturas vigentes
 * dos 13 meses até o mês e os links dos PDFs do mês (só com a permissão das
 * contas).
 */
export const respostaFaturasAte = z.object({
  faturas: z.array(faturaConta),
  pdfs: z.record(z.string(), z.string()),
});

export const itemDaFatura = z.object({
  id: z.string(),
  ordem: z.number(),
  descricao: z.string(),
  tipo: z.string(),
  origem: z.enum(["oUC", "mUC"]).nullable(),
  mes_geracao: data.nullable(),
  unidade: z.string().nullable(),
  quantidade: z.number().nullable(),
  preco_unitario: z.number().nullable(),
  valor: z.number(),
  pis_cofins: z.number().nullable(),
  base_icms: z.number().nullable(),
  aliquota_icms: z.number().nullable(),
  icms: z.number().nullable(),
  tarifa_unitaria: z.number().nullable(),
});
export type ItemDaFatura = z.infer<typeof itemDaFatura>;

export const faturaDetalhe = faturaConta.extend({
  leitura_anterior_data: data.nullable(),
  leitura_atual_data: data.nullable(),
  proxima_leitura: data.nullable(),
  dias: z.number().nullable(),
  leitura_anterior: z.number().nullable(),
  leitura_atual: z.number().nullable(),
  nota_fiscal: z.string().nullable(),
  observacao: z.string().nullable(),
  importado_em: instante,
  vigente: z.boolean(),
  itens: z.array(itemDaFatura),
});
export type FaturaDetalhe = z.infer<typeof faturaDetalhe>;

/** GET /operacoes/energia/contas/faturas/:id */
export const respostaFatura = z.object({
  fatura: faturaDetalhe,
  pdf: z.string().nullable(),
});

/** GET /operacoes/energia/contas/creditos?mes=: créditos usados (itens "Injetada"). */
export const respostaCreditosDoMes = z.object({
  creditos: z.array(
    z.object({
      matricula: z.string(),
      origem: z.enum(["oUC", "mUC"]).nullable(),
      mes_geracao: data.nullable(),
      quantidade: z.number().nullable(),
      valor: z.number(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Importação das faturas da Energisa
// ---------------------------------------------------------------------------

export const previaFatura = z.object({
  importacaoId: z.string(),
  arquivo: z.string(),
  matricula: z.string(),
  unidade: z.object({ apelido: z.string().nullable(), papel }).nullable(),
  endereco: z.string().nullable(),
  classificacao: z.string().nullable(),
  ligacao: z.string().nullable(),
  referencia: data,
  vencimento: data.nullable(),
  consumoKwh: z.number(),
  compensadoKwh: z.number(),
  valorCompensado: z.number(),
  total: z.number(),
  somaItens: z.number(),
  bate: z.boolean(),
  bandeira: z.string().nullable(),
  saldoKwh: z.number().nullable(),
  expirarKwh: z.number().nullable(),
  itens: z.array(
    z.object({
      descricao: z.string(),
      tipo: z.enum(TIPOS_ITEM),
      quantidade: z.number().nullable(),
      valor: z.number(),
    }),
  ),
  avisos: z.array(avisoSchema),
  gravada: z.boolean(),
  media: z.object({ kwh: z.number(), meses: z.number() }).nullable(),
});

/** POST /operacoes/energia/contas/importacao (multipart, campo "arquivo") */
export const respostaLerFatura = z.object({
  previa: previaFatura,
  /** Prévia anterior da mesma fatura descartada para dar lugar a esta. */
  substituiu: z.boolean(),
});

/** GET /operacoes/energia/contas/importacao/previas */
export const respostaPreviasDeFatura = z.object({
  previas: z.array(previaFatura),
});

/** POST /operacoes/energia/contas/importacao/:id/unidade */
export const entradaCadastroDaUnidade = z.object({
  apelido: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : String(v).trim()),
    z.string().max(80, "máximo de 80 caracteres").nullable(),
  ),
  papel: z.enum(["consome", "gera", "gera_e_consome"], "escolha o papel"),
});

export const respostaCadastroDaUnidade = z.object({ previa: previaFatura });

/** POST /operacoes/energia/contas/importacao/:id/confirmar */
export const entradaConfirmarFatura = z.object({
  motivo: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : String(v).trim()),
    z.string().max(500, "motivo com no máximo 500 caracteres").nullable(),
  ),
});

// ---------------------------------------------------------------------------
// Quadros de medidores
// ---------------------------------------------------------------------------

export const quadro = z.object({
  id: z.string(),
  codigo: z.string(),
  nome: z.string(),
  bloco: z.string(),
  projeto: z.string().nullable(),
  subestacao: z.string().nullable(),
  roteiro_base: z.string().nullable(),
  armario: z.string().nullable(),
  disjuntor_geral: z.string().nullable(),
  espacos: z.number().nullable(),
  observacoes: z.string().nullable(),
  fotos: z.array(z.string()),
  ordem: z.number(),
  ativo: z.boolean(),
  exemplo: z.boolean(),
});
export type Quadro = z.infer<typeof quadro>;

export const resumoDoQuadro = z.object({
  quadro_id: z.string(),
  caixas: z.number(),
  ocupadas: z.number(),
  reservadas: z.number(),
  livres: z.number(),
  sem_termo: z.number(),
  locatarios_novos: z.number(),
});
export type ResumoDoQuadro = z.infer<typeof resumoDoQuadro>;

export const contratoEnet = z.object({
  bloco: z.string().nullable(),
  luc: z.string(),
  nome: z.string(),
  locatario: z.string(),
  documento: z.string().nullable(),
  contrato: z.string().nullable(),
  inicio: data.nullable(),
  fim: data.nullable(),
});

/** GET /operacoes/energia/quadros: quadros, contagem por quadro e contratos do ENET. */
export const respostaQuadros = z.object({
  quadros: z.array(quadro),
  resumo: z.array(resumoDoQuadro),
  contratos: z.array(contratoEnet),
});

export const caixa = z.object({
  id: z.string(),
  quadro_id: z.string(),
  numero: z.string(),
  numero_antigo: z.string().nullable(),
  lado: z.string(),
  coluna: z.number(),
  linha: z.number(),
  rota: z.string().nullable(),
  sala_id: z.string().nullable(),
  salas_texto: z.string().nullable(),
  pavimento: z.string().nullable(),
  status: z.string(),
  ocupante: z.string().nullable(),
  ocupante_documento: z.string().nullable(),
  ocupante_desde: data.nullable(),
  contrato: z.string().nullable(),
  ocupante_origem: z.string().nullable(),
  locatario_novo: z.boolean(),
  termo_externo: z.boolean(),
  disjuntor_amperes: z.number().nullable(),
  ligacao: z.string().nullable(),
  disjuntor_texto: z.string().nullable(),
  medidor_situacao: z.string().nullable(),
  medidor_numero: z.string().nullable(),
  modulo: z.string().nullable(),
  observacoes: z.string().nullable(),
  exemplo: z.boolean(),
  /** Sala como no painel (ou a do cadastro, no formato do termo). */
  sala: z.string().nullable(),
  /** Bloco da sala (o quadro do Bloco 04 atende salas do 03). */
  sala_bloco: z.string().nullable(),
  /** Unidade da sala ("101-102"), para ligar ao ENET. */
  sala_unidade: z.string().nullable(),
  /** Termos emitidos no sistema. */
  termos: z.number(),
  com_termo: z.boolean(),
});
export type Caixa = z.infer<typeof caixa>;

/** GET /operacoes/energia/caixas?quadro=<id> (sem quadro: todas). */
export const respostaCaixas = z.object({ caixas: z.array(caixa) });

export const sala = z.object({
  id: z.string(),
  codigo: z.string(),
  bloco: z.string(),
  sala: z.string(),
  pavimento: z.string().nullable(),
  caixas: z.number(),
});
export type Sala = z.infer<typeof sala>;

/** GET /operacoes/energia/salas */
export const respostaSalasDaEnergia = z.object({ salas: z.array(sala) });

/** GET /operacoes/energia/quadros/:id/fotos: links das fotos da sala de medidores. */
export const respostaFotosDoQuadro = z.object({
  fotos: z.array(z.object({ caminho: z.string(), url: z.string() })),
});

export const termoEmitido = z.object({
  id: z.string(),
  versao: z.number(),
  locatario: z.string(),
  documento: z.string(),
  bloco: z.string(),
  sala: z.string(),
  data_emissao: data,
  emitido_em: instante,
  emitidoPor: z.string(),
  temWord: z.boolean(),
});
export type TermoEmitido = z.infer<typeof termoEmitido>;

export const ocupanteAnterior = z.object({
  id: z.string(),
  nome: z.string(),
  documento: z.string().nullable(),
  entrada: data.nullable(),
  saida: data.nullable(),
  origem: z.string(),
});

/** GET /operacoes/energia/caixas/:id: tudo o que a ficha mostra (sem os parâmetros). */
export const respostaFichaDaCaixa = z.object({
  caixa: caixa.extend({ quadro }),
  termos: z.array(termoEmitido),
  /** null: sem a permissão do histórico (sigiloso). */
  historico: z.array(ocupanteAnterior).nullable(),
  /** Contrato vigente do ENET na sala da caixa. */
  enet: contratoEnet.nullable(),
  /** Salas para o cadastro (só para quem edita). */
  salas: z.array(sala),
});
export type RespostaFichaDaCaixa = z.infer<typeof respostaFichaDaCaixa>;

export const termoRecente = z.object({
  id: z.string(),
  caixa_id: z.string(),
  versao: z.number(),
  locatario: z.string(),
  bloco: z.string(),
  sala: z.string(),
  data_emissao: data,
  emitido_em: instante,
  temWord: z.boolean(),
});
export type TermoRecente = z.infer<typeof termoRecente>;

/** GET /operacoes/energia/termos: últimos termos emitidos (todas as caixas). */
export const respostaTermosRecentes = z.object({
  termos: z.array(termoRecente),
});

// ---------------------------------------------------------------------------
// Gravações dos quadros (os formulários mandam texto; a API converte)
// ---------------------------------------------------------------------------

const texto = (max: number) =>
  z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : String(v).trim()),
    z.string().max(max, `máximo de ${max} caracteres`).nullable(),
  );
const id = z.uuid("escolha um item da lista");
const idOpcional = z.preprocess((v) => (v ? v : null), id.nullable());
const dataIso = z.iso.date("data inválida");
const inteiro = (min: number, max: number) =>
  z.coerce
    .number("informe um número")
    .int("use um número inteiro")
    .min(min, `mínimo ${min}`)
    .max(max, `máximo ${max}`);
const marcado = z.preprocess((v) => v === "on" || v === "true", z.boolean());

/** POST /operacoes/energia/quadros (sem id cria; com id atualiza) */
export const entradaQuadro = z.object({
  id: z.preprocess((v) => (v ? v : undefined), id.optional()),
  codigo: z.preprocess(
    (v) => (v ? String(v).trim().toLowerCase() : undefined),
    z
      .string()
      .regex(/^[a-z0-9-]{1,20}$/, "use letras, números e hífen (ex.: b01)")
      .optional(),
  ),
  nome: z.string().trim().min(1, "informe o nome").max(80, "máximo de 80"),
  bloco: z
    .string()
    .trim()
    .transform((b) => b.padStart(2, "0"))
    .pipe(z.string().regex(/^\d{2}$/, "use o número do bloco (ex.: 04)")),
  projeto: texto(160),
  subestacao: texto(80),
  roteiro_base: texto(40),
  armario: texto(40),
  disjuntor_geral: texto(60),
  espacos: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : v),
    inteiro(2, 400)
      .refine((n) => n % 2 === 0, "metade de cada lado: use um número par")
      .nullable(),
  ),
  ordem: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? 0 : v),
    inteiro(0, 999),
  ),
  observacoes: texto(2000),
});
export type EntradaQuadro = z.infer<typeof entradaQuadro>;

/** POST /operacoes/energia/caixas (sem id cria; com id atualiza) */
export const entradaCaixa = z.object({
  id: z.preprocess((v) => (v ? v : undefined), id.optional()),
  quadro_id: id,
  numero: z
    .string()
    .trim()
    .min(1, "informe o número (giz ou plaqueta)")
    .max(30, "máximo de 30"),
  numero_antigo: texto(30),
  lado: z.enum(LADOS, "escolha o lado"),
  coluna: inteiro(1, 40),
  linha: inteiro(1, 80),
  rota: texto(60),
  sala_id: idOpcional,
  salas_texto: texto(80),
  pavimento: texto(60),
  status: z.enum(STATUS_CAIXA, "escolha o status"),
  disjuntor: z.string().max(40).default(""),
  medidor_situacao: texto(60),
  medidor_numero: texto(40),
  modulo: texto(30),
  observacoes: texto(2000),
  termo_externo: marcado,
});
export type EntradaCaixa = z.infer<typeof entradaCaixa>;

/** Resposta de criar quadro ou caixa: a tela navega para o novo. */
export const respostaCriado = z.object({
  mensagem: z.string(),
  /** Quadro: o código; caixa: o id. */
  codigo: z.string().optional(),
  id: z.string().optional(),
});

/** POST /operacoes/energia/caixas/:id/locatario (troca à mão) */
export const entradaTroca = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "informe o novo locatário")
    .max(200, "máximo de 200"),
  documento: texto(30),
  desde: dataIso,
  contrato: texto(40),
});
export type EntradaTroca = z.infer<typeof entradaTroca>;

/** POST /operacoes/energia/caixas/:id/liberar */
export const entradaLiberar = z.object({
  saida: dataIso,
  status: z.enum(["livre", "reservado"], "escolha como a caixa fica"),
});
export type EntradaLiberar = z.infer<typeof entradaLiberar>;

/** POST /operacoes/energia/caixas/:id/termos */
export const entradaTermo = z.object({
  data_emissao: dataIso,
  locatario: z.string().trim().min(1, "informe o locatário").max(200),
  documento: z.string().trim().min(1, "informe o CPF ou CNPJ").max(30),
  qualificacao: z.string().trim().max(120).default(""),
  bloco: z.string().trim().min(1, "informe o bloco").max(40),
  pavimento: z.string().trim().max(60).default(""),
  sala: z.string().trim().min(1, "informe a sala ou loja").max(80),
  projeto: z.string().trim().max(160).default(""),
  amperes: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : v),
    inteiro(1, 1000).nullable(),
  ),
  ligacao: z.string().trim().max(20).default(""),
  armario: z.string().trim().max(40).default(""),
  rota: z.string().trim().max(60).default(""),
  observacao_tecnica: z.string().trim().max(1000).default(""),
});
export type EntradaTermo = z.infer<typeof entradaTermo>;

/** POST /operacoes/energia/quadros/:id/fotos/envio */
export const entradaEnvioDeFoto = z.object({
  nome: z.string().min(1).max(255),
  tamanho: z.number().int().positive(),
});

/** POST /operacoes/energia/quadros/:id/fotos (depois do envio) */
export const entradaRegistrarFoto = z.object({ caminho: z.string().max(400) });
