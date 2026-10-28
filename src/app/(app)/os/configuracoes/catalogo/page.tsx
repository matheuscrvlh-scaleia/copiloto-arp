import {
  ArrowDown,
  ArrowUp,
  BatteryFull,
  ChevronRight,
  Copy,
  Pencil,
  Plus,
  Power,
  Signal,
  Smartphone,
  Tags,
  Wifi,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { Situacao } from "@/components/admin/ui";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { NotificarAoAbrir } from "@/components/notificacoes";
import { IconeCatalogo, SeloIcone } from "@/components/os/configuracoes/icones";
import { Logo } from "@/components/os/portal/publico/visual";
import { IconeTipo } from "@/components/os/selos";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { CONFIGURACOES_OS } from "@/config/navigation";
import { formatarNumero } from "@/lib/formato";
import { arvore, textoDoPrazo } from "@/lib/os/catalogo";
import { TIPOS } from "@/lib/os/rotulos";
import {
  alternarCategoria,
  duplicarCategoria,
  moverCategoria,
} from "@/server/os/acoes/config-catalogo";
import {
  type Categoria,
  categorias,
  nomes,
  parametros,
  type Setor,
  setores,
} from "@/server/os/base";
import {
  agendas,
  chamadosPorCategoria,
  etiquetasRecentes,
} from "@/server/os/configuracoes";

export const metadata: Metadata = { title: "Catálogo de chamados" };

// Catálogo por setor (spec 4.5): cada setor cadastra os pedidos que recebe
// e cada categoria define como o chamado se comporta. Lista por setor, na
// ordem em que aparece para quem abre o chamado.

type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: PageProps<"/os/configuracoes/catalogo">) {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Protegido permissao="os.catalogo">
        <Catalogo busca={searchParams} />
      </Protegido>
    </Suspense>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <div aria-hidden className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="carregando h-10 w-32 rounded-full" />
        ))}
      </div>
      <CartaoCarregando altura="h-[32rem]" />
    </TelaCarregando>
  );
}

async function Catalogo({ busca }: { busca: Promise<Busca> }) {
  // Etiquetas e parâmetros não dependem do setor: começam já.
  const extras = Promise.all([etiquetasRecentes(), parametros()]);
  extras.catch(() => {});
  const [b, todosSetores, todas, listaAgendas, nomesPorId] = await Promise.all([
    busca,
    setores(),
    categorias(),
    agendas(),
    nomes(),
  ]);
  const pedido = typeof b.setor === "string" ? b.setor : null;
  const setor =
    todosSetores.find((s) => s.id === pedido) ??
    todosSetores.find((s) => s.ativo) ??
    todosSetores[0];
  if (!setor)
    return (
      <Cartao>
        <p className="text-sm text-neutral-600">
          Nenhum setor cadastrado.{" "}
          <Link href={CONFIGURACOES_OS.setores} className="underline">
            Cadastre os setores
          </Link>{" "}
          antes do catálogo.
        </p>
      </Cartao>
    );

  const doSetor = todas.filter((c) => c.setor_id === setor.id);
  const [contagens, [etiquetas, p]] = await Promise.all([
    chamadosPorCategoria(doSetor.map((c) => c.id)),
    extras,
  ]);
  const grupos = arvore(doSetor);
  const nomeAgenda = new Map(listaAgendas.map((a) => [a.id, a.nome]));
  const porSetor = new Map<string, number>();
  for (const c of todas)
    porSetor.set(c.setor_id, (porSetor.get(c.setor_id) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-5">
      {b.criada === "1" && (
        <NotificarAoAbrir texto="Categoria criada." parametro="criada" />
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <nav
          aria-label="Setores"
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
        >
          {todosSetores.map((s) => (
            <Link
              key={s.id}
              href={`?setor=${s.id}`}
              aria-current={s.id === setor.id ? "page" : undefined}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/60 px-3.5 py-2 text-sm text-neutral-700 ring-1 ring-neutral-900/[0.06] transition hover:bg-white aria-[current=page]:bg-neutral-900 aria-[current=page]:font-medium aria-[current=page]:text-white"
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: s.cor }}
              />
              {s.nome}
              <span className="text-xs opacity-60 tabular-nums">
                {porSetor.get(s.id) ?? 0}
              </span>
              {!s.ativo && (
                <span className="text-xs opacity-60">(inativo)</span>
              )}
            </Link>
          ))}
        </nav>
        <Link
          href={`${CONFIGURACOES_OS.catalogo}/nova?setor=${setor.id}`}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-neutral-900 py-2 pr-5 pl-3 text-sm font-medium text-white shadow-lg transition hover:bg-neutral-800"
        >
          <Plus className="size-4" aria-hidden />
          Nova categoria
        </Link>
      </div>

      <Cartao className="p-3 md:p-4">
        <div className="flex items-center gap-3 px-2 pt-1 pb-3">
          <SeloIcone nome={setor.icone} cor={setor.cor} />
          <div>
            <h2 className="text-base font-semibold">{setor.nome}</h2>
            <p className="text-xs text-neutral-500">
              {doSetor.length === 0
                ? "Nenhuma categoria ainda."
                : `${doSetor.length} ${doSetor.length === 1 ? "categoria" : "categorias"} · use as setas para mudar a ordem em que aparecem`}
            </p>
          </div>
        </div>
        {grupos.length > 0 && (
          <ul className="flex flex-col">
            {grupos.map((g, i) => (
              <li
                key={g.categoria.id}
                className="border-t border-neutral-900/[0.06] first:border-0"
              >
                <Linha
                  c={g.categoria}
                  setor={setor}
                  indice={i}
                  total={grupos.length}
                  chamados={contagens.get(g.categoria.id) ?? 0}
                  agenda={
                    g.categoria.agenda_id
                      ? nomeAgenda.get(g.categoria.agenda_id)
                      : undefined
                  }
                  responsavel={
                    g.categoria.responsavel_padrao_id
                      ? (nomesPorId.get(g.categoria.responsavel_padrao_id) ??
                        "Pessoa sem acesso")
                      : null
                  }
                />
                {g.filhas.length > 0 && (
                  <ul className="mb-2 ml-6 border-l border-neutral-900/10 pl-2 md:ml-9">
                    {g.filhas.map((f, k) => (
                      <li key={f.id}>
                        <Linha
                          c={f}
                          setor={setor}
                          indice={k}
                          total={g.filhas.length}
                          chamados={contagens.get(f.id) ?? 0}
                          agenda={
                            f.agenda_id
                              ? nomeAgenda.get(f.agenda_id)
                              : undefined
                          }
                          responsavel={
                            f.responsavel_padrao_id
                              ? (nomesPorId.get(f.responsavel_padrao_id) ??
                                "Pessoa sem acesso")
                              : null
                          }
                          sub
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Etiquetas lista={etiquetas} />
        <PreviaDoPortal
          categorias={todas.filter((c) => c.no_portal && c.ativo)}
          boasVindas={p.portal_boas_vindas}
        />
      </div>
    </div>
  );
}

function Linha({
  c,
  setor,
  indice,
  total,
  chamados,
  agenda,
  responsavel,
  sub = false,
}: {
  c: Categoria;
  setor: Setor;
  indice: number;
  total: number;
  chamados: number;
  agenda?: string;
  responsavel: string | null;
  sub?: boolean;
}) {
  const recursos = [
    c.registrar_tempo && "Tempo",
    agenda && `Agenda: ${agenda}`,
    c.vincular_ativo && "Ativo",
    c.vincular_loja && "Loja",
    c.preventiva && "Preventiva",
    c.prazo_terceirizado_dias &&
      `Terceirizado: ${c.prazo_terceirizado_dias} d.u.`,
    Array.isArray(c.campos) &&
      c.campos.length > 0 &&
      `${c.campos.length} campo${c.campos.length === 1 ? "" : "s"}`,
    Array.isArray(c.checklist) &&
      c.checklist.length > 0 &&
      `Checklist (${c.checklist.length})`,
  ].filter((r): r is string => Boolean(r));

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl px-2 py-3 sm:flex-row sm:items-center ${c.ativo ? "" : "opacity-60"}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <SeloIcone
          nome={c.icone}
          cor={c.cor ?? setor.cor}
          tamanho={sub ? "sm" : "md"}
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <Link
              href={`${CONFIGURACOES_OS.catalogo}/${c.id}`}
              className="font-medium hover:underline"
            >
              {c.nome}
            </Link>
            {!c.ativo && <Situacao tipo="neutro">Inativa</Situacao>}
            {c.no_portal && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-400/15 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                <Smartphone className="size-3" aria-hidden />
                Portal
              </span>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1">
              <IconeTipo tipo={c.tipo_padrao} className="size-3.5" />
              {TIPOS[c.tipo_padrao]}
            </span>
            <span aria-hidden>·</span>
            <span>Prazo: {textoDoPrazo(c.prazo_valor, c.prazo_unidade)}</span>
            {c.resposta_horas && (
              <>
                <span aria-hidden>·</span>
                <span>Resposta em {c.resposta_horas}h</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span>{responsavel ?? "Fila do setor"}</span>
            {c.tipo_padrao !== "aviso" && !c.precisa_confirmacao && (
              <>
                <span aria-hidden>·</span>
                <span>Sem confirmação</span>
              </>
            )}
          </p>
          {recursos.length > 0 && (
            <p className="mt-1.5 flex flex-wrap gap-1">
              {recursos.map((r) => (
                <span
                  key={r}
                  className="rounded-full bg-neutral-900/[0.05] px-2 py-0.5 text-[11px] text-neutral-600"
                >
                  {r}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pl-12 sm:justify-end sm:pl-0">
        <span className="text-xs text-neutral-500 tabular-nums sm:w-24 sm:text-right">
          {formatarNumero(chamados)} {chamados === 1 ? "chamado" : "chamados"}
        </span>
        <div className="flex items-center">
          {indice > 0 ? (
            <AcaoRapida
              acao={moverCategoria}
              campos={{ id: c.id, delta: "-1" }}
              rotulo={`Subir ${c.nome}`}
              icone={<ArrowUp className="size-4" aria-hidden />}
            />
          ) : (
            <span className="size-9" aria-hidden />
          )}
          {indice < total - 1 ? (
            <AcaoRapida
              acao={moverCategoria}
              campos={{ id: c.id, delta: "1" }}
              rotulo={`Descer ${c.nome}`}
              icone={<ArrowDown className="size-4" aria-hidden />}
            />
          ) : (
            <span className="size-9" aria-hidden />
          )}
          <Link
            href={`${CONFIGURACOES_OS.catalogo}/${c.id}`}
            title="Editar"
            aria-label={`Editar ${c.nome}`}
            className="grid size-9 place-items-center rounded-full opacity-60 transition hover:bg-[rgb(127_127_127/0.15)] hover:opacity-100"
          >
            <Pencil className="size-4" aria-hidden />
          </Link>
          <AcaoRapida
            acao={duplicarCategoria}
            campos={{ id: c.id }}
            rotulo={`Duplicar ${c.nome}`}
            icone={<Copy className="size-4" aria-hidden />}
          />
          <AcaoRapida
            acao={alternarCategoria}
            campos={{ id: c.id, ativo: String(!c.ativo) }}
            rotulo={c.ativo ? `Desativar ${c.nome}` : `Reativar ${c.nome}`}
            icone={<Power className="size-4" aria-hidden />}
            confirmar={
              c.ativo
                ? `Desativar ${c.nome}? Some da abertura de chamados (e do portal). Os chamados já abertos continuam com ela.`
                : undefined
            }
            perigo={c.ativo}
          />
        </div>
      </div>
    </div>
  );
}

function Etiquetas({
  lista,
}: {
  lista: { etiqueta: string; vezes: number }[];
}) {
  return (
    <Cartao>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Tags className="size-4" aria-hidden />
        Etiquetas mais usadas
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        Etiquetas são livres: quem abre ou atende escreve as que quiser. Só para
        referência, nos últimos chamados.
      </p>
      {lista.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">Nenhuma etiqueta ainda.</p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {lista.map((e) => (
            <li
              key={e.etiqueta}
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900/[0.06] px-2.5 py-1 text-xs text-neutral-700"
            >
              #{e.etiqueta}
              <span className="text-neutral-500 tabular-nums">{e.vezes}</span>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

/** Como o lojista vê os pedidos no portal (só ilustração; nada é enviado):
 *  um iPhone com o início do portal, nas mesmas peças da página real. */
function PreviaDoPortal({
  categorias: lista,
  boasVindas,
}: {
  categorias: Categoria[];
  boasVindas: string;
}) {
  return (
    <Cartao>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Smartphone className="size-4" aria-hidden />
        Como o lojista vê
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        Prévia do portal com as categorias marcadas para o lojista, de todos os
        setores. A mensagem de boas-vindas fica em Parâmetros.
      </p>
      {/* Aparelho com cores fixas, para não inverter no tema escuro. */}
      <div className="relative mx-auto mt-6 w-full max-w-[372px] rounded-[3.25rem] bg-[#1c1c1e] p-[11px] shadow-2xl ring-1 ring-[#3a3a3c]">
        <span
          aria-hidden
          className="absolute top-28 -left-[3px] h-8 w-[3px] rounded-l bg-[#2c2c2e]"
        />
        <span
          aria-hidden
          className="absolute top-40 -left-[3px] h-14 w-[3px] rounded-l bg-[#2c2c2e]"
        />
        <span
          aria-hidden
          className="absolute top-56 -left-[3px] h-14 w-[3px] rounded-l bg-[#2c2c2e]"
        />
        <span
          aria-hidden
          className="absolute top-44 -right-[3px] h-20 w-[3px] rounded-r bg-[#2c2c2e]"
        />
        <div
          className="relative aspect-[390/844] overflow-hidden rounded-[2.6rem] bg-neutral-50 text-neutral-900"
          style={{
            // A aurora do portal, parada.
            backgroundImage:
              "radial-gradient(24rem 24rem at -10% -5%, rgb(88 192 105 / 0.3), transparent 70%), radial-gradient(20rem 20rem at 110% 35%, rgb(143 217 155 / 0.26), transparent 70%), radial-gradient(22rem 22rem at 40% 110%, rgb(47 125 61 / 0.16), transparent 70%)",
          }}
        >
          <div className="absolute inset-x-0 top-0 z-10 flex h-12 items-center justify-between px-7 text-[15px] font-semibold">
            <span className="tabular-nums">9:41</span>
            <span aria-hidden className="flex items-center gap-1.5">
              <Signal className="size-4" strokeWidth={2.5} />
              <Wifi className="size-4" strokeWidth={2.5} />
              <BatteryFull className="size-5" />
            </span>
          </div>
          <span
            aria-hidden
            className="absolute top-3 left-1/2 z-10 h-[30px] w-[104px] -translate-x-1/2 rounded-full bg-black"
          />
          <div className="flex h-full flex-col gap-5 overflow-y-auto px-4 pt-14 pb-10 [scrollbar-width:none]">
            <div className="vidro flex flex-col gap-5 rounded-[1.75rem] p-5">
              <div className="flex items-center justify-between gap-3">
                <Logo />
                <span className="px-3 py-1.5 text-sm text-neutral-500">
                  Trocar de loja
                </span>
              </div>
              <div>
                <p className="text-3xl font-semibold tracking-tight">
                  Loja Exemplo
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  LUC 101 · Bloco A
                </p>
              </div>
              {boasVindas && (
                <p className="text-sm text-neutral-700">{boasVindas}</p>
              )}
              <span className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 py-3.5 text-base font-semibold text-white shadow-lg">
                <Plus className="size-5" aria-hidden />
                Fazer um pedido
              </span>
            </div>
            <div className="vidro rounded-[1.75rem] p-5">
              <p className="text-lg font-semibold">Fazer um pedido</p>
              <p className="mt-1 text-sm text-neutral-500">
                Escolha o que você precisa.
              </p>
              {lista.length ? (
                <ul className="mt-4 flex flex-col gap-3">
                  {lista.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-4 rounded-2xl border border-neutral-900/[0.06] bg-white/70 p-4"
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-marca text-[#fff] shadow-sm">
                        <IconeCatalogo nome={c.icone} className="size-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold">
                          {c.nome}
                        </span>
                        {c.orientacao_portal && (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-neutral-500">
                            {c.orientacao_portal}
                          </span>
                        )}
                      </span>
                      <ChevronRight
                        className="size-5 shrink-0 text-neutral-400"
                        aria-hidden
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-neutral-500">
                  Nenhum tipo de pedido disponível agora. Fale com a
                  administração.
                </p>
              )}
            </div>
            <div className="vidro rounded-[1.75rem] p-5">
              <p className="text-lg font-semibold">Meus pedidos</p>
              <p className="mt-2 text-sm text-neutral-500">
                Os pedidos da sua loja aparecem aqui, com o andamento de cada
                um.
              </p>
            </div>
            <p className="text-center text-xs text-neutral-500">
              Portal do lojista · Espaço ARP, Nova Friburgo
            </p>
          </div>
          <span
            aria-hidden
            className="absolute bottom-2 left-1/2 h-[5px] w-32 -translate-x-1/2 rounded-full bg-neutral-900"
          />
        </div>
      </div>
    </Cartao>
  );
}
