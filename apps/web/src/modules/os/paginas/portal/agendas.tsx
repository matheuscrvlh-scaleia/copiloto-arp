import { formatarDataHora } from "@arp/shared/formato";
import type { AgendamentoDoPortal } from "@arp/shared/os/contratos/portal";
import { DIAS_CURTOS, descreverHorario } from "@arp/shared/os/portal";
import { paraBrasilia } from "@arp/shared/os/tempo";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarX, ChevronRight, Plus } from "lucide-react";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { Protegido } from "@/components/protegido";
import { Link, useBusca } from "@/lib/navegacao";
import { BotaoLink, Situacao } from "@/modules/admin/components/ui";
import { consultaDasAgendas, removerBloqueio } from "@/modules/os/api-portal";
import { Atualizado } from "@/modules/os/components/portal/cartao-filtro";
import { FormBloqueio } from "@/modules/os/components/portal/form-bloqueio";
import { AcoesDoHorario } from "@/modules/os/components/portal/remarcar";

/** Quantos dias à frente a lista de próximos horários mostra. */
const DIAS_PROXIMOS = 14;

export default function Pagina() {
  return (
    <Protegido permissao="os.portal_agenda">
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-40" />
            <CartaoCarregando altura="h-80" />
            <CartaoCarregando altura="h-64" />
          </TelaCarregando>
        }
      >
        <Agendas />
      </Suspense>
    </Protegido>
  );
}

function Agendas() {
  const sp = useBusca();
  const { data } = useSuspenseQuery(consultaDasAgendas);
  const { agendas: lista, bloqueios, remarcar, proximos, usos, dias } = data;
  const agora = new Date(data.agora);
  const nomeDa = new Map(lista.map((a) => [a.id, a.nome]));

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
                  whatsapp={a.whatsapp}
                  dias={dias[a.agenda_id] ?? []}
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
            hoje={data.hoje}
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
                    {usos[a.id]?.length
                      ? ` · Usada em: ${usos[a.id]?.join(", ")}`
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
  a: AgendamentoDoPortal;
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
