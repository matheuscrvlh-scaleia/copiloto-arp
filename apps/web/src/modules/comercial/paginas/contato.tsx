import { textoDoChamado } from "@arp/shared/comercial/relacionamento";
import { formatarData, formatarDataHora } from "@arp/shared/formato";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import { z } from "zod";
import { CartaoCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { naoEncontrado, useNavegar, useParametro } from "@/lib/navegacao";
import { useSessao } from "@/lib/sessao";
import {
  Atalho,
  Resumo,
  Voltar,
} from "@/modules/comercial/components/ocupacao/resumo";
import { SeloTipo } from "@/modules/comercial/components/relacionamento/contatos";
import { ContatoNaPagina } from "@/modules/comercial/components/relacionamento/form-contato";
import {
  consultaConfigSe,
  consultaContato,
  consultaLocatariosSe,
  editarContato,
  excluirContato,
} from "../api/relacionamento";

// /comercial/relacionamento/contatos/:id
// (app/(app)/comercial/relacionamento/contatos/[id]/page.tsx).

const LISTA = "/comercial/relacionamento?aba=contatos";

export default function Page() {
  return (
    <>
      <Voltar href={LISTA}>Contatos registrados</Voltar>
      <Suspense fallback={<CartaoCarregando altura="h-96" />}>
        <Protegido permissao="comercial.relacionamento.ver">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

function Tela() {
  const id = useParametro("id");
  if (!z.uuid().safeParse(id).success) naoEncontrado();
  return <Contato id={id} />;
}

function Contato({ id }: { id: string }) {
  const { usuario, pode } = useSessao();
  const navegar = useNavegar();
  const excluir = useMemo(
    () => excluirContato(() => navegar.push(LISTA)),
    [navegar],
  );
  const {
    data: { contato: c, nomes: lidos },
  } = useSuspenseQuery(consultaContato(id));
  const meu =
    c.registrado_por === usuario.id &&
    pode("comercial.relacionamento.registrar");
  const [{ data: config }, { data: locs }] = useSuspenseQueries({
    queries: [consultaConfigSe(meu), consultaLocatariosSe(meu)],
  });
  const ctx = { pode, hoje: config?.hoje ?? c.data };
  const nomes = new Map(lidos.map((n) => [n.id, n.nome]));
  const locatarios = locs?.locatarios ?? [];
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
              acao={excluir}
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
