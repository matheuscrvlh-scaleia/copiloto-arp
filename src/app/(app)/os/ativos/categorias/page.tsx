import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { Janela } from "@/components/os/ativos/janela";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { formatarNumero } from "@/lib/formato";
import { ROTAS_OS } from "@/lib/os/rotas";
import { excluirCategoria, salvarCategoria } from "@/server/os/acoes/ativos";
import {
  ativosPorCategoria,
  type CategoriaAtivo,
  categoriasDeAtivo,
} from "@/server/os/ativos";
import { contexto } from "@/server/os/base";

export const metadata: Metadata = { title: "Categorias de ativo" };

export default function Page() {
  return (
    <>
      <Link
        href={ROTAS_OS.ativos}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Ativos
      </Link>
      <PageHeader
        title="Categorias de ativo"
        description="Ar-condicionado, bomba, portão, elevador… A vida útil padrão é sugerida ao cadastrar um ativo da categoria."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-96" />
          </TelaCarregando>
        }
      >
        <Conteudo />
      </Suspense>
    </>
  );
}

const anos = (v: number | null) =>
  v === null ? "" : formatarNumero(Number(v), 1).replace(",0", "");

function Campos({ c }: { c?: CategoriaAtivo }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
        Nome
        <input
          name="nome"
          required
          minLength={2}
          maxLength={80}
          defaultValue={c?.nome ?? ""}
          className={classeCampo}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
        Vida útil padrão (anos)
        <input
          name="vida_util_padrao_anos"
          inputMode="decimal"
          defaultValue={anos(c?.vida_util_padrao_anos ?? null)}
          className={classeCampo}
        />
      </label>
    </>
  );
}

async function Conteudo() {
  const ctx = await contexto();
  if (!ctx.pode("os.ativos_gerenciar")) return <SemAcesso />;
  const [cats, contagem] = await Promise.all([
    categoriasDeAtivo(),
    ativosPorCategoria(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Secao
        titulo={`${cats.length} categorias`}
        descricao="Mudar a vida útil padrão não muda os ativos já cadastrados."
      >
        <ul className="flex flex-col gap-1">
          {cats.map((c) => {
            const n = contagem.get(c.id) ?? 0;
            return (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{c.nome}</span>
                  <span className="block text-xs text-neutral-500">
                    {c.vida_util_padrao_anos
                      ? `Vida útil padrão: ${anos(c.vida_util_padrao_anos)} anos`
                      : "Sem vida útil padrão"}{" "}
                    · {n} {n === 1 ? "ativo" : "ativos"}
                  </span>
                </span>
                <Janela
                  acao={salvarCategoria}
                  variante="icone"
                  rotulo={`Editar ${c.nome}`}
                  icone={<Pencil className="size-4" aria-hidden />}
                  titulo="Editar categoria"
                >
                  <Campos c={c} />
                </Janela>
                <AcaoRapida
                  acao={excluirCategoria}
                  campos={{ id: c.id }}
                  rotulo={`Excluir ${c.nome}`}
                  icone={<Trash2 className="size-4" aria-hidden />}
                  confirmar={
                    n
                      ? `Excluir "${c.nome}"? ${n} ${n === 1 ? "ativo fica" : "ativos ficam"} sem categoria.`
                      : `Excluir "${c.nome}"?`
                  }
                  perigo
                />
              </li>
            );
          })}
        </ul>
        <div className="mt-3">
          <Janela
            acao={salvarCategoria}
            rotulo="Nova categoria"
            icone={<Plus className="size-4" aria-hidden />}
            titulo="Nova categoria de ativo"
            enviar="Criar"
          >
            <Campos />
          </Janela>
        </div>
      </Secao>
      <Nota>
        As vidas úteis de partida são uma sugestão a validar com Operações.
      </Nota>
    </div>
  );
}
