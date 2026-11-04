"use client";

import { Plus, Send, TriangleAlert } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { notificar } from "@/components/notificacoes";
import {
  type DocumentoExigido,
  LUC_NAO_SEI,
  MAXIMO_SOCIOS,
  type Problema,
  pessoaVazia,
  type RespostasFicha,
  ROTULO_TIPO,
  TIPOS_FICHA,
  type TipoFicha,
} from "@/lib/comercial/ficha";
import { salvarFichaPeloLink } from "@/server/comercial/acoes/ficha-publica";
import { Erro, Escolha, Secao, Texto } from "./campos";
import { type Caminho, Ctx, com, idDo } from "./contexto";
import { type DocumentoEnviado, Documentos } from "./documentos";
import { Empresa, Pessoa, Renda } from "./perguntas";

// A ficha cadastral que o interessado preenche pelo link (spec 4.12): as 48
// perguntas na ordem do Forms, com os saltos (PJ → empresa e sócios; casado
// ou união estável → cônjuge), celular primeiro. As respostas ficam aqui
// até "Salvar e continuar depois" ou "Enviar ficha"; os documentos sobem na
// hora. CEP e CNPJ preenchem campos; se a consulta falhar, a pessoa digita.

// ---------------------------------------------------------------------------
// A ficha
// ---------------------------------------------------------------------------

export function FormularioFicha({
  token,
  inicial,
  boasVindas,
  termoLgpd,
  documentos,
  enviados: enviadosIniciais,
  lucs,
  lucDoLink,
  hoje,
}: {
  /** null = demonstração (nada é gravado). */
  token: string | null;
  inicial: RespostasFicha;
  boasVindas: string;
  termoLgpd: string;
  documentos: Record<TipoFicha, DocumentoExigido[]>;
  enviados: DocumentoEnviado[];
  lucs: { valor: string; rotulo: string }[];
  lucDoLink: string | null;
  hoje: string;
}) {
  const [r, setR] = useState(inicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [enviados, setEnviados] = useState(enviadosIniciais);
  const [fim, setFim] = useState<"enviada" | string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const topo = useRef<HTMLDivElement>(null);

  const definir = (caminho: Caminho, valor: unknown) => {
    setR((atual) => com(atual, caminho.split("."), valor));
    setErros((e) => {
      if (!(caminho in e)) return e;
      const { [caminho]: _, ...resto } = e;
      return resto;
    });
  };

  function gravar(acao: "salvar" | "enviar", confirmar = false) {
    if (!token) {
      notificar(
        "info",
        "Demonstração: é assim que o interessado vê. Nada é gravado.",
      );
      return;
    }
    const f = new FormData();
    f.set("token", token);
    f.set("acao", acao);
    f.set("respostas", JSON.stringify(r));
    if (confirmar) f.set("confirmar", "1");
    iniciar(async () => {
      try {
        const res = await salvarFichaPeloLink({}, f);
        setProblemas(res.problemas ?? []);
        setErros(
          Object.fromEntries(
            (res.problemas ?? []).map((p) => [p.campo, p.mensagem]),
          ),
        );
        setAvisos(res.avisos ?? []);
        if (res.inativo) setFim(res.erro ?? "Este link não está mais ativo.");
        else if (res.enviada) setFim("enviada");
        if (res.ok) notificar("ok", res.ok);
        if (res.erro && !res.inativo) notificar("erro", res.erro);
        if (res.enviada || res.inativo)
          topo.current?.scrollIntoView({ behavior: "smooth" });
        const primeiro = res.problemas?.[0];
        if (primeiro)
          document
            .getElementById(idDo(primeiro.campo))
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        notificar(
          "erro",
          "Não deu para salvar agora. Confira a internet e tente de novo.",
        );
      }
    });
  }

  if (fim)
    return (
      <div
        ref={topo}
        className="vidro flex flex-col items-center gap-4 rounded-[1.75rem] px-6 py-12 text-center"
      >
        <span className="grid size-16 place-items-center rounded-full bg-neutral-900 text-white">
          <Send className="size-7" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold">
          {fim === "enviada"
            ? "Ficha enviada. Obrigado!"
            : "Este link não está mais ativo"}
        </h1>
        <p className="max-w-sm text-sm text-neutral-600">
          {fim === "enviada"
            ? "A equipe da ARP recebeu os seus dados e os documentos e entra em contato para os próximos passos."
            : fim}
        </p>
      </div>
    );

  const tipo = r.tipo || null;
  const pj = tipo === "pj";
  const opcoesLuc = [{ valor: LUC_NAO_SEI, rotulo: "Ainda não sei" }, ...lucs];

  return (
    <Ctx value={{ r, definir, erros, hoje, token }}>
      <div ref={topo} className="flex flex-col gap-4">
        <section className="destaque flex flex-col gap-3 rounded-[1.75rem] p-5">
          <p className="text-xs font-medium tracking-[0.14em] text-[rgb(255_255_255/0.6)] uppercase">
            Espaço ARP · Ficha cadastral
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Formulário cadastral
          </h1>
          <p className="text-sm whitespace-pre-wrap">{boasVindas}</p>
        </section>

        <Secao
          titulo="Para começar"
          descricao="Os campos com * são obrigatórios."
        >
          <Texto n={1} rotulo="E-mail" caminho="email" email max={160} />
          <div id={idDo("aceite")} className="flex flex-col gap-1.5">
            <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
              <input
                type="checkbox"
                checked={r.aceite}
                onChange={(e) => definir("aceite", e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-neutral-900"
              />
              <span>
                <b>2. </b>
                {termoLgpd}
                <span className="text-red-600"> *</span>
              </span>
            </label>
            <Erro caminho="aceite" />
          </div>
        </Secao>

        {!r.aceite ? (
          <p className="vidro rounded-[1.75rem] p-5 text-sm text-neutral-600">
            Marque o aceite do termo da LGPD (pergunta 2) para continuar a
            ficha.
          </p>
        ) : (
          <>
            <Secao titulo="Tipo de formulário e imóvel">
              <Escolha
                n={3}
                rotulo="Imóvel pretendido (bloco e nº da unidade)"
                caminho="luc"
                opcoes={opcoesLuc}
                dica={
                  lucDoLink && r.luc === lucDoLink
                    ? "Veio preenchido pelo link."
                    : undefined
                }
              />
              <fieldset id={idDo("tipo")} className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-neutral-800">
                  <span className="text-neutral-400">4. </span>Que tipo de
                  formulário você seguirá?
                  <span className="text-red-600"> *</span>
                </legend>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {TIPOS_FICHA.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={r.tipo === t}
                      onClick={() => definir("tipo", t)}
                      className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 aria-pressed:border-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white"
                    >
                      {ROTULO_TIPO[t]}
                    </button>
                  ))}
                </div>
                <Erro caminho="tipo" />
              </fieldset>
            </Secao>

            {pj && <Empresa />}
            {tipo &&
              (pj ? r.pessoas : r.pessoas.slice(0, 1)).map((_, i) => (
                <Pessoa
                  // biome-ignore lint/suspicious/noArrayIndexKey: a posição é o sócio
                  key={i}
                  i={i}
                  titulo={
                    pj
                      ? r.pessoas.length > 1
                        ? `Sócio administrador ${i + 1}`
                        : "Sócio administrador"
                      : tipo === "fiador"
                        ? "Dados cadastrais — fiador(a)"
                        : "Dados cadastrais — pessoa física"
                  }
                  remover={
                    pj && i > 0
                      ? () =>
                          definir(
                            "pessoas",
                            r.pessoas.filter((__, j) => j !== i),
                          )
                      : undefined
                  }
                />
              ))}
            {pj && r.pessoas.length < MAXIMO_SOCIOS && (
              <button
                type="button"
                onClick={() =>
                  definir("pessoas", [...r.pessoas, pessoaVazia()])
                }
                className="vidro inline-flex items-center justify-center gap-2 rounded-[1.75rem] p-4 text-sm font-medium text-neutral-800 transition hover:bg-white/80"
              >
                <Plus className="size-4" aria-hidden />
                Adicionar outro sócio administrador
              </button>
            )}
            {tipo && <Renda />}
            {tipo && (
              <Documentos
                token={token}
                tipo={tipo}
                aceite={r.aceite}
                exigidos={documentos[tipo]}
                enviados={enviados}
                aoMudar={setEnviados}
              />
            )}
            {tipo && (
              <Secao titulo="Envio do formulário">
                <p className="text-sm text-neutral-600">
                  Ao preencher seu nome completo abaixo, você confirma a
                  veracidade das informações e o consentimento de uso de dados.
                </p>
                <Texto n={48} rotulo="Nome completo" caminho="assinatura" />
              </Secao>
            )}
          </>
        )}

        {problemas.length > 0 && (
          <div
            role="alert"
            className="rounded-[1.75rem] bg-red-500/[0.08] p-5 text-sm text-red-800"
          >
            <p className="font-medium">Falta responder ou corrigir:</p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              {problemas.slice(0, 12).map((p) => (
                <li key={p.campo}>
                  <a
                    href={`#${idDo(p.campo)}`}
                    className="underline underline-offset-2"
                  >
                    {p.pergunta ? `${p.pergunta}. ` : ""}
                    {p.mensagem}
                  </a>
                </li>
              ))}
              {problemas.length > 12 && (
                <li>e mais {problemas.length - 12}.</li>
              )}
            </ul>
          </div>
        )}

        {avisos.length > 0 && (
          <div className="flex flex-col gap-3 rounded-[1.75rem] bg-amber-400/15 p-5 text-sm text-amber-900">
            {avisos.map((a) => (
              <p key={a} className="flex gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {a}
              </p>
            ))}
            <button
              type="button"
              disabled={ocupado}
              onClick={() => gravar("enviar", true)}
              className="self-start rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Está certo, enviar assim
            </button>
          </div>
        )}

        <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-2 rounded-[1.75rem] border border-neutral-900/[0.06] bg-white/85 p-3 backdrop-blur sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={ocupado || !r.aceite}
            onClick={() => gravar("salvar")}
            className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60"
          >
            Salvar e continuar depois
          </button>
          <button
            type="button"
            disabled={ocupado || !r.aceite || !tipo}
            onClick={() => gravar("enviar")}
            className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {ocupado ? "Enviando…" : "Enviar ficha"}
          </button>
        </div>
      </div>
    </Ctx>
  );
}
