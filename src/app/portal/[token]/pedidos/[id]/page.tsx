import {
  CalendarClock,
  CircleAlert,
  FileText,
  ImageIcon,
  Star,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import {
  FormAvaliacao,
  FormRemarcar,
  FormResposta,
} from "@/components/os/portal/publico/acoes-pedido";
import {
  dataDe,
  Etapas,
  LinkInativo,
  SeloPedido,
} from "@/components/os/portal/publico/visual";
import { formatarData, formatarDataHora, formatarNumero } from "@/lib/formato";
import {
  autorNoPortal,
  type DiaDaEscolha,
  descreverHorario,
  equipeDoSetor,
  etapasDoPedido,
  paraEscolha,
  podeAvaliar,
  podeResponder,
} from "@/lib/os/portal";
import { rotaPortal } from "@/lib/os/rotas";
import type { CampoExtra } from "@/lib/os/rotulos";
import { diasLivres } from "@/server/os/agenda";
import { osAdmin } from "@/server/os/base";
import {
  type ArquivoDoPortal,
  agendaDoPortal,
  type DetalheDoPedido,
  pedidoDaLoja,
} from "@/server/os/portal-publico";
import { acessoDaPagina } from "../../acesso";

// Um pedido da loja: andamento, horário marcado, conversa com o setor (só
// o que a equipe marcou para o lojista), arquivos devolvidos (o laudo do
// projeto, por exemplo), resposta e avaliação.

export default function Page({
  params,
}: PageProps<"/portal/[token]/pedidos/[id]">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-56" />
          <CartaoCarregando altura="h-80" />
        </TelaCarregando>
      }
    >
      <Detalhe params={params} />
    </Suspense>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Detalhe({
  params,
}: Pick<PageProps<"/portal/[token]/pedidos/[id]">, "params">) {
  const { token, id } = await params;
  const acesso = await acessoDaPagina(token);
  if (!acesso) return <LinkInativo />;
  const base = rotaPortal(token);
  const voltar = (
    <Link
      href={base}
      className="w-fit rounded-full px-1 text-sm text-neutral-500 hover:text-neutral-900"
    >
      ← Meus pedidos
    </Link>
  );
  const d = UUID.test(id) ? await pedidoDaLoja(acesso.loja.id, id) : null;
  if (!d)
    return (
      <>
        {voltar}
        <div className="vidro rounded-[1.75rem] p-6 text-sm text-neutral-600">
          Pedido não encontrado.
        </div>
      </>
    );

  const { pedido: p } = d;
  const remarcar = await diasParaRemarcar(d);
  const daEquipe = d.arquivos.filter((a) => !a.daLoja);
  const doPedido = d.arquivos.filter((a) => a.daLoja && a.eventoId === null);

  return (
    <>
      {voltar}
      <section className="vidro flex flex-col gap-5 rounded-[1.75rem] p-5 sm:p-6">
        <div>
          <p className="text-sm text-neutral-500 tabular-nums">
            Pedido #{p.numero} · {p.categoria ?? "Pedido"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {p.titulo}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <SeloPedido status={p.status} aguardando={p.aguardando_tipo} />
            <span>{equipeDoSetor(p.setor)}</span>
            <span>· Aberto em {dataDe(p.criado_em)}</span>
          </div>
        </div>
        {p.status !== "cancelado" && <Etapas etapas={etapasDoPedido(p)} />}
        {p.status === "aguardando" && p.aguardando_tipo === "lojista" && (
          <p className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            <CircleAlert className="size-5 shrink-0" aria-hidden />A equipe
            precisa de uma resposta sua. Veja a conversa abaixo.
          </p>
        )}
      </section>

      {daEquipe.length > 0 && (
        <Bloco titulo="Arquivos da equipe">
          <ListaArquivos arquivos={daEquipe} />
        </Bloco>
      )}

      {d.horarios.length > 0 && (
        <Bloco titulo="Horário">
          <ul className="flex flex-col gap-4">
            {d.horarios.map((h) => (
              <li key={h.id} className="flex flex-col gap-3">
                <p className="flex items-start gap-3 text-sm">
                  <CalendarClock
                    className="mt-0.5 size-5 shrink-0 text-neutral-500"
                    aria-hidden
                  />
                  <span>
                    <span className="block font-medium">
                      {descreverHorario(new Date(h.inicio))}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {h.agenda} ·{" "}
                      {h.status === "remarcar"
                        ? "Precisa remarcar"
                        : h.status === "realizado"
                          ? "Realizado"
                          : "Marcado"}
                    </span>
                  </span>
                </p>
                {h.status === "remarcar" && p.status !== "cancelado" && (
                  <div className="rounded-2xl bg-amber-50/60 p-4">
                    <p className="mb-3 text-sm text-amber-900">
                      Este horário precisou ser cancelado (por exemplo, por
                      causa do clima). Escolha um novo horário:
                    </p>
                    <FormRemarcar
                      token={token}
                      pedido={p.id}
                      agendamento={h.id}
                      dias={remarcar.get(h.agendaId) ?? []}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      <Bloco titulo="O que foi pedido">
        {p.descricao && (
          <p className="whitespace-pre-line text-sm text-neutral-800">
            {p.descricao}
          </p>
        )}
        <Respostas campos={p.camposDaCategoria} valores={p.campos} />
        {doPedido.length > 0 && <ListaArquivos arquivos={doPedido} />}
        {p.solicitante_nome && (
          <p className="text-xs text-neutral-500">
            Pedido por {p.solicitante_nome}
          </p>
        )}
      </Bloco>

      {podeAvaliar(p) && (
        <Bloco titulo="Seu pedido foi concluído">
          <FormAvaliacao
            token={token}
            pedido={p.id}
            podeReabrir={p.status === "concluido"}
          />
        </Bloco>
      )}
      {p.avaliacao !== null && (
        <Bloco titulo="Sua avaliação">
          <p
            role="img"
            className="flex items-center gap-1"
            aria-label={`${p.avaliacao} de 5 estrelas`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                aria-hidden
                className={`size-6 ${n <= (p.avaliacao ?? 0) ? "fill-[#fab219] text-[#e09a00]" : "text-neutral-300"}`}
              />
            ))}
          </p>
          {p.avaliacao_comentario && (
            <p className="text-sm text-neutral-700">{p.avaliacao_comentario}</p>
          )}
        </Bloco>
      )}

      <Bloco titulo="Conversa">
        <Conversa d={d} />
        {podeResponder(p.status) ? (
          <div className="mt-2 border-t border-neutral-900/[0.06] pt-5">
            <FormResposta token={token} pedido={p.id} />
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            Este pedido foi encerrado. Para outro assunto,{" "}
            <Link href={`${base}#pedir`} className="font-medium underline">
              faça um novo pedido
            </Link>
            .
          </p>
        )}
      </Bloco>
    </>
  );
}

function Bloco({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="vidro flex flex-col gap-4 rounded-[1.75rem] p-5 sm:p-6">
      <h2 className="text-base font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

/** Dias livres de cada agenda com horário a remarcar. */
async function diasParaRemarcar(
  d: DetalheDoPedido,
): Promise<Map<string, DiaDaEscolha[]>> {
  const ids = [
    ...new Set(
      d.horarios.filter((h) => h.status === "remarcar").map((h) => h.agendaId),
    ),
  ];
  const agora = new Date();
  const pares = await Promise.all(
    ids.map(async (id) => {
      const agenda = await agendaDoPortal(id);
      const dias = agenda ? await diasLivres(osAdmin(), agenda, agora) : [];
      return [id, paraEscolha(dias)] as const;
    }),
  );
  return new Map(pares);
}

function Conversa({ d }: { d: DetalheDoPedido }) {
  const porEvento = new Map<number, ArquivoDoPortal[]>();
  for (const a of d.arquivos)
    if (a.eventoId !== null)
      porEvento.set(a.eventoId, [...(porEvento.get(a.eventoId) ?? []), a]);
  if (!d.eventos.length)
    return <p className="text-sm text-neutral-500">Nenhuma mensagem ainda.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {d.eventos.map((e) => {
        const autor = autorNoPortal(
          e,
          d.pedido.setor,
          d.pedido.solicitante_nome,
        );
        const arquivos = porEvento.get(e.id) ?? [];
        return (
          <li
            key={e.id}
            className={`flex max-w-[92%] flex-col gap-1 rounded-2xl px-4 py-3 text-sm ${
              autor.daLoja
                ? "self-end rounded-br-md bg-marca/20"
                : "self-start rounded-bl-md bg-white/80"
            }`}
          >
            <span className="text-xs text-neutral-500">
              <span className="font-medium text-neutral-700">{autor.nome}</span>{" "}
              · {formatarDataHora(e.em)}
            </span>
            {e.texto && (
              <span className="whitespace-pre-line text-neutral-900">
                {e.texto}
              </span>
            )}
            {arquivos.length > 0 && <ListaArquivos arquivos={arquivos} />}
          </li>
        );
      })}
    </ol>
  );
}

function ListaArquivos({ arquivos }: { arquivos: ArquivoDoPortal[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {arquivos.map((a) => {
        const Icone = a.mime?.startsWith("image/") ? ImageIcon : FileText;
        const conteudo = (
          <>
            <Icone className="size-4 shrink-0 text-neutral-500" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{a.nome}</span>
            {a.tamanho !== null && (
              <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
                {tamanho(a.tamanho)}
              </span>
            )}
          </>
        );
        return (
          <li key={a.id}>
            {a.url ? (
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2.5 text-sm font-medium transition hover:bg-white"
              >
                {conteudo}
              </a>
            ) : (
              <span className="flex items-center gap-2 rounded-xl bg-white/40 px-3 py-2.5 text-sm text-neutral-500">
                {conteudo}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const tamanho = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${formatarNumero(bytes / 1024 / 1024, 1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Respostas aos campos extras da categoria, com o rótulo de cada um. */
function Respostas({
  campos,
  valores,
}: {
  campos: CampoExtra[];
  valores: unknown;
}) {
  const v =
    typeof valores === "object" && valores !== null
      ? (valores as Record<string, unknown>)
      : {};
  const linhas = campos
    .map((c) => ({ c, valor: v[c.chave] }))
    .filter(
      ({ valor }) => valor !== null && valor !== undefined && valor !== "",
    );
  if (!linhas.length) return null;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {linhas.map(({ c, valor }) => (
        <div key={c.chave}>
          <dt className="text-xs text-neutral-500">{c.rotulo}</dt>
          <dd className="font-medium">{mostrar(c, valor)}</dd>
        </div>
      ))}
    </dl>
  );
}

function mostrar(c: CampoExtra, valor: unknown): string {
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (Array.isArray(valor)) return valor.join(", ");
  if (typeof valor === "number")
    return formatarNumero(valor, 2).replace(/,00$/, "");
  if (c.tipo === "data" && typeof valor === "string")
    return formatarData(valor);
  return String(valor);
}
