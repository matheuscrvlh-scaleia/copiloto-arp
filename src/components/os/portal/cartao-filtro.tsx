import Link from "next/link";
import { CartaoIndicador } from "@/components/dashboard/indicador";
import type { Tom } from "@/components/estilos";
import { CLASSE_MARCADO } from "@/components/os/tons";
import { paraBrasilia } from "@/lib/os/tempo";

// Cartão de indicador que filtra a lista ao clicar (de novo: tira o filtro)
// e o "Atualizado às hh:mm" do topo das telas.

export function CartaoFiltro({
  href,
  ativo,
  titulo,
  valor,
  detalhe,
  tom,
}: {
  href: string;
  ativo: boolean;
  titulo: string;
  valor: string;
  detalhe?: string;
  tom?: Tom;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={ativo ? "true" : undefined}
      className={`flex rounded-[1.75rem] outline-none transition *:flex-1 focus-visible:ring-4 focus-visible:ring-neutral-900/15 ${ativo ? CLASSE_MARCADO : ""}`}
    >
      <CartaoIndicador
        titulo={titulo}
        valor={valor}
        detalhe={ativo ? `${detalhe ?? ""} · filtrando a lista` : detalhe}
        tom={tom}
      />
    </Link>
  );
}

export function Atualizado({ agora }: { agora: Date }) {
  return (
    <p className="text-xs text-neutral-500">
      Atualizado às {paraBrasilia(agora).hora}
    </p>
  );
}
