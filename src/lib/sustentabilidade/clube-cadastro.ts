// Entrada dos formulários do Clube (4.5): participante, termo, contribuição,
// ação, saída, contato e valor combinado. Validação que vale na tela e na
// Server Action (o servidor confere de novo). Mensagens em português simples.

import { z } from "zod";
import { documentoValido, soDigitos } from "@/lib/documentos";
import { lerValorBr } from "@/lib/formato";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const TETO_VALOR = 1_000_000_000;

const texto = (max: number) => z.string().trim().max(max);
const opcional = (max: number) =>
  texto(max).transform((v) => (v === "" ? null : v));

const data = (rotulo: string) =>
  z.string().regex(DATA, `${rotulo}: informe uma data válida.`);

export const idDoParticipante = z.uuid("Participante inválido.");

/** Valor em reais digitado ("1.234,56"); vazio recusa; zero vale. */
export function lerReais(
  bruto: string,
): { ok: true; valor: number } | { ok: false; erro: string } {
  const v = lerValorBr(bruto);
  if (v === null)
    return { ok: false, erro: "Informe o valor (pode ser zero)." };
  if (!Number.isFinite(v) || v < 0 || v >= TETO_VALOR)
    return { ok: false, erro: "Valor inválido. Use o formato 1.234,56." };
  return { ok: true, valor: Math.round(v * 100) / 100 };
}

const formas = z
  .array(texto(80).min(1))
  .max(20, "Formas de participação demais.")
  .transform((l) => [...new Set(l)]);

export const novoParticipante = z
  .object({
    origem: z.enum(
      ["cliente", "manual"],
      "Escolha o cliente ou o cadastro manual.",
    ),
    /** Documento do cliente escolhido na lista de contratos. */
    cliente_doc: texto(20),
    nome: texto(200),
    documento: texto(30),
    formas,
    email: opcional(200),
    telefone: opcional(40),
    contato: opcional(200),
  })
  .transform((d, ctx) => {
    const doc = soDigitos(d.origem === "cliente" ? d.cliente_doc : d.documento);
    if (d.origem === "cliente") {
      if (doc.length !== 11 && doc.length !== 14) {
        ctx.addIssue({
          code: "custom",
          message: "Escolha o cliente na lista de contratos.",
        });
        return z.NEVER;
      }
    } else {
      if (d.nome.length < 2) {
        ctx.addIssue({ code: "custom", message: "Informe o nome." });
        return z.NEVER;
      }
      if (!documentoValido(doc)) {
        ctx.addIssue({
          code: "custom",
          message: "CPF ou CNPJ inválido. Confira os números.",
        });
        return z.NEVER;
      }
    }
    return { ...d, doc };
  });

export type NovoParticipante = z.infer<typeof novoParticipante>;

export const dadosDoParticipante = z.object({
  participante_id: idDoParticipante,
  formas,
  /** Só o cadastro manual muda o nome (o do ENET vem do contrato). */
  nome: texto(200).optional(),
});

export const contatoDoParticipante = z.object({
  participante_id: idDoParticipante,
  email: opcional(200),
  telefone: opcional(40),
  contato: opcional(200),
});

export const valorCombinado = z.object({
  participante_id: idDoParticipante,
  /** Vazio tira o valor combinado. */
  valor: texto(30),
});

export const saidaDoClube = z.object({
  participante_id: idDoParticipante,
  saiu_em: data("Data da saída"),
  motivo: texto(500).min(3, "Conte o motivo da saída."),
});

export const termoDoClube = z.object({
  participante_id: idDoParticipante,
  ano: z.coerce
    .number("Informe o ano do termo.")
    .int()
    .min(2000, "Ano inválido.")
    .max(2100, "Ano inválido."),
  assinado_em: data("Data da assinatura"),
  nome: texto(120).optional(),
  documento: texto(30).optional(),
});

export const contribuicaoDoClube = z.object({
  participante_id: idDoParticipante,
  data: data("Data"),
  forma: texto(80).min(1, "Escolha a forma."),
  competencia: z.string().regex(MES, "Escolha o mês de competência."),
  valor: texto(30),
  observacao: opcional(1000),
});

export const acaoDoClube = z.object({
  participante_id: idDoParticipante,
  data: data("Data"),
  tipo: texto(80).min(1, "Escolha o tipo da ação."),
  observacao: opcional(1000),
});

/** "2026-11" → "2026-11-01" (competência é o dia 1). */
export const competenciaDoMes = (mes: string) => `${mes}-01`;

/** Mensagem do primeiro erro, ou texto padrão. */
export function primeiroErro(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Formulário inválido.";
}
