import type { RespostaParametros } from "@arp/shared/os/contratos/configuracoes";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Protegido } from "@/components/protegido";
import { consultaDosParametros } from "@/modules/os/api-configuracoes";
import { BlocoSaidasDeAtivos } from "@/modules/os/components/configuracoes/parametros/bloco-saidas";
import {
  BlocoAtivos,
  BlocoCiclo,
  BlocoOperacoes,
} from "@/modules/os/components/configuracoes/parametros/blocos";
import {
  BlocoMetas,
  BlocoPapelTimbrado,
  BlocoPortal,
  BlocoVistorias,
  BlocoWhatsApp,
} from "@/modules/os/components/configuracoes/parametros/blocos-textos";

// app/(app)/os/configuracoes/parametros/page.tsx

// Tudo o que pode mudar fica aqui, nunca fixo no sistema (spec 4.15). Cada
// bloco salva separado e mostra as últimas alterações (quem, quando, antes e
// depois) para quem vê o histórico.

const INDICE = [
  ["ciclo", "Ciclo"],
  ["operacoes", "Operações"],
  ["ativos", "Ativos"],
  ["saidas", "Saída de ativos"],
  ["vistorias", "Vistorias"],
  ["portal", "Portal"],
  ["metas", "Metas"],
  ["whatsapp", "WhatsApp"],
  ["papel-timbrado", "Papel timbrado"],
] as const;

const BLOCOS: [string, (props: { d: RespostaParametros }) => ReactNode][] = [
  ["ciclo", BlocoCiclo],
  ["operacoes", BlocoOperacoes],
  ["ativos", BlocoAtivos],
  ["saidas", BlocoSaidasDeAtivos],
  ["vistorias", BlocoVistorias],
  ["portal", BlocoPortal],
  ["metas", BlocoMetas],
  ["whatsapp", BlocoWhatsApp],
  ["papel", BlocoPapelTimbrado],
];

export default function Page() {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Protegido permissao="os.parametros">
        <div className="flex flex-col gap-6">
          <nav aria-label="Ir para" className="flex flex-wrap gap-2">
            {INDICE.map(([id, nome]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-full bg-white/60 px-3 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-900/[0.06] transition hover:bg-neutral-900 hover:text-white"
              >
                {nome}
              </a>
            ))}
          </nav>
          <Blocos />
        </div>
      </Protegido>
    </Suspense>
  );
}

/** Uma leitura só para todos os blocos (o antigo lia cada bloco à parte). */
function Blocos() {
  const { data: d } = useSuspenseQuery(consultaDosParametros);
  return BLOCOS.map(([id, Bloco]) => <Bloco key={id} d={d} />);
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <div aria-hidden className="flex flex-wrap gap-2">
        {INDICE.map(([id]) => (
          <span key={id} className="carregando h-7 w-24 rounded-full" />
        ))}
      </div>
      <CartaoCarregando altura="h-96" />
      <CartaoCarregando altura="h-96" />
    </TelaCarregando>
  );
}
