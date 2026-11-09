import { z } from "zod";
import { documentoValido, formatarDocumento } from "@/lib/documentos";
import { lerValorBr } from "@/lib/formato";

// Saída do ativo (ajuste do Chamados na spec de Operações): venda, doação,
// descarte, devolução ou outro destino. Regras puras: o formulário, o rótulo
// "Baixado – Vendido", os filtros do relatório e o total vendido (centavos).
// Os tipos e as formas de recebimento vêm de os.parametros (editáveis).

/** Tipo que exige valor (o banco também confere: check em os.ativo_saidas). */
export const TIPO_VENDA = "Venda";

const sem = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export const ehVenda = (tipo: string) => sem(tipo) === sem(TIPO_VENDA);

/**
 * "Vendido", "Doado"… como o banco grava em os.ativos.baixa_motivo
 * (os.registrar_saida_ativo); outro tipo fica como está.
 */
export function rotuloDaSaida(tipo: string): string {
  const PARTICIPIOS: Record<string, string> = {
    venda: "Vendido",
    doacao: "Doado",
    descarte: "Descartado",
    devolucao: "Devolvido",
  };
  return PARTICIPIOS[sem(tipo)] ?? tipo.trim();
}

/** Valor em reais → centavos inteiros (arredonda o meio centavo para cima). */
export const centavos = (v: number | null | undefined) =>
  v === null || v === undefined ? 0 : Math.round(v * 100);

// ---------------------------------------------------------------------------
// Formulário
// ---------------------------------------------------------------------------

const vazioNulo = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;
const texto = (max: number) =>
  z.preprocess(
    vazioNulo,
    z.string().trim().max(max, `até ${max} caracteres`).nullable(),
  );
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "informe a data");

export const LIMITE_ANEXOS = 6;

/** Campos da saída (o ativo ou a sobra vêm à parte). */
export function esquemaDaSaida(listas: { tipos: string[]; formas: string[] }) {
  return z
    .object({
      tipo: z
        .string()
        .trim()
        .refine((t) => listas.tipos.includes(t), "escolha um tipo da lista"),
      data,
      quantidade: texto(60),
      valor: z.preprocess(
        (v) => (typeof v === "string" ? lerValorBr(v) : v),
        z
          .number("valor inválido")
          .min(0, "não pode ser negativo")
          .max(100_000_000, "valor alto demais")
          .nullable(),
      ),
      forma: z.preprocess(
        vazioNulo,
        z
          .string()
          .trim()
          .refine((f) => listas.formas.includes(f), "escolha da lista")
          .nullable(),
      ),
      recebido_por: texto(120),
      destinatario: texto(200),
      documento: z.preprocess(
        vazioNulo,
        z
          .string()
          .trim()
          .refine(documentoValido, "CPF ou CNPJ inválido")
          .transform((d) => d.replace(/\D/g, ""))
          .nullable(),
      ),
      responsavel_id: z.preprocess(vazioNulo, z.uuid().nullable()),
      motivo: texto(500),
      nf: z.preprocess((v) => v === "sim", z.boolean()),
      nf_numero: texto(60),
      observacoes: texto(2000),
    })
    .superRefine((s, ctx) => {
      if (ehVenda(s.tipo) && s.valor === null)
        ctx.addIssue({
          code: "custom",
          path: ["valor"],
          message: "obrigatório na venda (pode ser zero ou simbólico)",
        });
      if (s.nf && !s.nf_numero)
        ctx.addIssue({
          code: "custom",
          path: ["nf_numero"],
          message: "informe o número da nota",
        });
    })
    .transform((s) => ({ ...s, nf_numero: s.nf ? s.nf_numero : null }));
}

export type DadosDaSaida = z.infer<ReturnType<typeof esquemaDaSaida>>;

export const ROTULOS_SAIDA: Record<string, string> = {
  ativo_id: "Ativo",
  nome: "O que está saindo",
  categoria_id: "Categoria",
  bloco: "Bloco",
  area: "Local",
  tipo: "Tipo de saída",
  data: "Data",
  quantidade: "Quantidade",
  valor: "Valor",
  forma: "Forma de recebimento",
  recebido_por: "Quem recebeu",
  destinatario: "Destinatário",
  documento: "CPF ou CNPJ",
  responsavel_id: "Responsável",
  motivo: "Motivo",
  nf_numero: "Número da nota fiscal",
  observacoes: "Observações",
  anexos: "Anexos",
};

/** Listas dos parâmetros: sem vazios nem repetidos (sem diferenciar acento). */
export function limparListaDeSaida(itens: string[], max = 30): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const bruto of itens) {
    const t = bruto.trim().slice(0, 40);
    if (!t || vistos.has(sem(t))) continue;
    vistos.add(sem(t));
    lista.push(t);
  }
  return lista.slice(0, max);
}

/** Nome do anexo guardado (o caminho termina em "<aleatório>-<nome>"). */
export const nomeDoAnexo = (caminho: string) =>
  caminho.slice(caminho.lastIndexOf("/") + 1).replace(/^[0-9a-f]{12}-/, "");

export const textoDoDocumento = (d: string | null) =>
  d ? formatarDocumento(d) : "";

// ---------------------------------------------------------------------------
// Relatório de saídas (?de=…&ate=…&tipo=…&resp=…&desfeitas=1)
// ---------------------------------------------------------------------------

export interface FiltroSaidas {
  de: string | null;
  ate: string | null;
  tipo: string | null;
  responsavel: string | null;
  desfeitas: boolean;
}

const primeiro = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const dataOuNulo = z.preprocess(
  primeiro,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .catch(null),
);

const esquemaFiltro = z.object({
  de: dataOuNulo,
  ate: dataOuNulo,
  tipo: z.preprocess(
    primeiro,
    z.string().trim().min(1).max(40).nullable().catch(null),
  ),
  resp: z.preprocess(primeiro, z.uuid().nullable().catch(null)),
  desfeitas: z.preprocess((v) => primeiro(v) === "1", z.boolean()),
});

/** Valor inválido na URL vira "sem filtro"; datas trocadas, o intervalo certo. */
export function lerFiltroSaidas(
  busca: Record<string, string | string[] | undefined>,
): FiltroSaidas {
  const f = esquemaFiltro.parse({
    de: busca.de ?? null,
    ate: busca.ate ?? null,
    tipo: busca.tipo ?? null,
    resp: busca.resp ?? null,
    desfeitas: busca.desfeitas,
  });
  const [de, ate] =
    f.de && f.ate && f.de > f.ate ? [f.ate, f.de] : [f.de, f.ate];
  return {
    de,
    ate,
    tipo: f.tipo,
    responsavel: f.resp,
    desfeitas: f.desfeitas,
  };
}

export interface SaidaResumo {
  tipo: string;
  valor: number | null;
  desfeita: boolean;
}

/** Quantidade por tipo e total vendido (só saídas valendo), em centavos. */
export function totaisDasSaidas(saidas: SaidaResumo[]): {
  quantidade: number;
  vendidoCentavos: number;
  porTipo: { tipo: string; quantidade: number; centavos: number }[];
} {
  const valendo = saidas.filter((s) => !s.desfeita);
  const porTipo = new Map<string, { quantidade: number; centavos: number }>();
  for (const s of valendo) {
    const t = porTipo.get(s.tipo) ?? { quantidade: 0, centavos: 0 };
    t.quantidade++;
    t.centavos += centavos(s.valor);
    porTipo.set(s.tipo, t);
  }
  return {
    quantidade: valendo.length,
    vendidoCentavos: valendo
      .filter((s) => ehVenda(s.tipo))
      .reduce((soma, s) => soma + centavos(s.valor), 0),
    porTipo: [...porTipo.entries()]
      .map(([tipo, t]) => ({ tipo, ...t }))
      .sort((a, b) => b.quantidade - a.quantidade),
  };
}
