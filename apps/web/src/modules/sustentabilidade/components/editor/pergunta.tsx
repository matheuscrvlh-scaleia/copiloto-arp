import { formatarNumero } from "@arp/shared/formato";
import {
  aplicarOperacao,
  type Operacao,
  rotulosDoFormulario,
  type TipoFormulario,
  tiposDoFormulario,
} from "@arp/shared/sustentabilidade/editor-operacoes";
import {
  type IndicadoresPorCampo,
  todasAsPerguntas,
  type Uso,
} from "@arp/shared/sustentabilidade/formulario/editor";
import {
  type DefinicaoFormulario,
  type Pergunta,
  ROTULO_TIPO,
  TIPOS_COM_OPCOES,
  TIPOS_CONDICAO,
  type TipoPergunta,
} from "@arp/shared/sustentabilidade/formulario/tipos";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useId, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { Aviso, BOTAO, Janela } from "./janela";

// Painel da pergunta (4.13): seção, número, texto, ajuda, tipo, opções,
// unidades, obrigatória, "mostrar só se" e fonte de indicador. A regra pura
// roda aqui antes (aviso na hora) e de novo no servidor, sobre o rascunho
// do banco.

export type ModoPainel =
  | { tipo: "nova"; secaoId: string }
  | { tipo: "editar"; pergunta: Pergunta; secaoId: string };

interface OpcaoLocal {
  chave: string;
  id?: string;
  texto: string;
  ativa: boolean;
}

let sequencia = 0;
const chaveNova = () => `nova-${++sequencia}`;

function proximoNumero(def: DefinicaoFormulario): string {
  const numeros = todasAsPerguntas(def)
    .map((p) => Number.parseInt(p.numero, 10))
    .filter((n) => Number.isFinite(n));
  return String(numeros.length ? Math.max(...numeros) + 1 : 1);
}

export function PainelPergunta({
  modo,
  aoFechar,
  definicao,
  tipoFormulario,
  uso,
  indicadores,
  unidadesPadrao,
  enviando,
  enviar,
}: {
  modo: ModoPainel;
  aoFechar: () => void;
  definicao: DefinicaoFormulario;
  tipoFormulario: TipoFormulario;
  uso: Uso;
  indicadores: IndicadoresPorCampo;
  unidadesPadrao: string[];
  enviando: boolean;
  /** Manda a operação; true = gravou (fecha o painel). */
  enviar: (op: Operacao) => Promise<boolean>;
}) {
  const r = rotulosDoFormulario(tipoFormulario);
  const atual = modo.tipo === "editar" ? modo.pergunta : null;
  const travada = atual?.travada ?? false;
  const usos = atual ? (uso.perguntas[atual.id] ?? 0) : 0;
  const ids = {
    secao: useId(),
    numero: useId(),
    tipo: useId(),
    texto: useId(),
    ajuda: useId(),
    unidades: useId(),
    regra: useId(),
  };

  const [secaoId, setSecaoId] = useState(modo.secaoId);
  const [numero, setNumero] = useState(
    atual?.numero ?? proximoNumero(definicao),
  );
  const [texto, setTexto] = useState(atual?.texto ?? "");
  const [ajuda, setAjuda] = useState(atual?.ajuda ?? "");
  const [tipo, setTipo] = useState<TipoPergunta>(atual?.tipo ?? "texto");
  const [obrigatoria, setObrigatoria] = useState(atual?.obrigatoria ?? false);
  const [opcoes, setOpcoes] = useState<OpcaoLocal[]>(
    atual?.opcoes.map((o) => ({ ...o, chave: o.id })) ?? [
      { chave: chaveNova(), texto: "", ativa: true },
      { chave: chaveNova(), texto: "", ativa: true },
    ],
  );
  const [unidades, setUnidades] = useState(
    (atual?.unidades.length ? atual.unidades : unidadesPadrao).join("\n"),
  );
  const [regra, setRegra] = useState(
    atual?.mostrar_se
      ? `${atual.mostrar_se.pergunta_id}|${atual.mostrar_se.valor}`
      : "",
  );
  const [fonte, setFonte] = useState(atual?.fonte_indicador ?? false);
  const [erro, setErro] = useState<string>();

  const comOpcoes = TIPOS_COM_OPCOES.includes(tipo);
  const tipos = tiposDoFormulario(tipoFormulario);
  const tiposDaLista =
    atual && !tipos.includes(atual.tipo) ? [atual.tipo, ...tipos] : tipos;

  // Condições possíveis: perguntas ativas, de opções ou de sim/não.
  const condicoes = definicao.secoes
    .filter((s) => s.ativa)
    .flatMap((s) => s.perguntas)
    .filter(
      (p) => p.ativa && p.id !== atual?.id && TIPOS_CONDICAO.includes(p.tipo),
    )
    .flatMap((p) =>
      (p.tipo === "uma" || p.tipo === "varias"
        ? p.opcoes
            .filter((o) => o.ativa)
            .map((o) => ({ valor: o.id, texto: o.texto }))
        : [
            { valor: "sim", texto: "Sim" },
            { valor: "nao", texto: "Não" },
          ]
      ).map((v) => ({
        chave: `${p.id}|${v.valor}`,
        rotulo: `${p.numero} = ${v.texto}`,
      })),
    );

  const indicadoresDoCampo = atual ? (indicadores[atual.id] ?? []) : [];

  const mudarOpcao = (chave: string, muda: Partial<OpcaoLocal>) =>
    setOpcoes((os) =>
      os.map((o) => (o.chave === chave ? { ...o, ...muda } : o)),
    );
  const moverOpcao = (i: number, passo: -1 | 1) =>
    setOpcoes((os) => {
      const j = i + passo;
      const a = os[i];
      const b = os[j];
      if (!a || !b) return os;
      const nova = [...os];
      nova[i] = b;
      nova[j] = a;
      return nova;
    });

  function operacao(): Operacao {
    const [pid, valor] = regra.split("|");
    const dados = {
      numero,
      texto,
      ajuda,
      tipo,
      obrigatoria,
      opcoes: comOpcoes
        ? opcoes.map(({ id, texto: t, ativa }) => ({ id, texto: t, ativa }))
        : [],
      unidades:
        tipo === "numero_unidade"
          ? unidades
              .split("\n")
              .map((u) => u.trim())
              .filter(Boolean)
          : [],
      mostrar_se: pid && valor ? { pergunta_id: pid, valor } : null,
      ...(tipoFormulario === "questionario" ? { fonte_indicador: fonte } : {}),
    };
    if (!atual) return { op: "criar_pergunta", secao_id: secaoId, dados };
    if (travada)
      return {
        op: "editar_pergunta",
        pergunta_id: atual.id,
        mudancas: { ajuda },
      };
    return {
      op: "editar_pergunta",
      pergunta_id: atual.id,
      mudancas: {
        ...dados,
        ...(secaoId !== modo.secaoId ? { secao_id: secaoId } : {}),
      },
    };
  }

  async function salvar() {
    const op = operacao();
    // Mesma regra do servidor, só para avisar na hora.
    const local = aplicarOperacao(
      definicao,
      op,
      {
        uso,
        indicadoresPorCampo: indicadores,
        novoId: chaveNova,
        programa: tipoFormulario === "programa",
      },
      tipos,
    );
    if ("erro" in local) {
      if (local.erro === "Nada mudou.") aoFechar();
      else setErro(local.erro);
      return;
    }
    setErro(undefined);
    if (await enviar(op)) aoFechar();
  }

  return (
    <Janela
      aberto
      aoFechar={aoFechar}
      guia="painel-pergunta"
      largura="media"
      subtitulo={`${r.Item} · rascunho`}
      titulo={
        atual
          ? `Editar ${r.item} ${atual.numero}`
          : `Nov${r.item === "campo" ? "o" : "a"} ${r.item}`
      }
      rodape={
        <>
          <button type="button" className={BOTAO.secundario} onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className={BOTAO.primario}
            disabled={enviando}
            onClick={salvar}
          >
            {enviando
              ? "Gravando…"
              : atual
                ? "Salvar no rascunho"
                : `Criar ${r.item} no rascunho`}
          </button>
        </>
      }
    >
      {travada && (
        <Aviso>
          Campo automático do ENET: só o texto de ajuda pode ser editado.
        </Aviso>
      )}
      {usos > 0 && !travada && (
        <Aviso>
          Já tem {formatarNumero(usos)} {r.usos}. Mudar o texto não altera{" "}
          {r.usos} antig{r.usos === "respostas" ? "as" : "os"}. O tipo de
          resposta não pode mudar: para isso, inative est
          {r.item === "campo" ? "e" : "a"} e crie outr
          {r.item === "campo" ? "o" : "a"}.
        </Aviso>
      )}
      {erro && <Aviso tom="erro">{erro}</Aviso>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div className="sm:col-span-5">
          <Rotulo htmlFor={ids.secao}>Seção</Rotulo>
          <select
            id={ids.secao}
            className={classeCampo}
            value={secaoId}
            disabled={travada}
            onChange={(e) => setSecaoId(e.target.value)}
          >
            {definicao.secoes
              .filter((s) => s.ativa || s.id === modo.secaoId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Rotulo htmlFor={ids.numero}>Nº</Rotulo>
          <input
            id={ids.numero}
            className={classeCampo}
            value={numero}
            disabled={travada}
            maxLength={20}
            onChange={(e) => setNumero(e.target.value)}
          />
        </div>
        <div className="sm:col-span-5">
          <Rotulo htmlFor={ids.tipo}>Tipo de resposta</Rotulo>
          <select
            id={ids.tipo}
            className={classeCampo}
            value={tipo}
            disabled={travada || usos > 0}
            onChange={(e) => setTipo(e.target.value as TipoPergunta)}
          >
            {tiposDaLista.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-12">
          <Rotulo htmlFor={ids.texto}>{r.Item}</Rotulo>
          <textarea
            id={ids.texto}
            className={classeCampo}
            rows={2}
            value={texto}
            disabled={travada}
            maxLength={1000}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <div className="sm:col-span-12">
          <Rotulo htmlFor={ids.ajuda}>
            Texto de ajuda (aparece abaixo d{r.item === "campo" ? "o" : "a"}{" "}
            {r.item})
          </Rotulo>
          <textarea
            id={ids.ajuda}
            className={classeCampo}
            rows={2}
            value={ajuda}
            maxLength={2000}
            onChange={(e) => setAjuda(e.target.value)}
          />
        </div>

        {tipo === "numero_unidade" && (
          <div className="sm:col-span-12">
            <Rotulo htmlFor={ids.unidades}>
              Unidades aceitas (uma por linha)
            </Rotulo>
            <textarea
              id={ids.unidades}
              className={classeCampo}
              rows={4}
              value={unidades}
              disabled={travada}
              onChange={(e) => setUnidades(e.target.value)}
            />
          </div>
        )}

        {comOpcoes && (
          <div data-guia="opcoes" className="sm:col-span-12">
            <span className="mb-1 block text-xs font-medium text-neutral-600">
              {tipo === "grade"
                ? "Linhas da tabela (as colunas são Pouco, Médio, Muito e Não gera)"
                : "Opções de resposta"}
            </span>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                    <th className="px-1 py-1.5 text-left font-medium">Ordem</th>
                    <th className="px-1 py-1.5 text-left font-medium">Texto</th>
                    <th className="px-1 py-1.5 text-right font-medium">
                      Usada
                    </th>
                    <th className="px-1 py-1.5 text-left font-medium">
                      Situação
                    </th>
                    <th className="px-1 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {opcoes.map((o, i) => {
                    const usada = o.id ? (uso.opcoes[o.id] ?? 0) : 0;
                    return (
                      <tr
                        key={o.chave}
                        className={`border-b border-neutral-900/[0.06] ${o.ativa ? "" : "text-neutral-400"}`}
                      >
                        <td className="px-1 py-1 whitespace-nowrap">
                          <button
                            type="button"
                            className={BOTAO.icone}
                            aria-label="Subir opção"
                            disabled={travada || i === 0}
                            onClick={() => moverOpcao(i, -1)}
                          >
                            <ArrowUp className="size-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={BOTAO.icone}
                            aria-label="Descer opção"
                            disabled={travada || i === opcoes.length - 1}
                            onClick={() => moverOpcao(i, 1)}
                          >
                            <ArrowDown className="size-3.5" aria-hidden />
                          </button>
                        </td>
                        <td className="px-1 py-1">
                          <input
                            className={`${classeCampo} py-1.5`}
                            value={o.texto}
                            maxLength={300}
                            disabled={travada}
                            aria-label={`Texto da opção ${i + 1}`}
                            onChange={(e) =>
                              mudarOpcao(o.chave, { texto: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-1 py-1 text-right tabular-nums">
                          {formatarNumero(usada)}
                        </td>
                        <td className="px-1 py-1">
                          <Situacao ativa={o.ativa} />
                        </td>
                        <td className="px-1 py-1 whitespace-nowrap text-right">
                          <button
                            type="button"
                            className={BOTAO.pequeno}
                            disabled={travada}
                            onClick={() =>
                              mudarOpcao(o.chave, { ativa: !o.ativa })
                            }
                          >
                            {o.ativa ? "Inativar" : "Reativar"}
                          </button>{" "}
                          {usada === 0 && (
                            <button
                              type="button"
                              className={BOTAO.pequenoPerigo}
                              disabled={travada}
                              onClick={() =>
                                setOpcoes((os) =>
                                  os.filter((x) => x.chave !== o.chave),
                                )
                              }
                            >
                              Excluir
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={BOTAO.pequeno}
                disabled={travada}
                onClick={() =>
                  setOpcoes((os) => [
                    ...os,
                    { chave: chaveNova(), texto: "", ativa: true },
                  ])
                }
              >
                <Plus className="size-3.5" aria-hidden />
                Adicionar {tipo === "grade" ? "linha" : "opção"}
              </button>
              <span className="text-xs text-neutral-500">
                Opção já usada só pode ser inativada; {r.usos} antig
                {r.usos === "respostas" ? "as" : "os"} mantêm o texto original.
              </span>
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 sm:col-span-4">
          <input
            type="checkbox"
            checked={obrigatoria}
            disabled={travada}
            onChange={(e) => setObrigatoria(e.target.checked)}
          />
          Obrigatória
        </label>
        <div className="sm:col-span-8">
          <Rotulo htmlFor={ids.regra}>Mostrar só se</Rotulo>
          <select
            id={ids.regra}
            className={classeCampo}
            value={regra}
            disabled={travada}
            onChange={(e) => setRegra(e.target.value)}
          >
            <option value="">Sempre mostrar</option>
            {regra && !condicoes.some((c) => c.chave === regra) && (
              <option value={regra}>
                Regra atual (pergunta ou opção inativa)
              </option>
            )}
            {condicoes.map((c) => (
              <option key={c.chave} value={c.chave}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-12">
          {tipoFormulario === "questionario" ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={fonte}
                disabled={travada}
                onChange={(e) => setFonte(e.target.checked)}
              />
              Fonte de indicador (gráficos da tela Respostas e painel)
            </label>
          ) : (
            <p className="text-xs text-neutral-600">
              <span className="font-medium">Usado por indicador: </span>
              {indicadoresDoCampo.length
                ? `${indicadoresDoCampo.join("; ")} (aba Indicadores)`
                : "não (os indicadores são definidos na aba Indicadores)"}
            </p>
          )}
        </div>
      </div>
    </Janela>
  );
}

function Rotulo({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs font-medium text-neutral-600"
    >
      {children}
    </label>
  );
}

export function Situacao({
  ativa,
  travada = false,
}: {
  ativa: boolean;
  travada?: boolean;
}) {
  const [texto, cor] = travada
    ? ["Travada", "bg-sky-100 text-sky-800"]
    : ativa
      ? ["Ativa", "bg-emerald-100 text-emerald-800"]
      : ["Inativa", "bg-neutral-900/[0.06] text-neutral-600"];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cor}`}
    >
      {texto}
    </span>
  );
}
