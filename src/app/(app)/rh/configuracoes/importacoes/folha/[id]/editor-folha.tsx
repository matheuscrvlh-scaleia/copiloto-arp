"use client";

import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { type Opcao, Selecao } from "@/components/selecao";
import { formatarMoeda, formatarNumero } from "@/lib/formato";
import { NATUREZAS } from "@/lib/rh/folha/edicao";
import { ROTULO_CONTRATO, ROTULO_SITUACAO } from "@/lib/rh/rubricas";
import { salvarPessoaFolha } from "@/server/rh/acoes/folha";
import type { PessoaParaEditar } from "@/server/rh/folha";

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const colunas =
  "grid grid-cols-[minmax(0,1fr)_8rem_6rem_8rem] items-center gap-2";
const NOVAS_LINHAS = ["nova-1", "nova-2"];
/** No protótipo, o salário fica em R$ 2.000,00 (o banco também recusa). */
const GRUPOS_DO_SALARIO = new Set(["salario", "pro_labore"]);

const opcoesDe = (r: Record<string, string>): Opcao[] =>
  Object.entries(r).map(([valor, rotulo]) => ({ valor, rotulo }));
const valorBr = (v: number | null) => (v === null ? "" : formatarNumero(v, 2));
const horasBr = (min: number | null) =>
  min === null ? "" : formatarNumero(min / 60, min % 60 ? 2 : 0);

interface Opcoes {
  departamentos: Opcao[];
  cargos: Opcao[];
  rubricas: Opcao[];
}

/** Pessoas da folha; o formulário de cada uma só monta quando ela é aberta. */
export function EditorDaFolha({
  folhaId,
  editavel,
  ficticia,
  pessoas,
  departamentos,
  cargos,
  rubricas,
}: {
  folhaId: string;
  editavel: boolean;
  ficticia: boolean;
  pessoas: PessoaParaEditar[];
  departamentos: { id: string; nome: string }[];
  cargos: { id: string; nome: string }[];
  rubricas: { codigo: number; descricao: string }[];
}) {
  const [busca, setBusca] = useState("");
  const opcoes: Opcoes = {
    departamentos: departamentos.map((d) => ({ valor: d.id, rotulo: d.nome })),
    cargos: cargos.map((c) => ({ valor: c.id, rotulo: c.nome })),
    rubricas: rubricas.map((r) => ({
      valor: String(r.codigo),
      rotulo: `${r.codigo} · ${r.descricao}`,
    })),
  };
  const nomeDept = new Map(departamentos.map((d) => [d.id, d.nome]));
  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? pessoas.filter(
        (p) =>
          p.nome.toLowerCase().includes(termo) ||
          String(p.matricula ?? "").includes(termo),
      )
    : pessoas;

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou matrícula"
        aria-label="Buscar pessoa na folha"
        className={`${classeCampo} sm:max-w-sm`}
      />
      {visiveis.length === 0 && (
        <p className="text-sm text-neutral-500">Ninguém encontrado.</p>
      )}
      {visiveis.map((p) => (
        <Pessoa
          key={p.colaborador_id}
          pessoa={p}
          departamento={
            p.departamento_id ? nomeDept.get(p.departamento_id) : undefined
          }
          folhaId={folhaId}
          editavel={editavel}
          ficticia={ficticia}
          opcoes={opcoes}
        />
      ))}
    </div>
  );
}

function Pessoa({
  pessoa: p,
  departamento,
  ...resto
}: {
  pessoa: PessoaParaEditar;
  departamento: string | undefined;
  folhaId: string;
  editavel: boolean;
  ficticia: boolean;
  opcoes: Opcoes;
}) {
  const [aberta, setAberta] = useState(false);
  return (
    <details
      className="rounded-2xl bg-white/50 px-4 py-3 ring-1 ring-neutral-900/[0.06]"
      onToggle={(e) => setAberta(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-semibold">{p.nome}</span>
        <span className="text-xs text-neutral-500">
          {[
            p.matricula ? `matrícula ${p.matricula}` : null,
            ROTULO_CONTRATO[p.tipo_contrato] ?? p.tipo_contrato,
            departamento ?? "sem departamento",
            ROTULO_SITUACAO[p.situacao] ?? p.situacao,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="ml-auto text-xs tabular-nums text-neutral-500">
          {p.rubricas.length} rubricas · líquido {formatarMoeda(p.liquido)}
        </span>
      </summary>
      {aberta && <FormPessoa pessoa={p} {...resto} />}
    </details>
  );
}

function FormPessoa({
  pessoa: p,
  folhaId,
  editavel,
  ficticia,
  opcoes,
}: {
  pessoa: PessoaParaEditar;
  folhaId: string;
  editavel: boolean;
  ficticia: boolean;
  opcoes: Opcoes;
}) {
  const so = !editavel;
  const campos = (
    <>
      <input type="hidden" name="folha_id" value={folhaId} />
      <input type="hidden" name="colaborador_id" value={p.colaborador_id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <span className={rotulo}>
          Departamento
          <Selecao
            name="departamento_id"
            rotulo="Departamento"
            placeholder="Sem departamento"
            valorInicial={p.departamento_id ?? ""}
            opcoes={opcoes.departamentos}
            desabilitada={so}
          />
        </span>
        <span className={rotulo}>
          Cargo
          <Selecao
            name="cargo_id"
            rotulo="Cargo"
            placeholder="Sem cargo"
            valorInicial={p.cargo_id ?? ""}
            opcoes={opcoes.cargos}
            desabilitada={so}
          />
        </span>
        <span className={rotulo}>
          Contrato
          <Selecao
            name="tipo_contrato"
            rotulo="Tipo de contrato"
            obrigatorio
            valorInicial={p.tipo_contrato}
            opcoes={opcoesDe(ROTULO_CONTRATO)}
            desabilitada={so}
          />
        </span>
        <label className={rotulo}>
          Horas/mês
          <input
            name="horas_mes"
            inputMode="decimal"
            defaultValue={horasBr(p.horas_mes_min)}
            disabled={so}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Salário (R$)
          <input
            name="salario"
            inputMode="decimal"
            defaultValue={valorBr(p.salario)}
            // readOnly (e não disabled): o valor vai no envio e o banco confere.
            readOnly={ficticia}
            disabled={so}
            title={ficticia ? "Protótipo: salário fixo em R$ 2.000,00" : ""}
            className={classeCampo}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className={`${colunas} text-xs font-medium text-neutral-600`}>
          <span>Rubrica</span>
          <span>Natureza</span>
          <span>Referência</span>
          <span>Valor (R$)</span>
        </div>
        {p.rubricas.map((r, i) => {
          const travada = ficticia && GRUPOS_DO_SALARIO.has(r.grupo);
          return (
            // Mesma rubrica pode vir duas vezes na pessoa (ex.: dois períodos).
            <div key={`${r.codigo}-${i}`} className={colunas}>
              <input type="hidden" name="codigo" value={r.codigo} />
              <span className="truncate text-sm" title={r.descricao}>
                <span className="tabular-nums font-medium">{r.codigo}</span> ·{" "}
                {r.descricao}
              </span>
              <Selecao
                name="natureza"
                rotulo={`Natureza da rubrica ${r.codigo}`}
                valorInicial={r.natureza}
                opcoes={opcoesDe(NATUREZAS)}
                desabilitada={so || travada}
              />
              <input
                name="referencia"
                inputMode="decimal"
                aria-label={`Referência da rubrica ${r.codigo}`}
                defaultValue={
                  r.referencia === null ? "" : formatarNumero(r.referencia, 2)
                }
                readOnly={travada}
                disabled={so}
                className={classeCampo}
              />
              <input
                name="valor"
                inputMode="decimal"
                aria-label={`Valor da rubrica ${r.codigo}`}
                defaultValue={valorBr(r.valor)}
                readOnly={travada}
                disabled={so}
                title={travada ? "Protótipo: salário fixo em R$ 2.000,00" : ""}
                className={classeCampo}
              />
            </div>
          );
        })}
        {editavel &&
          NOVAS_LINHAS.map((chave) => (
            <div key={chave} className={colunas}>
              <Selecao
                name="codigo"
                rotulo="Rubrica a incluir"
                placeholder="Incluir rubrica…"
                opcoes={opcoes.rubricas}
                busca
              />
              <Selecao
                name="natureza"
                rotulo="Natureza da rubrica a incluir"
                placeholder="Natureza"
                opcoes={opcoesDe(NATUREZAS)}
              />
              <input
                name="referencia"
                inputMode="decimal"
                aria-label="Referência da rubrica a incluir"
                className={classeCampo}
              />
              <input
                name="valor"
                inputMode="decimal"
                aria-label="Valor da rubrica a incluir"
                className={classeCampo}
              />
            </div>
          ))}
      </div>
      {editavel && (
        <p className="text-xs text-neutral-500">
          Para tirar uma rubrica, apague o valor; as linhas em branco no fim
          servem para incluir. O líquido é refeito pelas rubricas.
          {ficticia
            ? " Protótipo: o salário e as rubricas de salário ficam em R$ 2.000,00."
            : ""}
        </p>
      )}
    </>
  );

  return editavel ? (
    <FormAcao
      acao={salvarPessoaFolha}
      rotulo={`Salvar ${p.nome.split(" ")[0]}`}
      className="mt-4 flex flex-col gap-4"
    >
      {campos}
    </FormAcao>
  ) : (
    <div className="mt-4 flex flex-col gap-4">{campos}</div>
  );
}
