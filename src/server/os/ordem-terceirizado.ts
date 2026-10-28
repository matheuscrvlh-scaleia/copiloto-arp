import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { after } from "next/server";
import { formatarData } from "@/lib/formato";
import { linkAtivo, localDaOS, tipoDeServico } from "@/lib/os/ordem";
import { dataHoraBr } from "@/lib/os/relatorios";
import { rotaChamado, rotaTerceirizado } from "@/lib/os/rotas";
import { PERIODOS, type Periodo, PRIORIDADES } from "@/lib/os/rotulos";
import { preencher } from "@/lib/os/whatsapp";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { TAG } from "@/server/cache";
import {
  notificar,
  osAdmin,
  type Parametros,
  registrarComoSistema,
  type Tabela,
  urlDoSistema,
  urlsAssinadas,
} from "./base";
import { modeloMensagem } from "./ordem";

// Link da OS para o terceirizado (spec 4.8): ele abre sem login, vê só a
// OS dele (nunca custos internos, outras OS ou dados de outras lojas) e
// marca aceite, chegada, término, fotos, solução e valor. Tudo aqui é
// service role, sempre depois de conferir o token e que a OS segue aberta.

/** Token como o novoToken() gera (base64url, 32+ caracteres). */
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{32,64}$/;

export interface MensagemTerceirizado {
  nome: string | null;
  numero: number;
  categoria: string | null;
  local: string;
  descricao: string | null;
  titulo: string;
  visitaData: string | null;
  visitaPeriodo: Periodo | null;
  token: string;
}

/** "24/10/2026 · Manhã", ou null sem data marcada. */
function textoVisita(data: string | null, periodo: Periodo | null) {
  if (!data) return null;
  return periodo
    ? `${formatarData(data)} · ${PERIODOS[periodo]}`
    : formatarData(data);
}

/**
 * Mensagem do WhatsApp para o terceirizado (modelo dos parâmetros). A data
 * da visita entra no fim quando o modelo não tem o campo {{visita}}.
 */
export function mensagemTerceirizado(
  p: Parametros,
  m: MensagemTerceirizado,
): string {
  const modelo = modeloMensagem(p, "terceirizado");
  const visita = textoVisita(m.visitaData, m.visitaPeriodo);
  const texto = preencher(modelo, {
    nome: m.nome ?? "",
    numero: m.numero,
    tipo: tipoDeServico(m.categoria),
    local: m.local,
    descricao: m.descricao ?? m.titulo,
    titulo: m.titulo,
    visita: visita ?? "a combinar",
    link: urlDoSistema(rotaTerceirizado(m.token)),
  });
  return visita && !/\{\{\s*visita\s*\}\}/.test(modelo)
    ? `${texto}\n*Visita:* ${visita}`
    : texto;
}

// ---------------------------------------------------------------------------
// Página pública
// ---------------------------------------------------------------------------

const COLUNAS_LINK =
  "id, chamado_id, token, empresa_id, criado_por, criado_em, aceito_em, recusado_em, recusa_motivo, chegada_em, saida_em, solucao, valor_informado, orcamento_numero, terminado_em, cancelado_em, assinado_em, assinatura_nome" as const;

const COLUNAS_CHAMADO =
  "id, numero, titulo, descricao, status, prioridade, categoria_id, bloco, local, loja_id, empresa_id, visita_data, visita_periodo, prazo_terceirizado, responsavel_id, aberto_por, solucao" as const;

/** O link, a OS e a empresa (do link ou da OS) numa consulta só. */
const COLUNAS_ACESSO =
  `${COLUNAS_LINK}, empresa:empresas(nome, telefone, ativo), chamado:chamados!inner(${COLUNAS_CHAMADO}, empresa:empresas(nome, telefone, ativo))` as const;

type Link = Pick<
  Tabela<"terceirizado_links">,
  | "id"
  | "chamado_id"
  | "token"
  | "empresa_id"
  | "criado_por"
  | "criado_em"
  | "aceito_em"
  | "recusado_em"
  | "recusa_motivo"
  | "chegada_em"
  | "saida_em"
  | "solucao"
  | "valor_informado"
  | "orcamento_numero"
  | "terminado_em"
  | "cancelado_em"
  | "assinado_em"
  | "assinatura_nome"
>;
type ChamadoDoLink = Pick<
  Tabela<"chamados">,
  | "id"
  | "numero"
  | "titulo"
  | "descricao"
  | "status"
  | "prioridade"
  | "categoria_id"
  | "bloco"
  | "local"
  | "loja_id"
  | "empresa_id"
  | "visita_data"
  | "visita_periodo"
  | "prazo_terceirizado"
  | "responsavel_id"
  | "aberto_por"
  | "solucao"
>;

export interface Acesso {
  link: Link;
  chamado: ChamadoDoLink;
  /** Nome que vai na linha do tempo ("Empresa X (terceirizado)"). */
  autor: string;
  empresa: Pick<Tabela<"empresas">, "nome" | "telefone"> | null;
}

/**
 * Confere o token e devolve a OS se o link ainda vale (não cancelado e OS
 * nem fechada nem cancelada). null: link inexistente ou inativo.
 */
export async function acessoPeloToken(token: string): Promise<Acesso | null> {
  if (!FORMATO_TOKEN.test(token)) return null;
  const { data } = await osAdmin()
    .from("terceirizado_links")
    .select(COLUNAS_ACESSO)
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  const {
    empresa: doLink,
    chamado: { empresa: daOS, ...chamado },
    ...link
  } = data;
  if (!linkAtivo(link, chamado)) return null;
  // A empresa do link vale; sem ela, a da OS (como antes, pelo id).
  const empresa = link.empresa_id ? doLink : chamado.empresa_id ? daOS : null;
  // Empresa desativada não segue mexendo nas OS que já tinha.
  if (empresa && !empresa.ativo) return null;
  return {
    link,
    chamado,
    empresa,
    autor: `${empresa?.nome ?? "Terceirizado"} (terceirizado)`,
  };
}

export interface Foto {
  id: string;
  nome: string;
  url: string;
  categoria: string;
}

export interface PaginaTerceirizado {
  token: string;
  numero: number;
  titulo: string;
  descricao: string | null;
  tipoServico: string;
  prioridade: string;
  local: string;
  visita: string | null;
  prazo: string | null;
  empresa: string | null;
  profissionais: string[];
  fotos: Foto[];
  /** O que ele mesmo enviou (orçamento, laudo), só o nome. */
  enviados: { id: string; nome: string; categoria: string }[];
  contato: {
    nome: string;
    telefone: string | null;
    email: string | null;
    endereco: string | null;
  };
  estado: Pick<
    Link,
    | "aceito_em"
    | "recusado_em"
    | "recusa_motivo"
    | "chegada_em"
    | "saida_em"
    | "terminado_em"
    | "solucao"
    | "valor_informado"
    | "orcamento_numero"
    | "assinado_em"
    | "assinatura_nome"
  >;
  /** Solução que vai na OS (a dele, ou a que a ARP escreveu). */
  solucaoDaOS: string | null;
}

/** O que a página pública mostra; grava o último acesso. */
export async function paginaDoTerceirizado(
  token: string,
): Promise<PaginaTerceirizado | null> {
  const acesso = await acessoPeloToken(token);
  if (!acesso) return null;
  const { link, chamado } = acesso;
  const db = osAdmin();
  const [loja, categoria, profissionais, anexos, empresaArp] =
    await Promise.all([
      chamado.loja_id
        ? db
            .from("lojas")
            .select("luc, nome")
            .eq("id", chamado.loja_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      chamado.categoria_id
        ? db
            .from("categorias")
            .select("nome")
            .eq("id", chamado.categoria_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      db
        .from("chamado_profissionais")
        .select("profissionais(nome)")
        .eq("chamado_id", chamado.id),
      db
        .from("anexos")
        .select(
          "id, nome, path, mime, categoria, enviado_por_nome, evento_id, visivel_lojista",
        )
        .eq("chamado_id", chamado.id)
        .order("em"),
      // Sem o contato a página ainda serve (cai no "ARP" padrão).
      contatoDaArp().catch((e) => {
        console.error("contato da ARP no link da OS", e);
        return null;
      }),
    ]);
  // O último acesso não muda a página: grava depois da resposta.
  after(async () => {
    const { error } = await osAdmin()
      .from("terceirizado_links")
      .update({ ultimo_acesso_em: new Date().toISOString() })
      .eq("id", link.id);
    if (error) console.error("último acesso do link da OS", error);
  });

  // Fotos do pedido, de antes e depois e as que ele mandou. Foto de nota
  // interna (comentário não visível ao lojista) fica de fora, como o
  // orçamento e o laudo internos.
  const todos = anexos.data ?? [];
  const fotos = todos.filter(
    (a) =>
      a.mime?.startsWith("image/") &&
      (["antes", "depois"].includes(a.categoria) ||
        (a.categoria === "foto" &&
          (a.evento_id === null || a.visivel_lojista))),
  );
  const urls = await urlsAssinadas(fotos.map((f) => f.path));
  const e = empresaArp;
  return {
    token,
    numero: chamado.numero,
    titulo: chamado.titulo,
    descricao: chamado.descricao,
    tipoServico: tipoDeServico(categoria.data?.nome),
    prioridade: PRIORIDADES[chamado.prioridade],
    local: localDaOS({
      bloco: chamado.bloco,
      local: chamado.local,
      loja: loja.data,
    }),
    visita: textoVisita(chamado.visita_data, chamado.visita_periodo),
    prazo: chamado.prazo_terceirizado
      ? dataHoraBr(chamado.prazo_terceirizado)
      : null,
    empresa: acesso.empresa?.nome ?? null,
    profissionais: (profissionais.data ?? [])
      .map((p) => p.profissionais?.nome)
      .filter((n): n is string => !!n),
    fotos: fotos.flatMap((f) => {
      const url = urls.get(f.path);
      return url
        ? [{ id: f.id, nome: f.nome, url, categoria: f.categoria }]
        : [];
    }),
    enviados: todos
      .filter(
        (a) =>
          a.enviado_por_nome === acesso.autor &&
          ["orcamento", "laudo"].includes(a.categoria),
      )
      .map((a) => ({ id: a.id, nome: a.nome, categoria: a.categoria })),
    contato: {
      nome: e?.nome ?? "ARP",
      telefone: e?.telefone ?? null,
      email: e?.email ?? null,
      endereco: e
        ? [e.endereco, [e.cidade, e.uf].filter(Boolean).join(" - ")]
            .filter(Boolean)
            .join(", ") || null
        : null,
    },
    estado: {
      aceito_em: link.aceito_em,
      recusado_em: link.recusado_em,
      recusa_motivo: link.recusa_motivo,
      chegada_em: link.chegada_em,
      saida_em: link.saida_em,
      terminado_em: link.terminado_em,
      solucao: link.solucao,
      valor_informado: link.valor_informado,
      orcamento_numero: link.orcamento_numero,
      assinado_em: link.assinado_em,
      assinatura_nome: link.assinatura_nome,
    },
    solucaoDaOS: chamado.solucao ?? link.solucao,
  };
}

// Contato da ARP no rodapé do link (o mesmo para todas as OS). Não
// exportar: só depois de conferir o token.
async function contatoDaArp() {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.empresa);
  const { data, error } = await createAdminClient()
    .schema("core")
    .from("empresa")
    .select("nome, telefone, email, endereco, cidade, uf")
    .maybeSingle();
  if (error) throw new Error(`Empresa: ${error.message}`);
  return data;
}

/**
 * Linha do tempo (evento 'terceirizado') e aviso ao responsável da OS
 * (quem enviou o link, se não há responsável).
 */
export async function avisarDoTerceirizado(
  a: Acesso,
  texto: string,
  dados: Record<string, Json | undefined> = {},
  notificacao?: string,
): Promise<void> {
  await registrarComoSistema(a.chamado.id, {
    tipo: "terceirizado",
    autorNome: a.autor,
    texto,
    dados: { link_id: a.link.id, ...dados },
  });
  if (!notificacao) return;
  // O aviso à equipe não muda a resposta ao terceirizado: sai depois.
  after(() =>
    notificar(
      [a.chamado.responsavel_id ?? a.link.criado_por ?? a.chamado.aberto_por],
      {
        tipo: "terceirizado",
        titulo: `#${a.chamado.numero} ${a.chamado.titulo}`,
        texto: notificacao,
        href: rotaChamado(a.chamado.id),
        chamadoId: a.chamado.id,
      },
    ),
  );
}
