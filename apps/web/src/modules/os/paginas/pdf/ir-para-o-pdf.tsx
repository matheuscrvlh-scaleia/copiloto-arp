import { useEffect } from "react";
import { Carregando } from "@/components/carregando";

// Endereços antigos dos PDFs (eram route.ts no Next): passam para a API,
// que confere a sessão (ou o token do link) e devolve o arquivo.

export function IrParaOPdf({ destino }: { destino: string }) {
  useEffect(() => {
    window.location.replace(destino);
  }, [destino]);
  return <Carregando />;
}
