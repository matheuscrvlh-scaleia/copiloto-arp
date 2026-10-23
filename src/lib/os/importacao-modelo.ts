import { z } from "zod";

// Formato intermediário da importação única do sistema de OS atual (O.S Arp
// 4.42, spec 4.14). Ainda não temos o formato do "Backup Geral" que o
// sistema gera (o código está com a ARP): a importação inteira trabalha
// sobre este formato, e cada leitor (o pacote ZIP com JSON/CSV daqui, e o
// leitor do Backup Geral quando o formato chegar) só precisa traduzir o
// arquivo para ele. Os campos aceitam o jeito brasileiro (datas dd/mm/aaaa,
// decimais com vírgula), para o conversor não ter de reformatar nada.

// ---------------------------------------------------------------------------
// Campos tolerantes
// ---------------------------------------------------------------------------

const vazio = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** "1.234,56", "0,4485", "1234.5", 12 → número; vazio → null. */
export function lerNumero(v: unknown): number | null | unknown {
  if (vazio(v)) return null;
  if (typeof v === "number") return v;
  const t = String(v).replace(/R\$|\s/g, "");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$|^-?\d+,\d+$/.test(t))
    return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return v;
}

/** "21/10/2026", "2026-10-21" ou "2026-10-21T08:00" → "2026-10-21". */
export function lerData(v: unknown): string | null | unknown {
  if (vazio(v)) return null;
  const t = String(v).trim();
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (br)
    return `${br[3]}-${br[2]?.padStart(2, "0")}-${br[1]?.padStart(2, "0")}`;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(t);
  return iso ? iso[1] : v;
}

/** "8:00", "08:00:00" → "08:00". */
export function lerHora(v: unknown): string | null | unknown {
  if (vazio(v)) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v).trim());
  return m ? `${m[1]?.padStart(2, "0")}:${m[2]}` : v;
}

/**
 * Data e hora → ISO com o fuso de Brasília quando vier sem fuso:
 * "21/10/2026 08:05" → "2026-10-21T08:05:00-03:00".
 */
export function lerDataHora(v: unknown): string | null | unknown {
  if (vazio(v)) return null;
  const t = String(v).trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(t) && /^\d{4}-\d{2}-\d{2}T/.test(t))
    return t;
  const data = lerData(t);
  if (typeof data !== "string") return v;
  const hora = /[ T](\d{1,2}:\d{2})(:\d{2})?/.exec(t);
  const hh = hora ? (lerHora(hora[1]) as string) : "00:00";
  return `${data}T${hh}:00-03:00`;
}

/** "sim", "S", "true", 1 → true. */
function lerSimNao(v: unknown): boolean | unknown {
  if (vazio(v)) return undefined;
  if (typeof v === "boolean") return v;
  const t = String(v).trim().toLowerCase();
  if (["sim", "s", "true", "1", "x"].includes(t)) return true;
  if (["nao", "não", "n", "false", "0"].includes(t)) return false;
  return v;
}

/** Lista: array ou texto separado por "|" (no CSV). */
function lerLista(v: unknown): unknown {
  if (vazio(v)) return [];
  if (typeof v === "string")
    return v
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  return v;
}

const texto = z.preprocess(
  (v) => (vazio(v) ? undefined : String(v).trim()),
  z.string().optional(),
);
const obrigatorio = z.preprocess(
  (v) => (vazio(v) ? "" : String(v).trim()),
  z.string().min(1, "não pode ficar vazio"),
);
const id = z.preprocess(
  (v) => (vazio(v) ? "" : String(v).trim()),
  z.string().min(1, "sem identificador"),
);
const numero = z.preprocess(lerNumero, z.number().nullable().optional());
const inteiro = z.preprocess(
  lerNumero,
  z.number().int("número inteiro").positive("número maior que zero"),
);
const data = z.preprocess(
  lerData,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida")
    .nullable()
    .optional(),
);
const dataObrigatoria = z.preprocess(
  lerData,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida"),
);
const hora = z.preprocess(
  lerHora,
  z
    .string()
    .regex(/^\d{2}:\d{2}$/, "hora inválida")
    .nullable()
    .optional(),
);
const horaObrigatoria = z.preprocess(
  lerHora,
  z.string().regex(/^\d{2}:\d{2}$/, "hora inválida"),
);
const dataHora = z.preprocess(
  lerDataHora,
  z.iso
    .datetime({ offset: true, error: "data e hora inválidas" })
    .nullable()
    .optional(),
);
const dataHoraObrigatoria = z.preprocess(
  lerDataHora,
  z.iso.datetime({ offset: true, error: "data e hora inválidas" }),
);
const simNao = z.preprocess(lerSimNao, z.boolean().optional());
const lista = <T extends z.ZodType>(s: T) => z.preprocess(lerLista, z.array(s));

// ---------------------------------------------------------------------------
// Registros
// ---------------------------------------------------------------------------

export const esquemaFoto = z.preprocess(
  (v) => (typeof v === "string" ? { arquivo: v } : v),
  z.object({
    /** Caminho no pacote ("fotos/123_antes.jpg") ou só o nome do arquivo. */
    arquivo: obrigatorio,
    tipo: z.preprocess(
      (v) => (vazio(v) ? "foto" : String(v).trim().toLowerCase()),
      z.enum(["foto", "antes", "depois"]),
    ),
    legenda: texto,
  }),
);
export type FotoLegado = z.infer<typeof esquemaFoto>;

export const esquemaTecnico = z.object({
  id,
  nome: obrigatorio,
  valor_minuto: numero,
  desligado_em: data,
});

export const esquemaTipoServico = z.object({
  id,
  nome: obrigatorio,
  /** Tipo de serviço das OS de terceirizados. */
  terceirizado: simNao,
});

export const esquemaProfissional = z.object({
  id,
  nome: obrigatorio,
  /** Nome da empresa terceirizada (vira o cadastro da empresa). */
  empresa: obrigatorio,
  telefone: texto,
  servicos: texto,
});

export const esquemaEquipamento = z.object({
  id,
  nome: obrigatorio,
  bloco: texto,
  local: texto,
  fabricante: texto,
  modelo: texto,
  numero_serie: texto,
  /** Contato do fornecedor do equipamento (vira contato salvo). */
  fornecedor: texto,
  fornecedor_contato: texto,
  fornecedor_telefone: texto,
  observacao: texto,
});

export const esquemaContato = z.object({
  id,
  nome: obrigatorio,
  telefone: obrigatorio,
  empresa: texto,
  observacao: texto,
});

export const esquemaSessao = z.object({
  data: dataObrigatoria,
  inicio: horaObrigatoria,
  fim: hora,
  almoco_inicio: hora,
  almoco_fim: hora,
  /** Ids dos técnicos (os de tecnicos.json). */
  tecnicos: lista(z.string()),
});

export const esquemaMaterial = z.object({
  descricao: obrigatorio,
  quantidade: z.preprocess(
    lerNumero,
    z.number().positive("quantidade maior que zero"),
  ),
  unidade: texto,
  valor_unitario: numero,
});

export const esquemaRateio = z
  .object({
    /** "Por colaborador / hora trabalhada", "Divisão manual", "Porcentagem…", "Terceirizado". */
    regra: obrigatorio,
    /** Reais (manual) ou % (porcentagem). */
    valor: numero,
  })
  .nullable()
  .optional();

/** Valores do sistema atual, para a conferência centavo a centavo. */
export const esquemaValoresLegado = z
  .object({
    valor_total: numero,
    valor_rateio: numero,
    minutos: numero,
    minuto_homem: numero,
  })
  .partial()
  .optional();

const baseOS = {
  numero: inteiro,
  status: obrigatorio,
  /** Id (ou nome) do tipo de serviço. */
  tipo_servico: texto,
  titulo: texto,
  descricao: texto,
  local: texto,
  bloco: texto,
  solicitante: texto,
  aberta_em: dataHoraObrigatoria,
  concluida_em: dataHora,
  solucao: texto,
  rateio: esquemaRateio,
  legado: esquemaValoresLegado,
  fotos: lista(esquemaFoto),
};

export const esquemaOsInterna = z.object({
  ...baseOS,
  /** Id do equipamento (equipamentos.json). */
  equipamento: texto,
  sessoes: lista(esquemaSessao),
  materiais: lista(esquemaMaterial),
});

export const esquemaOsTerceirizada = z.object({
  ...baseOS,
  empresa: texto,
  /** Ids dos profissionais (profissionais.json). */
  profissionais: lista(z.string()),
  visita_data: data,
  visita_periodo: texto,
  valor: numero,
  orcamento: texto,
});

export const esquemaTarefa = z.object({
  id,
  titulo: obrigatorio,
  descricao: texto,
  status: obrigatorio,
  criada_em: dataHoraObrigatoria,
  prazo: dataHora,
  concluida_em: dataHora,
  /** Nome de quem cuida (ligado ao usuário pelo nome, quando houver). */
  responsavel: texto,
  /** Número da OS em que a tarefa foi convertida. */
  os_numero: z.preprocess(
    lerNumero,
    z.number().int().positive().nullable().optional(),
  ),
});

export const esquemaAmbiente = z.object({
  titulo: obrigatorio,
  resposta: texto,
  descricao: texto,
  problema: simNao,
  fotos: lista(esquemaFoto),
});

export const esquemaVistoria = z.object({
  /** ARP01, ARP02… (mantido). */
  codigo: obrigatorio,
  tipo: obrigatorio,
  status: obrigatorio,
  data: dataObrigatoria,
  hora,
  vistoriador: obrigatorio,
  locatario: obrigatorio,
  bloco: obrigatorio,
  unidade: obrigatorio,
  campo_tipo: texto,
  itens_anteriores: texto,
  observacao: texto,
  consideracoes: texto,
  termo: texto,
  ambientes: lista(esquemaAmbiente),
  assinatura_locador: texto,
  assinatura_locatario: texto,
});

export const esquemaCompromisso = z.object({
  id,
  titulo: obrigatorio,
  inicio: dataHoraObrigatoria,
  fim: dataHora,
  /** Nome da agenda do módulo (ex.: Telhado); sem ela, a dos compromissos antigos. */
  agenda: texto,
  status: texto,
  observacao: texto,
});

export const esquemaRegistro = z.object({
  em: dataHoraObrigatoria,
  usuario: texto,
  texto: obrigatorio,
  /** A que se refere: número da OS ou id da tarefa. */
  os_numero: z.preprocess(
    lerNumero,
    z.number().int().positive().nullable().optional(),
  ),
  tarefa_id: texto,
});

export const TIPOS_DE_REGISTRO = {
  os_internas: "OS internas",
  os_terceirizadas: "OS de terceirizados",
  tarefas: "Tarefas",
  vistorias: "Vistorias",
  tecnicos: "Técnicos",
  tipos_servico: "Tipos de serviço",
  profissionais: "Profissionais terceirizados",
  equipamentos: "Equipamentos",
  contatos: "Contatos do WhatsApp",
  compromissos: "Compromissos",
  registros: "Registro de atividades",
} as const;
export type TipoDeRegistro = keyof typeof TIPOS_DE_REGISTRO;

export const ESQUEMAS = {
  os_internas: esquemaOsInterna,
  os_terceirizadas: esquemaOsTerceirizada,
  tarefas: esquemaTarefa,
  vistorias: esquemaVistoria,
  tecnicos: esquemaTecnico,
  tipos_servico: esquemaTipoServico,
  profissionais: esquemaProfissional,
  equipamentos: esquemaEquipamento,
  contatos: esquemaContato,
  compromissos: esquemaCompromisso,
  registros: esquemaRegistro,
} as const;

export type Registro<T extends TipoDeRegistro> = z.infer<(typeof ESQUEMAS)[T]>;
export type OsInterna = Registro<"os_internas">;
export type OsTerceirizada = Registro<"os_terceirizadas">;
export type TarefaLegado = Registro<"tarefas">;
export type VistoriaLegado = Registro<"vistorias">;
export type TecnicoLegado = Registro<"tecnicos">;

export const esquemaManifesto = z.object({
  sistema: texto,
  versao: texto,
  gerado_em: texto,
  /** Quantos registros de cada tipo o sistema atual tem (a conferência). */
  totais: z
    .partialRecord(
      z.enum(
        Object.keys(TIPOS_DE_REGISTRO) as [TipoDeRegistro, ...TipoDeRegistro[]],
      ),
      z.preprocess(lerNumero, z.number().int().min(0)),
    )
    .default({}),
});
export type Manifesto = z.infer<typeof esquemaManifesto>;

// ---------------------------------------------------------------------------
// Pacote e leitores
// ---------------------------------------------------------------------------

/** Um arquivo do que foi enviado (solto ou de dentro de um ZIP). */
export interface ArquivoDoPacote {
  /** Caminho com "/" (ex.: "fotos/123_antes.jpg"). */
  nome: string;
  tamanho: number;
  ler(): Promise<Uint8Array>;
}

/** Linha que não entrou: arquivo, linha e o motivo. */
export interface LinhaRecusada {
  tipo: TipoDeRegistro;
  arquivo: string;
  linha: number;
  motivo: string;
}

/** O sistema atual inteiro, no formato intermediário. */
export interface PacoteImportacao {
  manifesto: Manifesto;
  registros: { [T in TipoDeRegistro]: Registro<T>[] };
  recusadas: LinhaRecusada[];
  /** Fotos e assinaturas (para conferir as faltantes e copiar). */
  arquivos: ArquivoDoPacote[];
}

/**
 * Ponto de extensão: cada formato de backup tem um leitor que traduz os
 * arquivos enviados para o PacoteImportacao. O leitor do pacote ZIP com
 * JSON/CSV está em importacao-leitor.ts; o do "Backup Geral" do O.S Arp 4.42
 * entra quando a ARP passar o formato (banco e pasta de fotos).
 */
export interface LeitorDeBackup {
  chave: string;
  nome: string;
  /** Este leitor entende estes arquivos? */
  reconhece(arquivos: ArquivoDoPacote[]): boolean;
  ler(arquivos: ArquivoDoPacote[]): Promise<PacoteImportacao>;
}

/**
 * Layout do pacote, mostrado na tela para quem for escrever o conversor do
 * Backup Geral. Mantém-se igual aos esquemas acima.
 */
export const LAYOUT_DO_PACOTE = `Pacote de importação (um ou mais arquivos .zip, ou os arquivos soltos)

manifesto.json            obrigatório
  { "sistema": "O.S Arp 4.42", "versao": "4.42", "gerado_em": "2026-10-23",
    "totais": { "os_internas": 1234, "os_terceirizadas": 210, "tarefas": 380,
                "vistorias": 27, "tecnicos": 9, "tipos_servico": 14,
                "profissionais": 22, "equipamentos": 120, "contatos": 85,
                "compromissos": 40, "registros": 15000 } }
  Os totais são contados no sistema atual: a prévia compara com o que foi lido
  e só deixa confirmar se todos baterem.

Arquivos de dados: <tipo>.json (lista de objetos) ou <tipo>.csv (cabeçalho na
primeira linha, separador ; ou ,). Listas dentro de um campo do CSV vão
separadas por "|". Datas dd/mm/aaaa ou aaaa-mm-dd; data e hora
"dd/mm/aaaa hh:mm" (horário de Brasília); decimais com vírgula ou ponto.

tecnicos           id, nome, valor_minuto, desligado_em
tipos_servico      id, nome, terceirizado (sim/não)
profissionais      id, nome, empresa, telefone, servicos
equipamentos       id, nome, bloco, local, fabricante, modelo, numero_serie,
                   fornecedor, fornecedor_contato, fornecedor_telefone, observacao
contatos           id, nome, telefone, empresa, observacao   (contatos do WhatsApp)
tarefas            id, titulo, descricao, status, criada_em, prazo, concluida_em,
                   responsavel (nome), os_numero (se foi convertida em OS)
compromissos       id, titulo, inicio, fim, agenda, status, observacao
registros          em, usuario, texto, os_numero ou tarefa_id   (registro de atividades)

Só JSON (têm listas dentro):
os_internas.json   [{ numero, status, tipo_servico, titulo, descricao, local, bloco,
                      solicitante, aberta_em, concluida_em, solucao, equipamento,
                      sessoes: [{ data, inicio, fim, almoco_inicio, almoco_fim,
                                  tecnicos: [id, …] }],
                      materiais: [{ descricao, quantidade, unidade, valor_unitario }],
                      rateio: { regra, valor } | null,
                      legado: { valor_total, valor_rateio, minutos, minuto_homem },
                      fotos: [{ arquivo, tipo: antes|depois|foto, legenda }] }]
os_terceirizadas.json
                   [{ numero, status, tipo_servico, titulo, descricao, local, bloco,
                      aberta_em, concluida_em, empresa, profissionais: [id, …],
                      visita_data, visita_periodo (manhã/tarde/noite), solucao,
                      valor, orcamento, rateio, legado, fotos }]
vistorias.json     [{ codigo (ARP01…), tipo, status, data, hora, vistoriador,
                      locatario, bloco, unidade, campo_tipo, itens_anteriores,
                      observacao, consideracoes, termo,
                      assinatura_locador, assinatura_locatario (arquivos),
                      ambientes: [{ titulo, resposta, descricao, problema,
                                    fotos: [arquivo, …] }] }]

fotos/…            as fotos e assinaturas citadas nos dados (o caminho no campo
                   "arquivo", ou só o nome do arquivo). Pode vir em vários .zip.

Não entram: usuários e senhas, itens da lixeira, configurações visuais.`;
