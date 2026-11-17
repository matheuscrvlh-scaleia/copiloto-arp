import type { Execucao } from "@arp/shared/admin/contratos";
import { formatarDataHora, formatarNumero } from "@arp/shared/formato";
import { INTEGRACOES } from "@arp/shared/integracoes";
import { Tabela } from "@/components/dashboard/tabela";
import { Situacao } from "./ui";

// Últimas execuções das sincronizações (integracao.sync_runs). O banco já
// devolve só as das integrações que a pessoa pode configurar.

const NOME_SISTEMA: Record<string, string> = Object.fromEntries(
  Object.entries(INTEGRACOES).map(([k, v]) => [k, v.nome]),
);

export function HistoricoDasIntegracoes({
  linhas,
  descricao = "As 15 execuções mais recentes, automáticas ou pedidas aqui.",
}: {
  linhas: Execucao[];
  descricao?: string;
}) {
  return (
    <section className="vidro rounded-[2rem] p-6">
      <h2 className="text-lg font-semibold">Últimas sincronizações</h2>
      <p className="mt-1 text-xs text-neutral-500">{descricao}</p>
      <div className="mt-4">
        <Tabela
          linhas={linhas}
          chave={(l) => `${l.sistema}-${l.recurso}-${l.iniciado_em}`}
          vazio="Nenhuma sincronização ainda."
          colunas={[
            {
              titulo: "Sistema",
              valor: (l) => NOME_SISTEMA[l.sistema] ?? l.sistema,
            },
            { titulo: "Início", valor: (l) => formatarDataHora(l.iniciado_em) },
            {
              titulo: "Duração",
              numero: true,
              valor: (l) => duracao(l.iniciado_em, l.finalizado_em),
            },
            {
              titulo: "Situação",
              valor: (l) =>
                l.status === "sucesso" ? (
                  <Situacao tipo="ok">Sucesso</Situacao>
                ) : l.status === "erro" ? (
                  <Situacao tipo="erro">Erro</Situacao>
                ) : (
                  <Situacao tipo="rodando">Rodando</Situacao>
                ),
            },
            {
              titulo: "Registros",
              numero: true,
              valor: (l) => formatarNumero(l.registros),
            },
            {
              titulo: "Detalhe",
              valor: (l) =>
                l.erro || l.avisos.length === 0 ? (
                  <span
                    className="block max-w-md truncate text-xs text-neutral-500"
                    title={l.erro ?? undefined}
                  >
                    {l.erro ?? "—"}
                  </span>
                ) : (
                  <details className="max-w-md text-xs text-neutral-600">
                    <summary className="cursor-pointer font-medium text-amber-900">
                      {formatarNumero(l.avisos.length)}{" "}
                      {l.avisos.length > 1 ? "avisos" : "aviso"} para conferir
                    </summary>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {l.avisos.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </details>
                ),
            },
          ]}
        />
      </div>
    </section>
  );
}

function duracao(inicio: string, fim: string | null): string {
  if (!fim) return "—";
  const s = Math.max(
    0,
    Math.round((Date.parse(fim) - Date.parse(inicio)) / 1000),
  );
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`;
}
