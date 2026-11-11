import { Download } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
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
import {
  CORES,
  NOMES_DAS_CORES,
  paraBrasiliaLocal,
} from "@/lib/formularios/formulario";
import {
  duplicarFormulario,
  excluirFormulario,
  gerarNovoLink,
  mudarSituacao,
  salvarAparencia,
  salvarConfiguracoes,
} from "@/server/formularios/acoes/formularios";
import { contexto, formularioPorId } from "@/server/formularios/base";

export const metadata: Metadata = { title: "Link e configurações" };

export default function Page({
  params,
}: PageProps<"/relatorios/[id]/configuracoes">) {
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
}: Pick<PageProps<"/relatorios/[id]/configuracoes">, "params">) {
  const [{ id }, ctx] = await Promise.all([params, contexto()]);
  if (!ctx.edita) return <SemAcesso />;
  const f = await formularioPorId(id);
  if (!f) notFound();
  const qr = await QRCode.toDataURL(f.link, {
    width: 640,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  const arquivoQr = `qr-${
    f.titulo
      .normalize("NFD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 50) || "relatorio"
  }.png`;

  return (
    <>
      <CabecalhoDoFormulario f={f} aba="configuracoes" edita />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Secao
          titulo="Situação"
          descricao="Só o relatório publicado recebe respostas. Pode editar as perguntas a qualquer momento, mesmo publicado."
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
            <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white/60 p-3">
              {/* biome-ignore lint/performance/noImgElement: QR em data URL, gerado aqui */}
              <img
                src={qr}
                alt={`QR code do link de ${f.titulo}`}
                width={128}
                height={128}
                className="size-32 rounded-xl bg-white"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-sm text-neutral-600">
                  QR code para imprimir em cartaz, recepção ou obra: quem aponta
                  a câmera do celular abre o link.
                </p>
                <a
                  href={qr}
                  download={arquivoQr}
                  className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
                >
                  <Download className="size-4" aria-hidden />
                  Baixar QR code
                </a>
              </div>
            </div>
            {f.efetiva !== "publicado" && (
              <Nota>
                {f.situacao === "rascunho"
                  ? "O link só abre depois de publicar. Até lá, use a Prévia para ver como fica."
                  : "O link está fechado: quem abrir vê o aviso de relatório encerrado."}
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

        <Secao
          titulo="Aparência"
          descricao="Como o link aparece para quem responde. Use a Prévia para conferir."
        >
          <FormAcao acao={salvarAparencia} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={f.id} />
            <fieldset className="flex flex-col gap-2">
              <legend className={`${ROTULO} mb-1`}>Cor de destaque</legend>
              <div className="flex flex-wrap gap-2">
                {NOMES_DAS_CORES.map((c) => (
                  <label
                    key={c}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-neutral-200 bg-white py-1.5 pr-3 pl-1.5 text-sm transition hover:border-neutral-400 has-[:checked]:border-neutral-900 has-[:checked]:ring-2 has-[:checked]:ring-neutral-900/10"
                  >
                    <input
                      type="radio"
                      name="cor"
                      value={c}
                      defaultChecked={f.cor === c}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className="size-5 rounded-full"
                      style={{ backgroundColor: CORES[c].hex }}
                    />
                    {CORES[c].rotulo}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="paginas"
                defaultChecked={f.paginas}
                className="mt-0.5 size-4 accent-neutral-900"
              />
              <span>
                Uma seção por página, com barra de progresso
                <span className="block text-xs text-neutral-500">
                  Cada título de seção abre uma página. Bom para relatórios
                  longos no celular.
                </span>
              </span>
            </label>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="redirecionar_para" className={ROTULO}>
                Depois do envio, levar para (opcional)
              </label>
              <input
                id="redirecionar_para"
                name="redirecionar_para"
                type="url"
                inputMode="url"
                maxLength={500}
                defaultValue={f.redirecionar_para ?? ""}
                placeholder="https://"
                className={classeCampo}
              />
              <p className="text-xs text-neutral-500">
                Vazio: mostra a mensagem depois do envio.
              </p>
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
                rotulo="Duplicar relatório"
                rotuloEnviando="Duplicando…"
                variante="secundario"
              >
                <input type="hidden" name="id" value={f.id} />
              </FormAcao>
            </div>
            <div className="flex flex-col gap-2 border-t border-neutral-900/[0.06] pt-4">
              <p className="text-sm text-neutral-600">
                Excluir apaga o relatório e{" "}
                {f.total_respostas
                  ? `as ${formatarNumero(f.total_respostas)} respostas`
                  : "o link"}
                . Não tem volta: para só parar de receber, encerre.
              </p>
              <FormAcao
                acao={excluirFormulario}
                rotulo="Excluir relatório"
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
