import { z } from "zod";
import type { Aviso, FaturaLida, TipoItem } from "./energisa";
import { faturaLidaSchema } from "./energisa";
import type { Papel } from "./energisa-contas";
import { variacaoPct } from "./energisa-contas";

// Prévia de uma fatura da Energisa (o que a tela de importação mostra antes
// de confirmar). O que foi lido fica em operacoes.importacoes.resumo
// (`resumoSchema`): é dele que a prévia é remontada depois (unidade nova
// cadastrada, página recarregada), sem ler o PDF de novo.

export const resumoSchema = z.object({
  versao: z.literal(1),
  /** Também no topo, para filtrar no banco (resumo->>matricula). */
  matricula: z.string(),
  arquivo: z.string(),
  fatura: faturaLidaSchema,
});
export type ResumoImportacao = z.infer<typeof resumoSchema>;

/** Um arquivo da importação (operacoes.importacoes.arquivos). */
export const arquivoSchema = z.object({
  nome: z.string(),
  caminho: z.string(),
  sha256: z.string(),
  bytes: z.number().int(),
});
export const arquivosSchema = z.array(arquivoSchema);

export interface ItemPrevia {
  descricao: string;
  tipo: TipoItem;
  quantidade: number | null;
  /** Centavos. */
  valor: number;
}

export interface PreviaFatura {
  importacaoId: string;
  arquivo: string;
  matricula: string;
  /** Unidade cadastrada em operacoes.energia_unidades; null: matrícula nova. */
  unidade: { apelido: string | null; papel: Papel } | null;
  /** Endereço, classificação e ligação como vêm na fatura. */
  endereco: string | null;
  classificacao: string | null;
  ligacao: string | null;
  referencia: string;
  vencimento: string | null;
  consumoKwh: number;
  compensadoKwh: number;
  /** Centavos (como os outros valores abaixo). */
  valorCompensado: number;
  total: number;
  somaItens: number;
  bate: boolean;
  bandeira: string | null;
  saldoKwh: number | null;
  expirarKwh: number | null;
  itens: ItemPrevia[];
  avisos: Aviso[];
  /** Fatura e itens já gravados (só falta confirmar). */
  gravada: boolean;
  /** Média dos 12 meses anteriores da unidade (faturas confirmadas). */
  media: { kwh: number; meses: number } | null;
}

/** Os avisos da leitura mais os da conciliação com o que já está no sistema. */
export function montarPrevia(
  base: {
    importacaoId: string;
    arquivo: string;
    fatura: FaturaLida;
    unidade: PreviaFatura["unidade"];
    gravada: boolean;
    media: PreviaFatura["media"];
  },
  alertaPct: number,
): PreviaFatura {
  const f = base.fatura;
  const avisos = [...f.avisos];
  if (!base.unidade)
    avisos.push({
      nivel: "aviso",
      mensagem: `A matrícula ${f.matricula} ainda não está cadastrada: cadastre a unidade abaixo para seguir.`,
    });
  const acima = base.media ? variacaoPct(f.consumoKwh, base.media.kwh) : null;
  if (acima !== null && acima > alertaPct)
    avisos.push({
      nivel: "aviso",
      mensagem: `Consumo ${Math.round(acima)}% acima da média dos ${base.media?.meses} meses anteriores (alerta a partir de ${alertaPct}%).`,
    });
  if ((f.expirarKwh ?? 0) > 0)
    avisos.push({
      nivel: "info",
      mensagem: `${f.expirarKwh} kWh de crédito expiram no próximo ciclo.`,
    });
  return {
    importacaoId: base.importacaoId,
    arquivo: base.arquivo,
    matricula: f.matricula,
    unidade: base.unidade,
    endereco: f.endereco,
    classificacao: f.classificacao,
    ligacao: f.ligacao,
    referencia: f.referencia,
    vencimento: f.vencimento,
    consumoKwh: f.consumoKwh,
    compensadoKwh: f.compensadoKwh,
    valorCompensado: f.valorCompensado,
    total: f.total,
    somaItens: f.somaItens,
    bate: f.bate,
    bandeira: f.bandeira,
    saldoKwh: f.saldoKwh,
    expirarKwh: f.expirarKwh,
    itens: f.itens.map((i) => ({
      descricao: i.descricao,
      tipo: i.tipo,
      quantidade: i.quantidade,
      valor: i.valor,
    })),
    avisos,
    gravada: base.gravada,
    media: base.media,
  };
}
