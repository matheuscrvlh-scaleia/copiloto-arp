import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { Protegido } from "@/components/protegido";
import { formatarDataHora } from "@/lib/formato";
import { textoDoCampo } from "@/lib/os/chamado";
import { numeroDo } from "@/lib/os/numeros";
import { rotaDo } from "@/lib/os/rotas";
import {
  MOTIVOS_AGUARDANDO,
  ORIGENS,
  PRIORIDADES,
  STATUS,
  TIPOS,
} from "@/lib/os/rotulos";
import { carregarDetalhe } from "@/server/os/chamado-detalhe";
import { BotaoImprimir } from "./botao-imprimir";

export const metadata: Metadata = { title: "Imprimir chamado" };

// Folha de impressão do chamado (Tarefa, Solicitação, Aviso): limpa, em
// preto e branco, só com o que importa. "Salvar como PDF" sai da janela de
// impressão do navegador. A OS tem o PDF oficial (papel timbrado) em
// /os/ordens/pdf.

// Na impressão só a folha aparece (menu, barras e botões somem).
const CSS_IMPRESSAO = `
@media print {
  @page { margin: 14mm; }
  body * { visibility: hidden !important; }
  #folha-chamado, #folha-chamado * { visibility: visible !important; }
  #folha-chamado { position: absolute; inset: 0 auto auto 0; width: 100%; box-shadow: none !important; border: 0 !important; padding: 0 !important; }
  .aurora { display: none !important; }
}`;

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<CartaoCarregando altura="h-[60vh]" />}>
      <Protegido permissao="os.acessar">
        <Folha params={params} />
      </Protegido>
    </Suspense>
  );
}

async function Folha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await carregarDetalhe(id);
  if (!d)
    return (
      <p className="text-sm text-neutral-600">
        Chamado não encontrado, ou você não tem acesso a ele.
      </p>
    );
  const { ch } = d;
  const nome = (u: string | null) => (u ? (d.nomes[u] ?? "—") : "—");
  const linhas: [string, string][] = [
    ["Tipo", TIPOS[ch.tipo]],
    [
      "Status",
      ch.status === "aguardando" && ch.aguardando_tipo
        ? `${STATUS[ch.status]} · ${MOTIVOS_AGUARDANDO[ch.aguardando_tipo]}`
        : STATUS[ch.status],
    ],
    ["Prioridade", PRIORIDADES[ch.prioridade]],
    [
      "Setor",
      `${d.setor?.nome ?? "—"}${d.categoria ? ` › ${d.categoria.nome}` : ""}`,
    ],
    [
      "Quem pediu",
      ch.aberto_por
        ? nome(ch.aberto_por)
        : (ch.solicitante_nome ?? ORIGENS[ch.origem]),
    ],
    [
      "Responsável",
      ch.responsavel_id ? nome(ch.responsavel_id) : "Fila do setor",
    ],
    ["Aberto em", formatarDataHora(ch.criado_em)],
    ["Prazo", ch.prazo ? formatarDataHora(ch.prazo) : "Sem prazo"],
  ];
  if (d.loja) linhas.push(["Loja", `${d.loja.luc} · ${d.loja.nome}`]);
  if (d.ativo) linhas.push(["Ativo", `${d.ativo.codigo} · ${d.ativo.nome}`]);
  if (ch.concluido_em)
    linhas.push(["Concluído em", formatarDataHora(ch.concluido_em)]);
  const comentarios = d.eventos.filter((e) => e.texto);

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS fixo desta página, sem dado do usuário */}
      <style dangerouslySetInnerHTML={{ __html: CSS_IMPRESSAO }} />
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Link
          href={rotaDo(ch)}
          className="inline-flex min-h-10 items-center text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Voltar ao chamado
        </Link>
        <span className="flex-1" />
        <BotaoImprimir />
      </div>
      <article
        id="folha-chamado"
        className="mx-auto max-w-[210mm] rounded-3xl bg-[#fff] p-8 text-[13px] leading-relaxed text-[#111] shadow-xl md:p-12"
      >
        <header className="flex items-start justify-between gap-6 border-b border-[#ddd] pb-4">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.18em] text-[#666] uppercase">
              {TIPOS[ch.tipo]} {numeroDo(ch)}
            </p>
            <h1 className="mt-1 text-2xl font-semibold break-words">
              {ch.titulo}
            </h1>
          </div>
          <p className="shrink-0 text-right text-[11px] text-[#666]">
            Impresso em
            <br />
            {formatarDataHora(new Date().toISOString())}
          </p>
        </header>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
          {linhas.map(([r, v]) => (
            <div key={r} className="flex gap-2">
              <dt className="w-28 shrink-0 text-[#666]">{r}</dt>
              <dd className="min-w-0 font-medium break-words">{v}</dd>
            </div>
          ))}
        </dl>

        {ch.descricao && (
          <section className="mt-6">
            <h2 className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-[#666] uppercase">
              Descrição
            </h2>
            <p className="break-words whitespace-pre-wrap">{ch.descricao}</p>
          </section>
        )}

        {d.campos.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-[#666] uppercase">
              Dados da categoria
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
              {d.campos.map((c) => (
                <div key={c.chave} className="flex gap-2">
                  <dt className="text-[#666]">{c.rotulo}:</dt>
                  <dd className="font-medium">
                    {textoDoCampo(
                      c,
                      (ch.campos as Record<string, unknown>)[c.chave],
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {d.checklist.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-[#666] uppercase">
              Checklist
            </h2>
            <ul>
              {d.checklist.map((i, k) => (
                <li key={`${k}-${i.texto}`} className="flex gap-2">
                  <span aria-hidden>{i.feito ? "☑" : "☐"}</span>
                  <span>
                    {i.texto}
                    {i.obrigatorio ? " (obrigatório)" : ""}
                    {i.feito && i.por && i.em
                      ? ` — ${nome(i.por)}, ${formatarDataHora(i.em)}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {d.andamento && (
          <section className="mt-6">
            <h2 className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-[#666] uppercase">
              Destinos · {d.andamento.texto}
            </h2>
            <ul>
              {d.destinos.map((x) => (
                <li key={x.id}>
                  {x.nome}
                  {x.titulo ? ` · ${x.titulo}` : ""}:{" "}
                  {x.concluido_em
                    ? `concluído em ${formatarDataHora(x.concluido_em)}`
                    : "pendente"}
                </li>
              ))}
            </ul>
          </section>
        )}

        {ch.solucao && (
          <section className="mt-6">
            <h2 className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-[#666] uppercase">
              Solução
            </h2>
            <p className="whitespace-pre-wrap">{ch.solucao}</p>
          </section>
        )}

        {comentarios.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-[#666] uppercase">
              Histórico
            </h2>
            <ol className="flex flex-col gap-1.5">
              {comentarios.map((e) => (
                <li key={e.id} className="break-inside-avoid">
                  <span className="text-[#666]">
                    {formatarDataHora(e.em)} ·{" "}
                    {(e.autor_id && d.nomes[e.autor_id]) ||
                      e.autor_nome ||
                      "Sistema"}
                    :
                  </span>{" "}
                  <span className="whitespace-pre-wrap">{e.texto}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {d.anexos.length > 0 && (
          <p className="mt-6 text-[11px] text-[#666]">
            {d.anexos.length} arquivo(s) no sistema:{" "}
            {d.anexos.map((a) => a.nome).join(", ")}.
          </p>
        )}
      </article>
    </>
  );
}
