import {
  Building2,
  CalendarClock,
  Check,
  Hourglass,
  Link2Off,
  Mail,
  MapPin,
  MessageCircle,
  PenLine,
  Phone,
} from "lucide-react";
import Image from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Assinatura } from "@/components/os/ordem/assinatura";
import { formatarMoeda, formatarNumero } from "@/lib/formato";
import { dataHoraBr } from "@/lib/os/relatorios";
import { limparTelefone, linkWhatsApp } from "@/lib/os/whatsapp";
import { assinarPeloLink } from "@/server/os/acoes/ordem-link";
import {
  type PaginaTerceirizado,
  paginaDoTerceirizado,
} from "@/server/os/ordem-terceirizado";
import { Andamento, EnviarArquivos, type Etapa, Relatorio } from "./acoes";

// OS para o terceirizado, sem login: ele vê a OS dele (número, local,
// descrição, fotos, visita e o contato da ARP — nunca custos internos nem
// outras OS), aceita ou recusa, marca chegada e término, manda fotos, a
// solução e o valor e, no fim, confere tudo e assina. Depois a ARP valida
// e assina. O token é conferido no servidor a cada acesso.

export default function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-56" />
          <CartaoCarregando altura="h-40" />
          <CartaoCarregando altura="h-64" />
        </TelaCarregando>
      }
    >
      <Conteudo params={params} />
    </Suspense>
  );
}

async function Conteudo({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const p = await paginaDoTerceirizado(token);
  if (!p) return <LinkInativo />;
  const etapa = etapaDe(p);

  return (
    <>
      <Topo />
      <section className="destaque flex flex-col gap-3 rounded-[1.75rem] p-5">
        <p className="text-xs font-medium tracking-[0.14em] text-[rgb(255_255_255/0.6)] uppercase">
          O.S. {p.numero} · {p.tipoServico}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{p.titulo}</h1>
        <dl className="flex flex-col gap-2 text-sm">
          <Info
            icone={<MapPin className="size-4" aria-hidden />}
            rotulo="Local"
          >
            {p.local}
          </Info>
          <Info
            icone={<CalendarClock className="size-4" aria-hidden />}
            rotulo="Visita"
          >
            {p.visita ?? "A combinar com a ARP"}
          </Info>
          {p.prazo && (
            <Info
              icone={<Hourglass className="size-4" aria-hidden />}
              rotulo="Retorno até"
            >
              {p.prazo}
            </Info>
          )}
          {p.empresa && (
            <Info
              icone={<Building2 className="size-4" aria-hidden />}
              rotulo="Empresa"
            >
              {p.empresa}
              {p.profissionais.length > 0 && ` · ${p.profissionais.join(", ")}`}
            </Info>
          )}
        </dl>
        <p className="text-xs text-[rgb(255_255_255/0.6)]">
          Prioridade {p.prioridade.toLowerCase()}
        </p>
      </section>

      <Passos p={p} />

      {(etapa === "terminado" || etapa === "assinado") && <Conferir p={p} />}

      {etapa !== "terminado" &&
        etapa !== "assinado" &&
        etapa !== "recusado" && (
          <section className="vidro rounded-[1.75rem] p-5">
            <Andamento token={p.token} etapa={etapa} />
          </section>
        )}
      {etapa === "recusado" && (
        <p className="rounded-[1.75rem] bg-red-50 p-5 text-sm text-red-700">
          Você recusou esta OS
          {p.estado.recusa_motivo ? `: ${p.estado.recusa_motivo}` : "."} A ARP
          foi avisada.
        </p>
      )}

      <section className="vidro flex flex-col gap-3 rounded-[1.75rem] p-5">
        <h2 className="text-sm font-semibold">O que precisa ser feito</h2>
        <p className="whitespace-pre-wrap text-sm text-neutral-700">
          {p.descricao?.trim() || "Sem descrição informada."}
        </p>
        {p.fotos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2">
            {p.fotos.map((f) => (
              <li key={f.id}>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square overflow-hidden rounded-2xl ring-1 ring-neutral-900/10"
                >
                  {/* biome-ignore lint/performance/noImgElement: endereço assinado e temporário do bucket */}
                  <img
                    src={f.url}
                    alt={f.nome}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {etapa !== "aceitar" && etapa !== "recusado" && etapa !== "assinado" && (
        <section className="vidro flex flex-col gap-5 rounded-[1.75rem] p-5">
          <div>
            <h2 className="text-sm font-semibold">Fotos, solução e valor</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Tudo chega na hora para a ARP conferir e fechar a OS.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <EnviarArquivos
              token={p.token}
              categoria="antes"
              rotulo="Fotos de antes"
            />
            <EnviarArquivos
              token={p.token}
              categoria="depois"
              rotulo="Fotos de depois"
            />
          </div>
          <EnviarArquivos
            token={p.token}
            categoria="orcamento"
            rotulo="Orçamento, nota ou laudo"
            documento
          />
          {p.enviados.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-neutral-500">
              {p.enviados.map((e) => (
                <li key={e.id} className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-green-700" aria-hidden />
                  {e.nome}
                </li>
              ))}
            </ul>
          )}
          <Relatorio
            token={p.token}
            solucao={p.estado.solucao}
            valor={
              p.estado.valor_informado === null
                ? ""
                : formatarNumero(p.estado.valor_informado, 2)
            }
            orcamento={p.estado.orcamento_numero}
          />
        </section>
      )}

      <Contato p={p} />
    </>
  );
}

function etapaDe(p: PaginaTerceirizado): Etapa {
  const e = p.estado;
  if (e.recusado_em) return "recusado";
  if (e.assinado_em) return "assinado";
  if (e.terminado_em) return "terminado";
  if (e.chegada_em) return "terminar";
  if (e.aceito_em) return "chegar";
  return "aceitar";
}

function Topo() {
  return (
    <header className="flex items-center gap-2.5">
      <Image
        src="/brand/logo.png"
        alt="ARP"
        width={36}
        height={36}
        className="rounded-xl"
        priority
      />
      <span className="text-sm leading-tight">
        <span className="block font-semibold text-neutral-900">ARP</span>
        <span className="block text-xs text-neutral-500">
          Ordem de serviço para terceirizado
        </span>
      </span>
    </header>
  );
}

function Info({
  icone,
  rotulo,
  children,
}: {
  icone: React.ReactNode;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-[rgb(255_255_255/0.6)]">{icone}</span>
      <div>
        <dt className="sr-only">{rotulo}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}

/**
 * Depois de "Terminei": o resumo do que vai na OS e a assinatura dele.
 * Assinada, a OS segue para a ARP validar e assinar por último.
 */
function Conferir({ p }: { p: PaginaTerceirizado }) {
  const e = p.estado;
  const itens: [string, string][] = [
    ["Serviço", `O.S. ${p.numero} · ${p.tipoServico}`],
    ["Local", p.local],
    ["Chegada", e.chegada_em ? dataHoraBr(e.chegada_em).slice(0, 16) : "—"],
    ["Término", e.terminado_em ? dataHoraBr(e.terminado_em).slice(0, 16) : "—"],
    ["O que foi feito", p.solucaoDaOS?.trim() || "—"],
    [
      "Valor informado",
      e.valor_informado === null ? "—" : formatarMoeda(e.valor_informado),
    ],
    ["Nº do orçamento ou nota", e.orcamento_numero ?? "—"],
    ["Arquivos enviados", String(p.enviados.length)],
  ];
  return (
    <section className="vidro flex flex-col gap-4 rounded-[1.75rem] p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <PenLine className="size-4" aria-hidden />
          {e.assinado_em ? "OS conferida e assinada" : "Confira e assine a OS"}
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          {e.assinado_em
            ? "A ARP vai validar e assinar por último."
            : "Confira se está tudo certo. Se faltar algo, corrija logo abaixo antes de assinar."}
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        {itens.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="text-xs text-neutral-500">{rotulo}</dt>
            <dd className="whitespace-pre-wrap">{valor}</dd>
          </div>
        ))}
      </dl>
      <Assinatura
        acao={assinarPeloLink}
        campos={{ token: p.token }}
        podeEditar={!e.assinado_em}
        documento
        rotuloSalvar="Assinar a OS"
        atual={
          e.assinado_em
            ? { url: null, nome: e.assinatura_nome, em: e.assinado_em }
            : null
        }
        nomeSugerido={p.profissionais[0] ?? ""}
      />
    </section>
  );
}

/** Aceite → Chegada → Término → Assinatura, com o horário de cada um. */
function Passos({ p }: { p: PaginaTerceirizado }) {
  const e = p.estado;
  const passos: [string, string | null][] = [
    ["Aceite", e.aceito_em],
    ["Chegada", e.chegada_em],
    ["Término", e.terminado_em],
    ["Assinatura", e.assinado_em],
  ];
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {passos.map(([nome, quando]) => (
        <li
          key={nome}
          className={`rounded-2xl px-3 py-2 text-xs ${quando ? "bg-green-50 text-green-700" : "vidro text-neutral-500"}`}
        >
          <span className="flex items-center gap-1 font-medium">
            {quando && <Check className="size-3.5" aria-hidden />}
            {nome}
          </span>
          <span className="tabular-nums">
            {quando ? dataHoraBr(quando).slice(0, 16) : "—"}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Contato({ p }: { p: PaginaTerceirizado }) {
  const c = p.contato;
  const telefone = c.telefone ? limparTelefone(c.telefone) : null;
  return (
    <section className="vidro flex flex-col gap-3 rounded-[1.75rem] p-5">
      <h2 className="text-sm font-semibold">Fale com a ARP</h2>
      <p className="text-sm text-neutral-700">{c.nome}</p>
      {c.endereco && (
        <p className="flex items-start gap-2 text-sm text-neutral-600">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          {c.endereco}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {c.telefone && (
          <a
            href={`tel:+${telefone ?? c.telefone.replace(/\D/g, "")}`}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium"
          >
            <Phone className="size-4" aria-hidden />
            {c.telefone}
          </a>
        )}
        {telefone && (
          <a
            href={linkWhatsApp(telefone, `Olá! Sobre a O.S. ${p.numero}:`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium"
          >
            <MessageCircle className="size-4" aria-hidden />
            WhatsApp
          </a>
        )}
        {c.email && (
          <a
            href={`mailto:${c.email}`}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium"
          >
            <Mail className="size-4" aria-hidden />
            E-mail
          </a>
        )}
      </div>
    </section>
  );
}

function LinkInativo() {
  return (
    <>
      <Topo />
      <div className="vidro flex flex-col items-center gap-4 rounded-[1.75rem] px-6 py-12 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-neutral-900 text-white">
          <Link2Off className="size-7" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold">Este link não está mais ativo</h1>
        <p className="max-w-sm text-sm text-neutral-600">
          A OS foi concluída, cancelada ou o link foi trocado. Se precisar de
          algo, fale com a administração do Espaço ARP.
        </p>
      </div>
    </>
  );
}
