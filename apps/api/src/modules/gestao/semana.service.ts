import { formatarData } from "@arp/shared/formato";
import {
  type DesafioDaSemana,
  ordenarDesafios,
  type RespostaSemana,
  semanaDe,
} from "@arp/shared/gestao/semana";
import { hojeEmBrasilia, paraBrasilia } from "@arp/shared/os/tempo";
import { type Contexto, pode } from "@/contexto";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import { itensEntre } from "@/modules/calendario/itens.service";
import { ACESSO as ACESSO_AGENDA } from "@/modules/calendario/tipos.service";
import * as repo from "./semana.repository";

// "Minha semana" (página inicial da Gestão): o que é da pessoa nesta semana
// em cada módulo que ela acessa — itens da agenda dela, chamados em que é
// responsável, rodada do Censo terminando e os rascunhos de contrato que
// começou. Cada fonte é isolada: uma que falha não derruba as outras.

type Fonte = (ctx: Contexto, s: Semana) => Promise<DesafioDaSemana[]>;
interface Semana {
  hoje: string;
  de: string;
  ate: string;
}

const agenda: Fonte = async (ctx, s) => {
  if (!ACESSO_AGENDA.some((p) => pode(ctx, p))) return [];
  const itens = await itensEntre(ctx, s.de, s.ate);
  return itens
    .filter(
      (i) =>
        !i.concluido_em &&
        (i.responsavel_id === ctx.usuario.id ||
          (!i.responsavel_id && i.criado_por === ctx.usuario.id)),
    )
    .map((i) => ({
      grupo: "agenda",
      titulo: i.titulo,
      detalhe: `${formatarData(i.inicio)}${i.hora_inicio ? ` às ${i.hora_inicio.slice(0, 5)}` : ""}`,
      data: i.inicio,
      atrasado: i.inicio < s.hoje,
      href: "/calendario",
    }));
};

const tickets: Fonte = async (ctx, s) => {
  if (!pode(ctx, "os.acessar")) return [];
  const linhas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.chamadosDoResponsavel(tx, ctx.usuario.id),
  );
  return linhas
    .map((c) => ({
      ...c,
      dia: c.prazo ? paraBrasilia(new Date(c.prazo)).data : null,
    }))
    .filter((c) => !c.dia || c.dia <= s.ate)
    .map((c) => ({
      grupo: "tickets",
      titulo: `#${c.numero} ${c.titulo}`,
      detalhe: c.dia ? `Prazo ${formatarData(c.dia)}` : "Sem prazo",
      data: c.dia,
      atrasado: !!c.dia && c.dia < s.hoje,
      href: `/os/chamados/${c.id}`,
    }));
};

const censo: Fonte = async (ctx, s) => {
  if (!pode(ctx, "comercial.censo.aplicar")) return [];
  const rodadas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.rodadasTerminando(tx, s.ate),
  );
  return rodadas.map((r) => ({
    grupo: "comercial",
    titulo: `Censo: rodada ${r.nome} termina`,
    detalhe:
      r.fim < s.hoje
        ? `Terminou em ${formatarData(r.fim)} e segue aberta: encerre ou prorrogue`
        : `Termina em ${formatarData(r.fim)}`,
    data: r.fim,
    atrasado: r.fim < s.hoje,
    href: `/comercial/censo?aba=rodadas&rodada=${r.id}`,
  }));
};

const contratos: Fonte = async (ctx) => {
  if (!pode(ctx, "comercial.contratos.editar")) return [];
  const linhas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.rascunhosDoUsuario(tx, ctx.usuario.id),
  );
  return linhas.map((c) => ({
    grupo: "comercial",
    titulo: `Contrato em rascunho: ${c.locatario_nome || c.lucs.join(", ") || "sem locatário"}`,
    detalhe: `Mexido em ${formatarData(paraBrasilia(new Date(c.atualizado_em)).data)}`,
    data: null,
    atrasado: false,
    href: `/comercial/contratos/${c.id}`,
  }));
};

const FONTES: Record<string, Fonte> = { agenda, tickets, censo, contratos };

export async function minhaSemana(ctx: Contexto): Promise<RespostaSemana> {
  const hoje = hojeEmBrasilia(new Date());
  const s = { hoje, ...semanaDe(hoje) };
  const partes = await Promise.all(
    Object.entries(FONTES).map(([nome, fonte]) =>
      fonte(ctx, s).catch((erro: unknown) => {
        log.error({ err: erro, fonte: nome }, "minha semana");
        return [];
      }),
    ),
  );
  return { ...s, desafios: ordenarDesafios(partes.flat()) };
}
