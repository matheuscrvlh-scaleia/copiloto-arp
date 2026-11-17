import { fimDoMesDe, somarDias } from "@arp/shared/comercial/datas";
import { fotoDaOcupacao } from "@arp/shared/comercial/ocupacao";
import {
  aniversariosParaLembrar,
  chaveDoLembrete,
  quandoEh,
} from "@arp/shared/comercial/relacionamento";
import { formatarData } from "@arp/shared/formato";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import type { Rotina } from "@/infra/agendador";
import { banco } from "@/infra/banco";
import { registrarDepois } from "@/infra/eventos";
import { log } from "@/infra/log";
import { dadosEnet } from "./fontes";
import { limparPreviasAbandonadas } from "./importacoes.service";
import * as repo from "./jobs.repository";
import { lerFichasComSocios } from "./relacionamento.service";
import { rotinaDoSac } from "./sac.service";

// Rotina diária do Comercial (a antiga /api/cron/comercial, no mesmo
// horário UTC), só dentro do sistema (nada vai para o locatário):
// aniversário de contrato e de sócio X dias antes (lembrete_aniversario_dias)
// para quem tem comercial.relacionamento.ver, e documento do kit vencendo
// (kit_aviso_dias) para quem tem comercial.kit.editar. Vão para o sino
// (os.notificacoes) com uma chave por aviso: rodar de novo não repete.
// Também grava a foto da ocupação do fim do mês para o Painel e limpa as
// prévias de importação abandonadas.

export interface ResultadoRotinaCom {
  chave: string;
  rotulo: string;
  ok: boolean;
  /** Avisos novos. */
  registros: number;
  erro?: string;
}

interface Aviso {
  tipo: "comercial_aniversario" | "comercial_kit";
  titulo: string;
  texto: string;
  href: string;
  chave: string;
}

type Params = Awaited<ReturnType<typeof repo.parametros>>;

/** Grava os avisos para quem tem a permissão; devolve quantos eram novos. */
function avisar(permissao: string, avisos: Aviso[]): Promise<number> {
  return banco.comoServico(async (tx) => {
    const usuarios = await repo.usuariosComPermissao(tx, permissao);
    return repo.avisar(
      tx,
      usuarios.flatMap((usuario_id) =>
        avisos.map((a) => ({
          usuario_id,
          tipo: a.tipo,
          titulo: a.titulo.slice(0, 200),
          texto: a.texto.slice(0, 500),
          href: a.href,
          chave: a.chave,
        })),
      ),
    );
  });
}

async function rotinaAniversarios(hoje: string, p: Params): Promise<number> {
  const enet = dadosEnet(hoje);
  const fichas = await lerFichasComSocios(false);
  // Locatário de exemplo não vai para o sino: com o ENET de exemplo, só os
  // sócios das fichas reais (sem ligar a contrato fictício).
  const lista = aniversariosParaLembrar(
    enet.exemplo
      ? { lucs: enet.lucs, contratos: [], clientes: [], fichas, hoje }
      : { ...enet, fichas, hoje },
    p.lembrete_aniversario_dias,
  );
  if (!lista.length) return 0;
  const avisos: Aviso[] = lista.map((a) => {
    const dia = formatarData(a.data).slice(0, 5);
    const quando = quandoEh(a.data, hoje);
    return {
      tipo: "comercial_aniversario",
      titulo:
        a.tipo === "contrato"
          ? `Aniversário de contrato: ${a.locatario} (${a.luc})`
          : `Aniversário de sócio: ${a.socio}, de ${a.locatario}`,
      texto:
        a.tipo === "contrato"
          ? `${a.anos} ${a.anos === 1 ? "ano" : "anos"} de ARP em ${dia} (${quando}).`
          : [
              `Dia ${dia} (${quando}).`,
              [a.luc, a.bloco].filter(Boolean).join(", ").replace(/.+/, "$&."),
              a.origem === "ficha"
                ? "Data da ficha cadastral feita no sistema."
                : "",
            ]
              .filter(Boolean)
              .join(" "),
      href: `/comercial/relacionamento?aba=aniversarios&mes=${Number(a.data.slice(5, 7))}`,
      chave: chaveDoLembrete(a),
    };
  });
  return avisar("comercial.relacionamento.ver", avisos);
}

async function rotinaKit(hoje: string, p: Params): Promise<number> {
  const ate = somarDias(hoje, p.kit_aviso_dias);
  const versoes = await banco.comoServico((tx) =>
    repo.versoesVencendo(tx, ate),
  );
  const avisos: Aviso[] = [];
  for (const v of versoes) {
    if (!v.validade) continue;
    const venceu = v.validade < hoje;
    avisos.push({
      tipo: "comercial_kit",
      titulo: `${venceu ? "Documento do kit vencido" : "Documento do kit vencendo"}: ${v.nome}`,
      texto: `Versão ${v.versao}, ${venceu ? "venceu" : "vence"} em ${formatarData(v.validade)}. Suba a versão nova no Kit de entrega.`,
      href: "/comercial/kit",
      chave: `comercial:kit:${v.id}:${v.validade}:${venceu ? "venceu" : "vence"}`,
    });
  }
  if (!avisos.length) return 0;
  return avisar("comercial.kit.editar", avisos);
}

/**
 * Foto da ocupação do fim do mês (Painel, 4.10): o mês anterior, se ainda
 * não tem (cobre o dia em que a rotina não rodou), e o mês atual no último
 * dia dele. A foto gravada não muda (ignora a repetida).
 */
async function rotinaFotoOcupacao(hoje: string): Promise<number> {
  const enet = dadosEnet(hoje);
  return banco.comoServico(async (tx) => {
    const tipos = await repo.tiposLuc(tx);
    const contam = new Set(
      tipos.filter((t) => t.conta_ocupacao).map((t) => t.tipo),
    );
    const dias = [somarDias(`${hoje.slice(0, 7)}-01`, -1)];
    if (fimDoMesDe(hoje) === hoje) dias.push(hoje);
    // Foto de dado de exemplo sai marcada (Remover dados de exemplo apaga).
    const fotos = dias.map((d) => {
      const f = fotoDaOcupacao(enet, d, hoje, contam);
      return {
        ...f,
        por_bloco: JSON.stringify(f.por_bloco),
        por_tipo: JSON.stringify(f.por_tipo),
        exemplo: enet.exemplo,
      };
    });
    return (await repo.gravarFotos(tx, fotos)).length;
  });
}

const ROTINAS_DO_DIA = [
  {
    chave: "foto_ocupacao",
    rotulo: "Foto da ocupação do fim do mês",
    rodar: (hoje: string) => rotinaFotoOcupacao(hoje),
  },
  {
    chave: "aniversarios",
    rotulo: "Aniversários de contrato e de sócio",
    rodar: rotinaAniversarios,
  },
  { chave: "kit", rotulo: "Documentos do kit vencendo", rodar: rotinaKit },
] as const;

const mensagem = (erro: unknown) =>
  erro instanceof Error ? erro.message : "falha desconhecida";

/** Cada rotina isolada: uma falha não impede a outra. */
export async function rodarRotinasComercial(
  agora = new Date(),
): Promise<ResultadoRotinaCom[]> {
  const hoje = hojeEmBrasilia(agora);
  let p: Params;
  try {
    p = await banco.comoServico(repo.parametros);
  } catch (erro) {
    return ROTINAS_DO_DIA.map((r) => ({
      chave: r.chave,
      rotulo: r.rotulo,
      ok: false,
      registros: 0,
      erro: mensagem(erro),
    }));
  }
  const resultados: ResultadoRotinaCom[] = [];
  for (const r of ROTINAS_DO_DIA) {
    try {
      resultados.push({
        chave: r.chave,
        rotulo: r.rotulo,
        ok: true,
        registros: await r.rodar(hoje, p),
      });
    } catch (erro) {
      log.error({ err: erro, rotina: r.chave }, "rotina do comercial");
      resultados.push({
        chave: r.chave,
        rotulo: r.rotulo,
        ok: false,
        registros: 0,
        erro: mensagem(erro),
      });
    }
  }
  // Limpeza, fora da contagem de avisos.
  await limparPreviasAbandonadas().catch((erro: unknown) =>
    log.error({ err: erro }, "prévias de importação abandonadas"),
  );
  const total = resultados.reduce((t, r) => t + r.registros, 0);
  const falhas = resultados.filter((r) => !r.ok);
  if (total > 0 || falhas.length > 0)
    registrarDepois({
      modulo: "comercial",
      evento: "comercial_rotina",
      descricao: [
        `Lembretes do dia: ${total} ${total === 1 ? "aviso" : "avisos"}`,
        falhas.length
          ? `falha em ${falhas.map((f) => f.rotulo).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      usuarioId: null,
      detalhes: {
        rotinas: resultados.map((r) => ({
          rotina: r.chave,
          ok: r.ok,
          registros: r.registros,
          erro: r.erro ?? null,
        })),
      },
    });
  if (falhas.length)
    throw new Error(
      `Rotina do Comercial: falha em ${falhas.map((f) => f.chave).join(", ")}`,
    );
  return resultados;
}

export const rotinasDoComercial: Rotina[] = [
  {
    nome: "comercial.rotinas",
    cron: "0 11 * * *",
    executar: async () => {
      await rodarRotinasComercial(new Date());
    },
  },
  {
    // Registros do SAC no Asana → contatos do Relacionamento.
    nome: "comercial.sac",
    cron: "30 10 * * *",
    executar: rotinaDoSac,
  },
];
