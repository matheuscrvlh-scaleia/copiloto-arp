import { Building2, Mail, Plus, Search, Trash2, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { Situacao } from "@/components/admin/ui";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { TelefoneComWhatsApp } from "@/components/os/configuracoes/whatsapp";
import { SeloExemplo } from "@/components/os/selos";
import { SemAcesso } from "@/components/protegido";
import { contexto, type Tabela } from "@/server/os/base";
import { contatos, type Empresa, empresas } from "@/server/os/configuracoes";
import {
  removerContato,
  salvarContato,
  salvarEmpresa,
  salvarProfissional,
} from "./actions";

export const metadata: Metadata = { title: "Terceirizados e contatos" };

// Empresas terceirizadas, os profissionais de cada uma e os contatos salvos
// para o WhatsApp. Cada telefone tem o botão que abre a conversa.

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: PageProps<"/os/configuracoes/terceirizados">) {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Terceirizados busca={searchParams} />
    </Suspense>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-96" />
      <CartaoCarregando altura="h-72" />
    </TelaCarregando>
  );
}

async function Terceirizados({ busca }: { busca: Promise<Busca> }) {
  const ctx = await contexto();
  const verEmpresas = ctx.pode("os.terceirizados");
  const verContatos = verEmpresas || ctx.pode("os.parametros");
  if (!verContatos) return <SemAcesso />;
  const b = await busca;
  const termo = typeof b.q === "string" ? b.q.trim() : "";
  const [listaEmpresas, listaContatos] = await Promise.all([
    verEmpresas ? empresas() : Promise.resolve([]),
    contatos(),
  ]);
  const filtrados = termo
    ? listaContatos.filter((c) =>
        sem(
          `${c.nome} ${c.empresa ?? ""} ${c.telefone} ${c.observacao ?? ""}`,
        ).includes(sem(termo)),
      )
    : listaContatos;

  return (
    <div className="flex flex-col gap-6">
      {verEmpresas && (
        <Secao
          id="empresas"
          titulo="Empresas terceirizadas"
          descricao="Quem recebe a OS terceirizada pelo link. O prazo de retorno é o padrão da empresa; a categoria e os parâmetros também podem definir um."
        >
          <div className="flex flex-col gap-4">
            <Novo titulo="Nova empresa">
              <FormEmpresa />
            </Novo>
            {listaEmpresas.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Nenhuma empresa cadastrada.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {listaEmpresas.map((e) => (
                  <li key={e.id}>
                    <CartaoEmpresa e={e} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Secao>
      )}

      <Secao
        id="contatos"
        titulo="Contatos salvos"
        descricao="Colaboradores, lojistas e fornecedores para mandar mensagem pelo WhatsApp sem procurar o número."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <form className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-neutral-900/10 bg-white/70 py-1.5 pr-4 pl-1.5 text-sm">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
                <Search className="size-3.5" aria-hidden />
              </span>
              <label className="sr-only" htmlFor="busca-contato">
                Buscar contato
              </label>
              <input
                id="busca-contato"
                type="search"
                name="q"
                defaultValue={termo}
                placeholder="Buscar por nome, empresa ou telefone"
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
              />
            </form>
            <span className="text-xs text-neutral-500">
              {filtrados.length} de {listaContatos.length}
            </span>
          </div>
          <Novo titulo="Novo contato">
            <FormContato />
          </Novo>
          {filtrados.length === 0 ? (
            <p className="text-sm text-neutral-500">
              {termo ? "Nenhum contato encontrado." : "Nenhum contato salvo."}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
              {filtrados.map((c) => (
                <li key={c.id}>
                  <LinhaContato c={c} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Secao>
    </div>
  );
}

function Novo({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-dashed border-neutral-300 px-4 py-3 open:border-solid open:bg-white/50">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <Plus className="size-4 transition group-open:rotate-45" aria-hidden />
        {titulo}
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function FormEmpresa({ e }: { e?: Empresa }) {
  return (
    <FormAcao
      acao={salvarEmpresa}
      rotulo={e ? "Salvar empresa" : "Cadastrar empresa"}
      className="flex flex-col gap-4"
    >
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={rotulo}>
          Nome
          <input
            name="nome"
            required
            maxLength={120}
            defaultValue={e?.nome}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          CNPJ
          <input
            name="cnpj"
            inputMode="numeric"
            defaultValue={e?.cnpj ?? ""}
            placeholder="00.000.000/0000-00"
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Contato
          <input
            name="contato"
            maxLength={120}
            defaultValue={e?.contato ?? ""}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Telefone
          <input
            name="telefone"
            type="tel"
            defaultValue={e?.telefone ?? ""}
            placeholder="(22) 99999-0000"
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          E-mail
          <input
            name="email"
            type="email"
            defaultValue={e?.email ?? ""}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Prazo de retorno (dias úteis)
          <input
            name="prazo_retorno_dias"
            type="number"
            min={1}
            max={365}
            defaultValue={e?.prazo_retorno_dias ?? ""}
            placeholder="padrão dos parâmetros"
            className={classeCampo}
          />
        </label>
        <label className={`${rotulo} sm:col-span-2`}>
          Serviços
          <textarea
            name="servicos"
            rows={2}
            maxLength={500}
            defaultValue={e?.servicos ?? ""}
            placeholder="ex.: elétrica, ar-condicionado, telhado"
            className={classeCampo}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="ativo"
          defaultChecked={e?.ativo ?? true}
          className="size-4 accent-neutral-900"
        />
        Ativa (aparece para escolher na OS)
      </label>
    </FormAcao>
  );
}

function CartaoEmpresa({ e }: { e: Empresa }) {
  return (
    <div
      className={`flex h-full flex-col gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/60 p-4 ${e.ativo ? "" : "opacity-70"}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-900/[0.06] text-neutral-700">
          <Building2 className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {e.nome}
            {!e.ativo && <Situacao tipo="neutro">Inativa</Situacao>}
            {e.exemplo && <SeloExemplo />}
          </p>
          <p className="text-xs text-neutral-500">
            {[e.cnpj, e.contato].filter(Boolean).join(" · ") ||
              "Sem CNPJ nem contato"}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
        <dt className="text-xs text-neutral-500 sm:pt-0.5">Telefone</dt>
        <dd>
          <TelefoneComWhatsApp telefone={e.telefone} nome={e.nome} />
        </dd>
        {e.email && (
          <>
            <dt className="text-xs text-neutral-500 sm:pt-0.5">E-mail</dt>
            <dd className="min-w-0 truncate">
              <a
                href={`mailto:${e.email}`}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Mail className="size-3.5 shrink-0" aria-hidden />
                {e.email}
              </a>
            </dd>
          </>
        )}
        <dt className="text-xs text-neutral-500 sm:pt-0.5">Retorno</dt>
        <dd>
          {e.prazo_retorno_dias
            ? `${e.prazo_retorno_dias} ${e.prazo_retorno_dias === 1 ? "dia útil" : "dias úteis"}`
            : "Padrão dos parâmetros"}
        </dd>
        {e.servicos && (
          <>
            <dt className="text-xs text-neutral-500 sm:pt-0.5">Serviços</dt>
            <dd className="text-neutral-700">{e.servicos}</dd>
          </>
        )}
      </dl>

      <div className="border-t border-neutral-200/70 pt-3">
        <p className="mb-1.5 text-xs font-medium text-neutral-600">
          Profissionais ({e.profissionais.length})
        </p>
        {e.profissionais.length === 0 ? (
          <p className="text-xs text-neutral-500">
            Nenhum profissional cadastrado.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {e.profissionais.map((p) => (
              <li key={p.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2 py-1.5 text-sm hover:bg-white/60 [&::-webkit-details-marker]:hidden">
                    <span
                      className={`font-medium ${p.ativo ? "" : "text-neutral-500 line-through"}`}
                    >
                      {p.nome}
                    </span>
                    <TelefoneComWhatsApp telefone={p.telefone} nome={p.nome} />
                    {!p.ativo && (
                      <span className="text-xs text-neutral-500">inativo</span>
                    )}
                    <span className="ml-auto text-xs text-neutral-400 group-open:hidden">
                      editar
                    </span>
                  </summary>
                  <div className="px-2 pt-2 pb-3">
                    <FormProfissional empresaId={e.id} p={p} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <details className="group mt-2">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 [&::-webkit-details-marker]:hidden">
            <UserPlus className="size-3.5" aria-hidden />
            Incluir profissional
          </summary>
          <div className="px-2 pt-2">
            <FormProfissional empresaId={e.id} />
          </div>
        </details>
      </div>

      <details className="group mt-auto border-t border-neutral-200/70 pt-3">
        <summary className="cursor-pointer list-none text-xs font-medium text-neutral-600 hover:text-neutral-900 [&::-webkit-details-marker]:hidden">
          Editar empresa
        </summary>
        <div className="mt-3">
          <FormEmpresa e={e} />
        </div>
      </details>
    </div>
  );
}

function FormProfissional({
  empresaId,
  p,
}: {
  empresaId: string;
  p?: Tabela<"profissionais">;
}) {
  return (
    <FormAcao
      acao={salvarProfissional}
      rotulo={p ? "Salvar" : "Incluir"}
      variante={p ? "primario" : "secundario"}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="empresa_id" value={empresaId} />
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={rotulo}>
          Nome
          <input
            name="nome"
            required
            maxLength={120}
            defaultValue={p?.nome}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Telefone
          <input
            name="telefone"
            type="tel"
            defaultValue={p?.telefone ?? ""}
            className={classeCampo}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="ativo"
          defaultChecked={p?.ativo ?? true}
          className="size-4 accent-neutral-900"
        />
        Ativo
      </label>
    </FormAcao>
  );
}

function FormContato({ c }: { c?: Tabela<"contatos"> }) {
  return (
    <FormAcao
      acao={salvarContato}
      rotulo={c ? "Salvar contato" : "Salvar na lista"}
      className="flex flex-col gap-3"
    >
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={rotulo}>
          Nome
          <input
            name="nome"
            required
            maxLength={120}
            defaultValue={c?.nome}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Telefone
          <input
            name="telefone"
            type="tel"
            required
            defaultValue={c?.telefone}
            placeholder="(22) 99999-0000"
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Empresa ou loja
          <input
            name="empresa"
            maxLength={120}
            defaultValue={c?.empresa ?? ""}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Observação
          <input
            name="observacao"
            maxLength={500}
            defaultValue={c?.observacao ?? ""}
            className={classeCampo}
          />
        </label>
      </div>
    </FormAcao>
  );
}

function LinhaContato({ c }: { c: Tabela<"contatos"> }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-col gap-1 rounded-2xl px-2 py-2.5 text-sm hover:bg-white/50 sm:flex-row sm:items-center sm:gap-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 sm:w-56">
          <span className="flex items-center gap-2 font-medium">
            {c.nome}
            {c.exemplo && <SeloExemplo />}
          </span>
          {c.empresa && (
            <span className="block text-xs text-neutral-500">{c.empresa}</span>
          )}
        </span>
        <TelefoneComWhatsApp telefone={c.telefone} nome={c.nome} />
        {c.observacao && (
          <span className="min-w-0 flex-1 truncate text-xs text-neutral-500">
            {c.observacao}
          </span>
        )}
        <span className="ml-auto text-xs text-neutral-400 group-open:hidden">
          editar
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-2 pt-2 pb-4">
        <FormContato c={c} />
        <div className="self-start">
          <AcaoRapida
            acao={removerContato}
            campos={{ id: c.id }}
            rotulo="Remover contato"
            icone={<Trash2 className="size-4" aria-hidden />}
            confirmar={`Remover ${c.nome} dos contatos salvos?`}
            perigo
            comTexto
          />
        </div>
      </div>
    </details>
  );
}
