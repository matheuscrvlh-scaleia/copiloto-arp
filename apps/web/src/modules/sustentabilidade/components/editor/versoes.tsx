import { formatarDataHora, formatarNumero } from "@arp/shared/formato";
import {
  rotulosDoFormulario,
  type TipoFormulario,
} from "@arp/shared/sustentabilidade/editor-operacoes";
import {
  type DefinicaoFormulario,
  ROTULO_TIPO,
} from "@arp/shared/sustentabilidade/formulario/tipos";
import { ArrowLeft } from "lucide-react";
import { useState, useTransition } from "react";
import type { VersaoDoEditor } from "../../api-editor";
import { lerVersao } from "../../api-editor";
import { Aviso, BOTAO, Janela } from "./janela";
import { Situacao } from "./pergunta";

// Versões (4.13): número, data, quem publicou, resumo e quantas entrevistas
// ou lançamentos usaram cada uma. A antiga abre só para leitura e pode virar
// rascunho novo (nada é apagado).

export function JanelaVersoes({
  formularioId,
  nome,
  tipo,
  versaoAtual,
  versoes,
  aoFechar,
  restaurar,
  enviando,
}: {
  formularioId: string;
  nome: string;
  tipo: TipoFormulario;
  versaoAtual: number;
  versoes: VersaoDoEditor[];
  aoFechar: () => void;
  /** Pede confirmação e restaura; true = restaurou. */
  restaurar: (versao: number) => void;
  enviando: boolean;
}) {
  const r = rotulosDoFormulario(tipo);
  const [aberta, setAberta] = useState<{
    versao: number;
    definicao?: DefinicaoFormulario;
    erro?: string;
  } | null>(null);
  const [lendo, iniciar] = useTransition();

  const ver = (versao: number) =>
    iniciar(async () => {
      setAberta({ versao });
      const res = await lerVersao(formularioId, versao);
      setAberta({ versao, ...res });
    });

  return (
    <Janela
      aberto
      aoFechar={aoFechar}
      largura="larga"
      guia="versoes"
      subtitulo={nome}
      titulo={aberta ? `Versão ${aberta.versao} (só leitura)` : "Versões"}
    >
      {aberta ? (
        <>
          <div>
            <button
              type="button"
              className={BOTAO.pequeno}
              onClick={() => setAberta(null)}
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Voltar às versões
            </button>
          </div>
          {lendo && <p className="text-neutral-500">Carregando…</p>}
          {aberta.erro && <Aviso tom="erro">{aberta.erro}</Aviso>}
          {aberta.definicao && (
            <DefinicaoSoLeitura definicao={aberta.definicao} tipo={tipo} />
          )}
        </>
      ) : versoes.length === 0 ? (
        <p className="text-neutral-500">
          Ainda não há versão publicada. A primeira nasce ao publicar o
          rascunho.
        </p>
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                  <th className="px-2 py-2 text-left font-medium">Versão</th>
                  <th className="px-2 py-2 text-left font-medium">
                    Publicada em
                  </th>
                  <th className="px-2 py-2 text-left font-medium">Por</th>
                  <th className="px-2 py-2 text-left font-medium">
                    O que mudou
                  </th>
                  <th className="px-2 py-2 text-right font-medium">
                    {tipo === "programa" ? "Lançamentos" : "Entrevistas"}
                  </th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {versoes.map((v) => (
                  <tr
                    key={v.versao}
                    className="border-b border-neutral-900/[0.06] last:border-0"
                  >
                    <td className="px-2 py-2 whitespace-nowrap">
                      {v.versao}
                      {v.versao === versaoAtual && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          em uso
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {formatarDataHora(v.em)}
                    </td>
                    <td className="px-2 py-2">{v.por}</td>
                    <td className="px-2 py-2">{v.resumo}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatarNumero(v.usos)}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-right">
                      <button
                        type="button"
                        className={BOTAO.pequeno}
                        onClick={() => ver(v.versao)}
                      >
                        Ver
                      </button>{" "}
                      {v.versao !== versaoAtual && (
                        <button
                          type="button"
                          className={BOTAO.pequeno}
                          disabled={enviando}
                          onClick={() => restaurar(v.versao)}
                        >
                          Restaurar como rascunho
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-500">
            Versões antigas ficam só para leitura. Restaurar cria um rascunho
            novo a partir delas: {r.itens} e opções que não existiam nela entram
            inativ{r.item === "campo" ? "os" : "as"}, e nada é apagado.
          </p>
        </>
      )}
    </Janela>
  );
}

/** Seções e perguntas de uma definição, sem ações. */
export function DefinicaoSoLeitura({
  definicao,
  tipo,
}: {
  definicao: DefinicaoFormulario;
  tipo: TipoFormulario;
}) {
  const r = rotulosDoFormulario(tipo);
  return (
    <div className="flex flex-col gap-4">
      {definicao.secoes.map((s) => (
        <section key={s.id}>
          <h3 className="mb-1 font-semibold">
            {s.nome}
            {!s.ativa && (
              <span className="ml-2 align-middle">
                <Situacao ativa={false} />
              </span>
            )}
          </h3>
          {s.perguntas.length === 0 ? (
            <p className="text-neutral-500">Sem {r.itens}.</p>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <tbody>
                  {s.perguntas.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-b border-neutral-900/[0.06] last:border-0 ${p.ativa ? "" : "text-neutral-400"}`}
                    >
                      <td className="w-12 px-2 py-1.5 font-mono text-xs">
                        {p.numero}
                      </td>
                      <td className="px-2 py-1.5">
                        {p.texto}
                        {p.opcoes.length > 0 && (
                          <span className="block text-xs text-neutral-500">
                            {p.opcoes
                              .map((o) =>
                                o.ativa ? o.texto : `${o.texto} (inativa)`,
                              )
                              .join(" · ")}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-neutral-600">
                        {ROTULO_TIPO[p.tipo]}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Situacao ativa={p.ativa} travada={p.travada} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
