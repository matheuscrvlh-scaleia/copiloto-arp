import { formatarNumero } from "@arp/shared/formato";
import type { Decisao } from "@arp/shared/sustentabilidade/importacao/index";
import { ROTA_IMPORTACOES_SU } from "@arp/shared/sustentabilidade/importacao-historico";
import {
  type Escolhas,
  MOTIVO_MINIMO,
  PULAR,
  SEPARADOS,
} from "@arp/shared/sustentabilidade/importacao-linhas";
import { CircleCheck, Link2, Merge, PenLine } from "lucide-react";
import { useState, useTransition } from "react";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import { Selecao } from "@/components/selecao";
import { useRouter } from "@/lib/navegacao";
import {
  confirmarImportacaoSu,
  salvarEscolhasImportacao,
} from "../../api-config";

// Passos 2 e 3 da prévia (spec 4.10): o programa e o formulário que recebem
// os lançamentos, as decisões (vincular o contrato, unificar nomes,
// confirmar com motivo) e o "Confirmar". Cada escolha é gravada na hora; a
// página se refaz com a prévia nova.

const botao =
  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export interface PropsDecisoes {
  id: string;
  editavel: boolean;
  decisoes: Decisao[];
  escolhas: Escolhas;
  pendentes: string[];
  destino: {
    programas: { id: string; nome: string }[];
    formularios: { id: string; nome: string; programa_id: string }[];
    programa_id: string | null;
    formulario_id: string | null;
  } | null;
  contratos: { id: string; rotulo: string }[];
  bloqueio: string | null;
  /** "20 entrevistas" que entram ao confirmar. */
  entram: string;
}

export function DecisoesDaPrevia(p: PropsDecisoes) {
  const router = useRouter();
  const [escolhas, setEscolhas] = useState<Escolhas>(p.escolhas);
  const [rodando, iniciar] = useTransition();

  const salvar = (nova: Escolhas) => {
    setEscolhas(nova);
    iniciar(async () => {
      const r = await salvarEscolhasImportacao({ id: p.id, escolhas: nova });
      if (r.erro) notificar("erro", r.erro);
    });
  };

  const confirmar = () =>
    iniciar(async () => {
      const r = await confirmarImportacaoSu({ id: p.id });
      if (r.erro) return notificar("erro", r.erro);
      if (r.ok) notificar("ok", r.ok);
      router.push(ROTA_IMPORTACOES_SU);
    });

  const pendentes = new Set(p.pendentes);
  const d = p.destino;
  return (
    <div className="flex flex-col gap-6">
      {d && (
        <fieldset
          data-guia="su-importacoes-destino"
          disabled={!p.editavel || rodando}
          className="grid gap-4 sm:grid-cols-2"
        >
          <legend className="sr-only">Para onde os lançamentos vão</legend>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-neutral-600">
              Programa
            </span>
            <Selecao
              rotulo="Programa"
              valor={d.programa_id ?? ""}
              placeholder="Escolha o programa"
              desabilitada={!p.editavel || rodando}
              aoMudar={(v) =>
                salvar({
                  ...escolhas,
                  programa_id: v,
                  formulario_id: undefined,
                })
              }
              opcoes={d.programas.map((x) => ({ valor: x.id, rotulo: x.nome }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-neutral-600">
              Formulário (versão publicada)
            </span>
            <Selecao
              rotulo="Formulário"
              valor={d.formulario_id ?? ""}
              placeholder="Escolha o formulário"
              desabilitada={!p.editavel || rodando || !d.programa_id}
              aoMudar={(v) =>
                salvar({
                  ...escolhas,
                  programa_id: d.programa_id ?? undefined,
                  formulario_id: v,
                })
              }
              opcoes={d.formularios
                .filter((f) => f.programa_id === d.programa_id)
                .map((f) => ({ valor: f.id, rotulo: f.nome }))}
            />
          </div>
        </fieldset>
      )}

      {p.decisoes.length > 0 && (
        <section
          data-guia="su-importacoes-decisoes"
          aria-labelledby="titulo-decisoes"
          className="flex flex-col gap-3"
        >
          <h3 id="titulo-decisoes" className="text-sm font-semibold">
            Decisões ({formatarNumero(p.decisoes.length)}
            {pendentes.size
              ? `, ${formatarNumero(pendentes.size)} sem resposta`
              : ", todas respondidas"}
            )
          </h3>
          <ul className="flex flex-col gap-3">
            {p.decisoes.map((dec) => (
              <li
                key={dec.id}
                className={`rounded-2xl border p-3 ${pendentes.has(dec.id) ? "border-amber-300 bg-amber-50/60" : "border-neutral-200 bg-white/60"}`}
              >
                <UmaDecisao
                  d={dec}
                  escolhas={escolhas}
                  contratos={p.contratos}
                  desabilitada={!p.editavel || rodando}
                  aoEscolher={salvar}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.editavel ? (
        <div className="flex flex-col gap-2">
          {(p.bloqueio || pendentes.size > 0) && (
            <p className="text-sm text-amber-800">
              {p.bloqueio ??
                `Responda ${pendentes.size === 1 ? "a decisão marcada" : `as ${formatarNumero(pendentes.size)} decisões marcadas`} para confirmar.`}
            </p>
          )}
          <div>
            <button
              type="button"
              data-guia="su-importacoes-confirmar"
              onClick={confirmar}
              disabled={rodando || pendentes.size > 0 || Boolean(p.bloqueio)}
              className={`${botao} bg-neutral-900 text-white hover:bg-neutral-800`}
            >
              <CircleCheck className="size-4" aria-hidden />
              {rodando ? "Um instante…" : `Confirmar: entram ${p.entram}`}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-600">
          Só quem enviou o arquivo responde as decisões e confirma esta prévia.
        </p>
      )}
    </div>
  );
}

function UmaDecisao({
  d,
  escolhas,
  contratos,
  desabilitada,
  aoEscolher,
}: {
  d: Decisao;
  escolhas: Escolhas;
  contratos: { id: string; rotulo: string }[];
  desabilitada: boolean;
  aoEscolher: (e: Escolhas) => void;
}) {
  if (d.tipo === "vincular_contrato") {
    const atual = escolhas.vinculos[d.id] ?? "";
    const escolher = (v: string) =>
      aoEscolher({
        ...escolhas,
        vinculos: { ...escolhas.vinculos, [d.id]: v },
      });
    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-start gap-2 text-sm">
          <Link2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          {d.mensagem}
        </p>
        {d.sugestoes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {d.sugestoes.map((s) => (
              <button
                key={s.contrato_id}
                type="button"
                disabled={desabilitada}
                aria-pressed={atual === s.contrato_id}
                onClick={() => escolher(s.contrato_id)}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs hover:border-neutral-400 aria-pressed:border-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white"
              >
                {s.cliente_nome} · {s.motivo}
              </button>
            ))}
          </div>
        )}
        <div className="max-w-xl">
          <Selecao
            rotulo={`Contrato da linha ${d.linha}`}
            valor={atual}
            placeholder="Buscar o contrato…"
            busca
            desabilitada={desabilitada}
            aoMudar={escolher}
            opcoes={[
              { valor: PULAR, rotulo: "Não importar esta linha" },
              ...contratos.map((c) => ({ valor: c.id, rotulo: c.rotulo })),
            ]}
          />
        </div>
      </div>
    );
  }
  if (d.tipo === "unificar_nomes") {
    const atual = escolhas.nomes[d.id] ?? "";
    const escolher = (v: string) =>
      aoEscolher({ ...escolhas, nomes: { ...escolhas.nomes, [d.id]: v } });
    return (
      <fieldset className="flex flex-col gap-2" disabled={desabilitada}>
        <legend className="flex items-start gap-2 text-sm">
          <Merge className="mt-0.5 size-4 shrink-0" aria-hidden />
          {d.mensagem}
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {d.nomes.map((n) => (
            <label key={n.nome} className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name={d.id}
                checked={atual === n.nome}
                onChange={() => escolher(n.nome)}
              />
              Unificar como &ldquo;{n.nome}&rdquo; (
              {formatarNumero(n.ocorrencias)})
            </label>
          ))}
          <label className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              name={d.id}
              checked={atual === SEPARADOS}
              onChange={() => escolher(SEPARADOS)}
            />
            Manter separados
          </label>
        </div>
      </fieldset>
    );
  }
  return (
    <Motivo
      d={d}
      inicial={escolhas.motivos[d.id] ?? ""}
      desabilitada={desabilitada}
      aoGuardar={(m) =>
        aoEscolher({ ...escolhas, motivos: { ...escolhas.motivos, [d.id]: m } })
      }
    />
  );
}

function Motivo({
  d,
  inicial,
  desabilitada,
  aoGuardar,
}: {
  d: Extract<Decisao, { tipo: "confirmar_motivo" }>;
  inicial: string;
  desabilitada: boolean;
  aoGuardar: (m: string) => void;
}) {
  const [texto, setTexto] = useState(inicial);
  const valido = texto.trim().length >= MOTIVO_MINIMO;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-start gap-2 text-sm">
        <PenLine className="mt-0.5 size-4 shrink-0" aria-hidden />
        {d.mensagem}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          aria-label={`Motivo (${d.lido} lidas × ${d.escrito} escritas)`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          maxLength={500}
          disabled={desabilitada}
          placeholder="Ex.: uma ativação foi cancelada e o total não foi corrigido."
          className={`${classeCampo} flex-1`}
        />
        <button
          type="button"
          disabled={desabilitada || !valido || texto.trim() === inicial.trim()}
          onClick={() => aoGuardar(texto.trim())}
          className={`${botao} border border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400`}
        >
          Guardar motivo
        </button>
      </div>
    </div>
  );
}
