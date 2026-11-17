import { formatarNumero, lerValorBr } from "@arp/shared/formato";
import {
  type DefinicaoFormulario,
  NIVEIS_GRADE,
  type Pergunta,
  type Respostas,
  validarRespostas,
} from "@arp/shared/sustentabilidade/formulario/tipos";
import {
  perguntaVisivel,
  respostasVisiveis,
} from "@arp/shared/sustentabilidade/formulario/visibilidade";
import {
  nomeCadastrado,
  nomesParecidos,
} from "@arp/shared/sustentabilidade/lancamento-cadastro";
import {
  type CustoPorPessoa,
  camposReais,
  ERRO_DATA,
  preencherCustosPorPessoa,
  temCampoDeData,
} from "@arp/shared/sustentabilidade/lancamento-valores";
import { Lightbulb, Loader } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import { Selecao } from "@/components/selecao";
import type { RespostaLancamento } from "../../api-programas";

// Formulário de lançamento de um programa (spec 4.8): o MESMO para o
// parceiro (página do link) e para a equipe ("Lançar pela equipe" e
// corrigir). Monta os campos da versão publicada, com "mostrar só se",
// confere com as regras do editor antes de enviar e mostra o erro de cada
// campo. "Lista de cadastro" sugere nomes parecidos antes de criar um novo.
// Feito para o celular: um campo por linha, alvos grandes.

const BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60";

export function FormularioDeLancamento({
  definicao,
  valoresIniciais = {},
  dataInicial = "",
  listas = {},
  enviar,
  rotulo = "Enviar lançamento",
  limparAoConcluir = true,
  aoConcluir,
  custos,
}: {
  definicao: DefinicaoFormulario;
  valoresIniciais?: Respostas;
  /** Data do fato quando o formulário não tem campo de data. */
  dataInicial?: string;
  /** Nomes já cadastrados por campo "lista de cadastro". */
  listas?: Record<string, string[]>;
  enviar: (
    respostas: Respostas,
    data: string | null,
  ) => Promise<RespostaLancamento>;
  rotulo?: string;
  limparAoConcluir?: boolean;
  aoConcluir?: () => void;
  /**
   * Custos por pessoa (tour: álbum e copo, dos Parâmetros): preenchidos
   * pelo número de participantes enquanto a pessoa não mexe no campo. Só
   * para quem tem "Ver valores"; sem isso, o servidor preenche ao gravar.
   */
  custos?: CustoPorPessoa | null;
}) {
  const [respostas, setRespostas] = useState<Respostas>(valoresIniciais);
  const [data, setData] = useState(dataInicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, iniciar] = useTransition();
  const [chave, setChave] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const idData = useId();
  const pedeData = !temCampoDeData(definicao);
  // Custo que já veio preenchido (correção) conta como editado.
  const editados = useRef(
    new Set(
      Object.keys(valoresIniciais).filter((k) => k in (custos?.custos ?? {})),
    ),
  );
  const reais = useMemo(() => camposReais(definicao), [definicao]);

  const secoes = useMemo(
    () =>
      definicao.secoes
        .filter((s) => s.ativa)
        .map((s) => ({
          ...s,
          perguntas: s.perguntas.filter((p) =>
            perguntaVisivel(p, respostas, definicao),
          ),
        }))
        .filter((s) => s.perguntas.length > 0),
    [definicao, respostas],
  );

  function mudar(id: string, valor: unknown) {
    if (custos && id in custos.custos) editados.current.add(id);
    setRespostas((r) => {
      const n = { ...r };
      if (valor === undefined) delete n[id];
      else n[id] = valor;
      if (!custos || id !== custos.pessoas) return n;
      // Novo número de pessoas: refaz os custos que a pessoa não editou.
      const livres = Object.keys(custos.custos).filter(
        (c) => reais.has(c) && !editados.current.has(c),
      );
      for (const c of livres) delete n[c];
      return preencherCustosPorPessoa(definicao, n, {
        ...custos,
        custos: Object.fromEntries(
          livres.map((c) => [c, custos.custos[c] ?? 0]),
        ),
      });
    });
    setErros((e) => {
      if (!e[id]) return e;
      const { [id]: _, ...resto } = e;
      return resto;
    });
  }

  function enviarForm(ev: React.FormEvent) {
    ev.preventDefault();
    const locais = validarRespostas(definicao, respostas);
    if (pedeData && !data) locais[ERRO_DATA] = "Informe a data.";
    if (Object.keys(locais).length) {
      setErros(locais);
      notificar("erro", "Confira os campos marcados.");
      form.current
        ?.querySelector("[aria-invalid=true]")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    iniciar(async () => {
      const r = await enviar(
        respostasVisiveis(definicao, respostas),
        pedeData ? data : null,
      );
      if (r.erros) setErros(r.erros);
      if (r.erro) notificar("erro", r.erro);
      if (r.ok) {
        notificar("ok", r.ok);
        if (limparAoConcluir) {
          setRespostas({});
          setData("");
          setErros({});
          editados.current.clear();
          setChave((k) => k + 1);
        }
        aoConcluir?.();
      }
    });
  }

  if (!secoes.length && !pedeData)
    return (
      <p className="text-sm text-neutral-600">
        Este formulário ainda não tem campos. A equipe monta os campos na aba
        Formulário do programa.
      </p>
    );

  return (
    <form
      ref={form}
      key={chave}
      onSubmit={enviarForm}
      noValidate
      className="flex flex-col gap-6"
    >
      {pedeData && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={idData} className="text-sm font-medium">
            Data <span className="text-red-700">*</span>
          </label>
          <input
            id={idData}
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            aria-invalid={Boolean(erros[ERRO_DATA])}
            className={classeCampo}
          />
          <Erro texto={erros[ERRO_DATA]} />
        </div>
      )}
      {secoes.map((s) => (
        <fieldset key={s.id} className="flex flex-col gap-5">
          {secoes.length > 1 && (
            <legend className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {s.nome}
            </legend>
          )}
          {s.perguntas.map((p) => (
            <Campo
              key={p.id}
              p={p}
              valor={respostas[p.id]}
              erro={erros[p.id]}
              lista={listas[p.id] ?? []}
              mudar={(v) => mudar(p.id, v)}
            />
          ))}
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className={BOTAO}>
          {enviando && <Loader className="size-4 animate-spin" aria-hidden />}
          {enviando ? "Enviando…" : rotulo}
        </button>
      </div>
    </form>
  );
}

function Erro({ texto }: { texto?: string }) {
  if (!texto) return null;
  return (
    <p role="alert" className="text-xs font-medium text-red-700">
      {texto}
    </p>
  );
}

function Campo({
  p,
  valor,
  erro,
  lista,
  mudar,
}: {
  p: Pergunta;
  valor: unknown;
  erro?: string;
  lista: string[];
  mudar: (v: unknown) => void;
}) {
  const id = useId();
  const grupo = [
    "uma",
    "varias",
    "sim_nao",
    "sim_nao_quantidade",
    "sim_nao_descricao",
    "grade",
  ].includes(p.tipo);
  const Rotulo = grupo ? "legend" : "label";
  const corpo = (
    <>
      <Rotulo
        {...(grupo ? {} : { htmlFor: id })}
        className="text-sm font-medium text-neutral-900"
      >
        {p.texto}
        {p.obrigatoria && <span className="text-red-700"> *</span>}
      </Rotulo>
      {p.ajuda && <p className="-mt-1 text-xs text-neutral-500">{p.ajuda}</p>}
      <Entrada
        p={p}
        id={id}
        valor={valor}
        invalido={Boolean(erro)}
        lista={lista}
        mudar={mudar}
      />
      <Erro texto={erro} />
    </>
  );
  return grupo ? (
    <fieldset
      aria-invalid={Boolean(erro)}
      className="flex min-w-0 flex-col gap-1.5"
    >
      {corpo}
    </fieldset>
  ) : (
    <div className="flex min-w-0 flex-col gap-1.5">{corpo}</div>
  );
}

const textoDoNumero = (v: unknown, casas?: number) =>
  typeof v === "number"
    ? casas === undefined
      ? String(v).replace(".", ",")
      : formatarNumero(v, casas)
    : "";

/** Número digitado em pt-BR ("1.234,5" ou "12,5"); guarda número. */
function CampoNumero({
  id,
  valor,
  mudar,
  invalido,
  reais = false,
  placeholder,
}: {
  id: string;
  valor: unknown;
  mudar: (v: number | undefined) => void;
  invalido: boolean;
  reais?: boolean;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState(
    textoDoNumero(valor, reais ? 2 : undefined),
  );
  // Valor trocado de fora (custo pré-preenchido): o texto acompanha.
  const emitido = useRef<unknown>(valor);
  useEffect(() => {
    if (valor === emitido.current) return;
    emitido.current = valor;
    setTexto(textoDoNumero(valor, reais ? 2 : undefined));
  }, [valor, reais]);
  return (
    <div className="relative">
      {reais && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-neutral-500">
          R$
        </span>
      )}
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={texto}
        placeholder={placeholder}
        aria-invalid={invalido}
        onChange={(e) => {
          setTexto(e.target.value);
          const n = lerValorBr(e.target.value);
          const v = n === null || Number.isNaN(n) ? undefined : n;
          emitido.current = v;
          mudar(v);
        }}
        className={`${classeCampo} tabular-nums ${reais ? "pl-10" : ""}`}
      />
    </div>
  );
}

function Opcoes({
  p,
  valor,
  mudar,
  multipla,
}: {
  p: Pergunta;
  valor: unknown;
  mudar: (v: unknown) => void;
  multipla: boolean;
}) {
  const ativas = p.opcoes.filter((o) => o.ativa);
  const marcadas = multipla
    ? new Set(Array.isArray(valor) ? (valor as string[]) : [])
    : new Set(typeof valor === "string" ? [valor] : []);
  if (!multipla && ativas.length > 8)
    return (
      <Selecao
        opcoes={ativas.map((o) => ({ valor: o.id, rotulo: o.texto }))}
        valor={typeof valor === "string" ? valor : ""}
        aoMudar={(v) => mudar(v || undefined)}
        rotulo={p.texto}
        busca
      />
    );
  return (
    <div className="flex flex-wrap gap-2">
      {ativas.map((o) => {
        const marcada = marcadas.has(o.id);
        return (
          <label
            key={o.id}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition ${marcada ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"}`}
          >
            <input
              type={multipla ? "checkbox" : "radio"}
              name={p.id}
              checked={marcada}
              onChange={() => {
                if (!multipla) return mudar(marcada ? undefined : o.id);
                const n = new Set(marcadas);
                if (marcada) n.delete(o.id);
                else n.add(o.id);
                mudar(n.size ? [...n] : undefined);
              }}
              className="sr-only"
            />
            {o.texto}
          </label>
        );
      })}
    </div>
  );
}

function SimNao({
  p,
  valor,
  mudar,
}: {
  p: Pergunta;
  valor: unknown;
  mudar: (v: unknown) => void;
}) {
  const atual = (valor ?? {}) as { r?: string; d?: unknown };
  const idDetalhe = useId();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {(["sim", "nao"] as const).map((r) => (
          <label
            key={r}
            className={`inline-flex min-w-20 cursor-pointer items-center justify-center rounded-full border px-4 py-2.5 text-sm transition ${atual.r === r ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white hover:border-neutral-400"}`}
          >
            <input
              type="radio"
              name={p.id}
              checked={atual.r === r}
              onChange={() =>
                mudar(atual.r === r ? undefined : { ...atual, r })
              }
              className="sr-only"
            />
            {r === "sim" ? "Sim" : "Não"}
          </label>
        ))}
      </div>
      {atual.r === "sim" && p.tipo === "sim_nao_quantidade" && (
        <CampoNumero
          id={idDetalhe}
          valor={atual.d}
          placeholder="Quantidade"
          invalido={false}
          mudar={(n) =>
            mudar({ r: "sim", ...(n === undefined ? {} : { d: n }) })
          }
        />
      )}
      {atual.r === "sim" && p.tipo === "sim_nao_descricao" && (
        <input
          id={idDetalhe}
          value={typeof atual.d === "string" ? atual.d : ""}
          placeholder="Descreva"
          onChange={(e) => mudar({ r: "sim", d: e.target.value })}
          className={classeCampo}
        />
      )}
    </div>
  );
}

function ListaDeCadastro({
  id,
  p,
  valor,
  lista,
  mudar,
  invalido,
}: {
  id: string;
  p: Pergunta;
  valor: unknown;
  lista: string[];
  mudar: (v: unknown) => void;
  invalido: boolean;
}) {
  const atual = typeof valor === "string" ? valor : "";
  const idLista = useId();
  const parecidos = useMemo(() => nomesParecidos(atual, lista), [atual, lista]);
  const existe = nomeCadastrado(atual, lista);
  return (
    <div className="flex flex-col gap-2">
      <input
        id={id}
        list={idLista}
        value={atual}
        autoComplete="off"
        aria-invalid={invalido}
        placeholder={`Comece a digitar (${lista.length} ${lista.length === 1 ? "cadastrado" : "cadastrados"})`}
        onChange={(e) => mudar(e.target.value || undefined)}
        className={classeCampo}
      />
      <datalist id={idLista}>
        {lista.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {atual.trim() && !existe && (
        <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {parecidos.length > 0 ? (
            <>
              <p className="flex items-center gap-1.5 font-medium">
                <Lightbulb className="size-3.5" aria-hidden />
                Parecidos já cadastrados: é algum destes?
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {parecidos.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => mudar(n)}
                    className="rounded-full border border-amber-300 bg-white px-3 py-1.5 font-medium hover:border-amber-500"
                  >
                    Usar “{n}”
                  </button>
                ))}
              </div>
              <p className="mt-2">
                Se não for nenhum, siga: “{atual.trim()}” entra como novo{" "}
                {p.texto.toLowerCase()} ao enviar.
              </p>
            </>
          ) : (
            <p>
              “{atual.trim()}” ainda não está na lista: entra como novo ao
              enviar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Grade({
  p,
  valor,
  mudar,
}: {
  p: Pergunta;
  valor: unknown;
  mudar: (v: unknown) => void;
}) {
  const atual = (valor ?? {}) as Record<string, string>;
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="text-xs text-neutral-500">
            <th className="py-1 text-left font-medium" />
            {NIVEIS_GRADE.map((n) => (
              <th key={n.id} className="px-1 py-1 font-medium">
                {n.texto}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.opcoes
            .filter((o) => o.ativa)
            .map((o) => (
              <tr key={o.id} className="border-t border-neutral-100">
                <td className="py-2 pr-2">{o.texto}</td>
                {NIVEIS_GRADE.map((n) => (
                  <td key={n.id} className="px-1 py-2 text-center">
                    <input
                      type="radio"
                      name={`${p.id}-${o.id}`}
                      aria-label={`${o.texto}: ${n.texto}`}
                      checked={atual[o.id] === n.id}
                      onChange={() => mudar({ ...atual, [o.id]: n.id })}
                      className="size-5 accent-neutral-900"
                    />
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function Entrada({
  p,
  id,
  valor,
  invalido,
  lista,
  mudar,
}: {
  p: Pergunta;
  id: string;
  valor: unknown;
  invalido: boolean;
  lista: string[];
  mudar: (v: unknown) => void;
}) {
  const textoAtual = typeof valor === "string" ? valor : "";
  const vazioOu = (v: string) => (v === "" ? undefined : v);
  switch (p.tipo) {
    case "texto":
    case "auto":
      return (
        <input
          id={id}
          value={textoAtual}
          aria-invalid={invalido}
          onChange={(e) => mudar(vazioOu(e.target.value))}
          className={classeCampo}
        />
      );
    case "texto_longo":
      return (
        <textarea
          id={id}
          rows={3}
          value={textoAtual}
          aria-invalid={invalido}
          onChange={(e) => mudar(vazioOu(e.target.value))}
          className={classeCampo}
        />
      );
    case "numero":
      return (
        <CampoNumero id={id} valor={valor} mudar={mudar} invalido={invalido} />
      );
    case "reais":
      return (
        <CampoNumero
          id={id}
          valor={valor}
          mudar={mudar}
          invalido={invalido}
          reais
          placeholder="0,00"
        />
      );
    case "numero_unidade": {
      const atual = (valor ?? {}) as { n?: number; u?: string };
      const unidades = p.unidades.length ? p.unidades : [];
      const u = atual.u ?? unidades[0] ?? "";
      return (
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <CampoNumero
              id={id}
              valor={atual.n}
              invalido={invalido}
              mudar={(n) => mudar(n === undefined ? undefined : { n, u })}
            />
          </div>
          {unidades.length > 1 ? (
            <Selecao
              opcoes={unidades.map((x) => ({ valor: x, rotulo: x }))}
              valor={u}
              rotulo="Unidade"
              aoMudar={(x) =>
                mudar(atual.n === undefined ? undefined : { n: atual.n, u: x })
              }
              className="w-36"
            />
          ) : (
            <span className="self-center text-sm text-neutral-600">{u}</span>
          )}
        </div>
      );
    }
    case "uma":
      return <Opcoes p={p} valor={valor} mudar={mudar} multipla={false} />;
    case "varias":
      return <Opcoes p={p} valor={valor} mudar={mudar} multipla />;
    case "data":
      return (
        <input
          id={id}
          type="date"
          value={textoAtual}
          aria-invalid={invalido}
          onChange={(e) => mudar(vazioOu(e.target.value))}
          className={classeCampo}
        />
      );
    case "hora":
      return (
        <input
          id={id}
          type="time"
          value={textoAtual}
          aria-invalid={invalido}
          onChange={(e) => mudar(vazioOu(e.target.value))}
          className={classeCampo}
        />
      );
    case "sim_nao":
    case "sim_nao_quantidade":
    case "sim_nao_descricao":
      return <SimNao p={p} valor={valor} mudar={mudar} />;
    case "grade":
      return <Grade p={p} valor={valor} mudar={mudar} />;
    case "lista_cadastro":
      return (
        <ListaDeCadastro
          id={id}
          p={p}
          valor={valor}
          lista={lista}
          mudar={mudar}
          invalido={invalido}
        />
      );
    case "anexo":
      // atalho: envio de arquivo pelo lançamento ainda não existe; o campo
      // anexo aceita a referência em texto (ex.: "enviado por e-mail").
      return (
        <input
          id={id}
          value={textoAtual}
          placeholder="Descreva onde está o arquivo (envio de anexo em breve)"
          aria-invalid={invalido}
          onChange={(e) => mudar(vazioOu(e.target.value))}
          className={classeCampo}
        />
      );
  }
}
