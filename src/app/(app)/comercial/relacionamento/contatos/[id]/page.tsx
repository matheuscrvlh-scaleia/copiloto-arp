import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { CartaoCarregando } from "@/components/carregando";
import { Atalho, Resumo, Voltar } from "@/components/comercial/ocupacao/resumo";
import { SeloTipo } from "@/components/comercial/relacionamento/contatos";
import { ContatoNaPagina } from "@/components/comercial/relacionamento/form-contato";
import { Secao } from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { textoDoChamado } from "@/lib/comercial/relacionamento";
import { formatarData, formatarDataHora } from "@/lib/formato";
import {
  editarContato,
  excluirContato,
} from "@/server/comercial/acoes/contatos";
import { contextoCom } from "@/server/comercial/base";
import {
  configDoRelacionamento,
  contatoPorId,
  nomesDe,
  opcoesDeLocatario,
} from "@/server/comercial/relacionamento";

export const metadata: Metadata = { title: "Contato com locatário" };

const LISTA = "/comercial/relacionamento?aba=contatos";

export default function Page({
  params,
}: PageProps<"/comercial/relacionamento/contatos/[id]">) {
  return (
    <>
      <Voltar href={LISTA}>Contatos registrados</Voltar>
      <Suspense fallback={<CartaoCarregando altura="h-96" />}>
        <Protegido permissao="comercial.relacionamento.ver">
          <Tela params={params} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [ctx, c] = await Promise.all([contextoCom(), contatoPorId(id)]);
  if (!c) notFound();
  const meu =
    c.registrado_por === ctx.usuario.id &&
    ctx.pode("comercial.relacionamento.registrar");
  const [nomes, config, locatarios] = await Promise.all([
    nomesDe([c.registrado_por]),
    meu ? configDoRelacionamento() : null,
    meu ? opcoesDeLocatario() : [],
  ]);
  const chamado =
    c.precisa_outro_setor && ctx.pode("os.acessar")
      ? textoDoChamado({
          locatario: c.locatario_nome,
          luc: c.luc,
          tipo: c.tipo,
          canal: c.canal,
          descricao: c.descricao,
        })
      : null;

  return (
    <>
      <PageHeader
        title={c.locatario_nome}
        description={`${formatarData(c.data)} · ${c.tipo} · ${c.canal}`}
      />
      <div className="flex flex-col gap-6">
        <Secao titulo="Registro">
          <Resumo
            itens={[
              { rotulo: "Data", valor: formatarData(c.data) },
              { rotulo: "Tipo", valor: <SeloTipo tipo={c.tipo} /> },
              { rotulo: "Canal", valor: c.canal },
              { rotulo: "LUC", valor: c.luc ?? "—" },
              { rotulo: "Bloco", valor: c.bloco ?? "—" },
              { rotulo: "Contrato (ENET)", valor: c.contrato_enet_id ?? "—" },
              {
                rotulo: "Precisa de outro setor?",
                valor: c.precisa_outro_setor ? "Sim" : "Não",
              },
              {
                rotulo: "Registrado por",
                valor: c.registrado_por
                  ? (nomes.get(c.registrado_por) ?? "—")
                  : c.exemplo
                    ? "Exemplo"
                    : "—",
              },
              {
                rotulo: "Registrado em",
                valor: formatarDataHora(c.registrado_em),
              },
            ]}
          />
          <p className="mt-4 whitespace-pre-line rounded-2xl bg-neutral-900/[0.04] px-4 py-3 text-sm">
            {c.descricao}
          </p>
          {chamado && (
            <div className="mt-4">
              <Atalho href={`/os/novo?${new URLSearchParams(chamado)}`}>
                Abrir chamado no Tickets
              </Atalho>
            </div>
          )}
        </Secao>
        {meu && config && (
          <Secao
            titulo="Alterar o registro"
            descricao="Só quem registrou altera ou exclui."
          >
            <ContatoNaPagina
              acao={editarContato}
              locatarios={locatarios}
              tipos={config.tipos}
              canais={config.canais}
              hoje={ctx.hoje}
              abreChamado={ctx.pode("os.acessar")}
              contato={{
                id: c.id,
                contrato: c.contrato_enet_id ?? "",
                locatario: c.locatario_nome,
                luc: c.luc,
                data: c.data,
                tipo: c.tipo,
                canal: c.canal,
                descricao: c.descricao,
                outroSetor: c.precisa_outro_setor,
              }}
            />
            <FormAcao
              acao={excluirContato}
              rotulo="Excluir registro"
              rotuloEnviando="Excluindo…"
              variante="perigo"
              confirmar="Excluir este registro de contato? Não tem volta."
              className="mt-6 border-t border-neutral-900/[0.06] pt-4"
            >
              <input type="hidden" name="id" value={c.id} />
            </FormAcao>
          </Secao>
        )}
      </div>
    </>
  );
}
