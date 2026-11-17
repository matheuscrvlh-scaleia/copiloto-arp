import { z } from "zod";
import { esquemaDetalhe } from "../../detalhe";
import { ATALHOS } from "../../periodo";

// Contratos dos painéis do Tickets (prefixo /api/v1/os). O painel sai pronto
// da API (geral ou de um setor): os cartões, os blocos e as linhas dos
// chamados citados. Os chamados vão uma vez só (linhas); cada número leva só
// os ids de quem o forma, e o modal monta a lista no navegador. Assim a
// lista que abre tem exatamente a quantidade do número.
//
//   GET /os/paineis?setor=&periodo=&de=&ate=&categoria=&pessoa=  → RespostaPainel
//   GET /os/paineis/exportar?setor=<id>&…                         → PDF
//   GET /os/ordens/relatorios/abertas?formato=pdf|xlsx           → PDF ou Excel
//   GET /os/ordens/relatorios/rateio?de=&ate=                    → Excel
//   GET /os/ordens/relatorios/terceirizados?de=&ate=             → Excel

const tom = z.enum(["claro", "escuro", "verde"]);
const statusIndicador = z.enum([
  "ok",
  "atencao",
  "fora",
  "sem_meta",
  "sem_dado",
]);
const direcao = z.enum(["maior_melhor", "menor_melhor"]);
const rotuloValor = z.object({ rotulo: z.string(), valor: z.string() });
const link = z.object({ href: z.string(), rotulo: z.string() });

/** Um chamado como aparece nas listas dos painéis (textos prontos). */
export const linhaDoPainel = z.object({
  id: z.string(),
  numero: z.number(),
  titulo: z.string(),
  setor: z.string(),
  categoria: z.string(),
  status: z.string(),
  responsavel: z.string(),
  /** aaaa-mm-dd (Brasília). */
  aberto: z.string(),
  prazo: z.string().nullable(),
  concluido: z.string().nullable(),
});
export type LinhaChamado = z.infer<typeof linhaDoPainel>;

/** Coluna a mais numa lista (ex.: dias em aberto, custo da OS). */
const colunaExtra = z.object({
  titulo: z.string(),
  numero: z.boolean().optional(),
  valores: z.record(z.string(), z.string()),
  /** Para ordenar pela coluna (ex.: minutos em vez de "2h 10min"). */
  ordem: z.record(z.string(), z.number()).optional(),
});
export type ColunaExtra = z.infer<typeof colunaExtra>;

const parteLista = z.object({
  titulo: z.string().optional(),
  ids: z.array(z.string()),
  extra: colunaExtra.optional(),
  vazio: z.string().optional(),
});
export type ParteLista = z.infer<typeof parteLista>;

/** Os chamados que formam um número (abre no modal de detalhe). */
export const listaChamados = z.object({
  tipo: z.literal("chamados"),
  secao: z.string().optional(),
  titulo: z.string(),
  subtitulo: z.string().optional(),
  resumo: z.array(rotuloValor).optional(),
  fontes: z.array(rotuloValor).optional(),
  partes: z.array(parteLista),
  link: link.optional(),
  /** Sem a coluna Setor (painel de um setor só). */
  semSetor: z.boolean().optional(),
});
export type ListaChamados = z.infer<typeof listaChamados>;

/** Lista de chamados ou um detalhe pronto (ativos, vistorias, agenda). */
const origem = z.union([listaChamados, esquemaDetalhe]);
export type Origem = z.infer<typeof origem>;

const cor = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal("neutro"),
]);

const itemBloco = z.object({
  chave: z.string(),
  rotulo: z.string(),
  valor: z.number(),
  texto: z.string(),
  titulo: z.string().optional(),
  detalhe: z.string().optional(),
  destaque: z.boolean().optional(),
  origem: origem.optional(),
  /** Posição fixa na paleta (rosca). */
  cor: cor.optional(),
});
export type ItemBloco = z.infer<typeof itemBloco>;

const numeroBloco = z.object({
  rotulo: z.string(),
  valor: z.string(),
  detalhe: z.string().optional(),
  status: statusIndicador.optional(),
  direcao: direcao.optional(),
  /** Destaque vermelho (atrasos), sempre com texto. */
  alerta: z.boolean().optional(),
  origem: origem.optional(),
});
export type NumeroBloco = z.infer<typeof numeroBloco>;

const celulaTabela = z.object({
  texto: z.string(),
  origem: origem.optional(),
  status: statusIndicador.optional(),
  direcao: direcao.optional(),
});
export type CelulaTabela = z.infer<typeof celulaTabela>;

const conteudo = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("barras"),
    itens: z.array(itemBloco),
    meta: z.object({ valor: z.number(), texto: z.string() }).optional(),
    vazio: z.string().optional(),
    rotuloLargo: z.boolean().optional(),
  }),
  z.object({
    tipo: z.literal("colunas"),
    itens: z.array(itemBloco),
    rotularTodas: z.boolean().optional(),
  }),
  z.object({
    tipo: z.literal("espelhadas"),
    itens: z.array(
      z.object({
        chave: z.string(),
        rotulo: z.string(),
        titulo: z.string(),
        acima: z.number(),
        abaixo: z.number(),
        origem: origem.optional(),
      }),
    ),
    rotulos: z.object({ acima: z.string(), abaixo: z.string() }),
  }),
  z.object({
    tipo: z.literal("rosca"),
    itens: z.array(itemBloco),
    centro: z.object({ valor: z.string(), rotulo: z.string() }),
  }),
  z.object({ tipo: z.literal("faixas"), itens: z.array(itemBloco) }),
  z.object({ tipo: z.literal("numeros"), numeros: z.array(numeroBloco) }),
  z.object({
    tipo: z.literal("tabela"),
    colunas: z.array(
      z.object({ titulo: z.string(), numero: z.boolean().optional() }),
    ),
    linhas: z.array(
      z.object({ chave: z.string(), celulas: z.array(celulaTabela) }),
    ),
    vazio: z.string().optional(),
  }),
  z.object({
    tipo: z.literal("matriz"),
    origens: z.array(z.object({ chave: z.string(), rotulo: z.string() })),
    destinos: z.array(z.object({ chave: z.string(), rotulo: z.string() })),
    /** "origem>destino" → quantidade e quem forma. */
    celulas: z.record(z.string(), z.object({ n: z.number(), origem: origem })),
    vazio: z.string().optional(),
  }),
  z.object({ tipo: z.literal("texto"), texto: z.string() }),
]);
export type Conteudo = z.infer<typeof conteudo>;

const bloco = z.object({
  id: z.string(),
  titulo: z.string(),
  descricao: z.string().optional(),
  /** Colunas da grade de 12 no computador. */
  largura: z
    .union([
      z.literal(4),
      z.literal(5),
      z.literal(6),
      z.literal(7),
      z.literal(8),
      z.literal(12),
    ])
    .optional(),
  /** No computador o cartão fica com 600px de altura e o conteúdo rola. */
  rolagem: z.boolean().optional(),
  tom: tom.optional(),
  partes: z.array(conteudo),
  /** Aviso embaixo (ex.: período sem a medida no sistema anterior). */
  nota: z.string().optional(),
  /** Lista do bloco para o botão Excel (só com os.exportar). */
  exportar: listaChamados.optional(),
  links: z.array(link).optional(),
});
export type Bloco = z.infer<typeof bloco>;

const cartaoPainel = z.object({
  titulo: z.string(),
  valor: z.string(),
  detalhe: z.string().optional(),
  /** Como o número é calculado (o "i" ao lado do título). */
  calculo: z.string().optional(),
  meta: z.string().optional(),
  status: statusIndicador.optional(),
  direcao: direcao.optional(),
  tom: tom.optional(),
  origem: origem.optional(),
});
export type CartaoPainel = z.infer<typeof cartaoPainel>;

export const painelMontado = z.object({
  titulo: z.string(),
  rotulo: z.string(),
  atualizadoAs: z.string(),
  cartoes: z.array(cartaoPainel),
  blocos: z.array(bloco),
  linhas: z.array(linhaDoPainel),
  avisos: z.array(z.string()),
});
export type PainelMontado = z.infer<typeof painelMontado>;

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

/**
 * Parâmetros da URL da tela como vieram (período, ?categoria=, ?pessoa=),
 * mais o setor do endereço (/os/paineis/<setor>: slug ou id).
 */
export const consultaDoPainel = z.looseObject({
  setor: z.string().max(200).optional(),
});
export type ConsultaDoPainel = z.infer<typeof consultaDoPainel>;

const atalho = z.enum(ATALHOS.map((a) => a.valor));

export const respostaPainel = z.discriminatedUnion("tipo", [
  /** Sem os.painel_geral, /os/paineis vai ao painel do primeiro setor. */
  z.object({ tipo: z.literal("redirecionar"), para: z.string() }),
  z.object({ tipo: z.literal("sem_acesso") }),
  z.object({
    tipo: z.literal("painel"),
    painel: painelMontado,
    periodo: z.object({
      de: z.string(),
      ate: z.string(),
      atalho: atalho.nullable(),
    }),
    /** aaaa-mm-dd em Brasília (limite das datas na tela). */
    hoje: z.string(),
    /** id do setor do painel (null: geral), para o PDF. */
    setorId: z.string().nullable(),
    /** Setor é filtro: cada opção é a rota do painel dele. */
    setores: z.array(z.object({ rota: z.string(), nome: z.string() })),
    rotaAtual: z.string(),
    categorias: z.array(
      z.object({
        id: z.string(),
        nome: z.string(),
        grupo: z.string().optional(),
      }),
    ),
    categoria: z.string().nullable(),
    pessoas: z.array(z.object({ id: z.string(), nome: z.string() })),
    pessoa: z.string().nullable(),
    /** Linha de filtros escrita nos arquivos exportados. */
    textoFiltros: z.string(),
  }),
]);
export type RespostaPainel = z.infer<typeof respostaPainel>;

/** Período de fechamento dos relatórios de OS (aaaa-mm-dd). */
export const consultaDoRelatorio = z.looseObject({
  de: z.string().optional(),
  ate: z.string().optional(),
});
export type ConsultaDoRelatorio = z.infer<typeof consultaDoRelatorio>;

export const consultaDasAbertas = z.looseObject({
  formato: z.string().optional(),
});
export type ConsultaDasAbertas = z.infer<typeof consultaDasAbertas>;
