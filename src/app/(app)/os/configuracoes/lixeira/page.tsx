import { History, Trash2, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { hrefDaPagina, Paginacao } from "@/components/os/paginacao";
import {
  SeloExemplo,
  SeloSetor,
  SeloStatusChamado,
  SeloTipo,
} from "@/components/os/selos";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { CONFIGURACOES_OS } from "@/config/navigation";
import { formatarDataHora } from "@/lib/formato";
import { formatarNumeroChamado } from "@/lib/os/numeros";
import { paginaDaUrl, totalDePaginas } from "@/lib/os/paginacao";
import { rotaChamado } from "@/lib/os/rotas";
import { nomes, setores } from "@/server/os/base";
import { restaurarChamado } from "./actions";
import { paginaDaLixeira } from "./consulta";

export const metadata: Metadata = { title: "Lixeira de chamados" };

// Chamados mandados para a lixeira, com quem mandou e quando. Nada é apagado
// de verdade: restaurar devolve o chamado às listas como estava.

export default function Page({
  searchParams,
}: PageProps<"/os/configuracoes/lixeira">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-96" />
        </TelaCarregando>
      }
    >
      <Protegido permissao="os.excluir">
        <Lixeira searchParams={searchParams} />
      </Protegido>
    </Suspense>
  );
}

async function Lixeira({
  searchParams,
}: Pick<PageProps<"/os/configuracoes/lixeira">, "searchParams">) {
  const sp = await searchParams;
  const pagina = paginaDaUrl(sp.pagina);
  // Só a página mostrada vem do banco, com o total junto.
  const [{ chamados: lista, total }, todosSetores, nomesPorId] =
    await Promise.all([paginaDaLixeira(pagina), setores(), nomes()]);
  const ultima = totalDePaginas(total);
  if (pagina > ultima)
    redirect(hrefDaPagina(CONFIGURACOES_OS.lixeira, sp, ultima));
  const setorPorId = new Map(todosSetores.map((s) => [s.id, s]));

  return (
    <Cartao className="p-3 md:p-4">
      <div className="flex items-start gap-3 px-2 pt-1 pb-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-900/[0.06] text-neutral-700">
          <Trash2 className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold">
            {total === 0
              ? "A lixeira está vazia"
              : `${total} ${total === 1 ? "chamado na lixeira" : "chamados na lixeira"}`}
          </h2>
          <p className="text-xs text-neutral-500">
            Chamados na lixeira saem de todas as listas e painéis. Nada é
            apagado: restaure quando precisar.
          </p>
        </div>
      </div>
      {lista.length > 0 && (
        <ul className="flex flex-col">
          {lista.map((c) => {
            const setor = setorPorId.get(c.setor_id);
            const quem = c.lixeira_por
              ? (nomesPorId.get(c.lixeira_por) ?? "Outro usuário")
              : "Sistema";
            return (
              <li
                key={c.id}
                className="flex flex-col gap-3 border-t border-neutral-900/[0.06] px-2 py-3 md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-neutral-500 tabular-nums">
                      {formatarNumeroChamado(c.numero)}
                    </span>
                    <Link
                      href={rotaChamado(c.id)}
                      className="font-medium hover:underline"
                    >
                      {c.titulo}
                    </Link>
                    {c.exemplo && <SeloExemplo />}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <SeloTipo tipo={c.tipo} />
                    <SeloStatusChamado status={c.status} />
                    {setor && <SeloSetor nome={setor.nome} cor={setor.cor} />}
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-500">
                    Na lixeira desde{" "}
                    {c.lixeira_em ? formatarDataHora(c.lixeira_em) : "—"} por{" "}
                    {quem} · aberto em {formatarDataHora(c.criado_em)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`${CONFIGURACOES_OS.historico}?registro=${c.id}`}
                    title="Histórico do chamado"
                    aria-label={`Histórico do chamado ${formatarNumeroChamado(c.numero)}`}
                    className="grid size-9 place-items-center rounded-full opacity-60 transition hover:bg-[rgb(127_127_127/0.15)] hover:opacity-100"
                  >
                    <History className="size-4" aria-hidden />
                  </Link>
                  <AcaoRapida
                    acao={restaurarChamado}
                    campos={{ id: c.id }}
                    rotulo="Restaurar"
                    icone={<Undo2 className="size-4" aria-hidden />}
                    comTexto
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {total > 0 && (
        <div className="border-t border-neutral-900/[0.06] px-2 pt-3">
          <Paginacao
            pagina={pagina}
            total={total}
            href={(p) => hrefDaPagina(CONFIGURACOES_OS.lixeira, sp, p)}
          />
        </div>
      )}
    </Cartao>
  );
}
