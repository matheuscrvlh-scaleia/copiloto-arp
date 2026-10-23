"use client";

import { RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { type Acao, FormAcao } from "@/components/form-acao";
import {
  CHAVES_MENSAGEM,
  camposDoModelo,
  DESCRICAO_CAMPO,
  EXEMPLO_MENSAGEM,
} from "@/lib/os/configuracoes";
import {
  type ChaveMensagem,
  MENSAGENS_PADRAO,
  preencher,
  ROTULOS_MENSAGEM,
} from "@/lib/os/whatsapp";

// Textos das mensagens prontas do WhatsApp: cada um com os campos que pode
// usar (clicar insere no cursor), a prévia preenchida com um exemplo e o
// botão de voltar ao texto padrão.

export function MensagensWhatsApp({
  acao,
  iniciais,
}: {
  acao: Acao;
  iniciais: Record<ChaveMensagem, string>;
}) {
  const [textos, setTextos] = useState(iniciais);
  const [aberta, setAberta] = useState<ChaveMensagem>(
    CHAVES_MENSAGEM[0] as ChaveMensagem,
  );
  const campo = useRef<HTMLTextAreaElement>(null);

  const mudar = (k: ChaveMensagem, t: string) =>
    setTextos((x) => ({ ...x, [k]: t }));

  function inserir(nome: string) {
    const el = campo.current;
    const atual = textos[aberta];
    const marca = `{{${nome}}}`;
    const ini = el?.selectionStart ?? atual.length;
    const fim = el?.selectionEnd ?? atual.length;
    mudar(aberta, atual.slice(0, ini) + marca + atual.slice(fim));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(ini + marca.length, ini + marca.length);
    });
  }

  const texto = textos[aberta];
  // Campos que o sistema preenche nesta mensagem (os do texto padrão).
  const disponiveis = camposDoModelo(MENSAGENS_PADRAO[aberta]);
  const usados = camposDoModelo(texto);
  const desconhecidos = usados.filter((c) => !disponiveis.includes(c));
  const editadas = CHAVES_MENSAGEM.filter(
    (k) => textos[k] !== MENSAGENS_PADRAO[k],
  );

  return (
    <FormAcao
      acao={acao}
      rotulo="Salvar mensagens"
      className="flex flex-col gap-4"
    >
      {CHAVES_MENSAGEM.map((k) => (
        <input key={k} type="hidden" name={`msg_${k}`} value={textos[k]} />
      ))}
      <div
        role="tablist"
        aria-label="Mensagens"
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      >
        {CHAVES_MENSAGEM.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={aberta === k}
            onClick={() => setAberta(k)}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-600 ring-1 ring-neutral-900/[0.08] transition hover:text-neutral-900 aria-selected:bg-neutral-900 aria-selected:text-white"
          >
            {ROTULOS_MENSAGEM[k]}
            {editadas.includes(k) && (
              <span className="ml-1 opacity-70" title="Texto alterado">
                •
              </span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            Texto da mensagem “{ROTULOS_MENSAGEM[aberta]}”
            <textarea
              ref={campo}
              value={texto}
              onChange={(e) => mudar(aberta, e.target.value)}
              rows={11}
              maxLength={4000}
              className={`${classeCampo} font-mono text-[13px] leading-relaxed`}
            />
          </label>
          <p className="text-xs text-neutral-500">
            *texto* sai em negrito no WhatsApp. Campos disponíveis (toque para
            inserir):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {disponiveis.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => inserir(c)}
                title={DESCRICAO_CAMPO[c] ?? c}
                className="rounded-full bg-neutral-900/[0.06] px-2.5 py-1 font-mono text-[11px] text-neutral-700 transition hover:bg-neutral-900 hover:text-white"
              >
                {`{{${c}}}`}
              </button>
            ))}
          </div>
          {desconhecidos.length > 0 && (
            <p role="alert" className="text-xs text-amber-900">
              {desconhecidos.map((c) => `{{${c}}}`).join(", ")}{" "}
              {desconhecidos.length === 1
                ? "não é preenchido"
                : "não são preenchidos"}{" "}
              nesta mensagem e {desconhecidos.length === 1 ? "sai" : "saem"} em
              branco.
            </p>
          )}
          {texto !== MENSAGENS_PADRAO[aberta] && (
            <button
              type="button"
              onClick={() => mudar(aberta, MENSAGENS_PADRAO[aberta])}
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-400"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Voltar ao texto padrão
            </button>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-neutral-600">
            Prévia com dados de exemplo
          </p>
          <div className="rounded-2xl bg-[#e7f6e3] p-3 dark:bg-[#1f2c1d]">
            <p className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-white px-3 py-2 text-sm whitespace-pre-wrap text-neutral-900 shadow-sm">
              <Negrito texto={preencher(texto, EXEMPLO_MENSAGEM)} />
            </p>
          </div>
        </div>
      </div>
    </FormAcao>
  );
}

/** *texto* em negrito, como o WhatsApp mostra. */
function Negrito({ texto }: { texto: string }) {
  const partes = texto.split(/(\*[^*\n]+\*)/g);
  let posicao = 0;
  return partes.map((p) => {
    const chave = posicao;
    posicao += p.length;
    return p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
      <strong key={chave}>{p.slice(1, -1)}</strong>
    ) : (
      <span key={chave}>{p}</span>
    );
  });
}
