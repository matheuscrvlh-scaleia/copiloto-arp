"use client";

import { useActionState, useState } from "react";
import { SeloStatus } from "@/components/dashboard/indicador";
import type { EstadoAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import { formatarMes, formatarNumero } from "@/lib/formato";
import { ROTULO_CONTRATO, ROTULO_SITUACAO } from "@/lib/rh/rubricas";
import type { EstadoLeitura } from "@/server/rh/acoes/importacoes";

type Ler = (anterior: EstadoLeitura, form: FormData) => Promise<EstadoLeitura>;
type Confirmar = (anterior: EstadoAcao, form: FormData) => Promise<EstadoAcao>;

const botao =
  "rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60";

function Chips({
  contagem,
  rotulos,
}: {
  contagem: Record<string, number>;
  rotulos: Record<string, string>;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {Object.entries(contagem).map(([k, n]) => (
        <li
          key={k}
          className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700"
        >
          {rotulos[k] ?? k} · <span className="font-medium">{n}</span>
        </li>
      ))}
    </ul>
  );
}

/** Enviar o Extrato Mensal → conferir a prévia → confirmar. */
export function ImportarFolha({
  ler,
  confirmar,
}: {
  ler: Ler;
  confirmar: Confirmar;
}) {
  // Trocar a chave reinicia tudo para importar outro arquivo.
  const [rodada, setRodada] = useState(0);
  return (
    <Rodada
      key={rodada}
      ler={ler}
      confirmar={confirmar}
      reiniciar={() => setRodada((r) => r + 1)}
    />
  );
}

function Rodada({
  ler,
  confirmar,
  reiniciar,
}: {
  ler: Ler;
  confirmar: Confirmar;
  reiniciar: () => void;
}) {
  const [leitura, enviar, lendo] = useActionState(ler, {});
  const [gravacao, gravar, gravando] = useActionState(confirmar, {});
  const p = leitura.previa;

  if (gravacao.ok) {
    return (
      <div className="flex flex-col items-start gap-4">
        <output className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-800">
          {gravacao.ok}
        </output>
        <button type="button" onClick={reiniciar} className={botao}>
          Importar outro arquivo
        </button>
      </div>
    );
  }

  if (!p) {
    return (
      <form action={enviar} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">
            Extrato Mensal da Sousa e Couto (PDF)
          </span>
          <input
            type="file"
            name="arquivo"
            accept="application/pdf,.pdf"
            required
            className="text-sm file:mr-4 file:rounded-full file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-neutral-200"
          />
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={lendo} className={botao}>
            {lendo ? "Lendo o arquivo…" : "Ler arquivo"}
          </button>
          {leitura.erro && (
            <span role="alert" className="text-sm text-red-700">
              {leitura.erro}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          Nada é gravado nesta etapa: primeiro você confere a prévia.
        </p>
      </form>
    );
  }

  const bloqueada = p.folhaExistente?.status === "fechada";
  const tudoCoerente = p.conferencia.incoerentes.length === 0;

  return (
    <form action={gravar} className="flex flex-col gap-6">
      <input type="hidden" name="importacao_id" value={p.importacaoId} />

      <div>
        <p className="text-lg font-semibold">
          Folha de {formatarMes(p.competencia)} · {p.pessoas} pessoas
        </p>
        <p className="text-xs text-neutral-500">
          {p.arquivo} · {p.empresa}
        </p>
      </div>

      {p.ficticia && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Protótipo: o salário de cada pessoa será gravado como R$ 2.000,00, e
          tudo o que deriva dele (rubricas, bases e FGTS) na mesma proporção.
          Nenhum valor real é gravado nem exibido.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Conferência</h3>
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex flex-wrap items-center gap-3">
            <SeloStatus
              status={tudoCoerente ? "ok" : "fora"}
              rotulo={tudoCoerente ? "Bate" : "Não bate"}
            />
            <span>
              {p.conferencia.coerentes} de {p.pessoas} pessoas: rubricas fecham
              com proventos, descontos e líquido
            </span>
          </li>
          {p.conferencia.incoerentes.length > 0 && (
            <li className="text-xs text-red-700">
              Não fecham:{" "}
              {p.conferencia.incoerentes
                .map((i) => `${i.matricula} ${i.nome}`)
                .join(", ")}
            </li>
          )}
          {p.conferencia.itens.map((i) => (
            <li key={i.chave} className="flex flex-wrap items-center gap-3">
              <SeloStatus
                status={i.ok === null ? "sem_meta" : i.ok ? "ok" : "fora"}
                rotulo={
                  i.ok === null ? "A confirmar" : i.ok ? "Bate" : "Não bate"
                }
              />
              <span>
                {i.titulo} × resumo da empresa
                {i.importado !== null && i.resumo !== null && (
                  <span className="text-neutral-500">
                    {" "}
                    (importado {formatarNumero(i.importado, 2)} · resumo{" "}
                    {formatarNumero(i.resumo, 2)})
                  </span>
                )}
              </span>
              {i.nota && (
                <span className="w-full text-xs text-neutral-500">
                  {i.nota}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Quem está na folha</h3>
        <Chips contagem={p.porTipo} rotulos={ROTULO_CONTRATO} />
        <Chips contagem={p.porSituacao} rotulos={ROTULO_SITUACAO} />
      </section>

      {p.foraDoCopiloto.length > 0 && (
        <details className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">
            {p.foraDoCopiloto.length} pessoa(s) fora do Copiloto RH (ficam de
            fora)
          </summary>
          <p className="mt-2 text-neutral-600">
            {p.foraDoCopiloto
              .map((c) => `${c.matricula} ${c.nome}`)
              .join(" · ")}
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Só entra quem está no Copiloto RH, pela matrícula. Para incluir
            alguém, cadastre a pessoa no Copiloto com a mesma matrícula da folha
            e importe de novo.
          </p>
        </details>
      )}

      {p.rubricasNovas.length > 0 && (
        <details className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">
            {p.rubricasNovas.length} rubrica(s) nova(s): entram como “não
            classificada”
          </summary>
          <ul className="mt-2 grid gap-x-6 gap-y-1 text-neutral-600 sm:grid-cols-2">
            {p.rubricasNovas.map((r) => (
              <li key={r.codigo}>
                <span className="tabular-nums text-neutral-900">
                  {r.codigo}
                </span>{" "}
                · {r.descricao}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-neutral-500">
            Depois de importar, classifique cada uma abaixo para entrar certo no
            custo.
          </p>
        </details>
      )}

      {p.departamentosSemCodigo.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Departamentos da folha</h3>
          <p className="text-xs text-neutral-500">
            Estes códigos ainda não estão ligados a um departamento. Escolha o
            correspondente (fica salvo para os próximos meses) ou deixe criar um
            novo para renomear em Parâmetros.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {p.departamentosSemCodigo.map((d) => (
              <label
                key={d.codigo}
                className="flex flex-col gap-1 text-xs font-medium text-neutral-600"
              >
                Código {d.codigo} · {d.pessoas} pessoa(s)
                <Selecao
                  name={`dep_${d.codigo}`}
                  opcoes={[
                    {
                      valor: "",
                      rotulo: `Criar “Departamento ${d.codigo}”`,
                      descricao: "Dá para renomear depois em Parâmetros",
                    },
                    ...p.departamentosLivres.map((l) => ({
                      valor: l.id,
                      rotulo: l.nome,
                    })),
                  ]}
                />
              </label>
            ))}
          </div>
        </section>
      )}

      {p.folhaExistente && (
        <section className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm">
          {bloqueada ? (
            <p className="text-red-700">
              A folha de {formatarMes(p.competencia)} está fechada e não pode
              ser substituída.
            </p>
          ) : (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="substituir"
                required
                className="size-4 accent-neutral-900"
              />
              Já existe uma folha de {formatarMes(p.competencia)}. Substituir
              pela deste arquivo.
            </label>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={gravando || bloqueada}
          className={botao}
        >
          {gravando ? "Gravando…" : "Confirmar importação"}
        </button>
        <button
          type="button"
          onClick={reiniciar}
          className="rounded-full px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
        >
          Cancelar
        </button>
        {gravacao.erro && (
          <span role="alert" className="text-sm text-red-700">
            {gravacao.erro}
          </span>
        )}
      </div>
    </form>
  );
}
