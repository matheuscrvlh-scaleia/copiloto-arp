import { useEffect, useState } from "react";
import { clienteDeConsultas } from "@/lib/consulta";
import { Link } from "@/lib/navegacao";
import { consultaDaSessao } from "@/lib/sessao";
import { Carregando } from "./carregando";
import { Cartao } from "./page-header";

// Endereços antigos que entregavam um arquivo (eram route.ts no Next: termo,
// demonstrativo, planilha, laudo, etiquetas, recibo…). Aqui a tela só passa
// para a API, que confere a sessão (ou o token do link) e devolve o arquivo.
//
// O navegador não avisa quando um download começa nem quando termina: se o
// arquivo abre na própria aba (PDF), esta tela some; se ele é baixado, a
// aba continua aqui. Por isso, depois de pedir o arquivo, a tela troca o
// "carregando" por um aviso com os dois caminhos: pedir de novo e voltar.
// Erro da API num endereço aberto direto no navegador sai como texto simples
// (apps/api/src/http/erros.ts), não como JSON.

/** Tempo do esqueleto antes do aviso (o pedido já saiu). */
const ESPERA_DA_PONTE_MS = 2000;

const irParaOArquivo = (endereco: string) => window.location.replace(endereco);

export function PonteDeArquivo({
  destino,
  voltar,
  publica = false,
  ir = irParaOArquivo,
  esperaMs = ESPERA_DA_PONTE_MS,
}: {
  /** Endereço do arquivo na API (/api/v1/...). */
  destino: string;
  /** Tela de onde este arquivo sai (o "Voltar" do aviso). */
  voltar: string;
  /** Link por token, sem login: não confere a sessão antes. */
  publica?: boolean;
  /** Como pedir o arquivo (trocado nos testes). */
  ir?: (endereco: string) => void;
  /** Tempo do esqueleto antes do aviso (menor nos testes). */
  esperaMs?: number;
}) {
  const [pedido, setPedido] = useState(false);

  useEffect(() => {
    let vale = true;
    let relogio: ReturnType<typeof setTimeout> | undefined;
    // O pedido do arquivo é uma navegação: não passa por lib/api e não
    // renova o acesso sozinho. Perguntar "quem sou eu" antes renova o que
    // estiver vencido (aba parada há mais de 10 min).
    const pronta = publica
      ? Promise.resolve()
      : clienteDeConsultas
          .fetchQuery({ ...consultaDaSessao, staleTime: 0 })
          .then(
            () => undefined,
            () => undefined,
          );
    void pronta.then(() => {
      if (!vale) return;
      ir(destino);
      relogio = setTimeout(() => setPedido(true), esperaMs);
    });
    return () => {
      vale = false;
      clearTimeout(relogio);
    };
  }, [destino, publica, ir, esperaMs]);

  if (!pedido) return <Carregando />;

  const aviso = (
    <Cartao>
      <output className="flex flex-col items-start gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            O arquivo foi aberto ou baixado
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            Se ele não apareceu, confira os downloads do navegador ou peça de
            novo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={destino}
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Tentar de novo
          </a>
          <Link
            href={voltar}
            className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
          >
            Voltar
          </Link>
        </div>
      </output>
    </Cartao>
  );
  // Tela pública não tem a casca em volta: o cartão ganha a própria margem.
  return publica ? <div className="mx-auto max-w-xl p-6">{aviso}</div> : aviso;
}
