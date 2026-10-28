"use client";

import {
  ArrowLeft,
  ChevronDown,
  CircleUserRound,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import {
  useActionState,
  useEffect,
  useId,
  useMemo,
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
import { PILULA_OPCAO, Repetir } from "./repetir";
import type {
  CategoriaDoFormulario,
  DadosDoFormulario,
  InicialDoFormulario,
  SetorDoFormulario,
} from "./tipos";

// Abrir um chamado em três passos: escolher setor e categoria, escrever o
// título, enviar. O resto fica em "Mais detalhes" (opcional). A mesma tela
// serve ao botão "+ Novo" (janela) e à página /os/novo (com contexto da
// URL: ativo, loja, vistoria, chamado vinculado, converter, duplicar).

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Escolha {
  setorId: string;
  categoriaId: string | null;
  pessoal: boolean;
}

export function FormularioChamado({
  dados,
  inicial,
  aoCriar,
}: {
  dados: DadosDoFormulario;
  inicial?: InicialDoFormulario;
  aoCriar: (r: { id: string; numero: number; aviso?: string }) => void;
}) {
  const [escolha, setEscolha] = useState<Escolha | null>(() =>
    inicial?.setorId
      ? {
          setorId: inicial.setorId,
          categoriaId: inicial.categoriaId ?? null,
          pessoal: false,
        }
      : null,
  );

  if (!escolha)
    return (
      <EscolherCategoria
        dados={dados}
        dica={
          inicial?.tipo === "os"
            ? "Escolha a categoria da Ordem de Serviço."
            : undefined
        }
        contexto={inicial?.contexto ?? []}
        comPessoal={!inicial?.convertidoDeId && !inicial?.vistoriaId}
        aoEscolher={setEscolha}
      />
    );
  return (
    <Detalhes
      // Trocar a categoria recomeça os campos dela.
      key={`${escolha.setorId}-${escolha.categoriaId}-${escolha.pessoal}`}
      dados={dados}
      inicial={inicial}
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
}: {
  dados: DadosDoFormulario;
  dica?: string;
  contexto: InicialDoFormulario["contexto"];
  /** Atalho da tarefa pessoal (não cabe ao converter em OS). */
  comPessoal: boolean;
  aoEscolher: (e: Escolha) => void;
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
            Nenhuma categoria com esse nome. Escolha “Outro assunto” no setor.
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

function Detalhes({
  dados,
  inicial,
  escolha,
  aoTrocar,
  aoMudarCategoria,
  aoCriar,
}: {
  dados: DadosDoFormulario;
  inicial?: InicialDoFormulario;
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

  const [tipo, setTipo] = useState<TipoChamado>(
    pessoal ? "tarefa" : (inicial?.tipo ?? categoria?.tipo ?? "solicitacao"),
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
  const [pessoasExtras, setPessoasExtras] = useState<string[]>([]);
  const [maisAberto, setMaisAberto] = useState(
    Boolean(inicial?.descricao || inicial?.etiquetas),
  );
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

  // Lojas e ativos só quando a pessoa precisa (ou já vieram pela URL).
  const precisaVinculos =
    maisAberto || Boolean(inicial?.lojaId || inicial?.ativoId);
  useEffect(() => {
    if (precisaVinculos && !vinculos)
      carregar(async () => setVinculos(await opcoesDeVinculo()));
  }, [precisaVinculos, vinculos]);

  function aoEnviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-5">
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
      <input
        type="hidden"
        name="convertido_de_id"
        value={inicial?.convertidoDeId ?? ""}
      />

      {/* Passo 1 escolhido: mostra e deixa trocar. */}
      <div className="flex items-center gap-3 rounded-2xl bg-neutral-900/[0.04] p-2.5 pr-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl"
          style={{
            backgroundColor: `${categoria?.cor ?? setor?.cor ?? "#525252"}22`,
            color: categoria?.cor ?? setor?.cor ?? "#525252",
          }}
        >
          {pessoal ? (
            <Sparkles className="size-5" aria-hidden />
          ) : (
            <IconeCatalogo
              nome={categoria?.icone ?? setor?.icone}
              className="size-5"
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {pessoal
              ? "Tarefa pessoal rápida"
              : `${setor?.nome ?? ""} › ${pai?.nome ?? "Outro assunto"}${categoria?.paiId ? ` › ${categoria.nome}` : ""}`}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-neutral-500">
            <IconeTipo tipo={tipo} className="size-3.5" />
            {TIPOS[tipo]} · para {destino}
            {categoria?.prazo && !pessoal ? ` · prazo ${categoria.prazo}` : ""}
          </span>
        </span>
        <button
          type="button"
          onClick={aoTrocar}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-neutral-700 transition hover:bg-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Trocar
        </button>
      </div>

      {inicial?.contexto.length ? <Contexto itens={inicial.contexto} /> : null}

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

      <label htmlFor={`${id}-titulo`} className={rotulo}>
        {pessoal ? "O que você precisa fazer?" : "Título"}
        <input
          id={`${id}-titulo`}
          name="titulo"
          required
          minLength={3}
          maxLength={200}
          // biome-ignore lint/a11y/noAutofocus: passo 2, o título é o próximo campo
          autoFocus
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder={
            pessoal
              ? "Ex.: ligar para o fornecedor"
              : "Ex.: lâmpada queimada no corredor B"
          }
          className={`${classeCampo} min-h-12 text-base`}
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

      <div className="rounded-2xl border border-neutral-900/[0.07]">
        <button
          type="button"
          aria-expanded={maisAberto}
          aria-controls={`${id}-mais`}
          onClick={() => setMaisAberto((m) => !m)}
          className="flex min-h-12 w-full items-center justify-between gap-2 px-4 text-sm font-medium"
        >
          Mais detalhes
          <span className="flex items-center gap-2 text-xs font-normal text-neutral-500">
            descrição, prazo, fotos, vínculos…
            <ChevronDown
              className={`size-4 transition-transform ${maisAberto ? "rotate-180" : ""}`}
              aria-hidden
            />
          </span>
        </button>
        {/* Fica no formulário mesmo fechado: o que veio da URL vai junto. */}
        <div
          id={`${id}-mais`}
          hidden={!maisAberto}
          className="flex flex-col gap-5 border-t border-neutral-900/[0.07] p-4"
        >
          <label htmlFor={`${id}-descricao`} className={rotulo}>
            Descrição
            <CampoComMencao
              id={`${id}-descricao`}
              name="descricao"
              pessoas={dados.pessoas}
              valor={descricao}
              aoMudar={setDescricao}
              placeholder="Conte o que precisa. Use @ para citar alguém."
            />
          </label>

          {!pessoal && (
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-neutral-600">
                Tipo
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(TIPOS) as TipoChamado[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tipo === t}
                    onClick={() => setTipo(t)}
                    className={PILULA_OPCAO}
                  >
                    <IconeTipo tipo={t} className="size-3.5" />
                    {TIPOS[t]}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="mb-2 text-xs font-medium text-neutral-600">
              Prioridade
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(PRIORIDADES) as Prioridade[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={prioridade === p}
                  onClick={() => setPrioridade(p)}
                  className={PILULA_OPCAO}
                >
                  {PRIORIDADES[p]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label htmlFor={`${id}-prazo`} className={rotulo}>
              Prazo
              <input
                id={`${id}-prazo`}
                type="datetime-local"
                name="prazo"
                className={`${classeCampo} min-h-11`}
              />
              <span className="font-normal text-neutral-500">
                {categoria?.prazo && !pessoal
                  ? `Vazio: ${categoria.prazo} a partir de agora.`
                  : "Vazio: sem prazo."}
              </span>
            </label>
            {!pessoal && (
              <label htmlFor={`${id}-responsavel`} className={rotulo}>
                Responsável
                <Selecao
                  id={`${id}-responsavel`}
                  name="responsavel"
                  valorInicial=""
                  opcoes={opcoesResponsavel(
                    dados,
                    escolha.setorId,
                    nomeResponsavel,
                  )}
                />
              </label>
            )}
          </div>

          {!pessoal && tipo !== "aviso" && (
            <SetoresExtras dados={dados} setorPrincipal={escolha.setorId} />
          )}
          {!pessoal && (
            <PessoasExtras
              dados={dados}
              escolhidas={pessoasExtras}
              aoMudar={setPessoasExtras}
            />
          )}

          <label htmlFor={`${id}-etiquetas`} className={rotulo}>
            Etiquetas
            <input
              id={`${id}-etiquetas`}
              name="etiquetas"
              defaultValue={inicial?.etiquetas ?? ""}
              placeholder="Separe por vírgula (ex.: bloco B, reincidente)"
              className={classeCampo}
            />
          </label>

          <div className={rotulo}>
            Fotos e arquivos
            <EscolherArquivos
              arquivos={arquivos}
              aoMudar={setArquivos}
              rotulo="Fotos e arquivos"
            />
          </div>

          {!pessoal && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label htmlFor={`${id}-loja`} className={rotulo}>
                Loja / contrato
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
              </label>
              <label htmlFor={`${id}-ativo`} className={rotulo}>
                Ativo
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
              </label>
              {!inicial?.vinculadoAId && (
                <label htmlFor={`${id}-vinculado`} className={rotulo}>
                  Ligado a outro chamado (nº)
                  <input
                    id={`${id}-vinculado`}
                    name="vinculado_numero"
                    inputMode="numeric"
                    placeholder="Ex.: 1234"
                    className={classeCampo}
                  />
                </label>
              )}
            </div>
          )}

          <Repetir />

          {categoria?.agendaId && (
            <Horario
              agendaId={categoria.agendaId}
              nome={
                dados.agendas.find((a) => a.id === categoria.agendaId)?.nome ??
                "Agenda"
              }
            />
          )}
        </div>
      </div>

      {/* Na Janela, rodapé colado na borda: as margens negativas anulam o
          respiro do corpo dela (px-5 pb-5 / sm:px-7 sm:pb-7). */}
      <div className="sticky bottom-0 z-[1] flex flex-col gap-2 rounded-2xl bg-neutral-50/95 p-2 shadow-[0_-12px_24px_-20px_rgb(0_0_0/0.4)] backdrop-blur sm:flex-row sm:items-center sm:justify-end in-[.painel-modal]:-bottom-5 in-[.painel-modal]:-mx-5 in-[.painel-modal]:-mb-5 in-[.painel-modal]:rounded-none in-[.painel-modal]:border-t in-[.painel-modal]:border-neutral-200 in-[.painel-modal]:px-5 in-[.painel-modal]:pt-3 in-[.painel-modal]:pb-5 in-[.painel-modal]:shadow-none sm:in-[.painel-modal]:-bottom-7 sm:in-[.painel-modal]:-mx-7 sm:in-[.painel-modal]:-mb-7 sm:in-[.painel-modal]:px-7 sm:in-[.painel-modal]:pt-4 sm:in-[.painel-modal]:pb-6">
        {(erroLocal || estado.erro) && (
          <p role="alert" className="px-2 text-sm text-red-700 sm:mr-auto">
            {erroLocal ?? estado.erro}
          </p>
        )}
        <button type="submit" disabled={enviando} className={BOTAO_PRIMARIO}>
          <Send className="size-4" aria-hidden />
          {enviando
            ? "Enviando…"
            : inicial?.convertidoDeId
              ? "Criar Ordem de Serviço"
              : "Abrir chamado"}
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

function PessoasExtras({
  dados,
  escolhidas,
  aoMudar,
}: {
  dados: DadosDoFormulario;
  escolhidas: string[];
  aoMudar: (ids: string[]) => void;
}) {
  const id = useId();
  const nome = useMemo(
    () => new Map(dados.pessoas.map((p) => [p.id, p.nome])),
    [dados.pessoas],
  );
  return (
    <div className={rotulo}>
      <label htmlFor={`${id}-pessoa`}>Também para as pessoas</label>
      {escolhidas.map((p) => (
        <input key={p} type="hidden" name="pessoas_extras" value={p} />
      ))}
      <Selecao
        id={`${id}-pessoa`}
        valor=""
        placeholder="Adicionar pessoa…"
        aoMudar={(v) =>
          v && !escolhidas.includes(v) && aoMudar([...escolhidas, v])
        }
        opcoes={dados.pessoas
          .filter((p) => !escolhidas.includes(p.id))
          .map((p) => ({ valor: p.id, rotulo: p.nome }))}
      />
      {escolhidas.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {escolhidas.map((p) => (
            <li key={p}>
              <button
                type="button"
                onClick={() => aoMudar(escolhidas.filter((x) => x !== p))}
                aria-label={`Tirar ${nome.get(p)}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-neutral-900/[0.06] px-3 text-sm font-normal text-neutral-800 transition hover:bg-neutral-900/[0.1]"
              >
                <CircleUserRound className="size-4" aria-hidden />
                {nome.get(p)} ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
