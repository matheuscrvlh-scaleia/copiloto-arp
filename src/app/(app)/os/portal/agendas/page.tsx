import { CalendarX, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BotaoLink, Situacao } from "@/components/admin/ui";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { Atualizado } from "@/components/os/portal/cartao-filtro";
import { FormBloqueio } from "@/components/os/portal/form-bloqueio";
import { AcoesDoHorario } from "@/components/os/portal/remarcar";
import { SemAcesso } from "@/components/protegido";
import { formatarDataHora } from "@/lib/formato";
import {
  DIAS_CURTOS,
  descreverHorario,
  modeloDaMensagem,
} from "@/lib/os/portal";
import { hojeEmBrasilia, paraBrasilia } from "@/lib/os/tempo";
import { linkWhatsApp, preencher } from "@/lib/os/whatsapp";
import { removerBloqueio } from "@/server/os/acoes/portal";
import {
  type Agendamento,
  agendas,
  bloqueiosFuturos,
  categoriasPorAgenda,
  paraRemarcar,
  proximosHorarios,
} from "@/server/os/agenda";
import { contexto, parametros } from "@/server/os/base";
import { diasParaRemarcar, linkDoPortalDaLoja } from "@/server/os/portal";

export const metadata: Metadata = { title: "Agendas · Portal e agenda" };

/** Quantos dias à frente a lista de próximos horários mostra. */
const DIAS_PROXIMOS = 14;

export default function Page({
  searchParams,
}: PageProps<"/os/portal/agendas">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-40" />
          <CartaoCarregando altura="h-80" />
          <CartaoCarregando altura="h-64" />
        </TelaCarregando>
      }
    >
      <Agendas searchParams={searchParams} />
    </Suspense>
  );
}

async function Agendas({
  searchParams,
}: Pick<PageProps<"/os/portal/agendas">, "searchParams">) {
  const [ctx, sp] = await Promise.all([contexto(), searchParams]);
  if (!ctx.pode("os.portal_agenda")) return <SemAcesso />;
  const agora = new Date();
  const [lista, bloqueios, remarcar, proximos, usos, p] = await Promise.all([
    agendas(),
    bloqueiosFuturos(agora),
    paraRemarcar(),
    proximosHorarios(agora, DIAS_PROXIMOS),
    categoriasPorAgenda(),
    parametros(),
  ]);
  const nomeDa = new Map(lista.map((a) => [a.id, a.nome]));
  // Os dias livres e as mensagens não dependem um do outro.
  const [dias, avisos] = await Promise.all([
    diasParaRemarcar(lista, new Set(remarcar.map((a) => a.agenda_id)), agora),
    mensagensDeRemarcar(remarcar, nomeDa, p.mensagens),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Atualizado agora={agora} />
      {sp.salva && (
        <output className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
          Agenda criada.
        </output>
      )}

      {remarcar.length > 0 && (
        <Secao
          titulo={`Remarcar (${remarcar.length})`}
          descricao="Horários atingidos por um bloqueio. Avise a loja pelo WhatsApp: ela escolhe outro horário pelo portal, ou você marca aqui."
        >
          <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
            {remarcar.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0"
              >
                <Horario a={a} agenda={nomeDa.get(a.agenda_id)} destaque />
                <AcoesDoHorario
                  agendamento={a.id}
                  whatsapp={avisos.get(a.id)}
                  dias={dias.get(a.agenda_id) ?? []}
                />
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao
        titulo="Bloquear por clima"
        descricao="Bloqueie um dia ou um período. Ninguém marca nele, e quem já tinha horário vai para Remarcar."
      >
        {lista.length ? (
          <FormBloqueio
            agendas={lista
              .filter((a) => a.ativo)
              .map((a) => ({ id: a.id, nome: a.nome }))}
            hoje={hojeEmBrasilia(agora)}
          />
        ) : (
          <p className="text-sm text-neutral-500">Crie uma agenda primeiro.</p>
        )}
        {bloqueios.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">Bloqueios em vigor</h3>
            <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
              {bloqueios.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <p className="flex min-w-0 items-start gap-2 text-sm">
                    <CalendarX
                      className="mt-0.5 size-4 shrink-0 text-red-700"
                      aria-hidden
                    />
                    <span>
                      <span className="font-medium">
                        {nomeDa.get(b.agenda_id) ?? "Agenda"}
                      </span>{" "}
                      · {periodo(b.inicio, b.fim)}
                      <span className="block text-xs text-neutral-500">
                        {b.motivo}
                      </span>
                    </span>
                  </p>
                  <FormAcao
                    acao={removerBloqueio}
                    variante="secundario"
                    rotulo="Remover"
                    rotuloEnviando="Removendo…"
                    confirmar="Remover este bloqueio? Os horários voltam a ficar livres. Quem foi para Remarcar continua lá."
                  >
                    <input type="hidden" name="id" value={b.id} />
                  </FormAcao>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Secao>

      <Secao
        titulo="Agendas"
        descricao="Horários e limite de cada agenda. A categoria do catálogo diz qual agenda o pedido usa."
      >
        <div className="mb-4 flex justify-end">
          <BotaoLink href="/os/portal/agendas/nova">
            <span className="grid size-6 place-items-center rounded-full bg-white/20">
              <Plus className="size-4" aria-hidden />
            </span>
            Nova agenda
          </BotaoLink>
        </div>
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {lista.map((a) => (
            <li key={a.id}>
              <Link
                href={`/os/portal/agendas/${a.id}`}
                className="flex h-full items-center gap-3 rounded-2xl bg-white/60 p-4 transition hover:bg-white"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{a.nome}</span>
                    {a.ativo ? (
                      <Situacao tipo="ok">Aceitando</Situacao>
                    ) : (
                      <Situacao tipo="neutro">Pausada</Situacao>
                    )}
                  </span>
                  <span className="mt-1 block text-sm text-neutral-700 tabular-nums">
                    {a.hora_inicio.slice(0, 5)} às {a.hora_fim.slice(0, 5)} ·{" "}
                    {a.duracao_min} min cada · até {a.limite_por_dia} por dia ·
                    marca até {a.antecedencia_dias} dias à frente
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {[...a.dias_semana]
                      .sort((x, y) => x - y)
                      .map((d) => DIAS_CURTOS[d])
                      .join(", ")}
                    {usos.get(a.id)?.length
                      ? ` · Usada em: ${usos.get(a.id)?.join(", ")}`
                      : " · Nenhuma categoria usa ainda"}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-neutral-400"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao
        titulo={`Próximos horários (${DIAS_PROXIMOS} dias)`}
        descricao="O que está marcado. Cada horário aparece também no Calendário."
      >
        {proximos.length ? (
          <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
            {proximos.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <Horario a={a} agenda={nomeDa.get(a.agenda_id)} />
                <AcoesDoHorario agendamento={a.id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Nenhum horário marcado.</p>
        )}
      </Secao>
    </div>
  );
}

function periodo(inicio: string, fim: string): string {
  const i = paraBrasilia(new Date(inicio));
  const f = paraBrasilia(new Date(fim));
  const diaInteiro = i.hora === "00:00" && f.hora === "00:00";
  if (diaInteiro) {
    const ultimo = paraBrasilia(new Date(new Date(fim).getTime() - 1)).data;
    const d = (x: string) =>
      `${x.slice(8, 10)}/${x.slice(5, 7)}/${x.slice(0, 4)}`;
    return ultimo === i.data
      ? `${d(i.data)}, dia inteiro`
      : `${d(i.data)} a ${d(ultimo)}, dias inteiros`;
  }
  return `${formatarDataHora(inicio)} até ${f.data === i.data ? f.hora : formatarDataHora(fim)}`;
}

function Horario({
  a,
  agenda,
  destaque = false,
}: {
  a: Agendamento;
  agenda?: string;
  destaque?: boolean;
}) {
  return (
    <div className="min-w-0 text-sm">
      <p className="font-medium">
        {descreverHorario(new Date(a.inicio))}
        <span className="font-normal text-neutral-500">
          {" "}
          · {agenda ?? "Agenda"}
        </span>
      </p>
      <p className="mt-0.5 text-xs text-neutral-500">
        {[
          a.loja ? `${a.loja.luc} · ${a.loja.nome}` : "Sem loja",
          a.chamado ? `Chamado #${a.chamado.numero}` : null,
          a.chamado?.solicitante_nome,
          a.observacao,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {destaque && (
        <p className="mt-1 text-xs font-medium text-amber-900">
          Precisa remarcar
        </p>
      )}
    </div>
  );
}

/** Mensagem "remarcar" pronta para o WhatsApp de cada agendamento. */
async function mensagensDeRemarcar(
  remarcar: Agendamento[],
  nomeDa: Map<string, string>,
  mensagens: unknown,
): Promise<Map<string, string>> {
  const modelo = modeloDaMensagem(mensagens, "remarcar");
  const lojas = [
    ...new Set(remarcar.flatMap((a) => (a.loja_id ? [a.loja_id] : []))),
  ];
  const links = new Map(
    await Promise.all(
      lojas.map(async (id) => [id, await linkDoPortalDaLoja(id)] as const),
    ),
  );
  return new Map(
    remarcar.map((a) => {
      const { data, hora } = paraBrasilia(new Date(a.inicio));
      const texto = preencher(modelo, {
        nome: a.chamado?.solicitante_nome || a.loja?.nome,
        data: `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`,
        hora,
        assunto: a.chamado?.titulo ?? nomeDa.get(a.agenda_id),
        link: a.loja_id ? links.get(a.loja_id) : null,
      });
      const telefone =
        a.chamado?.solicitante_telefone || a.loja?.telefone || null;
      return [a.id, linkWhatsApp(telefone, texto)];
    }),
  );
}
