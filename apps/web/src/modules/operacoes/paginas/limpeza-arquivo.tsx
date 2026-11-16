import { useEffect } from "react";
import { Carregando } from "@/components/carregando";
import {
  useCaminho,
  useParametro,
  useParametrosDeBusca,
} from "@/lib/navegacao";
import { hrefDaPlanilhaDoRateio, hrefDoDemonstrativo } from "../api-limpeza";

// /operacoes/limpeza/:mes/demonstrativo[?bloco=] e /operacoes/limpeza/:mes/
// planilha: endereços antigos do PDF e do Excel do rateio (eram route.ts;
// estão nos avisos do Financeiro). Passa para a API, que confere o acesso.

export default function Pagina() {
  const mes = useParametro("mes");
  const planilha = useCaminho().endsWith("/planilha");
  const bloco = useParametrosDeBusca().get("bloco");
  const destino = planilha
    ? hrefDaPlanilhaDoRateio(mes)
    : `${hrefDoDemonstrativo(mes)}${bloco ? `?${new URLSearchParams({ bloco }).toString()}` : ""}`;
  useEffect(() => {
    window.location.replace(destino);
  }, [destino]);
  return <Carregando />;
}
