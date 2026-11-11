import { z } from "zod";
import { numeroBr as numeroDaPlanilha } from "./agua";

// Conta da concessionária de água (macromedidor do prédio): os campos que
// ficam guardados como dado, a validação do formulário e a sugestão lida do
// texto do PDF. A conta chega em PDF ou foto; o arquivo fica guardado como
// comprovante e quem importa confere (ou digita) os campos ao lado dele.
// Sem amostra real da conta, a sugestão só preenche o que achar com
// segurança: nada entra sem a pessoa conferir e confirmar.

export const LIMITE_CONTA_BYTES = 10 * 1024 * 1024;

/** PDF, JPG, PNG ou WEBP pelo começo do arquivo (não pela extensão). */
export function tipoDoComprovante(
  b: Uint8Array,
): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | null {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46)
    return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "image/png";
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return "image/webp";
  return null;
}

// ---------------------------------------------------------------------------
// Campos (formulário → banco)
// ---------------------------------------------------------------------------

/**
 * "1.632,06", "4.312" (milhar) ou "1632.06" → número; vazio ou ilegível →
 * null. Mesma leitura da planilha da água (lib/operacoes/agua).
 */
export function numeroBr(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const n = numeroDaPlanilha(v);
  return n !== null && Number.isFinite(n) ? n : null;
}

const numero = (rotulo: string, casas: number) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) return null;
      const n = numeroBr(v);
      if (n === null || n < 0) {
        ctx.addIssue({
          code: "custom",
          message: `${rotulo}: número inválido.`,
        });
        return z.NEVER;
      }
      return Math.round(n * 10 ** casas) / 10 ** casas;
    });

const data = (rotulo: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
        ctx.addIssue({ code: "custom", message: `${rotulo}: data inválida.` });
        return z.NEVER;
      }
      return v;
    });

export const esquemaConta = z
  .object({
    referencia: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Escolha o mês de referência.")
      .transform((m) => `${m}-01`),
    matricula: z
      .string()
      .trim()
      .min(1, "Informe a matrícula da conta.")
      .max(40, "Matrícula com até 40 caracteres."),
    vencimento: data("Vencimento"),
    data_anterior: data("Data da leitura anterior"),
    data_atual: data("Data da leitura atual"),
    leitura_anterior: numero("Leitura anterior", 3),
    leitura_atual: numero("Leitura atual", 3),
    consumo_m3: numero("Consumo", 3),
    valor_agua: numero("Valor da água", 2),
    valor_esgoto: numero("Valor do esgoto", 2),
    total: numero("Total", 2).refine((t) => t !== null, {
      message: "Informe o total da conta.",
    }),
    observacao: z
      .string()
      .trim()
      .max(500, "Observação com até 500 letras.")
      .optional()
      .transform((v) => v || null),
  })
  .superRefine((c, ctx) => {
    if (c.data_anterior && c.data_atual && c.data_anterior > c.data_atual)
      ctx.addIssue({
        code: "custom",
        message: "A leitura anterior não pode ser depois da atual.",
      });
  })
  .transform((c) => ({ ...c, total: c.total as number }));

export type ContaAgua = z.output<typeof esquemaConta>;

/** Avisos (não bloqueiam) das contas que a pessoa confere antes de confirmar. */
export function conferirConta(c: ContaAgua): string[] {
  const avisos: string[] = [];
  if (c.leitura_anterior !== null && c.leitura_atual !== null) {
    const medido = Math.round((c.leitura_atual - c.leitura_anterior) * 1000);
    if (medido < 0)
      avisos.push(
        "A leitura atual é menor que a anterior (troca do medidor?).",
      );
    else if (
      c.consumo_m3 !== null &&
      medido !== Math.round(c.consumo_m3 * 1000)
    )
      avisos.push(
        `O consumo (${c.consumo_m3}) é diferente de leitura atual menos anterior (${medido / 1000}).`,
      );
  }
  if (c.valor_agua !== null || c.valor_esgoto !== null) {
    const soma =
      Math.round((c.valor_agua ?? 0) * 100) +
      Math.round((c.valor_esgoto ?? 0) * 100);
    if (soma > Math.round(c.total * 100))
      avisos.push("Água mais esgoto passa do total da conta.");
  }
  return avisos;
}

// ---------------------------------------------------------------------------
// Sugestão lida do texto do PDF
// ---------------------------------------------------------------------------

export interface SugestaoConta {
  referencia?: string; // aaaa-mm
  matricula?: string;
  vencimento?: string; // aaaa-mm-dd
  consumo_m3?: string; // como no texto ("4.312")
  total?: string; // "1.234,56"
}

const MESES: Record<string, string> = {
  jan: "01",
  fev: "02",
  mar: "03",
  abr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  set: "09",
  out: "10",
  nov: "11",
  dez: "12",
};

const dataIso = (d: string) => {
  const [dia, mes, ano] = d.split("/");
  return `${ano}-${mes}-${dia}`;
};

/**
 * Procura no texto da conta os campos com rótulo claro (matrícula,
 * referência, vencimento, consumo em m³ e total a pagar). O que não achar
 * fica em branco para a pessoa digitar.
 */
export function sugerirDoTexto(texto: string): SugestaoConta {
  const t = texto.replace(/\s+/g, " ");
  const s: SugestaoConta = {};
  const matricula =
    /matr[íi]cula\s*(?:n[º°o.]*)?\s*:?\s*([0-9][0-9./-]{2,24}[0-9])/i.exec(t);
  if (matricula?.[1]) s.matricula = matricula[1];
  const ref =
    /(?:refer[êe]ncia|m[êe]s\s*(?:de\s*)?refer[êe]ncia|compet[êe]ncia)\s*:?\s*(\d{2})\s*\/\s*(\d{4})/i.exec(
      t,
    ) ??
    /(?:refer[êe]ncia|compet[êe]ncia)\s*:?\s*([a-zç]{3})[a-zç]*\s*\/\s*(\d{2,4})/i.exec(
      t,
    );
  if (ref?.[1] && ref[2]) {
    const mes = /^\d+$/.test(ref[1]) ? ref[1] : MESES[ref[1].toLowerCase()];
    const ano = ref[2].length === 2 ? `20${ref[2]}` : ref[2];
    if (mes && Number(mes) >= 1 && Number(mes) <= 12)
      s.referencia = `${ano}-${mes}`;
  }
  const venc = /vencimento\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(t);
  if (venc?.[1]) s.vencimento = dataIso(venc[1]);
  const consumo = /consumo[^0-9]{0,30}?([\d.]+(?:,\d+)?)\s*m(?:³|3)/i.exec(t);
  if (consumo?.[1]) s.consumo_m3 = consumo[1];
  const total =
    /(?:total\s*a\s*pagar|valor\s*a\s*pagar|valor\s*total|total\s*da\s*conta)\s*:?\s*(?:R\$)?\s*([\d.]+,\d{2})/i.exec(
      t,
    );
  if (total?.[1]) s.total = total[1];
  return s;
}

/** Quantos campos a sugestão achou (para dizer na tela). */
export const camposSugeridos = (s: SugestaoConta) =>
  Object.values(s).filter(Boolean).length;
