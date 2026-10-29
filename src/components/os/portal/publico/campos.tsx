"use client";

import { Camera, Paperclip, Pencil, Star, UserRound } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { classeCampo } from "@/components/estilos";
import {
  ACEITA_ARQUIVOS,
  type DiaDaEscolha,
  LIMITES_PORTAL,
} from "@/lib/os/portal";
import { mascaraTelefone } from "@/lib/os/whatsapp";
import { lerQuemPede, type QuemPede } from "./envio";

// Peças dos formulários do portal: quem está pedindo (lembrado no
// aparelho), arquivos, escolha de horário, estrelas e o botão de enviar.
// Feitas para o dedo: alvos grandes, texto de 16 px (o iPhone não dá zoom).

export const CAMPO = `${classeCampo} py-3 text-base`;

/** Limite de cada envio em MB, para avisar no formulário. */
const MB = LIMITES_PORTAL.tamanhoEnvio / 1024 / 1024;

export function Rotulo({
  htmlFor,
  children,
  obrigatorio = false,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  obrigatorio?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-medium text-neutral-800"
    >
      {children}
      {obrigatorio && (
        <span className="text-red-700" aria-hidden>
          {" "}
          *
        </span>
      )}
    </label>
  );
}

/**
 * Nome e telefone de quem pede, obrigatórios em tudo. Já lembrados neste
 * aparelho, aparecem numa linha com "Alterar".
 */
export function QuemPedeCampos() {
  const id = useId();
  const [quem, setQuem] = useState<QuemPede>({ nome: "", telefone: "" });
  const [editando, setEditando] = useState(true);

  // Lê depois de montar: o servidor não conhece o armazenamento do aparelho.
  useEffect(() => {
    const salvo = lerQuemPede();
    if (salvo) {
      setQuem(salvo);
      setEditando(false);
    }
  }, []);

  if (!editando)
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-white/60 px-4 py-3 text-sm">
        <UserRound className="size-5 shrink-0 text-neutral-500" aria-hidden />
        <p className="min-w-0 flex-1">
          <span className="block text-xs text-neutral-500">Pedindo como</span>
          <span className="block truncate font-medium">
            {quem.nome} · {quem.telefone}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-white"
        >
          <Pencil className="size-3.5" aria-hidden />
          Alterar
        </button>
        <input type="hidden" name="nome" value={quem.nome} />
        <input type="hidden" name="telefone" value={quem.telefone} />
      </div>
    );

  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="mb-2 text-sm text-neutral-500">
        Quem está pedindo? A equipe usa para falar com você.
      </legend>
      <div>
        <Rotulo htmlFor={`${id}-nome`} obrigatorio>
          Seu nome
        </Rotulo>
        <input
          id={`${id}-nome`}
          name="nome"
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          value={quem.nome}
          onChange={(e) => setQuem({ ...quem, nome: e.target.value })}
          className={CAMPO}
        />
      </div>
      <div>
        <Rotulo htmlFor={`${id}-tel`} obrigatorio>
          Telefone (WhatsApp)
        </Rotulo>
        <input
          id={`${id}-tel`}
          name="telefone"
          type="tel"
          inputMode="tel"
          required
          autoComplete="tel"
          placeholder="+55 (22) 99999-0000"
          maxLength={19}
          value={quem.telefone}
          onChange={(e) =>
            setQuem({ ...quem, telefone: mascaraTelefone(e.target.value) })
          }
          className={CAMPO}
        />
      </div>
    </fieldset>
  );
}

/** Escolha de fotos ou arquivos, com a lista do que foi escolhido. */
export function CampoArquivos({
  name,
  rotulo,
  apenasFotos = false,
  obrigatorio = false,
  multiplos = true,
}: {
  name: string;
  rotulo: string;
  apenasFotos?: boolean;
  obrigatorio?: boolean;
  multiplos?: boolean;
}) {
  const id = useId();
  const [nomes, setNomes] = useState<string[]>([]);
  const Icone = apenasFotos ? Camera : Paperclip;
  return (
    <div>
      <Rotulo htmlFor={id} obrigatorio={obrigatorio}>
        {rotulo}
      </Rotulo>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-4 py-4 text-sm text-neutral-600 transition hover:border-neutral-500 focus-within:border-neutral-900 focus-within:ring-4 focus-within:ring-neutral-900/5"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-marca/20 text-marca-escuro">
          <Icone className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          {nomes.length ? (
            <span className="block truncate font-medium text-neutral-900">
              {nomes.length === 1 ? nomes[0] : `${nomes.length} arquivos`}
            </span>
          ) : (
            <span className="block font-medium text-neutral-900">
              {apenasFotos ? "Tirar ou escolher foto" : "Escolher arquivo"}
            </span>
          )}
          <span className="block text-xs text-neutral-500">
            {apenasFotos
              ? "As fotos são reduzidas antes de enviar."
              : `Foto, PDF, planta (DWG/DXF), Word, Excel ou ZIP. Até ${MB} MB no total por envio.`}
          </span>
        </span>
        <input
          id={id}
          name={name}
          type="file"
          multiple={multiplos}
          required={obrigatorio}
          accept={apenasFotos ? "image/*" : ACEITA_ARQUIVOS}
          onChange={(e) =>
            setNomes([...(e.target.files ?? [])].map((f) => f.name))
          }
          className="sr-only"
        />
      </label>
    </div>
  );
}

/**
 * Dias com horário livre em pílulas e os horários do dia escolhido. Grava
 * o início escolhido (ISO) no campo `name`.
 */
export function EscolhaHorario({
  dias,
  name = "horario",
}: {
  dias: DiaDaEscolha[];
  name?: string;
}) {
  const [dia, setDia] = useState(dias[0]?.data ?? "");
  const [horario, setHorario] = useState("");
  const id = useId();
  if (!dias.length)
    return (
      <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Não há horário livre nos próximos dias. Tente de novo mais tarde ou fale
        com a administração.
      </p>
    );
  const doDia = dias.find((d) => d.data === dia) ?? dias[0];
  return (
    // min-w-0: o fieldset cresce até o conteúdo e a fileira de dias o
    // empurrava para fora do cartão.
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium text-neutral-800">
        Escolha o dia e o horário
        <span className="text-red-700" aria-hidden>
          {" "}
          *
        </span>
      </legend>
      <div
        role="radiogroup"
        aria-label="Dia"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sm:flex-wrap sm:overflow-visible"
      >
        {dias.map((d) => (
          <label
            key={d.data}
            className="shrink-0 cursor-pointer rounded-2xl border border-neutral-200 bg-white/70 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 has-checked:border-neutral-900 has-checked:bg-neutral-900 has-checked:text-white has-focus-visible:ring-4 has-focus-visible:ring-neutral-900/10"
          >
            <input
              type="radio"
              name={`${id}-d`}
              value={d.data}
              checked={d.data === doDia?.data}
              onChange={() => {
                setDia(d.data);
                setHorario("");
              }}
              className="sr-only"
            />
            {d.rotulo}
          </label>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {doDia?.horarios.map((h) => (
          <label
            key={h.valor}
            className="cursor-pointer rounded-2xl border border-neutral-200 bg-white/70 py-3 text-center text-base font-medium tabular-nums transition hover:border-neutral-400 has-checked:border-marca-escuro has-checked:bg-marca/25 has-focus-visible:ring-4 has-focus-visible:ring-neutral-900/10"
          >
            <input
              type="radio"
              name={`${id}-h`}
              value={h.valor}
              checked={horario === h.valor}
              onChange={() => setHorario(h.valor)}
              className="sr-only"
            />
            {h.rotulo}
          </label>
        ))}
      </div>
      {/* Campo do formulário: obrigatório, avisa no lugar certo. */}
      <input
        name={name}
        value={horario}
        required
        onChange={() => {}}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none h-0 w-full opacity-0"
      />
    </fieldset>
  );
}

/** Nota de 1 a 5 em estrelas (rádios acessíveis pelo teclado). */
export function Estrelas({ name = "nota" }: { name?: string }) {
  const [nota, setNota] = useState(0);
  const rotulos = ["Muito ruim", "Ruim", "Regular", "Bom", "Ótimo"];
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-neutral-800">
        Como foi o atendimento?
      </legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="cursor-pointer rounded-full p-1 has-focus-visible:ring-4 has-focus-visible:ring-neutral-900/10"
          >
            <input
              type="radio"
              name={name}
              value={n}
              required
              checked={nota === n}
              onChange={() => setNota(n)}
              className="sr-only"
            />
            <Star
              aria-hidden
              className={`size-9 transition ${n <= nota ? "fill-[#fab219] text-[#e09a00]" : "text-neutral-300"}`}
            />
            <span className="sr-only">
              {n} — {rotulos[n - 1]}
            </span>
          </label>
        ))}
        <span className="ml-2 text-sm text-neutral-600" aria-live="polite">
          {nota ? rotulos[nota - 1] : ""}
        </span>
      </div>
    </fieldset>
  );
}

/** Botão grande de enviar e a mensagem de retorno. */
export function BotaoEnviar({
  enviando,
  erro,
  ok,
  rotulo,
  rotuloEnviando = "Enviando…",
}: {
  enviando: boolean;
  erro?: string;
  ok?: string;
  rotulo: string;
  rotuloEnviando?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {erro && (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {erro}
        </p>
      )}
      {ok && !enviando && (
        <output className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
          {ok}
        </output>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-full bg-neutral-900 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60"
      >
        {enviando ? rotuloEnviando : rotulo}
      </button>
    </div>
  );
}
