import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { SeloSituacao } from "@/components/formularios/blocos";
import {
  CabecalhoDoFormulario,
  motivoDoEncerramento,
} from "@/components/formularios/cabecalho";
import { LinkDoFormulario } from "@/components/formularios/link";
import { SemAcesso } from "@/components/protegido";
import { formatarDataHora, formatarNumero } from "@/lib/formato";
import { paraBrasiliaLocal } from "@/lib/formularios/formulario";
import {
  duplicarFormulario,
  excluirFormulario,
  gerarNovoLink,
  mudarSituacao,
  salvarConfiguracoes,
} from "@/server/formularios/acoes/formularios";
import { contexto, formularioPorId } from "@/server/formularios/base";

export const metadata: Metadata = { title: "Link e configurações" };

export default function Page({
  params,
}: PageProps<"/formularios/[id]/configuracoes">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-28" />
          <CartaoCarregando altura="h-48" />
          <CartaoCarregando altura="h-56" />
        </TelaCarregando>
      }
    >
      <Tela params={params} />
    </Suspense>
  );
}

const ROTULO = "text-xs font-medium text-neutral-600";

/** Botão de publicar, encerrar, reabrir ou voltar para rascunho. */
function Mudar({
  id,
  acao,
  rotulo,
  variante = "primario",
  confirmar,
}: {
  id: string;
  acao: "publicar" | "encerrar" | "reabrir" | "rascunho";
  rotulo: string;
  variante?: "primario" | "secundario" | "perigo";
  confirmar?: string;
}) {
  return (
    <FormAcao
      acao={mudarSituacao}
      rotulo={rotulo}
      rotuloEnviando="Salvando…"
      variante={variante}
      confirmar={confirmar}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="acao" value={acao} />
    </FormAcao>
  );
}

async function Tela({
  params,
}: Pick<PageProps<"/formularios/[id]/configuracoes">, "params">) {
  const [{ id }, ctx] = await Promise.all([params, contexto()]);
  if (!ctx.edita) return <SemAcesso />;
  const f = await formularioPorId(id);
  if (!f) notFound();

  return (
    <>
      <CabecalhoDoFormulario f={f} aba="configuracoes" edita />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Secao
          titulo="Situação"
          descricao="Só o formulário publicado recebe respostas. Pode editar as perguntas a qualquer momento, mesmo publicado."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <SeloSituacao
                situacao={f.efetiva}
                detalhe={motivoDoEncerramento(f)}
              />
              {f.publicado_em && (
                <span className="text-neutral-500">
                  publicado pela primeira vez em{" "}
                  {formatarDataHora(f.publicado_em)}
                </span>
              )}
            </div>
            <div
              data-guia="formularios-situacao"
              className="flex flex-wrap gap-2"
            >
              {f.situacao === "rascunho" && (
                <Mudar id={f.id} acao="publicar" rotulo="Publicar" />
              )}
              {f.situacao === "publicado" && (
                <Mudar
                  id={f.id}
                  acao="encerrar"
                  rotulo="Encerrar"
                  variante="secundario"
                  confirmar="O link deixa de receber respostas na hora. As respostas recebidas continuam guardadas, e dá para reabrir depois."
                />
              )}
              {f.situacao === "encerrado" && (
                <Mudar id={f.id} acao="reabrir" rotulo="Reabrir" />
              )}
              {f.situacao !== "rascunho" && f.total_respostas === 0 && (
                <Mudar
                  id={f.id}
                  acao="rascunho"
                  rotulo="Voltar para rascunho"
                  variante="secundario"
                />
              )}
            </div>
          </div>
        </Secao>

        <Secao
          titulo="Link para responder"
          descricao="Quem recebe o link responde sem login. Gerar um link novo desliga o anterior."
        >
          <div data-guia="formularios-link" className="flex flex-col gap-3">
            <LinkDoFormulario link={f.link} titulo={f.titulo} />
            {f.efetiva !== "publicado" && (
              <Nota>
                {f.situacao === "rascunho"
                  ? "O link só abre depois de publicar. Até lá, use a Prévia para ver como fica."
                  : "O link está fechado: quem abrir vê o aviso de formulário encerrado."}
              </Nota>
            )}
            <FormAcao
              acao={gerarNovoLink}
              rotulo="Gerar novo link"
              rotuloEnviando="Gerando…"
              variante="secundario"
              confirmar="O link atual para de funcionar na hora: quem ainda não respondeu vai precisar do novo."
            >
              <input type="hidden" name="id" value={f.id} />
            </FormAcao>
          </div>
        </Secao>

        <Secao
          titulo="Respostas"
          descricao="Agradecimento depois do envio e quando o link fecha sozinho."
        >
          <FormAcao acao={salvarConfiguracoes} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={f.id} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mensagem_final" className={ROTULO}>
                Mensagem depois do envio
              </label>
              <textarea
                id="mensagem_final"
                name="mensagem_final"
                rows={3}
                maxLength={2000}
                defaultValue={f.mensagem_final}
                placeholder="Recebemos a sua resposta. Obrigado!"
                className={`${classeCampo} resize-y`}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="encerra_em" className={ROTULO}>
                  Encerrar em (opcional)
                </label>
                <input
                  id="encerra_em"
                  name="encerra_em"
                  type="datetime-local"
                  defaultValue={paraBrasiliaLocal(f.encerra_em)}
                  className={classeCampo}
                />
                <p className="text-xs text-neutral-500">Horário de Brasília.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="limite_respostas" className={ROTULO}>
                  Limite de respostas (opcional)
                </label>
                <input
                  id="limite_respostas"
                  name="limite_respostas"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={6}
                  defaultValue={f.limite_respostas ?? ""}
                  placeholder="Sem limite"
                  className={classeCampo}
                />
                <p className="text-xs text-neutral-500">
                  Já recebidas: {formatarNumero(f.total_respostas)}.
                </p>
              </div>
            </div>
          </FormAcao>
        </Secao>

        <Secao titulo="Mais ações">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-neutral-600">
                Duplicar cria uma cópia em rascunho, com as mesmas perguntas e
                sem as respostas.
              </p>
              <FormAcao
                acao={duplicarFormulario}
                rotulo="Duplicar formulário"
                rotuloEnviando="Duplicando…"
                variante="secundario"
              >
                <input type="hidden" name="id" value={f.id} />
              </FormAcao>
            </div>
            <div className="flex flex-col gap-2 border-t border-neutral-900/[0.06] pt-4">
              <p className="text-sm text-neutral-600">
                Excluir apaga o formulário e{" "}
                {f.total_respostas
                  ? `as ${formatarNumero(f.total_respostas)} respostas`
                  : "o link"}
                . Não tem volta: para só parar de receber, encerre.
              </p>
              <FormAcao
                acao={excluirFormulario}
                rotulo="Excluir formulário"
                rotuloEnviando="Excluindo…"
                variante="perigo"
                confirmar={`Excluir "${f.titulo}"${f.total_respostas ? ` e as ${f.total_respostas} respostas` : ""}? Não tem volta.`}
              >
                <input type="hidden" name="id" value={f.id} />
              </FormAcao>
            </div>
          </div>
        </Secao>
      </div>
    </>
  );
}
