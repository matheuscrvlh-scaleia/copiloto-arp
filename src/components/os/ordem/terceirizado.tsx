"use client";

import {
  Check,
  Copy,
  ExternalLink,
  MapPin,
  MessageCircle,
  Send,
} from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { type Opcao, Selecao } from "@/components/selecao";
import { formatarDataHora, formatarMoeda } from "@/lib/formato";
import { ETAPAS_TERCEIRIZADO, type EtapaTerceirizado } from "@/lib/os/ordem";
import {
  aprovarOrcamento,
  cancelarLinkTerceirizado,
  enviarAoTerceirizado,
  usarDoTerceirizado,
} from "@/server/os/acoes/ordem-terceirizado";
import { aviso, botao, rotulo } from "./estilos";
import type { EstadoOS } from "./tipos";

// Terceirizado: o link da OS (enviar pelo WhatsApp, reenviar, cancelar), o
// que ele marcou no link (aceite, chegada, término, solução, valor), a
// cobrança do prazo de retorno e a aprovação do orçamento acima do teto.

export interface Localizacao {
  lat: number;
  lng: number;
}

export interface LinkNaTela {
  etapa: EtapaTerceirizado;
  ativo: boolean;
  url: string;
  criado_em: string;
  aceito_em: string | null;
  recusado_em: string | null;
  recusa_motivo: string | null;
  chegada_em: string | null;
  chegada_local: Localizacao | null;
  saida_em: string | null;
  saida_local: Localizacao | null;
  terminado_em: string | null;
  solucao: string | null;
  /** null para quem não vê custos. */
  valor_informado: number | null;
  orcamento_numero: string | null;
  ultimo_acesso_em: string | null;
}

const COR_ETAPA: Record<EtapaTerceirizado, string> = {
  enviado: "bg-neutral-900/[0.06] text-neutral-700",
  aceito: "bg-violet-400/20 text-violet-700",
  no_local: "bg-amber-50 text-amber-900",
  terminado: "bg-amber-50 text-amber-900",
  assinado: "bg-green-50 text-green-700",
  recusado: "bg-red-50 text-red-700",
  cancelado: "bg-neutral-900/[0.04] text-neutral-500",
};

const mapa = (l: Localizacao) =>
  `https://www.google.com/maps?q=${l.lat},${l.lng}`;

export function Terceirizado({
  ordemId,
  link,
  podeEnviar,
  podeEditar,
  comCustos,
  telefones,
  solucaoAtual,
  cobranca,
  orcamento,
}: {
  ordemId: string;
  link: LinkNaTela | null;
  podeEnviar: boolean;
  podeEditar: boolean;
  comCustos: boolean;
  telefones: Opcao[];
  solucaoAtual: string | null;
  cobranca: {
    prazo: string;
    atrasado: boolean;
    vencendo: boolean;
    whatsapp: string;
  } | null;
  orcamento: {
    pendente: boolean;
    podeAprovar: boolean;
    aprovadoEm: string | null;
  };
}) {
  return (
    <div className="flex flex-col gap-4">
      {orcamento.pendente && (
        <div className={`${aviso.atencao} flex flex-col gap-2`}>
          <p>
            O orçamento do terceirizado passou do teto dos parâmetros e precisa
            ser aprovado por quem gerencia o setor antes de concluir a OS.
          </p>
          {orcamento.podeAprovar && (
            <FormAcao
              acao={aprovarOrcamento}
              rotulo="Aprovar orçamento"
              rotuloEnviando="Aprovando…"
              confirmar="Aprovar o orçamento do terceirizado? A OS poderá ser concluída com este valor."
            >
              <input type="hidden" name="ordem_id" value={ordemId} />
            </FormAcao>
          )}
        </div>
      )}
      {orcamento.aprovadoEm && (
        <p className={aviso.ok}>
          Orçamento aprovado em {formatarDataHora(orcamento.aprovadoEm)}.
        </p>
      )}

      {link ? (
        <Situacao link={link} />
      ) : (
        <p className="text-sm text-neutral-500">
          A OS ainda não foi enviada ao terceirizado. Envie o link: ele vê a OS
          no celular, aceita, marca a chegada e o término e manda fotos.
        </p>
      )}

      {cobranca && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 ${cobranca.atrasado ? aviso.erro : cobranca.vencendo ? aviso.atencao : aviso.neutro}`}
        >
          <span>
            {cobranca.atrasado ? "Retorno atrasado" : "Retorno combinado até"}{" "}
            <strong className="font-semibold">{cobranca.prazo}</strong>
          </span>
          <a
            href={cobranca.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className={`${botao.secundario} px-3 py-1.5`}
          >
            <MessageCircle className="size-4" aria-hidden />
            Cobrar pelo WhatsApp
          </a>
        </div>
      )}

      {link && (link.solucao || link.valor_informado !== null) && (
        <Informado
          ordemId={ordemId}
          link={link}
          podeEditar={podeEditar}
          comCustos={comCustos}
          solucaoAtual={solucaoAtual}
        />
      )}

      {podeEnviar && (
        <Enviar
          ordemId={ordemId}
          telefones={telefones}
          reenviar={!!link?.ativo && link.etapa !== "recusado"}
        />
      )}

      {podeEnviar && link?.ativo && (
        <FormAcao
          acao={cancelarLinkTerceirizado}
          rotulo="Cancelar link"
          rotuloEnviando="Cancelando…"
          variante="perigo"
          confirmar="Cancelar o link do terceirizado? Ele deixa de abrir a OS."
        >
          <input type="hidden" name="ordem_id" value={ordemId} />
        </FormAcao>
      )}
    </div>
  );
}

function Situacao({ link }: { link: LinkNaTela }) {
  const [copiado, setCopiado] = useState(false);
  const passos: [string, string | null, Localizacao | null][] = [
    ["Enviado", link.criado_em, null],
    ["Aceito", link.aceito_em, null],
    ["Chegou", link.chegada_em, link.chegada_local],
    ["Terminou", link.terminado_em ?? link.saida_em, link.saida_local],
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${COR_ETAPA[link.etapa]}`}
        >
          {ETAPAS_TERCEIRIZADO[link.etapa]}
        </span>
        {link.ultimo_acesso_em && (
          <span className="text-xs text-neutral-500">
            Último acesso ao link: {formatarDataHora(link.ultimo_acesso_em)}
          </span>
        )}
      </div>
      {link.etapa === "recusado" && (
        <p className={aviso.erro}>
          Recusou{link.recusa_motivo ? `: ${link.recusa_motivo}` : "."} Escolha
          outra empresa e envie de novo.
        </p>
      )}
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {passos.map(([nome, quando, local]) => (
          <li
            key={nome}
            className={`rounded-2xl px-3 py-2 text-xs ${quando ? "bg-green-50 text-green-700" : "bg-neutral-900/[0.04] text-neutral-500"}`}
          >
            <span className="flex items-center gap-1 font-medium">
              {quando && <Check className="size-3.5" aria-hidden />}
              {nome}
            </span>
            <span className="tabular-nums">
              {quando ? formatarDataHora(quando) : "—"}
            </span>
            {local && (
              <a
                href={mapa(local)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 flex items-center gap-1 underline underline-offset-2"
              >
                <MapPin className="size-3" aria-hidden />
                Ver no mapa
              </a>
            )}
          </li>
        ))}
      </ol>
      {link.ativo && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(link.url);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            }}
            className={`${botao.secundario} px-3 py-1.5`}
          >
            {copiado ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copiado ? "Copiado" : "Copiar link"}
          </button>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${botao.secundario} px-3 py-1.5`}
          >
            <ExternalLink className="size-4" aria-hidden />
            Ver como o terceirizado
          </a>
        </div>
      )}
    </div>
  );
}

function Informado({
  ordemId,
  link,
  podeEditar,
  comCustos,
  solucaoAtual,
}: {
  ordemId: string;
  link: LinkNaTela;
  podeEditar: boolean;
  comCustos: boolean;
  solucaoAtual: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-neutral-900/[0.03] p-3">
      <p className="text-xs font-medium text-neutral-600">
        Informado pelo terceirizado
      </p>
      {link.solucao && (
        <div className="flex flex-col gap-2">
          <p className="whitespace-pre-wrap text-sm">{link.solucao}</p>
          {podeEditar && link.solucao !== solucaoAtual && (
            <FormAcao
              acao={usarDoTerceirizado}
              rotulo="Usar como solução da OS"
              rotuloEnviando="Salvando…"
              variante="secundario"
            >
              <input type="hidden" name="ordem_id" value={ordemId} />
              <input type="hidden" name="campo" value="solucao" />
            </FormAcao>
          )}
        </div>
      )}
      {comCustos && link.valor_informado !== null && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            Valor: <strong>{formatarMoeda(link.valor_informado)}</strong>
            {link.orcamento_numero &&
              ` · orçamento/nota ${link.orcamento_numero}`}
          </p>
          {podeEditar && (
            <FormAcao
              acao={usarDoTerceirizado}
              rotulo="Usar este valor na OS"
              rotuloEnviando="Salvando…"
              variante="secundario"
            >
              <input type="hidden" name="ordem_id" value={ordemId} />
              <input type="hidden" name="campo" value="valor" />
            </FormAcao>
          )}
        </div>
      )}
    </div>
  );
}

function Enviar({
  ordemId,
  telefones,
  reenviar,
}: {
  ordemId: string;
  telefones: Opcao[];
  reenviar: boolean;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoOS, FormData>(
    enviarAoTerceirizado,
    {},
  );
  const [escolhido, setEscolhido] = useState(telefones[0]?.valor ?? "");
  const [digitado, setDigitado] = useState("");
  const outro = escolhido === "";

  // Link pronto: abre o WhatsApp numa aba nova (e deixa o botão, se o
  // navegador bloquear a janela).
  useEffect(() => {
    if (estado.whatsapp) window.open(estado.whatsapp, "_blank", "noopener");
  }, [estado]);

  return (
    <form
      action={enviar}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-3"
    >
      <input type="hidden" name="ordem_id" value={ordemId} />
      <input
        type="hidden"
        name="telefone"
        value={outro ? digitado : escolhido}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={rotulo}>
          Enviar para
          <Selecao
            rotulo="Enviar para"
            valor={escolhido}
            aoMudar={setEscolhido}
            opcoes={[
              ...telefones,
              { valor: "", rotulo: "Digitar outro número" },
            ]}
          />
        </label>
        {outro && (
          <label className={rotulo}>
            WhatsApp (com DDD)
            <input
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              inputMode="tel"
              placeholder="(22) 99999-0000"
              className={classeCampo}
            />
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className={botao.primario}>
          <Send className="size-4" aria-hidden />
          {enviando
            ? "Gerando…"
            : reenviar
              ? "Reenviar pelo WhatsApp"
              : "Enviar ao terceirizado"}
        </button>
        {estado.whatsapp && (
          <a
            href={estado.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 underline underline-offset-4"
          >
            <MessageCircle className="size-4" aria-hidden />
            Abrir o WhatsApp
          </a>
        )}
        {estado.erro && (
          <span role="alert" className="text-xs text-red-700">
            {estado.erro}
          </span>
        )}
      </div>
    </form>
  );
}
