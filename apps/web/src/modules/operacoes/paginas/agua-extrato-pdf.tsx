import { useEffect } from "react";
import { Carregando } from "@/components/carregando";
import { useBusca } from "@/lib/navegacao";
import { CAMPOS_DO_EXTRATO, camposDaBusca, hrefDoExtratoPdf } from "../api";

// /operacoes/agua/extrato/pdf?…: endereço antigo do extrato em PDF (era um
// route.ts). Passa para a API com os mesmos filtros.

export default function Pagina() {
  const destino = hrefDoExtratoPdf(
    camposDaBusca(useBusca(), CAMPOS_DO_EXTRATO),
  );
  useEffect(() => {
    window.location.replace(destino);
  }, [destino]);
  return <Carregando />;
}
