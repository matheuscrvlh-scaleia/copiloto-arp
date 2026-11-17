import { formatarNumero } from "@arp/shared/formato";
import type {
  FormularioDoPrograma,
  RespostaFormulario,
} from "@arp/shared/sustentabilidade/contratos/formularios";
import {
  Copy,
  FilePen,
  Loader,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import { useId, useState, useTransition } from "react";
import { classeCampo } from "@/components/estilos";
import { ModalConfirmacao } from "@/components/modal-confirmacao";
import { notificar } from "@/components/notificacoes";
import { Link, useRouter } from "@/lib/navegacao";
import { Dialogo } from "@/modules/calendario/components/dialogo";
import {
  alternarFormularioAtivo,
  criarFormularioDePrograma,
  duplicarFormulario,
  excluirFormulario,
  renomearFormulario,
} from "../../api-programas";

// Aba "Formulário" do programa (spec 4.8): lista dos formulários do
// programa com versão, campos ativos, lançamentos e situação, e as ações
// novo, abrir no editor, renomear, duplicar, inativar/reativar e excluir
// (só sem lançamentos). Os campos são montados no editor do questionário
// (4.13), aberto abaixo da lista.

const PEQUENO =
  "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-50";

type Resposta = RespostaFormulario;

export function FormulariosDoPrograma({
  programaId,
  formularios,
  selecionado,
  base,
}: {
  programaId: string;
  formularios: FormularioDoPrograma[];
  selecionado: string | null;
  /** Endereço da aba (ex.: ".../programas/<id>?aba=formulario"). */
  base: string;
}) {
  const router = useRouter();
  const [nome, setNome] = useState<{
    modo: "novo" | "renomear";
    id?: string;
    atual: string;
  } | null>(null);
  const [confirmar, setConfirmar] = useState<{
    tipo: "excluir" | "inativar" | "semExcluir";
    f: FormularioDoPrograma;
  } | null>(null);
  const [erro, setErro] = useState<string>();
  const [enviando, iniciar] = useTransition();
  const idNome = useId();

  function rodar(
    acao: () => Promise<Resposta>,
    ok: string,
    depois?: (r: Resposta) => void,
  ) {
    iniciar(async () => {
      const r = await acao();
      if (r.erro) {
        if (confirmar) setErro(r.erro);
        else notificar("erro", r.erro);
        return;
      }
      notificar("ok", ok);
      setConfirmar(null);
      setNome(null);
      depois?.(r);
    });
  }

  const hrefDoEditor = (id: string) =>
    id ? `${base}&formulario=${encodeURIComponent(id)}` : base;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600">
          {formularios.length
            ? `${formatarNumero(formularios.length)} ${formularios.length === 1 ? "formulário" : "formulários"} neste programa.`
            : "Nenhum formulário ainda: crie o primeiro e monte os campos no editor."}
        </p>
        <button
          type="button"
          data-guia="novo-formulario"
          onClick={() => setNome({ modo: "novo", atual: "" })}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          <Plus className="size-4" aria-hidden />
          Novo formulário
        </button>
      </div>

      {formularios.length > 0 && (
        <div className="overflow-x-auto">
          <table
            data-guia="lista-formularios"
            className="w-full min-w-[44rem] text-sm"
          >
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="px-2 py-2 font-medium">Formulário</th>
                <th className="px-2 py-2 text-right font-medium">Versão</th>
                <th className="px-2 py-2 text-right font-medium">
                  Campos ativos
                </th>
                <th className="px-2 py-2 text-right font-medium">
                  Lançamentos
                </th>
                <th className="px-2 py-2 font-medium">Situação</th>
                <th className="px-2 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {formularios.map((f) => (
                <tr
                  key={f.id}
                  aria-current={f.id === selecionado ? "true" : undefined}
                  className="border-t border-neutral-900/5 aria-[current=true]:bg-white/70"
                >
                  <td className="px-2 py-2.5 font-medium">
                    <Link
                      href={hrefDoEditor(f.id)}
                      scroll={false}
                      className="hover:underline"
                    >
                      {f.nome}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {f.versao_publicada
                      ? `v${f.versao_publicada}`
                      : "sem versão"}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {formatarNumero(f.campos_ativos)}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {formatarNumero(f.lancamentos)}
                  </td>
                  <td className="px-2 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.ativo ? "bg-green-400/20 text-green-800" : "bg-neutral-500/15 text-neutral-600"}`}
                    >
                      {f.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      <Link
                        href={hrefDoEditor(f.id)}
                        scroll={false}
                        className={PEQUENO}
                      >
                        <FilePen className="size-3.5" aria-hidden />
                        Abrir no editor
                      </Link>
                      <button
                        type="button"
                        className={PEQUENO}
                        onClick={() =>
                          setNome({ modo: "renomear", id: f.id, atual: f.nome })
                        }
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Renomear
                      </button>
                      <button
                        type="button"
                        className={PEQUENO}
                        disabled={enviando}
                        onClick={() =>
                          rodar(
                            () => duplicarFormulario(f.id),
                            "Cópia criada como rascunho, sem versão e sem lançamentos.",
                            (r) => r.id && router.push(hrefDoEditor(r.id)),
                          )
                        }
                      >
                        <Copy className="size-3.5" aria-hidden />
                        Duplicar
                      </button>
                      <button
                        type="button"
                        className={PEQUENO}
                        disabled={enviando}
                        onClick={() => {
                          if (!f.ativo)
                            return rodar(
                              () => alternarFormularioAtivo(f.id, true),
                              "Formulário reativado.",
                            );
                          setErro(undefined);
                          setConfirmar({ tipo: "inativar", f });
                        }}
                      >
                        <Power className="size-3.5" aria-hidden />
                        {f.ativo ? "Inativar" : "Reativar"}
                      </button>
                      <button
                        type="button"
                        className={`${PEQUENO} text-red-700 hover:border-red-400`}
                        disabled={enviando}
                        title={
                          f.lancamentos
                            ? `Tem ${formatarNumero(f.lancamentos)} lançamentos: só pode ser inativado.`
                            : undefined
                        }
                        onClick={() => {
                          setErro(undefined);
                          setConfirmar({
                            tipo: f.lancamentos ? "semExcluir" : "excluir",
                            f,
                          });
                        }}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialogo
        aberto={nome !== null}
        aoFechar={() => setNome(null)}
        titulo={
          nome?.modo === "novo" ? "Novo formulário" : "Renomear formulário"
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const n = String(new FormData(e.currentTarget).get("nome") ?? "");
            if (!nome) return;
            if (nome.modo === "novo")
              rodar(
                () => criarFormularioDePrograma(programaId, n),
                "Formulário criado. Monte os campos e publique.",
                (r) => r.id && router.push(hrefDoEditor(r.id)),
              );
            else if (nome.id) {
              const id = nome.id;
              rodar(() => renomearFormulario(id, n), "Formulário renomeado.");
            }
          }}
        >
          <label htmlFor={idNome} className="text-sm font-medium">
            Nome
          </label>
          <input
            id={idNome}
            name="nome"
            required
            maxLength={120}
            defaultValue={nome?.atual}
            placeholder="Ex.: Feira de orgânicos"
            className={classeCampo}
          />
          {nome?.modo === "novo" && (
            <p className="text-xs text-neutral-500">
              Nasce sem versão; ganha a versão 1 ao publicar e só então aparece
              no link do parceiro.
            </p>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {enviando && <Loader className="size-4 animate-spin" aria-hidden />}
            {nome?.modo === "novo" ? "Criar" : "Salvar"}
          </button>
        </form>
      </Dialogo>

      <ModalConfirmacao
        aberto={confirmar !== null}
        pergunta={
          confirmar?.tipo === "inativar"
            ? `Inativar “${confirmar.f.nome}”? Ele some do link do parceiro e da tela de lançamento. Os lançamentos e os indicadores continuam; reativar volta tudo.`
            : confirmar?.tipo === "semExcluir"
              ? `Inativar “${confirmar.f.nome}” em vez de excluir? Ele tem ${formatarNumero(confirmar.f.lancamentos)} ${confirmar.f.lancamentos === 1 ? "lançamento" : "lançamentos"} e não pode ser excluído: os números já lançados dependem dele. Inativo, some do link e da tela de lançamento, e nada se apaga.`
              : `Excluir “${confirmar?.f.nome ?? ""}”? O formulário e as versões dele saem de vez. Só é possível sem lançamentos e sem indicador.`
        }
        erro={erro}
        rotulo={confirmar?.tipo === "excluir" ? "Excluir" : "Inativar"}
        rotuloEnviando={
          confirmar?.tipo === "excluir" ? "Excluindo…" : "Inativando…"
        }
        perigo
        enviando={enviando}
        aoFechar={() => setConfirmar(null)}
        aoConfirmar={() => {
          if (!confirmar) return;
          const { f, tipo } = confirmar;
          if (tipo !== "excluir")
            rodar(
              () => alternarFormularioAtivo(f.id, false),
              "Formulário inativado.",
            );
          else
            rodar(
              () => excluirFormulario(f.id),
              "Formulário excluído.",
              () => router.push(hrefDoEditor("")),
            );
        }}
      />
    </div>
  );
}
