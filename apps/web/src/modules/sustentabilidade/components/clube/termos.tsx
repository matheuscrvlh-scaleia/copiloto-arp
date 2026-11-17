import { formatarData } from "@arp/shared/formato";
import { validadeDoTermo } from "@arp/shared/sustentabilidade/situacao";
import { FileText, PenLine, Plus } from "lucide-react";
import { useState } from "react";
import { Assinatura } from "@/components/assinatura";
import { classeCampo } from "@/components/estilos";
import { type EstadoAcao, FormAcao } from "@/components/form-acao";
import { Janela } from "@/components/janela";
import { notificar } from "@/components/notificacoes";
import { botao, rotulo } from "@/modules/os/components/ordem/estilos";
import {
  linkDoTermo,
  registrarTermoAnexo,
  registrarTermoAssinado,
  removerTermo,
} from "../../api-clube";

// Termos de todos os anos do participante (spec 4.5): ano, assinatura, válido
// até (assinatura + meses dos Parâmetros), o PDF e a assinatura. Um termo novo
// entra de dois jeitos: anexando o PDF do termo assinado em papel, ou
// assinando na tela (o sistema gera o PDF no papel timbrado). Salvar o termo
// novo conclui o chamado "Renovar termo do Clube".

export interface TermoDaLista {
  id: string;
  ano: number;
  assinadoEm: string;
  validoAte: string;
  temArquivo: boolean;
  temAssinatura: boolean;
}

async function abrir(id: string, qual: "arquivo" | "assinatura") {
  // A aba abre no clique (senão o navegador bloqueia) e recebe o link depois.
  const aba = window.open("", "_blank");
  const r = await linkDoTermo(id, qual);
  if ("url" in r) {
    if (aba) aba.location.href = r.url;
    else window.location.href = r.url;
    return;
  }
  aba?.close();
  notificar("erro", r.erro);
}

export function ListaDeTermos({
  termos,
  hoje,
  podeEditar,
}: {
  termos: TermoDaLista[];
  hoje: string;
  podeEditar: boolean;
}) {
  if (termos.length === 0)
    return (
      <p className="py-4 text-sm text-neutral-500">
        Nenhum termo registrado.{" "}
        {podeEditar
          ? "Use Registrar termo para anexar o PDF ou assinar na tela."
          : "Quem edita o Clube registra o termo aqui."}
      </p>
    );
  return (
    <div data-guia="termos" className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="px-2 py-2 font-medium">Ano</th>
            <th className="px-2 py-2 font-medium">Assinado em</th>
            <th className="px-2 py-2 font-medium">Válido até</th>
            <th className="px-2 py-2 font-medium">Arquivos</th>
            {podeEditar && <th className="w-24" aria-label="Remover" />}
          </tr>
        </thead>
        <tbody>
          {termos.map((t) => (
            <tr
              key={t.id}
              className="border-b border-neutral-900/[0.06] last:border-0"
            >
              <td className="px-2 py-2 font-medium tabular-nums">{t.ano}</td>
              <td className="px-2 py-2 tabular-nums">
                {formatarData(t.assinadoEm)}
              </td>
              <td className="px-2 py-2 tabular-nums">
                {formatarData(t.validoAte)}
                {t.validoAte < hoje && (
                  <span className="ml-2 text-xs text-red-700">vencido</span>
                )}
              </td>
              <td className="px-2 py-2">
                <div className="flex flex-wrap gap-2">
                  {t.temArquivo ? (
                    <button
                      type="button"
                      onClick={() => void abrir(t.id, "arquivo")}
                      className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline"
                    >
                      <FileText className="size-3.5" aria-hidden />
                      Abrir o termo (PDF)
                    </button>
                  ) : (
                    <span className="text-xs text-neutral-400">sem PDF</span>
                  )}
                  {t.temAssinatura && (
                    <button
                      type="button"
                      onClick={() => void abrir(t.id, "assinatura")}
                      className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline"
                    >
                      <PenLine className="size-3.5" aria-hidden />
                      Ver a assinatura
                    </button>
                  )}
                </div>
              </td>
              {podeEditar && (
                <td className="px-2 py-2 text-right">
                  <FormAcao
                    acao={removerTermo}
                    rotulo="Remover"
                    rotuloEnviando="Removendo…"
                    variante="perigo"
                    confirmar={`Remover o termo de ${t.ano}? O PDF e a assinatura também saem.`}
                  >
                    <input type="hidden" name="id" value={t.id} />
                  </FormAcao>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Modo = "anexo" | "assinatura";

export function RegistrarTermo({
  participanteId,
  nome,
  hoje,
  validadeMeses,
}: {
  participanteId: string;
  nome: string;
  hoje: string;
  /** termo_validade_meses dos Parâmetros. */
  validadeMeses: number;
}) {
  const [aberta, setAberta] = useState(false);
  const [modo, setModo] = useState<Modo>("anexo");
  const [assinadoEm, setAssinadoEm] = useState(hoje);
  const [ano, setAno] = useState(hoje.slice(0, 4));
  const valido = /^\d{4}-\d{2}-\d{2}$/.test(assinadoEm)
    ? validadeDoTermo(assinadoEm, validadeMeses)
    : null;

  const assinar = async (
    estado: EstadoAcao,
    form: FormData,
  ): Promise<EstadoAcao> => {
    const r = await registrarTermoAssinado(estado, form);
    if (r.ok) {
      notificar("ok", r.ok);
      setAberta(false);
    }
    return r;
  };

  const comum = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className={rotulo}>
        Assinado em
        <input
          type="date"
          required
          max={hoje}
          value={assinadoEm}
          onChange={(e) => {
            setAssinadoEm(e.target.value);
            if (e.target.value) setAno(e.target.value.slice(0, 4));
          }}
          className={classeCampo}
        />
      </label>
      <label className={rotulo}>
        Ano do termo
        <input
          type="number"
          required
          min={2000}
          max={2100}
          value={ano}
          onChange={(e) => setAno(e.target.value)}
          className={classeCampo}
        />
      </label>
      <p className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
        Válido até
        <span className="rounded-xl bg-neutral-900/[0.04] px-3 py-2 text-sm font-semibold tabular-nums text-neutral-900">
          {valido ? formatarData(valido) : "—"}
        </span>
      </p>
    </div>
  );

  return (
    <>
      <button
        type="button"
        data-guia="registrar-termo"
        onClick={() => setAberta(true)}
        aria-haspopup="dialog"
        className={botao.primario}
      >
        <Plus className="size-4" aria-hidden />
        Registrar termo
      </button>
      <Janela
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Registrar termo"
        descricao={`Vale por ${validadeMeses} ${validadeMeses === 1 ? "mês" : "meses"} a partir da assinatura (Parâmetros).`}
        largura="lg"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["anexo", "Anexar o PDF do termo assinado"],
                ["assinatura", "Assinar na tela"],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={modo === valor}
                onClick={() => setModo(valor)}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 aria-pressed:border-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white"
              >
                {texto}
              </button>
            ))}
          </div>

          {modo === "anexo" ? (
            <FormAcao
              acao={registrarTermoAnexo}
              rotulo="Salvar termo"
              rotuloEnviando="Salvando…"
              className="flex flex-col gap-3"
              aoConcluir={() => setAberta(false)}
            >
              <input
                type="hidden"
                name="participante_id"
                value={participanteId}
              />
              <input type="hidden" name="assinado_em" value={assinadoEm} />
              <input type="hidden" name="ano" value={ano} />
              {comum}
              <label className={rotulo}>
                PDF do termo assinado (até 8 MB)
                <input
                  type="file"
                  name="arquivo"
                  accept="application/pdf,.pdf"
                  required
                  className={classeCampo}
                />
              </label>
            </FormAcao>
          ) : (
            <div className="flex flex-col gap-3">
              {comum}
              <p className="text-xs text-neutral-500">
                Quem assina desenha no quadro. O sistema gera o PDF do termo no
                papel timbrado, com o texto, o ano e a validade.
              </p>
              <Assinatura
                acao={assinar}
                campos={{
                  participante_id: participanteId,
                  assinado_em: assinadoEm,
                  ano,
                }}
                podeEditar
                documento
                atual={null}
                nomeSugerido={nome}
                rotuloSalvar="Assinar e gerar o PDF"
                bloqueio={
                  assinadoEm && ano
                    ? null
                    : "Informe a data da assinatura e o ano do termo."
                }
              />
            </div>
          )}
        </div>
      </Janela>
    </>
  );
}
