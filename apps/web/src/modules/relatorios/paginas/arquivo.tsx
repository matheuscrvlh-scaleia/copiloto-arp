import { useEffect } from "react";
import { Carregando } from "@/components/carregando";
import { useParametro, useParametrosDeBusca } from "@/lib/navegacao";
import { linkDoArquivo } from "../api";

// /relatorios/:id/arquivo?caminho=…&nome=…: endereço antigo de baixar um
// arquivo de resposta (era um route.ts). Passa para a API, que confere a
// permissão e manda para o link assinado.

export default function Pagina() {
  const id = useParametro("id");
  const busca = useParametrosDeBusca();
  const destino = linkDoArquivo(
    id,
    busca.get("caminho") ?? "",
    busca.get("nome") ?? "",
  );
  useEffect(() => {
    window.location.replace(destino);
  }, [destino]);
  return <Carregando />;
}
