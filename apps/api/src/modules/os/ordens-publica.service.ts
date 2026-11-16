import { formatarMoeda, lerValorBr } from "@arp/shared/formato";
import {
  CATEGORIAS_DE_ARQUIVO,
  type CategoriaDeArquivo,
  type EntradaLocalizacao,
  entradaAssinaturaDoLink,
  entradaRecusa,
  entradaRelatorio,
  type PaginaTerceirizado,
} from "@arp/shared/os/contratos/ordens";
import { linkAtivo, localDaOS, tipoDeServico } from "@arp/shared/os/ordem";
import { dataHoraBr } from "@arp/shared/os/relatorios";
import { rotaOrdem } from "@arp/shared/os/rotas";
import { PRIORIDADES } from "@arp/shared/os/rotulos";
import { ErroDeNegocio } from "@/erros";
import type { ArquivoRecebido } from "@/http/formulario";
import { banco } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";
import { log } from "@/infra/log";
import { ordem } from "./alvo";
import {
  caminhoDoArquivo,
  depois,
  enviarArquivo,
  notificar,
  registrarComoSistema,
  removerArquivos,
  urlsAssinadas,
} from "./base.service";
import * as repo from "./ordens.repository";
import { conferirEnvio, pngDaAssinatura } from "./ordens-arquivos.service";
import { textoVisita } from "./ordens-terceirizado.service";

// Link da OS para o terceirizado (spec 4.8): ele abre sem login, vê só a
// OS dele (nunca custos internos, outras OS ou dados de outras lojas) e
// marca aceite, chegada, término, fotos, solução e valor. Tudo aqui é
// service role, sempre depois de conferir o token e que a OS segue aberta:
// link cancelado ou OS fechada/cancelada param na hora.

/** Token como o novoToken() gera (base64url, 32+ caracteres). */
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{32,64}$/;

const LINK_INATIVO = "Este link não está mais ativo. Fale com a ARP.";
const FALHOU = "Não foi possível salvar. Tente de novo.";
const JA_ASSINOU =
  "Você já conferiu e assinou a OS. Para mudar algo, fale com a ARP.";
const RECUSOU = "Você recusou esta OS.";

type Linha = NonNullable<Awaited<ReturnType<typeof repo.acessoPeloToken>>>;

export interface Acesso {
  link: Linha;
  /** Nome que vai na linha do tempo ("Empresa X (terceirizado)"). */
  autor: string;
  empresa: { nome: string; telefone: string | null } | null;
}

/**
 * Confere o token e devolve a OS se o link ainda vale (não cancelado e OS
 * nem fechada nem cancelada). null: link inexistente ou inativo.
 */
export async function acessoPeloToken(token: string): Promise<Acesso | null> {
  if (!FORMATO_TOKEN.test(token)) return null;
  const l = await banco.comoServico((tx) => repo.acessoPeloToken(tx, token));
  if (!l) return null;
  if (!linkAtivo(l, l)) return null;
  // A empresa do link vale; sem ela, a da OS.
  const empresa =
    l.empresa_id && l.link_empresa_nome !== null
      ? {
          nome: l.link_empresa_nome,
          telefone: l.link_empresa_telefone,
          ativo: l.link_empresa_ativo,
        }
      : !l.empresa_id && l.empresa_da_os && l.os_empresa_nome !== null
        ? {
            nome: l.os_empresa_nome,
            telefone: l.os_empresa_telefone,
            ativo: l.os_empresa_ativo,
          }
        : null;
  // Empresa desativada não segue mexendo nas OS que já tinha.
  if (empresa && !empresa.ativo) return null;
  return {
    link: l,
    empresa: empresa && { nome: empresa.nome, telefone: empresa.telefone },
    autor: `${empresa?.nome ?? "Terceirizado"} (terceirizado)`,
  };
}

async function conferir(token: string): Promise<Acesso> {
  const a = await acessoPeloToken(token);
  if (!a) throw new ErroDeNegocio(LINK_INATIVO);
  return a;
}

/** GET /os/ordem-publica/:token: o que a página mostra (null: link inativo). */
export async function paginaDoTerceirizado(
  token: string,
): Promise<PaginaTerceirizado | null> {
  const acesso = await acessoPeloToken(token);
  if (!acesso) return null;
  const { link } = acesso;
  const lido = await banco.comoServico(async (tx) => ({
    loja: link.loja_id ? await repo.lojaCurta(tx, link.loja_id) : undefined,
    categoria: link.categoria_id
      ? await repo.nomeDaCategoria(tx, link.categoria_id)
      : undefined,
    profissionais: await repo.nomesDosProfissionaisDa(tx, link.ordem_id),
    anexos: await repo.anexosDa(tx, link.ordem_id),
    // Sem o contato a página ainda serve (cai no "ARP" padrão).
    arp: await repo.contatoDaArp(tx),
  }));
  // O último acesso não muda a página: grava depois da resposta.
  depois("último acesso do link da OS", () =>
    banco.comoServico((tx) => repo.marcarAcessoDoLink(tx, link.id)),
  );

  // Fotos do pedido, de antes e depois e as que ele mandou. Foto de nota
  // interna (comentário não visível ao lojista) fica de fora, como o
  // orçamento e o laudo internos.
  const fotos = lido.anexos.filter(
    (a) =>
      a.mime?.startsWith("image/") &&
      (["antes", "depois"].includes(a.categoria) ||
        (a.categoria === "foto" &&
          (a.evento_id === null || a.visivel_lojista))),
  );
  const urls = await urlsAssinadas(fotos.map((f) => f.path));
  const e = lido.arp;
  return {
    token,
    numero: link.numero,
    titulo: link.titulo,
    descricao: link.descricao,
    tipoServico: tipoDeServico(lido.categoria?.nome),
    prioridade: PRIORIDADES[link.prioridade],
    local: localDaOS({
      bloco: link.bloco,
      local: link.local,
      loja: lido.loja ?? null,
    }),
    visita: textoVisita(link.visita_data, link.visita_periodo),
    prazo: link.prazo_terceirizado ? dataHoraBr(link.prazo_terceirizado) : null,
    empresa: acesso.empresa?.nome ?? null,
    profissionais: lido.profissionais,
    fotos: fotos.flatMap((f) => {
      const url = urls.get(f.path);
      return url
        ? [{ id: f.id, nome: f.nome, url, categoria: f.categoria }]
        : [];
    }),
    enviados: lido.anexos
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
    solucaoDaOS: link.solucao_da_os ?? link.solucao,
  };
}

/**
 * Linha do tempo (evento 'terceirizado') e aviso ao responsável da OS
 * (quem enviou o link, se não há responsável).
 */
async function avisarDoTerceirizado(
  a: Acesso,
  texto: string,
  dados: Record<string, JsonValue | undefined> = {},
  notificacao?: string,
): Promise<void> {
  const { link } = a;
  try {
    await banco.comoServico((tx) =>
      registrarComoSistema(tx, ordem(link.ordem_id), {
        tipo: "terceirizado",
        autorNome: a.autor,
        texto,
        dados: { link_id: link.id, ...dados },
      }),
    );
  } catch (err) {
    log.error({ err, id: link.ordem_id }, "linha do tempo do terceirizado");
  }
  if (!notificacao) return;
  // O aviso à equipe não muda a resposta ao terceirizado: sai depois.
  depois("aviso do terceirizado", () =>
    notificar([link.responsavel_id ?? link.criado_por ?? link.aberto_por], {
      tipo: "terceirizado",
      titulo: `#${link.numero} ${link.titulo}`,
      texto: notificacao,
      href: rotaOrdem(link.ordem_id),
      alvo: ordem(link.ordem_id),
    }),
  );
}

async function gravarLink(
  a: Acesso,
  muda: Parameters<typeof repo.gravarLink>[2],
): Promise<void> {
  try {
    await banco.comoServico((tx) => repo.gravarLink(tx, a.link.id, muda));
  } catch (err) {
    log.error({ err, id: a.link.id }, "link do terceirizado");
    throw new ErroDeNegocio(FALHOU);
  }
}

/** Localização enviada pelo navegador (se a pessoa permitiu). */
function localizacao(e: EntradaLocalizacao): string | null {
  const lat = Number(e.lat);
  const lng = Number(e.lng);
  if (!e.lat || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const precisao = Number(e.precisao);
  return JSON.stringify({
    lat,
    lng,
    precisao: Number.isFinite(precisao) ? Math.round(precisao) : null,
    em: new Date().toISOString(),
  });
}

export async function aceitar(token: string): Promise<string> {
  const a = await conferir(token);
  if (a.link.recusado_em) throw new ErroDeNegocio("Você já recusou esta OS.");
  if (a.link.aceito_em) return "OS aceita.";
  await gravarLink(a, { aceito_em: new Date().toISOString() });
  await avisarDoTerceirizado(
    a,
    "Aceitou a OS pelo link.",
    { acao: "aceitou" },
    "O terceirizado aceitou a OS.",
  );
  return "OS aceita. Obrigado!";
}

export async function recusar(token: string, corpo: unknown): Promise<string> {
  const a = await conferir(token);
  const d = entradaRecusa.safeParse(corpo);
  if (!d.success)
    throw new ErroDeNegocio(d.error.issues[0]?.message ?? "Motivo inválido.");
  if (a.link.chegada_em)
    throw new ErroDeNegocio(
      "O serviço já começou: fale com a ARP para desistir.",
    );
  await gravarLink(a, {
    recusado_em: new Date().toISOString(),
    recusa_motivo: d.data.motivo,
  });
  await avisarDoTerceirizado(
    a,
    `Recusou a OS: ${d.data.motivo}`,
    { acao: "recusou" },
    `O terceirizado recusou a OS: ${d.data.motivo}`,
  );
  return "Recusa registrada. A ARP foi avisada.";
}

/** "Cheguei": horário e, se permitido, a localização do aparelho. */
export async function cheguei(
  token: string,
  onde: EntradaLocalizacao,
): Promise<string> {
  const a = await conferir(token);
  if (a.link.recusado_em) throw new ErroDeNegocio(RECUSOU);
  if (a.link.chegada_em) return "Chegada já registrada.";
  const agora = new Date().toISOString();
  const local = localizacao(onde);
  await gravarLink(a, {
    chegada_em: agora,
    chegada_local: local,
    aceito_em: a.link.aceito_em ?? agora,
  });
  await avisarDoTerceirizado(a, "Chegou ao local.", {
    acao: "chegou",
    com_localizacao: local !== null,
  });
  return "Chegada registrada.";
}

/** "Terminei": horário de saída e, se permitido, a localização. */
export async function terminei(
  token: string,
  onde: EntradaLocalizacao,
): Promise<string> {
  const a = await conferir(token);
  if (a.link.recusado_em) throw new ErroDeNegocio(RECUSOU);
  if (a.link.terminado_em) return "Término já registrado.";
  const agora = new Date().toISOString();
  const local = localizacao(onde);
  await gravarLink(a, {
    saida_em: agora,
    saida_local: local,
    terminado_em: agora,
    chegada_em: a.link.chegada_em ?? agora,
    aceito_em: a.link.aceito_em ?? agora,
  });
  await avisarDoTerceirizado(
    a,
    "Terminou o serviço.",
    { acao: "terminou", com_localizacao: local !== null },
    "O terceirizado terminou o serviço. Confira, assine e conclua a OS.",
  );
  return "Serviço registrado como terminado. Obrigado!";
}

/** Solução, valor e nº do orçamento ou nota que ele informa. */
export async function salvarRelatorio(
  token: string,
  corpo: Record<string, unknown>,
): Promise<string> {
  const a = await conferir(token);
  if (a.link.recusado_em) throw new ErroDeNegocio(RECUSOU);
  if (a.link.assinado_em) throw new ErroDeNegocio(JA_ASSINOU);
  const d = entradaRelatorio.safeParse({
    solucao: corpo.solucao ?? "",
    valor: corpo.valor ?? "",
    orcamento_numero: corpo.orcamento_numero ?? "",
  });
  if (!d.success) throw new ErroDeNegocio("Confira os campos.");
  const valor = lerValorBr(d.data.valor);
  if (valor !== null && (Number.isNaN(valor) || valor < 0))
    throw new ErroDeNegocio("Valor: informe em reais, por exemplo 1.250,00.");
  if (!d.data.solucao && valor === null)
    throw new ErroDeNegocio("Descreva a solução ou informe o valor.");
  await gravarLink(a, {
    solucao: d.data.solucao || null,
    valor_informado: valor,
    orcamento_numero: d.data.orcamento_numero || null,
  });
  // A solução entra na OS se ainda não há uma; o valor, a ARP confere.
  if (d.data.solucao && !a.link.solucao_da_os?.trim())
    try {
      await banco.comoServico((tx) =>
        repo.atualizarOrdem(
          tx,
          a.link.ordem_id,
          { solucao: d.data.solucao },
          { solucaoVazia: true },
        ),
      );
    } catch (err) {
      log.error({ err, id: a.link.ordem_id }, "solução do terceirizado");
    }
  await avisarDoTerceirizado(
    a,
    [
      d.data.solucao && `Solução: ${d.data.solucao}`,
      valor !== null && `Valor informado: ${formatarMoeda(valor)}`,
      d.data.orcamento_numero && `Orçamento/nota: ${d.data.orcamento_numero}`,
    ]
      .filter(Boolean)
      .join("\n"),
    { acao: "relatorio" },
  );
  return "Enviado à ARP.";
}

const NOMES: Record<CategoriaDeArquivo, string> = {
  antes: "fotos de antes",
  depois: "fotos de depois",
  orcamento: "orçamento",
  laudo: "laudo",
};

const ehCategoria = (v: unknown): v is CategoriaDeArquivo =>
  CATEGORIAS_DE_ARQUIVO.some((c) => c === v);

/** Fotos (antes e depois) e o orçamento ou laudo. */
export async function enviarArquivosDoTerceirizado(
  token: string,
  categoria: unknown,
  arquivos: ArquivoRecebido[],
): Promise<string> {
  const a = await conferir(token);
  if (a.link.recusado_em) throw new ErroDeNegocio(RECUSOU);
  if (a.link.assinado_em) throw new ErroDeNegocio(JA_ASSINOU);
  if (!ehCategoria(categoria)) throw new ErroDeNegocio("Envio inválido.");
  const tipos = conferirEnvio(
    arquivos,
    categoria === "orcamento" || categoria === "laudo",
  );
  const ordemId = a.link.ordem_id;
  for (const [i, f] of arquivos.entries()) {
    const mime = tipos[i] ?? "";
    const path = caminhoDoArquivo("chamados", ordemId, f.nome);
    try {
      await enviarArquivo(path, f.bytes, mime);
    } catch (err) {
      log.error({ err, ordemId }, "arquivo do terceirizado");
      throw new ErroDeNegocio(
        `Não foi possível enviar ${f.nome}. Tente de novo.`,
      );
    }
    try {
      await banco.comoServico((tx) =>
        repo.inserirArquivo(tx, {
          ordem_id: ordemId,
          categoria,
          nome: f.nome.slice(0, 200),
          path,
          mime,
          tamanho: f.bytes.length,
          enviado_por_nome: a.autor,
        }),
      );
    } catch (err) {
      log.error({ err, ordemId }, "anexo do terceirizado");
      await removerArquivos([path]);
      throw new ErroDeNegocio(FALHOU);
    }
  }
  await avisarDoTerceirizado(
    a,
    `Enviou ${arquivos.length === 1 ? "1 arquivo" : `${arquivos.length} arquivos`} (${NOMES[categoria]}).`,
    { acao: "arquivos", categoria, quantidade: arquivos.length },
  );
  return arquivos.length === 1 ? "Arquivo enviado." : "Arquivos enviados.";
}

/**
 * Depois de "Terminei", ele confere a OS (o que fez, valor, fotos) e
 * assina na tela. Daí em diante a ARP valida e assina por último.
 */
export async function assinarPeloLink(
  token: string,
  campos: Record<string, unknown>,
  arquivo: ArquivoRecebido | undefined,
): Promise<string> {
  const a = await conferir(token);
  if (a.link.recusado_em) throw new ErroDeNegocio(RECUSOU);
  if (a.link.assinado_em) return "OS já assinada.";
  if (!a.link.terminado_em)
    throw new ErroDeNegocio("Toque em Terminei antes de assinar.");
  if (!a.link.solucao?.trim() && !a.link.solucao_da_os?.trim())
    throw new ErroDeNegocio(
      "Conte o que foi feito (solução) antes de assinar.",
    );
  const d = entradaAssinaturaDoLink.safeParse({
    nome: campos.nome ?? "",
    documento: campos.documento ?? "",
  });
  if (!d.success)
    throw new ErroDeNegocio(d.error.issues[0]?.message ?? "Confira os campos.");
  const png = pngDaAssinatura(arquivo, "Assine no quadro antes de enviar.");

  const path = caminhoDoArquivo(
    "assinaturas",
    a.link.ordem_id,
    "terceirizado.png",
  );
  try {
    await enviarArquivo(path, png.bytes, "image/png");
  } catch (err) {
    log.error({ err, id: a.link.id }, "assinatura do terceirizado");
    throw new ErroDeNegocio(
      "Não foi possível guardar a assinatura. Tente de novo.",
    );
  }
  // Só grava se ninguém assinou no meio do caminho (dois toques).
  let gravou: number;
  try {
    gravou = await banco.comoServico((tx) =>
      repo.gravarLink(
        tx,
        a.link.id,
        {
          assinatura_nome: d.data.nome,
          assinatura_documento: d.data.documento || null,
          assinatura_path: path,
          assinado_em: new Date().toISOString(),
        },
        { naoAssinado: true },
      ),
    );
  } catch (err) {
    log.error({ err, id: a.link.id }, "assinatura do terceirizado");
    await removerArquivos([path]);
    throw new ErroDeNegocio(FALHOU);
  }
  if (!gravou) {
    await removerArquivos([path]);
    return "OS já assinada.";
  }
  await avisarDoTerceirizado(
    a,
    `Conferiu e assinou a OS (${d.data.nome}).`,
    { acao: "assinou" },
    "O terceirizado conferiu e assinou a OS. Valide e assine como ARP para concluir.",
  );
  return "OS assinada. A ARP vai validar e concluir. Obrigado!";
}
