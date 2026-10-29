import "server-only";
import {
  aceiteVenceu,
  avisoDoPrazo,
  chaveDoAviso,
  confirmacaoParada,
  destinoVenceu,
  JANELA_VENCIDO_DIAS,
  TEXTO_FECHADO_AUTOMATICO,
} from "@/lib/os/automacao";
import { numeroDo } from "@/lib/os/numeros";
import type { Calendario } from "@/lib/os/prazo";
import { rotaDo } from "@/lib/os/rotas";
import { MS_DIA } from "@/lib/os/tempo";
import { prazoRelativo } from "@/lib/os/texto";
import {
  type AvisoPlanejado,
  cacheDeSetores,
  configDoSistema,
  notificarUmaVez,
} from "../automacao";
import {
  type Alvo,
  notificar,
  osAdmin,
  type Parametros,
  registrarComoSistema,
  tabelaDo,
} from "../base";

// Aceite automático (fecha o Concluído depois do prazo de aceite), avisos de
// "vence em 24h" e "venceu" (do chamado e dos destinos de Aviso) e lembrete
// de confirmação parada. Roda de hora em hora pela /api/cron/os com a
// service role; tudo é idempotente (status conferido no update, chave em
// cada notificação). Vale para chamados e OS (cada um na sua tabela).
// Devolve quantos fechou mais quantas notificações novas saíram.

const LOTE = 1000;
const titulo = (c: Pick<Alvo, "tipo"> & { numero: number; titulo: string }) =>
  `${numeroDo(c)} ${c.titulo}`;
/** Uma vez para os chamados e outra para as OS. */
const DONOS = [{ tipo: "solicitacao" }, { tipo: "os" }] as const;
const emAmbos = async <T>(f: (dono: Pick<Alvo, "tipo">) => Promise<T[]>) =>
  (await Promise.all(DONOS.map(f))).flat();

export async function rotinaAceite(agora: Date): Promise<number> {
  const { p, cal } = await configDoSistema();
  const setores = cacheDeSetores();
  const fechados = await fecharVencidos(p, cal, agora);
  const avisos = [
    ...(await avisosDePrazo(p, agora, setores)),
    ...(await avisosDosDestinos(agora, setores)),
    ...(await lembretesDeConfirmacao(p, cal, agora)),
  ];
  return fechados + (await notificarUmaVez(avisos));
}

/** Concluído há mais que o prazo de aceite → Fechado sozinho. */
async function fecharVencidos(
  p: Parametros,
  cal: Calendario,
  agora: Date,
): Promise<number> {
  const db = osAdmin();
  const data = await emAmbos(async (dono) => {
    const { data, error } = await db
      .from(tabelaDo(dono))
      .select("id, tipo, numero, titulo, concluido_em, responsavel_id")
      .eq("status", "concluido")
      .not("concluido_em", "is", null)
      .order("concluido_em")
      .limit(LOTE);
    if (error) throw new Error(`Chamados concluídos: ${error.message}`);
    return data ?? [];
  });

  let fechados = 0;
  for (const c of data) {
    if (!c.concluido_em) continue;
    if (!aceiteVenceu(c.concluido_em, p.aceite_dias_uteis, cal, agora))
      continue;
    // Só fecha se ainda está Concluído (quem pediu pode ter confirmado ou
    // reaberto entre a leitura e agora).
    const { data: mudou, error: e } = await db
      .from(tabelaDo(c))
      .update({ status: "fechado", fechado_automatico: true })
      .eq("id", c.id)
      .eq("status", "concluido")
      .select("id");
    if (e) throw new Error(`Fechar ${numeroDo(c)}: ${e.message}`);
    if (!mudou?.length) continue;
    fechados++;
    await registrarComoSistema(c, {
      tipo: "status",
      autorNome: "Sistema",
      texto: TEXTO_FECHADO_AUTOMATICO,
      dados: { de: "concluido", para: "fechado", automatico: true },
    });
    await notificar([c.responsavel_id], {
      tipo: "fechado",
      titulo: titulo(c),
      texto: TEXTO_FECHADO_AUTOMATICO,
      href: rotaDo(c),
      alvo: c,
    });
  }
  return fechados;
}

/**
 * Vence em N horas → responsável (ou a fila do setor). Venceu → responsável
 * e gestores do setor. Vencido há muito tempo não avisa de novo: o aviso é
 * do momento em que venceu (a tela já mostra o atraso).
 */
async function avisosDePrazo(
  p: Parametros,
  agora: Date,
  setores: ReturnType<typeof cacheDeSetores>,
): Promise<AvisoPlanejado[]> {
  const ate = new Date(agora.getTime() + p.aviso_vencimento_horas * 3_600_000);
  const desde = new Date(agora.getTime() - JANELA_VENCIDO_DIAS * MS_DIA);
  const data = await emAmbos(async (dono) => {
    const { data, error } = await osAdmin()
      .from(tabelaDo(dono))
      .select(
        "id, tipo, numero, titulo, status, prazo, responsavel_id, setor_id",
      )
      .in("status", ["aberto", "em_andamento"])
      .gte("prazo", desde.toISOString())
      .lte("prazo", ate.toISOString())
      .limit(LOTE);
    if (error) throw new Error(`Prazos: ${error.message}`);
    return data ?? [];
  });

  const avisos: AvisoPlanejado[] = [];
  for (const c of data) {
    const tipo = avisoDoPrazo(c, agora, p.aviso_vencimento_horas);
    if (!tipo || !c.prazo) continue;
    const usuarios =
      tipo === "vence"
        ? c.responsavel_id
          ? [c.responsavel_id]
          : await setores.membros(c.setor_id)
        : [
            ...(c.responsavel_id ? [c.responsavel_id] : []),
            ...(await setores.gestores(c.setor_id)),
          ];
    avisos.push({
      usuarios,
      tipo,
      titulo: titulo(c),
      texto:
        tipo === "vence"
          ? `O prazo está chegando: ${prazoRelativo(c.prazo, agora)}.`
          : "O prazo venceu.",
      href: rotaDo(c),
      alvo: c,
      chave: chaveDoAviso(tipo, c.id, c.prazo),
    });
  }
  return avisos;
}

/** Destino de Aviso com prazo próprio que venceu → quem cuida dele. */
async function avisosDosDestinos(
  agora: Date,
  setores: ReturnType<typeof cacheDeSetores>,
): Promise<AvisoPlanejado[]> {
  const desde = new Date(agora.getTime() - JANELA_VENCIDO_DIAS * MS_DIA);
  // O dono (chamado ou OS) vem junto, pela chave de cada um.
  const data = await emAmbos(async (dono) => {
    const { data, error } = await osAdmin()
      .from("destinatarios")
      .select(
        `id, setor_id, usuario_id, responsavel_id, titulo, prazo, status, chamado:${tabelaDo(dono)}!inner(id, tipo, numero, titulo, status)`,
      )
      .neq("status", "concluido")
      .gte("prazo", desde.toISOString())
      .lte("prazo", agora.toISOString())
      .in("chamado.status", ["aberto", "em_andamento", "aguardando"])
      .limit(LOTE);
    if (error) throw new Error(`Destinos: ${error.message}`);
    return data ?? [];
  });

  const avisos: AvisoPlanejado[] = [];
  for (const d of data) {
    if (!d.prazo || !destinoVenceu(d, agora)) continue;
    const quem = d.responsavel_id ?? d.usuario_id;
    const usuarios = quem
      ? [quem]
      : d.setor_id
        ? await setores.membros(d.setor_id)
        : [];
    avisos.push({
      usuarios,
      tipo: "venceu",
      titulo: titulo(d.chamado),
      texto: `Venceu o prazo da sua parte${d.titulo ? `: ${d.titulo}` : ""}.`,
      href: rotaDo(d.chamado),
      alvo: d.chamado,
      chave: `venceu:destino:${d.id}:${new Date(d.prazo).toISOString()}`,
    });
  }
  return avisos;
}

/** Concluído esperando confirmação há N dias úteis → lembra quem pediu. */
async function lembretesDeConfirmacao(
  p: Parametros,
  cal: Calendario,
  agora: Date,
): Promise<AvisoPlanejado[]> {
  const data = await emAmbos(async (dono) => {
    const { data, error } = await osAdmin()
      .from(tabelaDo(dono))
      .select("id, tipo, numero, titulo, concluido_em, aberto_por")
      .eq("status", "concluido")
      .not("aberto_por", "is", null)
      .not("concluido_em", "is", null)
      .limit(LOTE);
    if (error) throw new Error(`Confirmações: ${error.message}`);
    return data ?? [];
  });

  return data.flatMap((c): AvisoPlanejado[] => {
    if (!c.concluido_em || !c.aberto_por) return [];
    if (
      !confirmacaoParada(c.concluido_em, p.confirmacao_alerta_dias, cal, agora)
    )
      return [];
    return [
      {
        usuarios: [c.aberto_por],
        tipo: "confirmar",
        titulo: titulo(c),
        texto:
          "Concluído e esperando a sua confirmação. Confirme ou reabra; sem resposta, fecha sozinho.",
        href: rotaDo(c),
        alvo: c,
        // Reaberto e concluído de novo, lembra de novo.
        chave: `confirmar:${c.id}:${new Date(c.concluido_em).toISOString()}`,
      },
    ];
  });
}
