import { Pencil, Plus } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import { useNavegar } from "@/lib/navegacao";
import { Dialogo } from "@/modules/calendario/components/dialogo";
import { alternarProgramaAtivo, salvarPrograma } from "../../api-programas";

// Cadastro do programa (spec 4.8): nome, descrição, área de impacto (lista
// dos Parâmetros), parceiro (nome, CNPJ e contato — o contato só para quem
// tem "Ver contato"), início e fim, frequência esperada. E o botão de
// inativar/reativar (nada se apaga).

export interface DadosDoPrograma {
  id: string;
  nome: string;
  descricao: string | null;
  area: string | null;
  parceiro_nome: string | null;
  parceiro_doc: string | null;
  inicio: string | null;
  fim: string | null;
  frequencia: string;
  contato?: {
    email: string | null;
    telefone: string | null;
    contato: string | null;
  } | null;
}

const PRIMARIO =
  "inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800";
const SECUNDARIO =
  "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400";

function Campo({
  rotulo,
  children,
  id,
  dica,
}: {
  rotulo: string;
  children: React.ReactNode;
  id?: string;
  dica?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      {children}
      {dica && <p className="text-xs text-neutral-500">{dica}</p>}
    </div>
  );
}

export function CadastroDoPrograma({
  programa,
  areas,
  podeContato,
}: {
  /** Sem programa: "Novo programa". */
  programa?: DadosDoPrograma;
  areas: string[];
  podeContato: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const navegar = useNavegar();
  const acao = useMemo(
    () =>
      salvarPrograma(programa?.id ?? null, (id) =>
        navegar.push(`/sustentabilidade/programas/${id}`),
      ),
    [programa?.id, navegar],
  );
  const ids = {
    nome: useId(),
    descricao: useId(),
    parceiro: useId(),
    doc: useId(),
    email: useId(),
    telefone: useId(),
    contato: useId(),
    inicio: useId(),
    fim: useId(),
  };
  const p = programa;
  const opcoesArea = [
    ...areas,
    ...(p?.area && !areas.includes(p.area) ? [p.area] : []),
  ].map((a) => ({ valor: a, rotulo: a }));
  return (
    <>
      <button
        type="button"
        data-guia={p ? "editar-programa" : "novo-programa"}
        onClick={() => setAberto(true)}
        className={p ? SECUNDARIO : PRIMARIO}
      >
        {p ? (
          <Pencil className="size-4" aria-hidden />
        ) : (
          <Plus className="size-4" aria-hidden />
        )}
        {p ? "Editar cadastro" : "Novo programa"}
      </button>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={p ? "Cadastro do programa" : "Novo programa"}
        subtitulo={p?.nome}
      >
        <FormAcao
          acao={acao}
          rotulo={p ? "Salvar" : "Criar programa"}
          aoConcluir={() => setAberto(false)}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="id" value={p?.id ?? ""} />
          <Campo rotulo="Nome" id={ids.nome}>
            <input
              id={ids.nome}
              name="nome"
              required
              maxLength={120}
              defaultValue={p?.nome}
              className={classeCampo}
            />
          </Campo>
          <Campo rotulo="Descrição" id={ids.descricao}>
            <textarea
              id={ids.descricao}
              name="descricao"
              rows={2}
              maxLength={1000}
              defaultValue={p?.descricao ?? ""}
              className={classeCampo}
            />
          </Campo>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo rotulo="Área de impacto" dica="Lista dos Parâmetros.">
              <Selecao
                name="area"
                opcoes={opcoesArea}
                valorInicial={p?.area ?? ""}
                rotulo="Área de impacto"
                placeholder="Escolha a área"
              />
            </Campo>
            <Campo rotulo="Frequência esperada">
              <Selecao
                name="frequencia"
                opcoes={[
                  { valor: "mensal", rotulo: "Mensal" },
                  { valor: "evento", rotulo: "Por evento" },
                ]}
                valorInicial={p?.frequencia ?? "mensal"}
                rotulo="Frequência esperada"
                obrigatorio
              />
            </Campo>
            <Campo rotulo="Início" id={ids.inicio}>
              <input
                id={ids.inicio}
                type="date"
                name="inicio"
                defaultValue={p?.inicio ?? ""}
                className={classeCampo}
              />
            </Campo>
            <Campo
              rotulo="Fim"
              id={ids.fim}
              dica="Em branco: sem data para acabar."
            >
              <input
                id={ids.fim}
                type="date"
                name="fim"
                defaultValue={p?.fim ?? ""}
                className={classeCampo}
              />
            </Campo>
          </div>
          <fieldset className="flex flex-col gap-4 rounded-2xl border border-neutral-200 p-4">
            <legend className="px-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              Parceiro responsável
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo rotulo="Nome" id={ids.parceiro}>
                <input
                  id={ids.parceiro}
                  name="parceiro_nome"
                  maxLength={150}
                  defaultValue={p?.parceiro_nome ?? ""}
                  className={classeCampo}
                />
              </Campo>
              <Campo rotulo="CNPJ" id={ids.doc}>
                <input
                  id={ids.doc}
                  name="parceiro_doc"
                  inputMode="numeric"
                  maxLength={18}
                  defaultValue={p?.parceiro_doc ?? ""}
                  className={classeCampo}
                />
              </Campo>
              {podeContato && (
                <>
                  <Campo rotulo="Pessoa de contato" id={ids.contato}>
                    <input
                      id={ids.contato}
                      name="contato"
                      maxLength={150}
                      defaultValue={p?.contato?.contato ?? ""}
                      className={classeCampo}
                    />
                  </Campo>
                  <Campo rotulo="Telefone (WhatsApp)" id={ids.telefone}>
                    <input
                      id={ids.telefone}
                      name="telefone"
                      type="tel"
                      maxLength={40}
                      defaultValue={p?.contato?.telefone ?? ""}
                      className={classeCampo}
                    />
                  </Campo>
                  <Campo rotulo="E-mail" id={ids.email}>
                    <input
                      id={ids.email}
                      name="email"
                      type="email"
                      maxLength={150}
                      defaultValue={p?.contato?.email ?? ""}
                      className={classeCampo}
                    />
                  </Campo>
                </>
              )}
            </div>
            {!podeContato && (
              <p className="text-xs text-neutral-500">
                O contato do parceiro só aparece para quem tem “Ver contato”.
              </p>
            )}
          </fieldset>
        </FormAcao>
      </Dialogo>
    </>
  );
}

/** Inativar ou reativar o programa, com confirmação. */
export function SituacaoDoPrograma({
  id,
  ativo,
}: {
  id: string;
  ativo: boolean;
}) {
  return (
    <FormAcao
      acao={alternarProgramaAtivo}
      rotulo={ativo ? "Inativar" : "Reativar"}
      rotuloEnviando={ativo ? "Inativando…" : "Reativando…"}
      variante={ativo ? "perigo" : "secundario"}
      confirmar={
        ativo
          ? "Inativar o programa? Ele sai da tela de lançamento e o link do parceiro para de abrir. Os lançamentos e os números dos meses passados continuam no painel; reativar volta tudo."
          : "Reativar o programa? Ele volta à tela de lançamento e o link do parceiro (se não foi desligado) abre de novo."
      }
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ativo" value={ativo ? "false" : "true"} />
    </FormAcao>
  );
}
