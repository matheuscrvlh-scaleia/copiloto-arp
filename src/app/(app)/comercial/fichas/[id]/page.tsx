import {
  ArrowLeft,
  ExternalLink,
  FileDown,
  FileSignature,
  FileText,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { BlocosDaFicha } from "@/components/comercial/fichas/blocos";
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  LinkParaEnviar,
} from "@/components/comercial/fichas/gerar-link";
import { TopoComercial } from "@/components/comercial/tela";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import {
  blocosDaFicha,
  ROTULO_ORIGEM,
  ROTULO_SITUACAO,
  ROTULO_TIPO_CURTO,
  type SituacaoFicha,
} from "@/lib/comercial/ficha";
import { formatarDocumento } from "@/lib/documentos";
import { formatarData, formatarDataHora, formatarNumero } from "@/lib/formato";
import {
  cancelarLinkFicha,
  reenviarLinkFicha,
} from "@/server/comercial/acoes/fichas";
import { contextoCom } from "@/server/comercial/base";
import {
  detalheDaFicha,
  linkDaFicha,
  ROTA_FICHAS,
  registrarAcessoDepois,
  rotaDaFicha,
} from "@/server/comercial/fichas";

export const metadata: Metadata = { title: "Ficha cadastral" };

const ACAO: Record<string, string> = {
  abriu: "Abriu a ficha",
  pdf: "Baixou o PDF",
  documento: "Baixou um documento",
};

export default function Page({ params }: PageProps<"/comercial/fichas/[id]">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-24" />
          <CartaoCarregando altura="h-96" />
        </TelaCarregando>
      }
    >
      <Tela params={params} />
    </Suspense>
  );
}

async function Tela({
  params,
}: Pick<PageProps<"/comercial/fichas/[id]">, "params">) {
  const [{ id }, ctx] = await Promise.all([params, contextoCom()]);
  const ver = ctx.pode("comercial.formulario.ver");
  const gerar = ctx.pode("comercial.formulario.link");
  const contrato = ctx.pode("comercial.contratos.editar");
  if (!ver && !gerar && !contrato) return <SemAcesso />;
  const d = await detalheDaFicha(id, ver);
  if (!d) notFound();
  if (ver) registrarAcessoDepois(id, ctx.usuario.id, "abriu");

  const { ficha } = d;
  const situacao = ficha.situacao as SituacaoFicha;
  const aberta = situacao === "em_preenchimento";
  const vencida =
    aberta &&
    !!ficha.expira_em &&
    new Date(ficha.expira_em).getTime() <= Date.now();
  const tipo = ficha.tipo ? ROTULO_TIPO_CURTO[ficha.tipo] : "Tipo a escolher";

  return (
    <>
      <Link
        href={ROTA_FICHAS}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden /> Fichas cadastrais
      </Link>
      <PageHeader
        title={ficha.nome ?? "Ficha sem nome"}
        description={`${tipo} · ${ROTULO_SITUACAO[situacao]} · Origem: ${ROTULO_ORIGEM[ficha.origem] ?? ficha.origem}${ficha.luc ? ` · Imóvel pretendido ${ficha.luc}` : ""}`}
      />
      <div className="flex flex-col gap-6">
        <TopoComercial
          dadosDe={
            ficha.recebida_em
              ? `Enviada em ${formatarDataHora(ficha.recebida_em)}`
              : `Link gerado em ${formatarDataHora(ficha.gerada_em)}`
          }
          exemplo={ficha.exemplo ? "ficha do mockup" : undefined}
        />

        <div className="flex flex-wrap gap-2">
          {contrato && !aberta && (
            <Link
              href={`/comercial/contratos/novo?ficha=${ficha.id}`}
              className={BOTAO_PRIMARIO}
            >
              <FileSignature className="size-4" aria-hidden />
              Usar em contrato
            </Link>
          )}
          {ver && d.dados && (
            <a
              href={`${rotaDaFicha(ficha.id)}/pdf`}
              className={BOTAO_SECUNDARIO}
            >
              <FileDown className="size-4" aria-hidden />
              Ficha cadastral em PDF
            </a>
          )}
        </div>

        {d.mesmoDocumento.length > 0 && (
          <div
            role="alert"
            className="flex gap-3 rounded-[1.75rem] bg-amber-400/15 p-5 text-sm text-amber-900"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="font-medium">
                Este {d.dados?.documento?.length === 14 ? "CNPJ" : "CPF"} já tem{" "}
                {d.mesmoDocumento.length === 1
                  ? "outra ficha"
                  : `${d.mesmoDocumento.length} outras fichas`}
                :
              </p>
              <ul className="flex flex-col gap-0.5">
                {d.mesmoDocumento.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={rotaDaFicha(m.id)}
                      className="underline underline-offset-2"
                    >
                      {m.nome ?? "Sem nome"}
                    </Link>{" "}
                    ·{" "}
                    {ROTULO_SITUACAO[m.situacao as SituacaoFicha] ?? m.situacao}{" "}
                    · {formatarData(m.gerada_em)}
                  </li>
                ))}
              </ul>
              <p className="text-xs">
                Aviso só para a equipe; o interessado não vê.
              </p>
            </div>
          </div>
        )}

        {aberta && gerar && (
          <Secao
            titulo="Link da ficha"
            descricao={
              ficha.cancelada_em
                ? `Cancelado em ${formatarDataHora(ficha.cancelada_em)}. Reenviar volta a valer o mesmo link.`
                : vencida
                  ? `Venceu em ${formatarData(ficha.expira_em)}. Reenviar renova a validade; o que o interessado salvou continua.`
                  : ficha.expira_em
                    ? `Vale até ${formatarData(ficha.expira_em)}. ${ficha.iniciada_em ? "O interessado já começou a preencher." : "Ainda não preenchido."}`
                    : "Sem validade."
            }
          >
            <div className="flex flex-col gap-4">
              {!ficha.cancelada_em && !vencida && (
                <LinkParaEnviar
                  link={linkDaFicha(ficha.token)}
                  validoAte={
                    ficha.expira_em ? formatarData(ficha.expira_em) : undefined
                  }
                />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <FormAcao
                  acao={reenviarLinkFicha}
                  variante="secundario"
                  rotulo={
                    ficha.cancelada_em || vencida
                      ? "Reenviar link"
                      : "Renovar validade"
                  }
                  rotuloEnviando="Renovando…"
                >
                  <input type="hidden" name="id" value={ficha.id} />
                </FormAcao>
                {!ficha.cancelada_em && (
                  <FormAcao
                    acao={cancelarLinkFicha}
                    variante="perigo"
                    rotulo="Cancelar link"
                    rotuloEnviando="Cancelando…"
                    confirmar="Cancelar o link? Quem abrir vai ver que o link foi cancelado. Dá para reenviar depois."
                  >
                    <input type="hidden" name="id" value={ficha.id} />
                  </FormAcao>
                )}
                {!ficha.cancelada_em && !vencida && (
                  <a
                    href={linkDaFicha(ficha.token)}
                    target="_blank"
                    rel="noreferrer"
                    className={BOTAO_SECUNDARIO}
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    Abrir o link
                  </a>
                )}
              </div>
              {ficha.rd_oportunidade && (
                <Nota>Oportunidade no RD: {ficha.rd_oportunidade}</Nota>
              )}
            </div>
          </Secao>
        )}

        {(d.principal || d.fiadores.length > 0) && (
          <Secao titulo="Fichas ligadas">
            <ul className="flex flex-col gap-1 text-sm">
              {d.principal && (
                <li>
                  Fiador(a) de{" "}
                  <Link
                    href={rotaDaFicha(d.principal.id)}
                    className="font-medium underline underline-offset-2"
                  >
                    {d.principal.nome ?? "ficha sem nome"}
                  </Link>
                </li>
              )}
              {d.fiadores.map((x) => (
                <li key={x.id}>
                  Fiador(a):{" "}
                  <Link
                    href={rotaDaFicha(x.id)}
                    className="font-medium underline underline-offset-2"
                  >
                    {x.nome ?? "sem nome"}
                  </Link>{" "}
                  · {ROTULO_SITUACAO[x.situacao as SituacaoFicha] ?? x.situacao}
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {!ver ? (
          <Secao titulo="Dados da ficha">
            <p className="text-sm text-neutral-600">
              Dados pessoais, de renda e documentos só para quem tem a permissão
              de ver as fichas cadastrais.
            </p>
          </Secao>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Secao titulo="Consentimento LGPD">
                <p className="text-sm">
                  {ficha.consentimento_em ? (
                    <>
                      <span className="rounded-full bg-green-400/20 px-2 py-0.5 text-xs font-medium text-green-800">
                        Aceito
                      </span>{" "}
                      em {formatarDataHora(ficha.consentimento_em)}
                    </>
                  ) : (
                    "Ainda não aceito (o interessado não passou da pergunta 2)."
                  )}
                </p>
                {d.dados?.documento && (
                  <p className="mt-2 text-sm text-neutral-600">
                    {d.dados.documento.length === 14 ? "CNPJ" : "CPF"}:{" "}
                    {formatarDocumento(d.dados.documento)}
                  </p>
                )}
              </Secao>
              <Secao
                titulo="Documentos enviados"
                className="lg:col-span-2"
                descricao="O download abre por um endereço temporário e fica registrado."
              >
                {d.documentos.length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    Nenhum documento enviado.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
                    {d.documentos.map((x) => (
                      <li
                        key={x.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
                      >
                        <FileText
                          className="size-4 text-neutral-400"
                          aria-hidden
                        />
                        <span className="font-medium">{x.documento}</span>
                        <a
                          href={`${rotaDaFicha(ficha.id)}/documento/${x.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 truncate text-neutral-600 underline underline-offset-2"
                        >
                          {x.arquivo_nome}
                        </a>
                        <span className="ml-auto text-xs text-neutral-500">
                          {x.tamanho
                            ? `${formatarNumero(x.tamanho / 1024 / 1024, 1)} MB · `
                            : ""}
                          {formatarDataHora(x.enviado_em)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Secao>
            </div>

            {d.dados ? (
              <BlocosDaFicha blocos={blocosDaFicha(d.dados.respostas)} />
            ) : (
              <Secao titulo="Respostas">
                <p className="text-sm text-neutral-500">
                  O interessado ainda não salvou nenhuma resposta.
                </p>
              </Secao>
            )}

            <Secao
              titulo="Quem abriu esta ficha"
              descricao="Registro de acesso (LGPD): os últimos 30."
            >
              {d.acessos.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Você é o primeiro a abrir.
                </p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {d.acessos.map((a) => (
                    <li
                      key={`${a.em}-${a.acao}`}
                      className="flex flex-wrap gap-x-2"
                    >
                      <span className="tabular-nums text-neutral-500">
                        {formatarDataHora(a.em)}
                      </span>
                      <span className="font-medium">{a.nome}</span>
                      <span className="text-neutral-600">
                        {ACAO[a.acao] ?? a.acao}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Secao>
          </>
        )}
      </div>
    </>
  );
}
