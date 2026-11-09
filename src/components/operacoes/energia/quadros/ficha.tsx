import { Download, Lock, TriangleAlert, Zap } from "lucide-react";
import { formatarData, formatarDataHora } from "@/lib/formato";
import {
  AVISO_LOCATARIO_NOVO,
  avisosDaCaixa,
  chaveDoDisjuntor,
  mesmoLocatario,
  opcoesDeDisjuntor,
  semTermo,
  textoDoDisjuntor,
} from "@/lib/operacoes/energia";
import {
  blocoNoTermo,
  nomeDoArquivoDoTermo,
  qualificacaoPadrao,
  salaNoTermo,
} from "@/lib/operacoes/termo";
import type { DadosDaFicha } from "@/server/operacoes/quadros";
import { FormCaixa } from "./form-caixa";
import { AcoesDoLocatario, AtualizarDoEnet } from "./locatario";
import { SeloDoStatus, SeloSemTermo, statusValido } from "./status";
import { EmitirTermo } from "./termo";

// Ficha da caixa (spec 4.5 e 4.6), no painel lateral e na página inteira:
// avisos, locatário (com o contrato vigente do ENET e a troca), cadastro,
// termos emitidos (com reimpressão) e o histórico de ocupantes, que só
// aparece para quem tem operacoes.energia.historico e nunca sai no termo.

const ORIGEM: Record<string, string> = {
  enet: "ENET",
  manual: "Digitado na ficha",
  importacao: "Carga inicial",
};

function Secao({
  titulo,
  extra,
  children,
}: {
  titulo: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      data-guia="secao"
      data-guia-titulo={titulo}
      className="flex flex-col gap-3"
    >
      <h3 className="flex flex-wrap items-baseline gap-x-2 text-xs font-semibold tracking-wide text-neutral-600 uppercase">
        {titulo}
        {extra && (
          <span className="text-[11px] font-normal tracking-normal normal-case text-neutral-500">
            {extra}
          </span>
        )}
      </h3>
      {children}
    </section>
  );
}

function Dados({ itens }: { itens: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm sm:grid-cols-3">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="min-w-0">
          <dt className="text-[11px] text-neutral-500">{rotulo}</dt>
          <dd className="break-words text-neutral-900">{valor || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FichaDaCaixa({
  d,
  termoAberto = false,
}: {
  d: DadosDaFicha;
  termoAberto?: boolean;
}) {
  const { caixa: c, ctx, parametros: p, enet } = d;
  const q = c.quadro;
  const status = statusValido(c.status);
  const podeEditar = ctx.pode("operacoes.energia.editar");
  const podeTermo = ctx.pode("operacoes.energia.termo");
  const avisos = avisosDaCaixa(c, enet);
  const divergente = !!enet && !mesmoLocatario(enet.locatario, c.ocupante);
  const disjuntores = opcoesDeDisjuntor(
    p.energia_disjuntores,
    p.energia_ligacoes,
    {
      amperes: c.disjuntor_amperes,
      ligacao: c.ligacao,
    },
  );

  // Termo: o contrato vigente do ENET manda; sem ele, a ficha da caixa.
  const doc = enet ? (enet.documento ?? "") : (c.ocupante_documento ?? "");
  const inicialTermo = {
    data_emissao: ctx.hoje,
    locatario: enet?.locatario ?? c.ocupante ?? "",
    documento: doc,
    qualificacao: qualificacaoPadrao(doc, p),
    bloco: blocoNoTermo(c.sala_bloco ?? q.bloco),
    pavimento: c.pavimento ?? "",
    sala: c.sala_unidade ? salaNoTermo(c.sala_unidade) : (c.sala ?? ""),
    projeto: q.projeto ?? "",
    amperes: c.disjuntor_amperes ? String(c.disjuntor_amperes) : "",
    ligacao: c.ligacao ?? "",
    armario: q.armario ?? "",
    rota: c.rota ?? "",
    observacao_tecnica: "",
  };

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Zap className="size-3.5" aria-hidden />
          {q.nome}
          {q.armario ? ` · Armário ${q.armario}` : ""}
          {c.exemplo && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 font-medium text-amber-800">
              <TriangleAlert className="size-3" aria-hidden />
              Dados de exemplo (fictícios)
            </span>
          )}
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
          Caixa {c.numero} · {c.sala ?? "sem sala ligada"}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <SeloDoStatus status={status} />
          {c.locatario_novo ? (
            <SeloSemTermo texto={AVISO_LOCATARIO_NOVO} />
          ) : (
            semTermo(c) && <SeloSemTermo />
          )}
        </div>
        {podeTermo && (
          <div className="mt-1 flex flex-wrap gap-2">
            <EmitirTermo
              caixaId={c.id}
              inicial={inicialTermo}
              arp={{
                razaoSocial: p.termo_razao_social,
                cnpj: p.termo_cnpj,
                endereco: p.termo_endereco,
                cidade: p.termo_cidade,
              }}
              ligacoes={p.energia_ligacoes}
              qualificacoes={{
                termo_qualificacao_cpf: p.termo_qualificacao_cpf,
                termo_qualificacao_cnpj: p.termo_qualificacao_cnpj,
              }}
              abertoAoCarregar={termoAberto}
              origem={
                enet ? "o contrato vigente no ENET" : "o ocupante da ficha"
              }
            />
          </div>
        )}
      </header>

      {avisos.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Avisos da caixa">
          {avisos.map((a) => (
            <li
              key={a.texto}
              className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${a.tipo === "erro" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-900"}`}
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {a.texto}
            </li>
          ))}
        </ul>
      )}

      <Secao titulo="Locatário">
        <Dados
          itens={[
            ["Ocupante", c.ocupante],
            ["CPF / CNPJ", c.ocupante_documento],
            ["Desde", c.ocupante_desde ? formatarData(c.ocupante_desde) : ""],
            ["Contrato nº", c.contrato],
            ["Origem", c.ocupante_origem ? ORIGEM[c.ocupante_origem] : ""],
          ]}
        />
        <div
          data-guia="op-energia-enet"
          className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
        >
          {enet ? (
            <div className="flex flex-col gap-2">
              <p>
                <span className="text-neutral-500">
                  Contrato vigente no ENET:{" "}
                </span>
                <b>{enet.locatario}</b>
                {enet.documento ? ` · ${enet.documento}` : ""}
                {enet.contrato ? ` · contrato ${enet.contrato}` : ""}
                {enet.inicio ? ` · desde ${formatarData(enet.inicio)}` : ""}
              </p>
              {divergente ? (
                podeEditar ? (
                  <AtualizarDoEnet caixaId={c.id} locatario={enet.locatario} />
                ) : (
                  <p className="text-xs text-neutral-500">
                    A caixa mostra outro locatário. Quem edita os quadros
                    atualiza a partir do ENET.
                  </p>
                )
              ) : (
                <p className="text-xs text-green-800">
                  A caixa mostra o mesmo locatário do ENET.
                </p>
              )}
            </div>
          ) : (
            <p className="text-neutral-500">
              {c.sala_unidade || c.sala
                ? "Sem contrato vigente no ENET para esta sala. Sala sem contrato: a troca é feita à mão."
                : "Caixa sem sala ligada: o ocupante é digitado na ficha."}
            </p>
          )}
        </div>
        {podeEditar && (
          <AcoesDoLocatario
            caixaId={c.id}
            hoje={ctx.hoje}
            temOcupante={!!c.ocupante?.trim()}
          />
        )}
      </Secao>

      <Secao titulo="Dados da caixa">
        {podeEditar ? (
          <FormCaixa
            valores={{
              id: c.id,
              quadro_id: c.quadro_id,
              numero: c.numero,
              numero_antigo: c.numero_antigo ?? "",
              lado: c.lado,
              coluna: c.coluna,
              linha: c.linha,
              rota: c.rota ?? "",
              sala_id: c.sala_id ?? "",
              salas_texto: c.salas_texto ?? "",
              pavimento: c.pavimento ?? "",
              status: c.status,
              disjuntor: chaveDoDisjuntor(c.disjuntor_amperes, c.ligacao),
              medidor_situacao: c.medidor_situacao ?? "",
              medidor_numero: c.medidor_numero ?? "",
              modulo: c.modulo ?? "",
              observacoes: c.observacoes ?? "",
              termo_externo: c.termo_externo,
            }}
            listas={{
              salas: d.salas.map((s) => ({
                valor: s.id,
                rotulo: `${s.codigo}${s.pavimento ? ` · ${s.pavimento}` : ""}`,
              })),
              disjuntores: disjuntores.map((o) => ({
                valor: o.valor,
                rotulo: o.rotulo,
              })),
              medidores: p.energia_medidor_situacoes,
            }}
          />
        ) : (
          <Dados
            itens={[
              ["Numeração antiga", c.numero_antigo],
              ["Rota completa", c.rota],
              ["Pavimento", c.pavimento],
              [
                "Disjuntor",
                textoDoDisjuntor(c.disjuntor_amperes, c.ligacao) ||
                  c.disjuntor_texto,
              ],
              [
                "Medidor / visor",
                [c.medidor_situacao, c.medidor_numero]
                  .filter(Boolean)
                  .join(" · "),
              ],
              ["Módulo", c.modulo],
              [
                "Posição",
                `Lado ${c.lado}, coluna ${c.coluna}, linha ${c.linha}`,
              ],
              ["Termo da carga", c.termo_externo ? "Sim" : "Não"],
              ["Observações de campo", c.observacoes],
            ]}
          />
        )}
        {c.disjuntor_texto &&
          c.disjuntor_texto !==
            textoDoDisjuntor(c.disjuntor_amperes, c.ligacao) && (
            <p className="text-xs text-neutral-500">
              Disjuntor como veio do catálogo: “{c.disjuntor_texto}”.
            </p>
          )}
      </Secao>

      <Secao titulo="Termos emitidos" extra="Reemitir cria uma nova versão">
        {d.termos.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {c.termo_externo
              ? "Termo emitido antes do sistema (carga inicial), sem arquivo aqui."
              : "Nenhum termo emitido para esta caixa."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-900/[0.06] text-sm">
            {d.termos.map((t) => {
              const nome = nomeDoArquivoDoTermo(p.termo_nome_arquivo, t);
              const href = `/operacoes/energia/termo/${t.id}`;
              return (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-medium text-neutral-900">
                      {nome}
                    </span>
                    <span className="text-xs text-neutral-500">
                      Versão {t.versao} · emitido em{" "}
                      {formatarData(t.data_emissao)} · registrado{" "}
                      {formatarDataHora(t.emitido_em)} por {t.emitidoPor}
                    </span>
                  </span>
                  {podeTermo ? (
                    <span className="flex gap-1.5">
                      <a
                        href={`${href}?formato=pdf`}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-xs font-medium hover:border-neutral-400"
                      >
                        <Download className="size-3.5" aria-hidden />
                        PDF
                        <span className="sr-only"> da versão {t.versao}</span>
                      </a>
                      {t.temWord && (
                        <a
                          href={`${href}?formato=docx`}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-xs font-medium hover:border-neutral-400"
                        >
                          <Download className="size-3.5" aria-hidden />
                          Word
                          <span className="sr-only"> da versão {t.versao}</span>
                        </a>
                      )}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {!podeTermo && d.termos.length > 0 && (
          <p className="text-xs text-neutral-500">
            Baixar e reimprimir o termo precisa da permissão do termo de
            energia.
          </p>
        )}
      </Secao>

      <Secao
        titulo="Histórico de ocupantes"
        extra="Sigiloso · não sai no termo"
      >
        {d.historico === null ? (
          <p className="flex items-center gap-2 text-sm text-neutral-500">
            <Lock className="size-4" aria-hidden />
            Só quem tem a permissão do histórico de ocupantes vê esta parte.
          </p>
        ) : d.historico.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nenhum ocupante anterior registrado.
          </p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="px-2 py-1.5 font-medium">Ocupante</th>
                  <th className="px-2 py-1.5 font-medium">Documento</th>
                  <th className="px-2 py-1.5 font-medium">Entrada</th>
                  <th className="px-2 py-1.5 font-medium">Saída</th>
                  <th className="px-2 py-1.5 font-medium">Origem</th>
                </tr>
              </thead>
              <tbody>
                {d.historico.map((h) => (
                  <tr key={h.id} className="border-t border-neutral-900/[0.06]">
                    <td className="px-2 py-1.5">{h.nome}</td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {h.documento ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {formatarData(h.entrada)}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {formatarData(h.saida)}
                    </td>
                    <td className="px-2 py-1.5">
                      {ORIGEM[h.origem] ?? h.origem}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
    </article>
  );
}
