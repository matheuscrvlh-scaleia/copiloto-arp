import type { Formulario } from "@arp/shared/comercial/contratos/configuracoes";
import type {
  ImovelPesquisado,
  RespostaApoioPesquisa,
  RespostaImovel,
  RespostaPesquisa,
} from "@arp/shared/comercial/contratos/pesquisa";
import type { Aba } from "@arp/shared/comercial/importacao";
import { valorM2DoPainel } from "@arp/shared/comercial/pesquisa";
import {
  chaveDoImovel,
  type ImovelImportado,
  lerPesquisa,
} from "@arp/shared/comercial/pesquisa-importacao";
import { lerValorBr } from "@arp/shared/formato";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao, ErroNaoEncontrado } from "@/erros";
import { banco } from "@/infra/banco";
import { codigoDoBanco } from "@/infra/banco/erros";
import {
  contextoCom,
  listas,
  parametros,
  tiposLuc,
  valoresDaLista,
} from "./base";
import { dadosEnet } from "./fontes";
import { ErroImportacao, importador } from "./importacoes.service";
import * as repo from "./pesquisa.repository";
import { primeiroErro, traduzir } from "./traduzir";

// Pesquisa de mercado (spec 4.16): imóveis pesquisados (só locação), lidos e
// gravados com a sessão (RLS: pesquisa.ver ou .editar). Valor por m², custo
// total e custo por m² vêm calculados do banco. A linha "ARP" usa o valor
// por m² do Painel (ENET de exemplo até a API).

const SEM_PERMISSAO =
  "Você não tem permissão para editar a pesquisa de mercado.";

type Lido = Awaited<ReturnType<typeof repo.imoveis>>[number];

const paraTela = ({ importacao_id, ...i }: Lido): ImovelPesquisado => ({
  ...i,
  importado: importacao_id !== null,
});

export async function tela(ctx: Contexto): Promise<RespostaPesquisa> {
  const { hoje, dadosDe } = contextoCom(ctx);
  const lidos = await banco.comoUsuario(ctx.usuario.id, repo.imoveis);
  const p = await parametros(ctx);
  const todas = await listas(ctx);
  const tipos = await tiposLuc(ctx);
  const enet = dadosEnet(hoje);
  const contam = new Set(
    tipos.filter((t) => t.conta_ocupacao).map((t) => t.tipo),
  );
  return {
    hoje,
    dadosDe,
    imoveis: lidos.map(paraTela),
    faixasM2: p.pesquisa_faixas_m2.map(Number),
    tipos: valoresDaLista(todas, "pesquisa_tipo"),
    arp: { ...valorM2DoPainel(enet, contam, hoje), exemplo: enet.exemplo },
  };
}

/** Bairros, tipos e faixas (cadastro e correção). */
export async function apoio(ctx: Contexto): Promise<RespostaApoioPesquisa> {
  const { hoje, dadosDe } = contextoCom(ctx);
  const todas = await listas(ctx);
  const p = await parametros(ctx);
  return {
    hoje,
    dadosDe,
    bairros: valoresDaLista(todas, "pesquisa_bairro"),
    tipos: valoresDaLista(todas, "pesquisa_tipo"),
    faixasM2: p.pesquisa_faixas_m2.map(Number),
  };
}

export async function imovel(
  ctx: Contexto,
  id: string,
): Promise<RespostaImovel> {
  const i = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.imovel(tx, id),
  );
  if (!i) throw new ErroNaoEncontrado("Imóvel não encontrado.");
  return { imovel: paraTela(i) };
}

// ---------------------------------------------------------------------------
// Cadastro e correção
// ---------------------------------------------------------------------------

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);
const valor = z.preprocess(
  (v) => (typeof v === "string" ? lerValorBr(v) : v),
  z.number().min(0).max(100_000_000).nullable(),
);

const esquemaImovel = z.object({
  data_pesquisa: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da pesquisa."),
  cep: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(
      z.union([
        z.literal(""),
        z.string().length(8, "CEP com 8 dígitos (ou deixe em branco)."),
      ]),
    )
    .transform((v) => (v ? `${v.slice(0, 5)}-${v.slice(5)}` : null)),
  endereco: z
    .string()
    .trim()
    .min(1, "Informe o endereço ou referência.")
    .max(300),
  bairro: z.string().trim().min(1, "Escolha o bairro.").max(80),
  tipo: z.string().trim().min(1, "Escolha o tipo.").max(80),
  area_m2: valor.pipe(z.number().positive("Informe a área (m²).")),
  aluguel: valor.pipe(z.number({ message: "Informe o aluguel." })),
  condominio: valor,
  iptu: valor,
  vagas: valor.pipe(z.number().int().nullable()),
  observacao: opcional(1000),
  fonte: opcional(1000).pipe(
    z
      .string()
      .regex(/^https?:\/\//i, "A fonte é o link do anúncio (http…).")
      .nullable(),
  ),
});

const campo = (form: Formulario, k: string) => {
  const v = form[k];
  return (Array.isArray(v) ? v[0] : v) ?? "";
};

function lerForm(form: Formulario) {
  const e = esquemaImovel.safeParse({
    data_pesquisa: campo(form, "data_pesquisa"),
    cep: campo(form, "cep"),
    endereco: campo(form, "endereco"),
    bairro: campo(form, "bairro"),
    tipo: campo(form, "tipo"),
    area_m2: campo(form, "area_m2"),
    aluguel: campo(form, "aluguel"),
    condominio: campo(form, "condominio"),
    iptu: campo(form, "iptu"),
    vagas: campo(form, "vagas"),
    observacao: campo(form, "observacao"),
    fonte: campo(form, "fonte"),
  });
  if (!e.success)
    throw new ErroDeNegocio(
      primeiroErro(e.error, "Confira os campos do imóvel."),
    );
  return e.data;
}

const MENSAGENS = {
  permissao: SEM_PERMISSAO,
  check: "Confira os valores do imóvel.",
  falha: "Não foi possível salvar o imóvel. Tente de novo.",
};

/** Bairro e tipo da lista; na correção, o valor antigo segue valendo. */
async function conferirListas(
  ctx: Contexto,
  v: { bairro: string; tipo: string },
  atual?: { bairro: string; tipo: string },
) {
  const todas = await listas(ctx);
  if (
    !valoresDaLista(todas, "pesquisa_bairro").includes(v.bairro) &&
    atual?.bairro !== v.bairro
  )
    throw new ErroDeNegocio("Bairro fora da lista dos parâmetros.");
  if (
    !valoresDaLista(todas, "pesquisa_tipo").includes(v.tipo) &&
    atual?.tipo !== v.tipo
  )
    throw new ErroDeNegocio("Tipo fora da lista dos parâmetros.");
}

export async function cadastrar(
  ctx: Contexto,
  form: Formulario,
): Promise<string> {
  const v = lerForm(form);
  await conferirListas(ctx, v);
  try {
    const { id } = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.incluir(tx, v),
    );
    return id;
  } catch (e) {
    traduzir(e, MENSAGENS, "pesquisa de mercado");
  }
}

export async function corrigir(
  ctx: Contexto,
  id: string,
  form: Formulario,
): Promise<void> {
  const v = lerForm(form);
  const atual = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.imovel(tx, id),
  );
  await conferirListas(ctx, v, atual);
  let mudou: { id: string }[];
  try {
    mudou = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.alterar(tx, id, v),
    );
  } catch (e) {
    traduzir(e, MENSAGENS, "pesquisa de mercado");
  }
  if (!mudou.length) throw new ErroDePermissao(SEM_PERMISSAO);
}

// ---------------------------------------------------------------------------
// Importação da aba Base de Dados (Configurações › Importações)
// ---------------------------------------------------------------------------

/** Lê o arquivo com as listas dos parâmetros e o que já está na pesquisa. */
async function lerPesquisaDoArquivo(ctx: Contexto, abas: Aba[]) {
  const [todas, existentes] = await Promise.all([
    listas(ctx),
    banco.comoUsuario(ctx.usuario.id, repo.existentes),
  ]);
  const manuais = new Set<string>();
  const importados = new Set<string>();
  for (const i of existentes)
    (i.importacao_id ? importados : manuais).add(
      chaveDoImovel({
        ...i,
        area_m2: Number(i.area_m2),
        aluguel: Number(i.aluguel),
      }),
    );
  return lerPesquisa(
    abas,
    {
      bairros: valoresDaLista(todas, "pesquisa_bairro"),
      tipos: valoresDaLista(todas, "pesquisa_tipo"),
    },
    { manuais, importados },
  );
}

export const importadorPesquisa = importador<ImovelImportado | null>(
  (ctx, abas) => lerPesquisaDoArquivo(ctx, abas),
  async (linhas, g) => {
    const imoveis = linhas
      .map((l) => l.dados)
      .filter((d): d is ImovelImportado => d !== null);
    if (!imoveis.length)
      throw new ErroImportacao("Nenhum imóvel novo para importar.");
    try {
      const gravados = await repo.incluirVarios(
        g.tx,
        imoveis.map((i) => ({
          ...i,
          criado_por: g.usuarioId,
          importacao_id: g.importacaoId,
        })),
      );
      return gravados.length;
    } catch (e) {
      if (e instanceof ErroDePermissao || codigoDoBanco(e) === "42501")
        throw new ErroImportacao(SEM_PERMISSAO);
      throw e;
    }
  },
);
