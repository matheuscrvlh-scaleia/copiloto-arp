import { ROTAS_OS } from "@arp/shared/os/rotas";
import { TIPOS_VISTORIA, type TipoVistoria } from "@arp/shared/os/rotulos";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import { localDaUnidade } from "@arp/shared/os/vistoria-regras";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link, useBusca } from "@/lib/navegacao";
import { Secao } from "@/modules/admin/components/ui";
import { consultaDaNovaVistoria } from "@/modules/os/api-vistorias";
import { NovaVistoria } from "@/modules/os/components/vistorias/nova";

// /os/vistorias/nova: tipo e contrato (pelo link do contrato já chega
// preenchida, ?loja=…&tipo=…).

const ehTipo = (t: string): t is TipoVistoria =>
  Object.hasOwn(TIPOS_VISTORIA, t);

export default function Pagina() {
  return (
    <>
      <Link
        href={ROTAS_OS.vistorias}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Vistorias
      </Link>
      <PageHeader
        title="Nova vistoria"
        description="Escolha o tipo e o contrato. Os ambientes padrão já vêm prontos para preencher e fotografar."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-96" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="os.vistorias">
          <Formulario />
        </Protegido>
      </Suspense>
    </>
  );
}

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

function Formulario() {
  const sp = useBusca();
  const { lojas } = useSuspenseQuery(consultaDaNovaVistoria).data;
  const tipo = um(sp.tipo);
  const loja = um(sp.loja);

  return (
    <Cartao>
      <Secao
        titulo="Contrato e tipo"
        descricao="Pelo link do contrato (?loja=…&tipo=entrada) a vistoria já chega preenchida."
      >
        <NovaVistoria
          hoje={hojeEmBrasilia(new Date())}
          tipoInicial={ehTipo(tipo) ? tipo : null}
          lojaInicial={lojas.some((l) => l.id === loja) ? loja : null}
          lojas={lojas.map((l) => ({
            id: l.id,
            rotulo: `${localDaUnidade(l.bloco, l.luc)} · ${l.nome}`,
            descricao: [
              l.locatario,
              l.situacao === "encerrado" ? "contrato encerrado" : null,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
        />
      </Secao>
    </Cartao>
  );
}
