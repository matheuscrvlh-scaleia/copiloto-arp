import {
  ArrowDown,
  ArrowUp,
  Crown,
  Plus,
  TriangleAlert,
  UserMinus,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { Avatar, Situacao } from "@/components/admin/ui";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { FormAcao } from "@/components/form-acao";
import { FormSetor } from "@/components/os/configuracoes/form-setor";
import { SeloIcone } from "@/components/os/configuracoes/icones";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Selecao } from "@/components/selecao";
import { CONFIGURACOES_OS } from "@/config/navigation";
import {
  incluirMembro,
  marcarGestor,
  moverSetor,
  removerMembro,
  salvarSetor,
} from "@/server/os/acoes/config-setores";
import {
  categorias,
  type Pessoa,
  pessoas,
  type Setor,
  setores,
} from "@/server/os/base";
import { type Membro, membros } from "@/server/os/configuracoes";

export const metadata: Metadata = { title: "Setores e pessoas" };

// Setores e quem é de cada um. Quem é do setor recebe a fila dele; o gestor
// recebe também o aviso quando um chamado do setor vence. O que cada um
// pode fazer vem das permissões (Administração › Usuários).

export default function Page() {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Protegido permissao="os.catalogo">
        <Setores />
      </Protegido>
    </Suspense>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-14" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <CartaoCarregando key={i} altura="h-72" />
        ))}
      </div>
    </TelaCarregando>
  );
}

async function Setores() {
  const [lista, todasPessoas, todosMembros, todas] = await Promise.all([
    setores(),
    pessoas(),
    membros(),
    categorias(),
  ]);
  const semSetor = todasPessoas.filter(
    (p) => !todosMembros.some((m) => m.usuario_id === p.id),
  );
  const nomePorId = new Map(todasPessoas.map((p) => [p.id, p.nome]));

  return (
    <div className="flex flex-col gap-5">
      {semSetor.length > 0 && (
        <div className="flex items-start gap-3 rounded-3xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong className="font-semibold">
              {semSetor.length === 1
                ? "1 pessoa com acesso ao módulo não está em nenhum setor"
                : `${semSetor.length} pessoas com acesso ao módulo não estão em nenhum setor`}
            </strong>{" "}
            e não recebem a fila de chamados:{" "}
            {semSetor.map((p) => p.nome).join(", ")}. Inclua cada uma no setor
            dela abaixo.
          </p>
        </div>
      )}

      <details className="vidro group rounded-[1.75rem] p-5 md:p-6">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="grid size-7 place-items-center rounded-full bg-neutral-900 text-white">
            <Plus
              className="size-4 transition group-open:rotate-45"
              aria-hidden
            />
          </span>
          Novo setor
        </summary>
        <div className="mt-5">
          <FormSetor acao={salvarSetor} />
        </div>
      </details>

      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {lista.map((s, i) => (
          <li key={s.id}>
            <CartaoSetor
              setor={s}
              indice={i}
              total={lista.length}
              membros={todosMembros.filter((m) => m.setor_id === s.id)}
              pessoas={todasPessoas}
              nomePorId={nomePorId}
              categorias={todas.filter((c) => c.setor_id === s.id).length}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CartaoSetor({
  setor: s,
  indice,
  total,
  membros: doSetor,
  pessoas: todasPessoas,
  nomePorId,
  categorias: qtdCategorias,
}: {
  setor: Setor;
  indice: number;
  total: number;
  membros: Membro[];
  pessoas: Pessoa[];
  nomePorId: Map<string, string>;
  categorias: number;
}) {
  const ordenados = [...doSetor].sort(
    (a, b) =>
      Number(b.gestor) - Number(a.gestor) ||
      (nomePorId.get(a.usuario_id) ?? "").localeCompare(
        nomePorId.get(b.usuario_id) ?? "",
        "pt-BR",
      ),
  );
  const forasDoSetor = todasPessoas.filter(
    (p) => !doSetor.some((m) => m.usuario_id === p.id),
  );

  return (
    <Cartao
      className={`flex h-full flex-col gap-4 p-5 ${s.ativo ? "" : "opacity-70"}`}
    >
      <div className="flex items-start gap-3">
        <SeloIcone nome={s.icone} cor={s.cor} />
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">
            {s.nome}
            {!s.ativo && <Situacao tipo="neutro">Inativo</Situacao>}
          </h2>
          <p className="text-xs text-neutral-500">
            {doSetor.length} {doSetor.length === 1 ? "pessoa" : "pessoas"} ·{" "}
            <Link
              href={`${CONFIGURACOES_OS.catalogo}?setor=${s.id}`}
              className="underline-offset-2 hover:underline"
            >
              {qtdCategorias} {qtdCategorias === 1 ? "categoria" : "categorias"}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          {indice > 0 && (
            <AcaoRapida
              acao={moverSetor}
              campos={{ id: s.id, delta: "-1" }}
              rotulo={`Subir ${s.nome}`}
              icone={<ArrowUp className="size-4" aria-hidden />}
            />
          )}
          {indice < total - 1 && (
            <AcaoRapida
              acao={moverSetor}
              campos={{ id: s.id, delta: "1" }}
              rotulo={`Descer ${s.nome}`}
              icone={<ArrowDown className="size-4" aria-hidden />}
            />
          )}
        </div>
      </div>

      {ordenados.length === 0 ? (
        <p className="rounded-2xl bg-neutral-900/[0.04] px-3 py-2 text-sm text-neutral-500">
          Ninguém no setor ainda: a fila dele não chega a ninguém.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
          {ordenados.map((m) => {
            const nome =
              nomePorId.get(m.usuario_id) ?? "Pessoa sem acesso ao módulo";
            return (
              <li key={m.usuario_id} className="flex items-center gap-3 py-2">
                <Avatar nome={nome} apagado={!nomePorId.has(m.usuario_id)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{nome}</p>
                  {m.gestor && (
                    <p className="flex items-center gap-1 text-xs text-amber-900">
                      <Crown className="size-3" aria-hidden />
                      Gestor: recebe os vencidos
                    </p>
                  )}
                </div>
                <AcaoRapida
                  acao={marcarGestor}
                  campos={{
                    setor_id: s.id,
                    usuario_id: m.usuario_id,
                    gestor: String(!m.gestor),
                  }}
                  rotulo={
                    m.gestor
                      ? `Tirar ${nome} de gestor`
                      : `Marcar ${nome} como gestor`
                  }
                  icone={
                    <Crown
                      className={`size-4 ${m.gestor ? "fill-current text-amber-700" : ""}`}
                      aria-hidden
                    />
                  }
                />
                <AcaoRapida
                  acao={removerMembro}
                  campos={{ setor_id: s.id, usuario_id: m.usuario_id }}
                  rotulo={`Tirar ${nome} do setor`}
                  icone={<UserMinus className="size-4" aria-hidden />}
                  confirmar={`Tirar ${nome} de ${s.nome}? Deixa de receber a fila do setor. Os chamados em que é responsável continuam com ${nome}.`}
                  perigo
                />
              </li>
            );
          })}
        </ul>
      )}

      {forasDoSetor.length > 0 && (
        <FormAcao
          acao={incluirMembro}
          rotulo="Incluir"
          rotuloEnviando="Incluindo…"
          variante="secundario"
          className="mt-auto flex flex-col gap-2 border-t border-neutral-200/70 pt-4 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <input type="hidden" name="setor_id" value={s.id} />
          <div className="min-w-0 flex-1 sm:min-w-[12rem]">
            <Selecao
              name="usuario_id"
              rotulo={`Pessoa para incluir em ${s.nome}`}
              obrigatorio
              placeholder="Incluir pessoa…"
              opcoes={forasDoSetor.map((p) => ({
                valor: p.id,
                rotulo: p.nome,
                descricao: p.setores.length ? undefined : "Sem setor",
              }))}
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-neutral-600">
            <input
              type="checkbox"
              name="gestor"
              className="size-4 accent-neutral-900"
            />
            Gestor
          </label>
        </FormAcao>
      )}

      <details className="group border-t border-neutral-200/70 pt-3">
        <summary className="cursor-pointer list-none text-xs font-medium text-neutral-600 hover:text-neutral-900 [&::-webkit-details-marker]:hidden">
          Editar nome, cor, ícone e situação
        </summary>
        <div className="mt-4">
          <FormSetor acao={salvarSetor} setor={s} />
        </div>
      </details>
    </Cartao>
  );
}
