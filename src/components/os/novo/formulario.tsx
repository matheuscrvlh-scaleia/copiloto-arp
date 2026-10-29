"use client";

import {
  ArrowLeft,
  CircleUserRound,
  Flag,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { classeCampo } from "@/components/estilos";
import { LIMITE_ENVIO, tamanhoTotal } from "@/components/os/chamado/arquivos";
import { EscolherArquivos } from "@/components/os/chamado/escolher-arquivos";
import { BOTAO_PRIMARIO } from "@/components/os/chamado/janela";
import { CampoComMencao } from "@/components/os/chamado/mencao";
import { IconeCatalogo } from "@/components/os/configuracoes/icones";
import { IconeTipo } from "@/components/os/selos";
import { type Opcao, Selecao } from "@/components/selecao";
import { campoDeArquivo } from "@/lib/os/chamado";
import {
  type CampoExtra,
  PRIORIDADES,
  type Prioridade,
  TIPOS,
  type TipoChamado,
} from "@/lib/os/rotulos";
import {
  abrirChamado,
  type EstadoCriacao,
  type OpcoesDeVinculo,
  opcoesDeVinculo,
} from "@/server/os/acoes/chamados";
import { Horario } from "./horario";
import { NovaCategoria } from "./nova-categoria";
import { NovoTerceirizado } from "./novo-terceirizado";
import { PILULA_OPCAO, Repetir } from "./repetir";
import type {
  CategoriaDoFormulario,
  DadosDoFormulario,
  InicialDoFormulario,
  SetorDoFormulario,
} from "./tipos";

// Abrir um chamado em três passos: escolher setor e categoria, escrever o
// título, enviar. O resto fica em "Mais detalhes" (opcional). A mesma tela
// serve ao botão "+ Novo" (janela) e às páginas /os/novo e /os/ordens/nova
// (com contexto da URL: ativo, loja, vistoria, chamado vinculado,
// duplicar). Com `inicial.tipo` = "os" é o formulário da OS (tipo fixo);
// sem, o do chamado (sem a opção OS: um não cria o outro).

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Escolha {
  setorId: string;
  categoriaId: string | null;
  pessoal: boolean;
}

export function FormularioChamado({
  dados: recebidos,
  inicial,
  naJanela = false,
  aoCriar,
}: {
  dados: DadosDoFormulario;
  inicial?: InicialDoFormulario;
  /** Na Janela (corpo cheio): o formulário cuida da rolagem e do respiro. */
  naJanela?: boolean;
  aoCriar: (r: { id: string; numero: number; aviso?: string }) => void;
}) {
  // A criada no botão flutuante entra já (o cache só volta na próxima visita).
  const [criadas, setCriadas] = useState<CategoriaDoFormulario[]>([]);
  const dados = criadas.length
    ? { ...recebidos, categorias: [...recebidos.categorias, ...criadas] }
    : recebidos;
  const [escolha, setEscolha] = useState<Escolha | null>(() =>
    inicial?.setorId
      ? {
          setorId: inicial.setorId,
          categoriaId: inicial.categoriaId ?? null,
          pessoal: false,
        }
      : null,
  );

  if (!escolha) {
    const passo = (
      <EscolherCategoria
        dados={dados}
        dica={
          inicial?.tipo === "os"
            ? "Escolha a categoria da Ordem de Serviço."
            : undefined
        }
        contexto={inicial?.contexto ?? []}
        comPessoal={inicial?.tipo !== "os" && !inicial?.vistoriaId}
        aoEscolher={setEscolha}
        aoCriarCategoria={(c) => {
          setCriadas((l) => [...l, c]);
          setEscolha({ setorId: c.setorId, categoriaId: c.id, pessoal: false });
        }}
      />
    );
    return naJanela ? (
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-7 sm:pb-7">
        {passo}
      </div>
    ) : (
      passo
    );
  }
  return (
    <Detalhes
      // Trocar a categoria recomeça os campos dela.
      key={`${escolha.setorId}-${escolha.categoriaId}-${escolha.pessoal}`}
      dados={dados}
      inicial={inicial}
      naJanela={naJanela}
      escolha={escolha}
      aoTrocar={() => setEscolha(null)}
      aoMudarCategoria={(categoriaId) =>
        setEscolha({ ...escolha, categoriaId })
      }
      aoCriar={aoCriar}
    />
  );
}

// ---------------------------------------------------------------------------
// Passo 1: setor e categoria
// ---------------------------------------------------------------------------

function corDe(c: CategoriaDoFormulario, s: SetorDoFormulario | undefined) {
  return c.cor ?? s?.cor ?? "#525252";
}

function BotaoCategoria({
  icone,
  cor,
  nome,
  detalhe,
  aoClicar,
}: {
  icone: string;
  cor: string;
  nome: string;
  detalhe?: string;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="group flex min-h-16 items-center gap-3 rounded-2xl border border-neutral-900/[0.07] bg-white/70 p-3 text-left transition hover:-translate-y-px hover:border-neutral-900/20 hover:bg-white hover:shadow-[0_12px_24px_-16px_rgb(0_0_0/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca"
    >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-xl"
        style={{ backgroundColor: `${cor}22`, color: cor }}
      >
        <IconeCatalogo nome={icone} className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm leading-tight font-medium text-neutral-900">
          {nome}
        </span>
        {detalhe && (
          <span className="mt-0.5 block truncate text-xs text-neutral-500">
            {detalhe}
          </span>
        )}
      </span>
    </button>
  );
}

function EscolherCategoria({
  dados,
  dica,
  contexto,
  comPessoal,
  aoEscolher,
  aoCriarCategoria,
}: {
  dados: DadosDoFormulario;
  dica?: string;
  contexto: InicialDoFormulario["contexto"];
  /** Atalho da tarefa pessoal (não cabe na OS). */
  comPessoal: boolean;
  aoEscolher: (e: Escolha) => void;
  aoCriarCategoria: (c: CategoriaDoFormulario) => void;
}) {
  const [busca, setBusca] = useState("");
  const termo = sem(busca.trim());
  const setorPorId = new Map(dados.setores.map((s) => [s.id, s]));
  const catPorId = new Map(dados.categorias.map((c) => [c.id, c]));
  // Os setores da pessoa primeiro.
  const ordem = [...dados.setores].sort(
    (a, b) =>
      Number(!dados.meusSetores.includes(a.id)) -
      Number(!dados.meusSetores.includes(b.id)),
  );
  const setorPessoal = dados.meusSetores[0] ?? dados.setores[0]?.id;

  const achadas = termo
    ? dados.categorias.filter((c) => {
        const pai = c.paiId ? catPorId.get(c.paiId)?.nome : "";
        const setor = setorPorId.get(c.setorId)?.nome ?? "";
        return sem(`${c.nome} ${pai} ${setor}`).includes(termo);
      })
    : [];

  return (
    <div className="flex flex-col gap-5">
      {contexto.length > 0 && <Contexto itens={contexto} />}
      {dica && <p className="text-sm text-neutral-600">{dica}</p>}
      <label className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white py-1.5 pr-4 pl-1.5 text-sm focus-within:border-neutral-900 focus-within:ring-4 focus-within:ring-neutral-900/5">
        <span className="grid size-8 place-items-center rounded-full bg-neutral-900 text-white">
          <Search className="size-4" aria-hidden />
        </span>
        <span className="sr-only">Buscar categoria</span>
        <input
          // biome-ignore lint/a11y/noAutofocus: primeiro passo da janela, é o que a pessoa faz primeiro
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="O que você precisa? (ex.: elétrica, credenciamento)"
          className="min-h-9 min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
        />
      </label>

      {!termo && comPessoal && setorPessoal && (
        <button
          type="button"
          onClick={() =>
            aoEscolher({
              setorId: setorPessoal,
              categoriaId: null,
              pessoal: true,
            })
          }
          className="destaque flex items-center gap-3 rounded-2xl p-4 text-left transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca"
        >
          <span className="ladrilho grid size-10 shrink-0 place-items-center rounded-xl">
            <Sparkles className="size-5 text-marca" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold">
              Tarefa pessoal rápida
            </span>
            <span className="block text-xs text-white/60">
              Para mim mesmo, sem confirmação de ninguém.
            </span>
          </span>
        </button>
      )}

      {termo ? (
        achadas.length ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {achadas.map((c) => {
              const s = setorPorId.get(c.setorId);
              const pai = c.paiId ? catPorId.get(c.paiId) : undefined;
              return (
                <BotaoCategoria
                  key={c.id}
                  icone={c.icone}
                  cor={corDe(c, s)}
                  nome={pai ? `${pai.nome} › ${c.nome}` : c.nome}
                  detalhe={`${s?.nome ?? ""} · ${TIPOS[c.tipo]}`}
                  aoClicar={() =>
                    aoEscolher({
                      setorId: c.setorId,
                      categoriaId: c.id,
                      pessoal: false,
                    })
                  }
                />
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl bg-neutral-900/[0.03] px-4 py-6 text-center text-sm text-neutral-500">
            Nenhuma categoria com esse nome. Escolha “Outro assunto” no setor ou
            crie uma no botão abaixo.
          </p>
        )
      ) : (
        ordem.map((s) => {
          const cats = dados.categorias.filter(
            (c) => c.setorId === s.id && !c.paiId,
          );
          return (
            <section key={s.id} aria-labelledby={`setor-${s.id}`}>
              <h3
                id={`setor-${s.id}`}
                className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-neutral-500 uppercase"
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: s.cor }}
                />
                {s.nome}
              </h3>
              <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 lg:grid-cols-3">
                {cats.map((c) => (
                  <BotaoCategoria
                    key={c.id}
                    icone={c.icone}
                    cor={corDe(c, s)}
                    nome={c.nome}
                    detalhe={TIPOS[c.tipo]}
                    aoClicar={() =>
                      aoEscolher({
                        setorId: s.id,
                        categoriaId: c.id,
                        pessoal: false,
                      })
                    }
                  />
                ))}
                <BotaoCategoria
                  icone={s.icone}
                  cor={s.cor}
                  nome="Outro assunto"
                  detalhe={`Para ${s.nome}`}
                  aoClicar={() =>
                    aoEscolher({
                      setorId: s.id,
                      categoriaId: null,
                      pessoal: false,
                    })
                  }
                />
              </div>
            </section>
          );
        })
      )}

      <div className="pointer-events-none sticky bottom-1 -mt-2 flex flex-wrap justify-end gap-2">
        <NovaCategoria
          dados={dados}
          nomeInicial={busca.trim()}
          aoCriar={aoCriarCategoria}
        />
        <NovoTerceirizado />
      </div>
    </div>
  );
}

function Contexto({ itens }: { itens: InicialDoFormulario["contexto"] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {itens.map((i) => (
        <li
          key={i.rotulo}
          className="rounded-full bg-marca/15 px-3 py-1 text-xs text-neutral-800"
        >
          <span className="text-neutral-500">{i.rotulo}: </span>
          <span className="font-medium">{i.valor}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Passo 2 e 3: título (e o resto opcional) e enviar
// ---------------------------------------------------------------------------

const rotulo = "flex flex-col gap-1.5 text-xs font-medium text-neutral-600";
const SECAO =
  "text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase";

/** Propriedade na coluna lateral: rótulo à esquerda, campo à direita. */
function Propriedade({
  nome,
  htmlFor,
  dica,
  children,
}: {
  nome: string;
  htmlFor: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
      <label htmlFor={htmlFor} className="text-xs font-medium text-neutral-600">
        {nome}
      </label>
      {children}
      {dica && (
        <p className="col-start-2 text-[11px] text-neutral-500">{dica}</p>
      )}
    </div>
  );
}

// Duas colunas, como um editor: à esquerda o que se digita (título,
// descrição, campos da categoria, arquivos); à direita as propriedades.
// No celular, uma coluna só. O rodapé com o envio fica sempre à vista.
function Detalhes({
  dados,
  inicial,
  naJanela,
  escolha,
  aoTrocar,
  aoMudarCategoria,
  aoCriar,
}: {
  dados: DadosDoFormulario;
  inicial?: InicialDoFormulario;
  naJanela: boolean;
  escolha: Escolha;
  aoTrocar: () => void;
  aoMudarCategoria: (id: string | null) => void;
  aoCriar: (r: { id: string; numero: number; aviso?: string }) => void;
}) {
  const id = useId();
  const setor = dados.setores.find((s) => s.id === escolha.setorId);
  const categoria = dados.categorias.find((c) => c.id === escolha.categoriaId);
  const pai = categoria?.paiId
    ? dados.categorias.find((c) => c.id === categoria.paiId)
    : categoria;
  const subcategorias = pai
    ? dados.categorias.filter((c) => c.paiId === pai.id)
    : [];
  const pessoal = escolha.pessoal;

  const ehOS = inicial?.tipo === "os";
  const [tipo, setTipo] = useState<TipoChamado>(
    pessoal
      ? "tarefa"
      : ehOS
        ? "os"
        : (inicial?.tipo ??
          (categoria?.tipo === "os" ? null : categoria?.tipo) ??
          "solicitacao"),
  );
  const [prioridade, setPrioridade] = useState<Prioridade>(
    inicial?.prioridade ?? categoria?.prioridade ?? "media",
  );
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [arquivosCampo, setArquivosCampo] = useState<Record<string, File[]>>(
    {},
  );
  // Em ordem; "" é um select ainda vazio.
  const [setoresExtras, setSetoresExtras] = useState<string[]>([""]);
  const [pessoasExtras, setPessoasExtras] = useState<string[]>([""]);
  const [vinculos, setVinculos] = useState<OpcoesDeVinculo | null>(null);
  const [, carregar] = useTransition();
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [estado, executar, enviando] = useActionState<EstadoCriacao, FormData>(
    abrirChamado,
    {},
  );
  const [, enviar] = useTransition();
  const avisado = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (estado.id && estado.numero && avisado.current !== estado.id) {
      avisado.current = estado.id;
      aoCriar({
        id: estado.id,
        numero: estado.numero,
        aviso: estado.aviso,
      });
    }
  }, [estado, aoCriar]);

  // Lojas e ativos dos vínculos (a tarefa pessoal não tem).
  useEffect(() => {
    if (!pessoal && !vinculos)
      carregar(async () => setVinculos(await opcoesDeVinculo()));
  }, [pessoal, vinculos]);

  function aoEnviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando || estado.id) return;
    const todos = [...arquivos, ...Object.values(arquivosCampo).flat()];
    if (tamanhoTotal(todos) > LIMITE_ENVIO) {
      setErroLocal(
        "Os arquivos passam de 4 MB juntos. Envie menos agora e o resto pela conversa do chamado.",
      );
      return;
    }
    setErroLocal(null);
    const form = new FormData(e.currentTarget);
    for (const a of arquivos) form.append("arquivos", a);
    for (const [chave, lista] of Object.entries(arquivosCampo))
      for (const a of lista) form.append(`arquivo:${chave}`, a);
    enviar(() => executar(form));
  }

  const nomeResponsavel = categoria?.responsavelId
    ? dados.pessoas.find((p) => p.id === categoria.responsavelId)?.nome
    : null;
  const destino = pessoal
    ? "Você"
    : (nomeResponsavel ?? `Fila de ${setor?.nome ?? "setor"}`);
  const cor = categoria?.cor ?? setor?.cor ?? "#525252";
  const erro = erroLocal ?? estado.erro;
  const falta = titulo.trim().length < 3;

  return (
    <form
      onSubmit={aoEnviar}
      onKeyDown={(e) => {
        // Ctrl+Enter (⌘+Enter) envia de qualquer campo.
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          e.currentTarget.requestSubmit();
        }
      }}
      className={naJanela ? "flex min-h-0 flex-1 flex-col" : "flex flex-col"}
    >
      <input type="hidden" name="setor_id" value={escolha.setorId} />
      <input
        type="hidden"
        name="categoria_id"
        value={escolha.categoriaId ?? ""}
      />
      <input type="hidden" name="pessoal" value={pessoal ? "1" : "0"} />
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="prioridade" value={prioridade} />
      <input
        type="hidden"
        name="vistoria_id"
        value={inicial?.vistoriaId ?? ""}
      />
      <input
        type="hidden"
        name="ambiente_id"
        value={inicial?.ambienteId ?? ""}
      />
      <input
        type="hidden"
        name="vinculado_a_id"
        value={inicial?.vinculadoAId ?? ""}
      />

      <div
        className={
          naJanela
            ? "min-h-0 flex-1 overflow-y-auto border-t border-neutral-900/[0.07] md:grid md:min-h-[min(34rem,62dvh)] md:grid-cols-[minmax(0,1fr)_21rem] md:grid-rows-1 md:overflow-hidden"
            : "md:grid md:grid-cols-[minmax(0,1fr)_20rem]"
        }
      >
        <div
          className={`flex flex-col gap-5 ${naJanela ? "p-5 sm:px-7 sm:py-6 md:overflow-y-auto" : "pb-5 md:pr-7"}`}
        >
          {/* Categoria escolhida: mostra e deixa trocar. */}
          <div className="flex items-center gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl"
              style={{ backgroundColor: `${cor}22`, color: cor }}
            >
              {pessoal ? (
                <Sparkles className="size-[18px]" aria-hidden />
              ) : (
                <IconeCatalogo
                  nome={categoria?.icone ?? setor?.icone}
                  className="size-[18px]"
                />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {pessoal
                  ? "Tarefa pessoal rápida"
                  : `${setor?.nome ?? ""} › ${pai?.nome ?? "Outro assunto"}${categoria?.paiId ? ` › ${categoria.nome}` : ""}`}
              </span>
              <span className="block truncate text-xs text-neutral-500">
                Para {destino}
                {categoria?.prazo && !pessoal
                  ? ` · prazo ${categoria.prazo}`
                  : ""}
              </span>
            </span>
            <button
              type="button"
              onClick={aoTrocar}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-sm font-medium text-neutral-700 transition hover:border-neutral-400"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Trocar
            </button>
          </div>

          {inicial?.contexto.length ? (
            <Contexto itens={inicial.contexto} />
          ) : null}

          {subcategorias.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-neutral-600">
                Subcategoria (opcional)
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {subcategorias.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={escolha.categoriaId === s.id}
                    onClick={() =>
                      aoMudarCategoria(
                        escolha.categoriaId === s.id ? (pai?.id ?? null) : s.id,
                      )
                    }
                    className={PILULA_OPCAO}
                  >
                    {s.nome}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${id}-titulo`}
              className="text-xs font-medium text-neutral-600"
            >
              {pessoal ? "O que você precisa fazer?" : "Título"}
            </label>
            <input
              id={`${id}-titulo`}
              name="titulo"
              required
              minLength={3}
              maxLength={200}
              // biome-ignore lint/a11y/noAutofocus: passo 2, o título é o próximo campo
              autoFocus
              autoComplete="off"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => {
                // Enter no título passa para a descrição (não envia sem querer).
                if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                  document.getElementById(`${id}-descricao`)?.focus();
                }
              }}
              placeholder={
                pessoal
                  ? "Ex.: ligar para o fornecedor"
                  : "Ex.: lâmpada queimada no corredor B"
              }
              className="w-full border-0 border-b-2 border-neutral-200 bg-transparent pt-1 pb-2 text-xl font-semibold tracking-tight text-neutral-900 outline-none transition placeholder:font-normal placeholder:text-neutral-400 focus:border-neutral-900 sm:text-2xl"
            />
          </div>

          <label htmlFor={`${id}-descricao`} className={rotulo}>
            <span>
              Descrição{" "}
              <span className="font-normal text-neutral-500">
                · @ cita alguém
              </span>
            </span>
            <CampoComMencao
              id={`${id}-descricao`}
              name="descricao"
              pessoas={dados.pessoas}
              valor={descricao}
              aoMudar={setDescricao}
              linhas={6}
              placeholder="Contexto, onde é, o que já foi tentado…"
            />
          </label>

          {categoria && categoria.campos.length > 0 && (
            <CamposExtras
              campos={categoria.campos}
              arquivos={arquivosCampo}
              aoMudarArquivos={(chave, lista) =>
                setArquivosCampo((a) => ({ ...a, [chave]: lista }))
              }
            />
          )}

          {tipo === "aviso" && !pessoal && (
            <SetoresExtras
              dados={dados}
              setorPrincipal={escolha.setorId}
              destaque
            />
          )}

          <div className={rotulo}>
            Fotos e arquivos
            <EscolherArquivos
              arquivos={arquivos}
              aoMudar={setArquivos}
              rotulo="Fotos e arquivos"
            />
          </div>
        </div>

        <aside
          aria-label="Propriedades do chamado"
          className={`flex flex-col gap-6 border-t border-neutral-900/[0.07] md:border-t-0 md:border-l ${naJanela ? "bg-neutral-900/[0.025] p-5 sm:px-6 sm:py-6 md:overflow-y-auto" : "py-5 md:py-0 md:pl-7"}`}
        >
          <section className="flex flex-col gap-3">
            <h3 className={SECAO}>Essencial</h3>
            {!pessoal && !ehOS && (
              <Propriedade nome="Tipo" htmlFor={`${id}-tipo`}>
                <Selecao
                  id={`${id}-tipo`}
                  valor={tipo}
                  aoMudar={(v) => setTipo(v as TipoChamado)}
                  icone={<IconeTipo tipo={tipo} className="size-4" />}
                  opcoes={(Object.keys(TIPOS) as TipoChamado[])
                    .filter((t) => t !== "os")
                    .map((t) => ({
                      valor: t,
                      rotulo: TIPOS[t],
                    }))}
                />
              </Propriedade>
            )}
            <Propriedade nome="Prioridade" htmlFor={`${id}-prioridade`}>
              <Selecao
                id={`${id}-prioridade`}
                valor={prioridade}
                aoMudar={(v) => setPrioridade(v as Prioridade)}
                icone={<Flag className="size-4" />}
                opcoes={(Object.keys(PRIORIDADES) as Prioridade[]).map((p) => ({
                  valor: p,
                  rotulo: PRIORIDADES[p],
                }))}
              />
            </Propriedade>
            {!pessoal && (
              <Propriedade nome="Responsável" htmlFor={`${id}-responsavel`}>
                <Selecao
                  id={`${id}-responsavel`}
                  name="responsavel"
                  valorInicial=""
                  icone={<CircleUserRound className="size-4" />}
                  opcoes={opcoesResponsavel(
                    dados,
                    escolha.setorId,
                    nomeResponsavel,
                  )}
                />
              </Propriedade>
            )}
            <Propriedade
              nome="Prazo"
              htmlFor={`${id}-prazo`}
              dica={
                categoria?.prazo && !pessoal
                  ? `Vazio: ${categoria.prazo} a partir de agora.`
                  : "Vazio: sem prazo."
              }
            >
              <input
                id={`${id}-prazo`}
                type="datetime-local"
                name="prazo"
                className={`${classeCampo} min-w-0`}
              />
            </Propriedade>
          </section>

          {!pessoal && (
            <section className="flex flex-col gap-3">
              <h3 className={SECAO}>Vínculos</h3>
              <Propriedade nome="Loja" htmlFor={`${id}-loja`}>
                <Selecao
                  id={`${id}-loja`}
                  name="loja_id"
                  valorInicial={inicial?.lojaId ?? ""}
                  busca
                  placeholder={vinculos ? "Nenhuma" : "Carregando…"}
                  opcoes={[
                    { valor: "", rotulo: "Nenhuma" },
                    ...(vinculos?.lojas ?? []).map((l) => ({
                      valor: l.id,
                      rotulo: l.rotulo,
                    })),
                  ]}
                />
              </Propriedade>
              <Propriedade nome="Ativo" htmlFor={`${id}-ativo`}>
                <Selecao
                  id={`${id}-ativo`}
                  name="ativo_id"
                  valorInicial={inicial?.ativoId ?? ""}
                  busca
                  placeholder={vinculos ? "Nenhum" : "Carregando…"}
                  opcoes={[
                    { valor: "", rotulo: "Nenhum" },
                    ...(vinculos?.ativos ?? []).map((a) => ({
                      valor: a.id,
                      rotulo: a.rotulo,
                      descricao: a.descricao,
                    })),
                  ]}
                />
              </Propriedade>
              {!inicial?.vinculadoAId && (
                <Propriedade nome="Chamado nº" htmlFor={`${id}-vinculado`}>
                  <input
                    id={`${id}-vinculado`}
                    name="vinculado_numero"
                    inputMode="numeric"
                    placeholder={
                      ehOS
                        ? "Chamado ligado (ex.: 1234)"
                        : "Ligado a outro (ex.: 1234)"
                    }
                    className={classeCampo}
                  />
                </Propriedade>
              )}
            </section>
          )}

          <section className="flex flex-col gap-4">
            <h3 className={SECAO}>Mais</h3>
            <Propriedade nome="Etiquetas" htmlFor={`${id}-etiquetas`}>
              <input
                id={`${id}-etiquetas`}
                name="etiquetas"
                defaultValue={inicial?.etiquetas ?? ""}
                placeholder="bloco B, reincidente"
                className={classeCampo}
              />
            </Propriedade>
            {!pessoal && tipo !== "aviso" && (
              <ListaEmOrdem
                titulo="Também para os setores, em ordem"
                dica={`Começa em ${setor?.nome ?? "este setor"}; cada um só anda depois que o anterior concluir a sua parte.`}
                nome="setores_extras"
                inicio={2}
                primeiro={{
                  id: escolha.setorId,
                  nome: setor?.nome ?? "Este setor",
                }}
                adicionar="Adicionar setor"
                placeholder="Escolher setor…"
                opcoes={dados.setores
                  .filter((s) => s.id !== escolha.setorId)
                  .map((s) => ({ valor: s.id, rotulo: s.nome }))}
                valores={setoresExtras}
                aoMudar={setSetoresExtras}
              />
            )}
            {!pessoal && (
              <ListaEmOrdem
                titulo={
                  tipo === "aviso"
                    ? "Também para as pessoas"
                    : "Depois, para as pessoas, em ordem"
                }
                nome="pessoas_extras"
                inicio={
                  tipo === "aviso"
                    ? undefined
                    : 2 + setoresExtras.filter(Boolean).length
                }
                adicionar="Adicionar pessoa"
                placeholder="Escolher pessoa…"
                opcoes={dados.pessoas.map((p) => ({
                  valor: p.id,
                  rotulo: p.nome,
                }))}
                valores={pessoasExtras}
                aoMudar={setPessoasExtras}
              />
            )}
            <Repetir />
            {categoria?.agendaId && !ehOS && (
              <Horario
                agendaId={categoria.agendaId}
                nome={
                  dados.agendas.find((a) => a.id === categoria.agendaId)
                    ?.nome ?? "Agenda"
                }
              />
            )}
          </section>
        </aside>
      </div>

      <div
        className={`sticky bottom-0 z-[1] flex flex-col gap-2 border-t border-neutral-900/[0.07] sm:flex-row sm:items-center sm:justify-end sm:gap-4 ${naJanela ? "px-5 py-3 sm:px-7 sm:py-4" : "bg-neutral-50/95 py-3 backdrop-blur"}`}
      >
        {erro ? (
          <p role="alert" className="text-sm text-red-700 sm:mr-auto">
            {erro}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-neutral-500 sm:mr-auto">
            {falta ? (
              <>
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-amber-500"
                />
                Falta: título
              </>
            ) : (
              <>Vai para {destino}</>
            )}
          </p>
        )}
        <button
          type="submit"
          disabled={enviando || Boolean(estado.id)}
          aria-keyshortcuts="Control+Enter"
          className={BOTAO_PRIMARIO}
        >
          <Send className="size-4" aria-hidden />
          {enviando
            ? "Enviando…"
            : ehOS
              ? "Abrir Ordem de Serviço"
              : "Abrir chamado"}
          <kbd className="ml-1 hidden rounded-md border border-current px-1.5 font-sans text-[11px] opacity-60 sm:inline">
            Ctrl ↵
          </kbd>
        </button>
      </div>
    </form>
  );
}

function opcoesResponsavel(
  dados: DadosDoFormulario,
  setorId: string,
  padrao: string | null | undefined,
): Opcao[] {
  // Gente do setor primeiro.
  const pessoas = [...dados.pessoas].sort(
    (a, b) =>
      Number(!a.setores.includes(setorId)) -
        Number(!b.setores.includes(setorId)) ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
  return [
    {
      valor: "",
      rotulo: padrao ? `Padrão: ${padrao}` : "Padrão: fila do setor",
    },
    { valor: "fila", rotulo: "Fila do setor (sem responsável)" },
    ...pessoas.map((p) => ({
      valor: p.id,
      rotulo: p.id === dados.eu.id ? `${p.nome} (eu)` : p.nome,
      descricao: p.setores.includes(setorId) ? "Do setor" : undefined,
    })),
  ];
}

function SetoresExtras({
  dados,
  setorPrincipal,
  destaque = false,
}: {
  dados: DadosDoFormulario;
  setorPrincipal: string;
  destaque?: boolean;
}) {
  const outros = dados.setores.filter((s) => s.id !== setorPrincipal);
  if (!outros.length) return null;
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-medium text-neutral-600">
        {destaque
          ? "Para quais setores, além deste?"
          : "Também para os setores"}
      </legend>
      <p className="mb-2 text-xs text-neutral-500">
        Cada setor confirma que leu e conclui a sua parte.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {outros.map((s) => (
          <label key={s.id} className="cursor-pointer">
            <input
              type="checkbox"
              name="setores_extras"
              value={s.id}
              className="peer sr-only"
            />
            <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-sm text-neutral-700 transition peer-checked:border-neutral-900 peer-checked:bg-neutral-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-marca">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: s.cor }}
              />
              {s.nome}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const CAMPO_TAREFA =
  "min-h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none";

/**
 * Destinos extras em ordem: um select por vez e "Adicionar" para o próximo.
 * Grava os escolhidos, na ordem, em campos ocultos `nome`, e o que cabe a
 * cada um em `tarefa:<id>`.
 */
function ListaEmOrdem({
  titulo,
  dica,
  nome,
  inicio,
  primeiro,
  adicionar,
  placeholder,
  opcoes,
  valores,
  aoMudar,
}: {
  titulo: string;
  dica?: string;
  nome: string;
  /** Número do primeiro da lista; sem ele, a lista não é numerada. */
  inicio?: number;
  /** O destino principal, antes da lista (só a tarefa dele é editável). */
  primeiro?: { id: string; nome: string };
  adicionar: string;
  placeholder: string;
  opcoes: Opcao[];
  valores: string[];
  aoMudar: (valores: string[]) => void;
}) {
  const id = useId();
  // Pela id: tirar um do meio não troca a tarefa de lugar.
  const [tarefas, setTarefas] = useState<Record<string, string>>({});
  if (!opcoes.length) return null;
  const campoTarefa = (v: string, rotulo: string) => (
    <input
      name={`tarefa:${v}`}
      value={tarefas[v] ?? ""}
      onChange={(e) => setTarefas({ ...tarefas, [v]: e.target.value })}
      maxLength={200}
      placeholder="O que fazer (opcional)"
      aria-label={`O que cabe a ${rotulo}`}
      className={CAMPO_TAREFA}
    />
  );
  const trocar = (i: number, v: string) =>
    aoMudar(valores.map((x, j) => (j === i ? v : x)));
  const escolhidos = valores.filter(Boolean);
  const podeAdicionar =
    valores.at(-1) !== "" && escolhidos.length < opcoes.length;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-xs font-medium text-neutral-600">
        {titulo}
      </legend>
      {dica && <p className="-mt-1 text-xs text-neutral-500">{dica}</p>}
      {escolhidos.map((v) => (
        <input key={v} type="hidden" name={nome} value={v} />
      ))}
      <ol className="flex flex-col gap-2">
        {primeiro && (
          <li className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-neutral-900/[0.06] text-xs font-semibold text-neutral-600"
            >
              {(inicio ?? 2) - 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="pt-1.5 text-sm font-medium text-neutral-800">
                {primeiro.nome}
              </span>
              {campoTarefa(primeiro.id, primeiro.nome)}
            </div>
            <span aria-hidden className="size-9 shrink-0" />
          </li>
        )}
        {valores.map((v, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a posição é a ordem
          <li key={i} className="flex items-start gap-2">
            {inicio !== undefined && (
              <span
                aria-hidden
                className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-neutral-900/[0.06] text-xs font-semibold text-neutral-600"
              >
                {inicio + i}
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Selecao
                id={`${id}-${i}`}
                rotulo={`${titulo}: ${i + 1}º`}
                valor={v}
                placeholder={placeholder}
                aoMudar={(x) => trocar(i, x)}
                opcoes={opcoes.filter(
                  (o) => o.valor === v || !valores.includes(o.valor),
                )}
                className="min-w-0"
              />
              {v &&
                campoTarefa(
                  v,
                  opcoes.find((o) => o.valor === v)?.rotulo ?? "este destino",
                )}
            </div>
            {(v || valores.length > 1) && (
              <button
                type="button"
                onClick={() => {
                  const resto = valores.filter((_, j) => j !== i);
                  aoMudar(resto.length ? resto : [""]);
                }}
                aria-label={`Tirar o ${i + 1}º`}
                className="grid size-9 shrink-0 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.06] hover:text-neutral-800"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={!podeAdicionar}
        onClick={() => aoMudar([...valores, ""])}
        className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-full border border-dashed border-neutral-300 px-3 text-sm text-neutral-700 transition hover:border-neutral-500 disabled:opacity-50"
      >
        <Plus className="size-4" aria-hidden />
        {adicionar}
      </button>
    </fieldset>
  );
}

function CamposExtras({
  campos,
  arquivos,
  aoMudarArquivos,
}: {
  campos: CampoExtra[];
  arquivos: Record<string, File[]>;
  aoMudarArquivos: (chave: string, lista: File[]) => void;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {campos.map((c) => {
        const campoId = `${id}-${c.chave}`;
        const titulo = (
          <>
            {c.rotulo}
            {c.obrigatorio && (
              <span className="text-red-700" title="Obrigatório">
                {" "}
                *
              </span>
            )}
          </>
        );
        if (campoDeArquivo(c))
          return (
            <div key={c.chave} className={`${rotulo} sm:col-span-2`}>
              <span>{titulo}</span>
              <EscolherArquivos
                arquivos={arquivos[c.chave] ?? []}
                aoMudar={(l) => aoMudarArquivos(c.chave, l)}
                soFoto={c.tipo === "foto"}
                rotulo={c.rotulo}
              />
            </div>
          );
        if (c.tipo === "lista")
          return (
            <label key={c.chave} htmlFor={campoId} className={rotulo}>
              {titulo}
              <Selecao
                id={campoId}
                name={`campo:${c.chave}`}
                obrigatorio={c.obrigatorio}
                opcoes={(c.opcoes ?? []).map((o) => ({ valor: o, rotulo: o }))}
              />
            </label>
          );
        if (c.tipo === "sim_nao")
          return (
            <fieldset key={c.chave} className={rotulo}>
              <legend className="mb-1.5">{titulo}</legend>
              <div className="flex gap-1.5">
                {[
                  ["sim", "Sim"],
                  ["nao", "Não"],
                ].map(([v, r]) => (
                  <label key={v} className="cursor-pointer">
                    <input
                      type="radio"
                      name={`campo:${c.chave}`}
                      value={v}
                      required={c.obrigatorio}
                      className="peer sr-only"
                    />
                    <span className="inline-flex min-h-10 items-center rounded-full border border-neutral-200 bg-white px-4 text-sm font-normal text-neutral-700 transition peer-checked:border-neutral-900 peer-checked:bg-neutral-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-marca">
                      {r}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        return (
          <label
            key={c.chave}
            htmlFor={campoId}
            className={`${rotulo} ${c.tipo === "texto" ? "sm:col-span-2" : ""}`}
          >
            {titulo}
            <input
              id={campoId}
              name={`campo:${c.chave}`}
              required={c.obrigatorio}
              type={c.tipo === "data" ? "date" : "text"}
              inputMode={c.tipo === "numero" ? "decimal" : undefined}
              className={`${classeCampo} min-h-11`}
            />
          </label>
        );
      })}
    </div>
  );
}
