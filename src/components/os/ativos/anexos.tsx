import { FileText, ImageIcon, Paperclip, Trash2 } from "lucide-react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { classeCampo } from "@/components/estilos";
import type { Acao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import { formatarData, formatarNumero } from "@/lib/formato";
import { paraBrasilia } from "@/lib/os/tempo";
import type { Anexo } from "@/server/os/ativos";
import { Janela } from "./janela";

// Anexos do ativo: foto, manual, nota fiscal e laudos. O arquivo fica no
// bucket privado; o link é temporário (1 h) e só sai para quem vê ativos.

export const CATEGORIAS_ANEXO = {
  foto: "Foto",
  manual: "Manual",
  nota_fiscal: "Nota fiscal",
  laudo: "Laudo",
  anexo: "Outro",
} as const;

function tamanho(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${formatarNumero(bytes / 1024)} KB`;
  return `${formatarNumero(bytes / 1024 / 1024, 1)} MB`;
}

export function AnexosDoAtivo({
  ativoId,
  anexos,
  gerenciar,
  enviar,
  remover,
}: {
  ativoId: string;
  anexos: Anexo[];
  gerenciar: boolean;
  enviar: Acao;
  remover: Acao;
}) {
  return (
    <div className="flex flex-col gap-3">
      {anexos.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nenhum arquivo. Guarde aqui o manual, a nota fiscal e os laudos.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {anexos.map((a) => {
            const Icone = a.mime?.startsWith("image/")
              ? ImageIcon
              : a.mime === "application/pdf"
                ? FileText
                : Paperclip;
            const rotulo =
              CATEGORIAS_ANEXO[a.categoria as keyof typeof CATEGORIAS_ANEXO] ??
              "Arquivo";
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/50"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-900/[0.05] text-neutral-600">
                  <Icone className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm font-medium underline-offset-2 hover:underline"
                    >
                      {a.nome}
                    </a>
                  ) : (
                    <span className="block truncate text-sm font-medium">
                      {a.nome}
                    </span>
                  )}
                  <span className="block truncate text-xs text-neutral-500">
                    {rotulo} · {formatarData(paraBrasilia(new Date(a.em)).data)}
                    {a.enviadoPor ? ` · ${a.enviadoPor}` : ""}
                    {a.tamanho ? ` · ${tamanho(a.tamanho)}` : ""}
                  </span>
                </span>
                {gerenciar && (
                  <AcaoRapida
                    acao={remover}
                    campos={{ id: a.id }}
                    rotulo="Remover arquivo"
                    icone={<Trash2 className="size-4" aria-hidden />}
                    confirmar={`Remover "${a.nome}"? O arquivo é apagado de vez.`}
                    perigo
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {gerenciar && (
        <div>
          <Janela
            acao={enviar}
            rotulo="Anexar arquivo"
            icone={<Paperclip className="size-4" aria-hidden />}
            titulo="Anexar arquivo"
            descricao="Até 4 MB por arquivo."
            enviar="Anexar"
            enviando="Enviando…"
          >
            <input type="hidden" name="ativo_id" value={ativoId} />
            <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
              Tipo
              <Selecao
                name="categoria"
                valorInicial="manual"
                opcoes={Object.entries(CATEGORIAS_ANEXO).map(
                  ([valor, rotulo]) => ({ valor, rotulo }),
                )}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
              Arquivo
              <input
                type="file"
                name="arquivo"
                required
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                className={`${classeCampo} file:mr-3 file:rounded-full file:border-0 file:bg-neutral-900 file:px-3 file:py-1 file:text-xs file:text-white`}
              />
            </label>
          </Janela>
        </div>
      )}
    </div>
  );
}
