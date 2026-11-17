import { FileText } from "lucide-react";
import { useState } from "react";
import { notificar } from "@/components/notificacoes";
import { mensagemDoErro } from "@/lib/api";
import { gerarRelatorioDoMes } from "../../api-painel";

/**
 * "Relatório do mês (PDF)": gera o relatório na API e abre o PDF em outra
 * aba, como o link do sistema antigo. Gerar conclui o chamado recorrente do
 * relatório, por isso é um POST disparado pelo clique (e não um endereço que
 * grava ao ser aberto). A aba é aberta já no clique, para o navegador não
 * bloquear; o PDF entra nela quando chega.
 */
export function BotaoRelatorioDoMes({
  mes,
  rotulo = "Relatório do mês (PDF)",
}: {
  /** "aaaa-mm". */
  mes: string;
  rotulo?: string;
}) {
  const [gerando, setGerando] = useState(false);
  async function gerar() {
    const aba = window.open("", "_blank");
    setGerando(true);
    try {
      const pdf = await gerarRelatorioDoMes(mes);
      const url = URL.createObjectURL(
        new Blob([pdf], { type: "application/pdf" }),
      );
      if (aba) aba.location.replace(url);
      else window.location.assign(url);
    } catch (e) {
      aba?.close();
      notificar("erro", mensagemDoErro(e));
    } finally {
      setGerando(false);
    }
  }
  return (
    <button
      type="button"
      onClick={gerar}
      disabled={gerando}
      aria-busy={gerando}
      data-guia="painel-relatorio"
      className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
    >
      <FileText className="size-4" aria-hidden />
      {gerando ? "Gerando…" : rotulo}
    </button>
  );
}
