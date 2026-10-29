"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { classeCampo } from "@/components/estilos";
import type { EstadoAcao } from "@/components/form-acao";
import { useNotificarEstado } from "@/components/notificacoes";
import { Selecao } from "@/components/selecao";
import {
  type CargaLida,
  chaveDoNome,
  corrigirLinhaDaCarga,
  FORMAS_ACESSO,
  type FormaAcesso,
  type LinhaDaCarga,
  planoDaCarga,
} from "@/lib/marketing/parametros";

// Carga inicial da planilha de locatários (spec 4.12): lê o arquivo como ele
// está, mostra a prévia com as linhas com problema (dá para corrigir aqui
// mesmo, sem voltar à planilha) e só grava quando a pessoa confirma.

type Previa = CargaLida & { arquivo: string };
type Ler = (
  anterior: EstadoAcao & { previa?: Previa },
  form: FormData,
) => Promise<EstadoAcao & { previa?: Previa }>;
type Confirmar = (anterior: EstadoAcao, form: FormData) => Promise<EstadoAcao>;

const botao =
  "rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50";
const secundario =
  "rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400";
const formas = Object.entries(FORMAS_ACESSO).map(([valor, rotulo]) => ({
  valor,
  rotulo,
}));

export function CargaLocatarios({
  ler,
  confirmar,
  existentes,
}: {
  ler: Ler;
  confirmar: Confirmar;
  existentes: { id: string; nome: string; ativo: boolean }[];
}) {
  const [rodada, setRodada] = useState(0);
  return (
    <Rodada
      key={rodada}
      ler={ler}
      confirmar={confirmar}
      existentes={existentes}
      reiniciar={() => setRodada((r) => r + 1)}
    />
  );
}

function Rodada({
  ler,
  confirmar,
  existentes,
  reiniciar,
}: {
  ler: Ler;
  confirmar: Confirmar;
  existentes: { id: string; nome: string; ativo: boolean }[];
  reiniciar: () => void;
}) {
  const [leitura, enviar, lendo] = useActionState(ler, {});
  const [gravacao, gravar, gravando] = useActionState(confirmar, {});
  useNotificarEstado(leitura, { ok: false });
  useNotificarEstado(gravacao);
  useEffect(() => {
    if (gravacao.ok) reiniciar();
  }, [gravacao, reiniciar]);

  if (!leitura.previa)
    return (
      <form action={enviar} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">
            Planilha de locatários (.xlsx ou .csv)
          </span>
          <input
            type="file"
            name="arquivo"
            required
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="text-sm file:mr-4 file:rounded-full file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-neutral-200"
          />
        </label>
        <div>
          <button type="submit" disabled={lendo} className={botao}>
            {lendo ? "Lendo a planilha…" : "Ler planilha"}
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Pode mandar como ela está: o cabeçalho pode ser Nome, Locatário ou
          Loja; Categoria ou Segmento; Link, Perfil ou Google; e, se tiver,
          Forma de acesso e Data de entrada. Linhas vazias são ignoradas. Nada é
          gravado antes de você confirmar a prévia.
        </p>
      </form>
    );

  return (
    <Previa
      previa={leitura.previa}
      existentes={existentes}
      gravar={gravar}
      gravando={gravando}
      cancelar={reiniciar}
    />
  );
}

function Previa({
  previa,
  existentes,
  gravar,
  gravando,
  cancelar,
}: {
  previa: Previa;
  existentes: { id: string; nome: string; ativo: boolean }[];
  gravar: (form: FormData) => void;
  gravando: boolean;
  cancelar: () => void;
}) {
  const [linhas, setLinhas] = useState<LinhaDaCarga[]>(previa.linhas);
  const [tirar, setTirar] = useState(false);
  // Correção na prévia: a linha é conferida de novo na hora.
  const mudar = (
    i: number,
    mudanca: Parameters<typeof corrigirLinhaDaCarga>[2],
  ) => setLinhas((ls) => corrigirLinhaDaCarga(ls, i, mudanca));
  const plano = useMemo(
    () => planoDaCarga(linhas, existentes, tirar),
    [linhas, existentes, tirar],
  );
  const jaCadastrados = new Set(
    plano.atualizar.map((a) => chaveDoNome(a.nome)),
  );
  const total =
    plano.incluir.length + plano.atualizar.length + plano.tirar.length;
  const comProblema = linhas.filter((l) => l.problemas.length).length;

  return (
    <form action={gravar} className="flex flex-col gap-4">
      <input
        type="hidden"
        name="linhas"
        value={JSON.stringify(
          linhas.map(({ problemas: _p, avisos: _a, ...l }) => l),
        )}
      />
      <div>
        <p className="text-sm font-semibold">{previa.arquivo}</p>
        <p className="text-xs text-neutral-500">
          Colunas usadas:{" "}
          {Object.entries(previa.colunas)
            .filter(([, v]) => v)
            .map(([, v]) => `“${v}”`)
            .join(", ")}
          .
        </p>
      </div>
      {previa.faltando.length > 0 && (
        <p
          role="alert"
          className="rounded-xl bg-amber-400/15 px-3 py-2 text-sm text-amber-800"
        >
          Coluna faltando na planilha: {previa.faltando.join(", ")}. Preencha
          nas linhas abaixo ou carregue sem elas (linha sem categoria fica de
          fora; sem link, entra com “sem dados”).
        </p>
      )}
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-2 py-2 font-medium">Linha</th>
              <th className="px-2 py-2 font-medium">Nome</th>
              <th className="px-2 py-2 font-medium">Categoria</th>
              <th className="px-2 py-2 font-medium">Link do perfil</th>
              <th className="px-2 py-2 font-medium">Forma de acesso</th>
              <th className="px-2 py-2 font-medium">Conferência</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr
                key={l.linha}
                className={`border-b border-neutral-900/[0.06] align-top ${l.problemas.length ? "bg-red-400/10" : ""}`}
              >
                <td className="px-2 py-2 tabular-nums text-neutral-500">
                  {l.linha}
                </td>
                <td className="px-2 py-2">
                  <input
                    aria-label={`Nome da linha ${l.linha}`}
                    value={l.nome}
                    onChange={(e) => mudar(i, { nome: e.target.value })}
                    className={`${classeCampo} min-w-44`}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    aria-label={`Categoria da linha ${l.linha}`}
                    value={l.categoria}
                    onChange={(e) => mudar(i, { categoria: e.target.value })}
                    className={`${classeCampo} min-w-36`}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    aria-label={`Link da linha ${l.linha}`}
                    value={l.perfil_url ?? ""}
                    onChange={(e) =>
                      mudar(i, { perfil_url: e.target.value || null })
                    }
                    className={`${classeCampo} min-w-56`}
                  />
                </td>
                <td className="px-2 py-2">
                  <Selecao
                    rotulo={`Forma de acesso da linha ${l.linha}`}
                    valor={l.forma_acesso}
                    aoMudar={(v) =>
                      mudar(i, { forma_acesso: v as FormaAcesso })
                    }
                    opcoes={formas}
                    className="min-w-56"
                  />
                </td>
                <td className="max-w-72 px-2 py-2 text-xs">
                  {l.problemas.map((p) => (
                    <p key={p} className="font-medium text-red-700">
                      {p} (fica de fora)
                    </p>
                  ))}
                  {!l.problemas.length &&
                    jaCadastrados.has(chaveDoNome(l.nome)) && (
                      <p className="text-neutral-600">
                        Já cadastrado: atualiza
                      </p>
                    )}
                  {l.avisos.map((a) => (
                    <p key={a} className="text-amber-700">
                      {a}
                    </p>
                  ))}
                  {!l.problemas.length && !l.avisos.length && (
                    <p className="text-green-700">Ok</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="tirar_ausentes"
          checked={tirar}
          onChange={(e) => setTirar(e.target.checked)}
          className="mt-0.5 size-4 accent-neutral-900"
        />
        <span>
          Tirar da lista os locatários ativos que não estão na planilha
          <span className="block text-xs text-neutral-500">
            Ficam inativos, com saída hoje (nada é apagado).
            {tirar &&
              plano.tirar.length > 0 &&
              ` Saem: ${plano.tirar.map((t) => t.nome).join(", ")}.`}
          </span>
        </span>
      </label>
      <p className="text-sm text-neutral-700">
        {plano.incluir.length} para incluir, {plano.atualizar.length} para
        atualizar
        {tirar ? `, ${plano.tirar.length} para tirar da lista` : ""}
        {comProblema ? ` · ${comProblema} com problema ficam de fora` : ""}.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={gravando || total === 0}
          className={botao}
        >
          {gravando ? "Carregando…" : "Confirmar e carregar"}
        </button>
        <button type="button" onClick={cancelar} className={secundario}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
