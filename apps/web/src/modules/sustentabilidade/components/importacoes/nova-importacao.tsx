import type { TipoDeImportacao } from "@arp/shared/sustentabilidade/importacao/index";
import {
  ARQUIVO_DO_TIPO,
  NOME_DO_TIPO,
  rotaDaImportacaoSu,
} from "@arp/shared/sustentabilidade/importacao-historico";
import { FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { ModalConfirmacao } from "@/components/modal-confirmacao";
import { notificar } from "@/components/notificacoes";
import { Selecao } from "@/components/selecao";
import { enviarParaLink } from "@/lib/enviar-arquivo";
import { useRouter } from "@/lib/navegacao";
import {
  descartarEnvio,
  lerEnvioImportacao,
  prepararEnvioImportacao,
} from "../../api-config";

// Passo 1 (spec 4.10): escolher o tipo e enviar o arquivo como está. O
// arquivo vai direto para o disco (link de envio); o servidor confere,
// calcula o sha256 e cria a prévia. Arquivo já importado: pergunta se
// substitui (a anterior fica guardada como "substituída").

const TIPOS = Object.keys(NOME_DO_TIPO) as TipoDeImportacao[];

const botao =
  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export function NovaImportacao() {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoDeImportacao>("entrevistas");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [repetida, setRepetida] = useState<{
    caminho: string;
    nome: string;
    pergunta: string;
  } | null>(null);
  const [rodando, iniciar] = useTransition();
  const campo = useRef<HTMLInputElement>(null);

  const abrir = (id: string) => {
    notificar("ok", "Prévia pronta. Confira e confirme.");
    router.push(rotaDaImportacaoSu(id));
  };

  const enviar = () =>
    arquivo &&
    iniciar(async () => {
      try {
        setEtapa("Enviando o arquivo…");
        const p = await prepararEnvioImportacao({
          tipo,
          nome: arquivo.name,
          tamanho: arquivo.size,
        });
        if (!p.ok) return notificar("erro", p.erro);
        if (!(await enviarParaLink(p.url, arquivo)))
          return notificar("erro", "O envio não chegou. Tente de novo.");
        setEtapa("Lendo o arquivo e montando a prévia…");
        const r = await lerEnvioImportacao({
          tipo,
          caminho: p.caminho,
          nome: arquivo.name,
        });
        if (r.ok) return abrir(r.id);
        if ("repetida" in r)
          return setRepetida({
            caminho: p.caminho,
            nome: arquivo.name,
            pergunta: `Substituir a importação anterior? Este arquivo já foi importado em ${r.repetida.quando} (${r.repetida.texto}). Ao confirmar a nova prévia, a anterior fica guardada como "substituída" e só a nova vale.`,
          });
        notificar("erro", r.erro);
      } finally {
        setEtapa(null);
      }
    });

  const substituir = () =>
    repetida &&
    iniciar(async () => {
      setEtapa("Lendo o arquivo e montando a prévia…");
      try {
        const r = await lerEnvioImportacao({
          tipo,
          caminho: repetida.caminho,
          nome: repetida.nome,
          substituir: true,
        });
        setRepetida(null);
        if (r.ok) return abrir(r.id);
        notificar("erro", "erro" in r ? r.erro : "Tente de novo.");
      } finally {
        setEtapa(null);
      }
    });

  const naoSubstituir = () => {
    if (repetida) void descartarEnvio({ caminho: repetida.caminho });
    setRepetida(null);
    setArquivo(null);
    if (campo.current) campo.current.value = "";
    notificar("info", "Nada mudou: a importação anterior continua valendo.");
  };

  return (
    <div data-guia="su-importacoes-nova" className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-600">Tipo</span>
          <div data-guia="su-importacoes-tipo">
            <Selecao
              rotulo="Tipo de importação"
              valor={tipo}
              aoMudar={(v) => setTipo(v as TipoDeImportacao)}
              opcoes={TIPOS.map((t) => ({
                valor: t,
                rotulo: NOME_DO_TIPO[t],
              }))}
              desabilitada={rodando}
            />
          </div>
          <p className="text-xs text-neutral-500">{ARQUIVO_DO_TIPO[tipo]}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-600">Arquivo</span>
          <label
            data-guia="su-importacoes-arquivo"
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:border-neutral-500 has-[:disabled]:cursor-wait"
          >
            <FileSpreadsheet
              className="size-4 shrink-0 text-neutral-500"
              aria-hidden
            />
            <span className="truncate">
              {arquivo ? arquivo.name : "Escolher a planilha (.xlsx ou .csv)"}
            </span>
            <input
              ref={campo}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="sr-only"
              disabled={rodando}
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-xs text-neutral-500">
            Envie como recebeu: não precisa editar nada. Abas de orçamento de
            eventos (&ldquo;Plano B&rdquo;, &ldquo;Plano de Mídia&rdquo;,
            &ldquo;Local Working&rdquo;) são ignoradas.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-guia="su-importacoes-ler"
          onClick={enviar}
          disabled={!arquivo || rodando}
          className={`${botao} bg-neutral-900 text-white hover:bg-neutral-800`}
        >
          <Upload className="size-4" aria-hidden />
          {rodando ? "Um instante…" : "Ler arquivo e mostrar prévia"}
        </button>
        {etapa && <output className="text-sm text-neutral-600">{etapa}</output>}
      </div>
      <ModalConfirmacao
        aberto={repetida !== null}
        pergunta={repetida?.pergunta}
        rotulo="Substituir"
        enviando={rodando}
        aoConfirmar={substituir}
        aoFechar={naoSubstituir}
      />
    </div>
  );
}
