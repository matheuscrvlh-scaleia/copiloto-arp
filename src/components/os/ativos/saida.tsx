import { FileText, LogOut, Paperclip, Undo2 } from "lucide-react";
import { SeloStatus } from "@/components/dashboard/indicador";
import { classeCampo } from "@/components/estilos";
import type { Opcao } from "@/components/selecao";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/formato";
import { nomeDoAnexo, rotuloDaSaida, textoDoDocumento } from "@/lib/os/saidas";
import { desfazerSaida, registrarSaida } from "@/server/os/acoes/saidas";
import type { SaidaNaTela } from "@/server/os/saidas";
import { Janela } from "./janela";
import { CamposDaSaida } from "./saida-campos";

// Saída do ativo na ficha e no relatório: o botão "Registrar saída" (com a
// janela do formulário), o quadro de cada saída com recibo, anexos e o
// "Desfazer saída" (com motivo).

export const rotaRecibo = (saidaId: string) =>
  `/os/ativos/saidas/${saidaId}/recibo`;

export function BotaoRegistrarSaida({
  ativo,
  tipos,
  formas,
  pessoas,
  hoje,
  responsavelPadrao,
  sobra,
  variante = "secundario",
}: {
  /** Ativo da ficha; sem ele, registra a saída de uma sobra sem cadastro. */
  ativo?: { id: string; nome: string };
  tipos: string[];
  formas: string[];
  pessoas: Opcao[];
  hoje: string;
  responsavelPadrao?: string;
  sobra?: { categorias: Opcao[] };
  variante?: "primario" | "secundario";
}) {
  return (
    <span data-guia="os-ativo-registrar-saida">
      <Janela
        acao={registrarSaida}
        variante={variante}
        rotulo={ativo ? "Registrar saída" : "Registrar saída de sobra"}
        icone={<LogOut className="size-4" aria-hidden />}
        titulo={
          ativo
            ? `Registrar saída de ${ativo.nome}`
            : "Saída de sobra sem cadastro"
        }
        descricao={
          ativo
            ? "Venda, doação, descarte, devolução ou outro destino. O ativo fica baixado, sai das listas de uso e não recebe nova OS; o histórico continua."
            : "Material que nunca foi cadastrado (ex.: sobra de obra). O sistema cria o ativo já baixado e registra a saída."
        }
        enviar="Registrar saída"
        enviando="Registrando…"
      >
        <CamposDaSaida
          ativoId={ativo?.id}
          tipos={tipos}
          formas={formas}
          pessoas={pessoas}
          hoje={hoje}
          responsavelPadrao={responsavelPadrao}
          sobra={sobra}
        />
      </Janela>
    </span>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-neutral-500">{rotulo}</dt>
      <dd className="text-sm break-words text-neutral-900">{valor}</dd>
    </div>
  );
}

/** As saídas do ativo (a que vale e as desfeitas), da mais nova à mais antiga. */
export function SaidasDoAtivo({
  saidas,
  podeDesfazer,
}: {
  saidas: SaidaNaTela[];
  podeDesfazer: boolean;
}) {
  return (
    <ul className="flex flex-col gap-4">
      {saidas.map((s) => {
        const desfeita = s.desfeita_em !== null;
        return (
          <li
            key={s.id}
            className={`flex flex-col gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/50 p-4 ${desfeita ? "opacity-75" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">
                {s.tipo} · {formatarData(s.data)}
              </p>
              <SeloStatus
                status={desfeita ? "sem_dado" : "ok"}
                rotulo={
                  desfeita ? "Desfeita" : `Baixado – ${rotuloDaSaida(s.tipo)}`
                }
              />
            </div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {s.quantidade && (
                <Linha rotulo="Quantidade" valor={s.quantidade} />
              )}
              {s.valor !== null && (
                <Linha rotulo="Valor" valor={formatarMoeda(Number(s.valor))} />
              )}
              {s.forma_recebimento && (
                <Linha
                  rotulo="Recebimento"
                  valor={[s.forma_recebimento, s.recebido_por]
                    .filter(Boolean)
                    .join(" · ")}
                />
              )}
              {s.destinatario_nome && (
                <Linha
                  rotulo="Destinatário"
                  valor={[
                    s.destinatario_nome,
                    textoDoDocumento(s.destinatario_documento),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              )}
              <Linha rotulo="Responsável" valor={s.responsavel ?? "—"} />
              <Linha
                rotulo="Nota fiscal"
                valor={
                  s.nota_fiscal ? `Sim, nº ${s.nota_fiscal_numero}` : "Não"
                }
              />
              {s.motivo && <Linha rotulo="Motivo" valor={s.motivo} />}
              {s.observacoes && (
                <Linha rotulo="Observações" valor={s.observacoes} />
              )}
              <Linha
                rotulo="Registrada"
                valor={`${formatarDataHora(s.registrado_em)}${s.registradoPorNome ? ` por ${s.registradoPorNome}` : ""}`}
              />
              {desfeita && s.desfeita_em && (
                <Linha
                  rotulo="Desfeita"
                  valor={`${formatarDataHora(s.desfeita_em)}${s.desfeitaPorNome ? ` por ${s.desfeitaPorNome}` : ""}: ${s.desfeita_motivo ?? ""}`}
                />
              )}
            </dl>
            {s.arquivos.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {s.arquivos.map((a) => (
                  <li key={a.caminho}>
                    {a.url ? (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:border-neutral-400"
                      >
                        <Paperclip className="size-3.5" aria-hidden />
                        {nomeDoAnexo(a.caminho)}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-500">
                        <Paperclip className="size-3.5" aria-hidden />
                        {nomeDoAnexo(a.caminho)} (arquivo não encontrado)
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={rotaRecibo(s.id)}
                target="_blank"
                rel="noreferrer"
                data-guia="os-ativo-recibo-saida"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
              >
                <FileText className="size-4" aria-hidden />
                Recibo em PDF
              </a>
              {podeDesfazer && !desfeita && (
                <Janela
                  acao={desfazerSaida}
                  variante="perigo"
                  perigo
                  rotulo="Desfazer saída"
                  icone={<Undo2 className="size-4" aria-hidden />}
                  titulo="Desfazer a saída"
                  descricao="O ativo volta à situação de antes da saída. O registro fica no histórico, com o motivo."
                  enviar="Desfazer saída"
                  enviando="Desfazendo…"
                >
                  <input type="hidden" name="id" value={s.id} />
                  <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
                    Motivo
                    <textarea
                      name="motivo"
                      required
                      minLength={3}
                      maxLength={500}
                      rows={3}
                      placeholder="Ex.: o comprador desistiu e devolveu o item."
                      className={classeCampo}
                    />
                  </label>
                </Janela>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
