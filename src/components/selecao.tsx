"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

// Seleção padrão do sistema (no lugar do <select> nativo): botão em pílula
// ou campo, lista flutuante de vidro com marca no escolhido, busca quando há
// muitas opções e teclado completo (setas, Home/End, Enter, Esc, digitar
// para pular). Num formulário, grava num campo oculto com o mesmo "name".
// A lista é desenhada no <body>: dentro de um cartão de vidro (backdrop-filter)
// ela ficaria presa ao cartão e cortada.

export interface Opcao {
  valor: string;
  rotulo: string;
  /** Linha menor embaixo do rótulo. */
  descricao?: string;
  desabilitada?: boolean;
}

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const ESTILO = {
  pilula:
    "vidro rounded-full py-2 pr-3 pl-4 hover:border-neutral-400 data-[aberta=true]:border-neutral-900",
  campo:
    "rounded-xl border border-neutral-200 bg-white py-2 pr-2.5 pl-3 hover:border-neutral-400 data-[aberta=true]:border-neutral-900 data-[aberta=true]:ring-4 data-[aberta=true]:ring-neutral-900/5",
  /** Dentro de uma barra de vidro (filtros): sem borda própria. */
  embutida:
    "rounded-full py-2 pr-3 pl-3.5 hover:bg-white/70 data-[aberta=true]:bg-white/90 dark:hover:bg-white/10 dark:data-[aberta=true]:bg-white/15",
} as const;

export function Selecao({
  opcoes,
  name,
  valor,
  valorInicial = "",
  aoMudar,
  placeholder = "Selecione…",
  rotulo,
  id,
  obrigatorio = false,
  desabilitada = false,
  variante = "campo",
  busca,
  icone,
  multipla = false,
  className = "",
}: {
  opcoes: Opcao[];
  /** Nome do campo no formulário. */
  name?: string;
  /** Valor controlado (com aoMudar). */
  valor?: string;
  /** Valor inicial quando não é controlado. */
  valorInicial?: string;
  aoMudar?: (valor: string) => void;
  placeholder?: string;
  /** Nome acessível, quando não há <label htmlFor>. */
  rotulo?: string;
  id?: string;
  obrigatorio?: boolean;
  desabilitada?: boolean;
  variante?: keyof typeof ESTILO;
  /** Caixa de busca na lista; por padrão, a partir de 9 opções. */
  busca?: boolean;
  /** Ícone à esquerda do texto (ex.: calendário no filtro de mês). */
  icone?: React.ReactNode;
  /**
   * Várias escolhas: o valor junta as marcadas com vírgula e a opção de
   * valor "" é "todas". A lista fica aberta enquanto a pessoa marca; a
   * escolha vale ao fechar.
   */
  multipla?: boolean;
  className?: string;
}) {
  const [interno, setInterno] = useState(valorInicial);
  const valorFora = valor ?? interno;
  const [rascunho, setRascunho] = useState<string | null>(null);
  const atual = rascunho ?? valorFora;
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [termo, setTermo] = useState("");
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    width: number;
    acima: boolean;
  } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);
  const digitado = useRef({ texto: "", ate: 0 });
  const idBase = useId();
  const idBotao = id ?? `${idBase}-botao`;
  const idLista = `${idBase}-lista`;
  const comBusca = busca ?? opcoes.length > 8;

  const marcadas = multipla ? atual.split(",").filter(Boolean) : [];
  const marcada = (o: Opcao) =>
    multipla
      ? o.valor
        ? marcadas.includes(o.valor)
        : !marcadas.length
      : o.valor === atual;
  const primeira = opcoes.find((o) => o.valor === (marcadas[0] ?? atual));
  const escolhida =
    primeira && marcadas.length > 1
      ? { rotulo: `${primeira.rotulo} +${marcadas.length - 1}` }
      : primeira;
  const t = sem(termo.trim());
  const visiveis = t
    ? opcoes.filter((o) => sem(`${o.rotulo} ${o.descricao ?? ""}`).includes(t))
    : opcoes;

  const mudar = useCallback(
    (v: string) => {
      if (valor === undefined) setInterno(v);
      aoMudar?.(v);
    },
    [aoMudar, valor],
  );

  const escolher = useCallback(
    (o: Opcao) => {
      if (o.desabilitada) return;
      if (multipla && o.valor) {
        // Marca ou desmarca; todas marcadas é o mesmo que "todas".
        const novas = marcadas.includes(o.valor)
          ? marcadas.filter((v) => v !== o.valor)
          : [...marcadas, o.valor];
        const todas = opcoes.every((x) => !x.valor || novas.includes(x.valor));
        setRascunho(todas ? "" : novas.join(","));
        return;
      }
      if (multipla) setRascunho(o.valor);
      else mudar(o.valor);
      setAberta(false);
      botao.current?.focus();
    },
    [multipla, marcadas, opcoes, mudar],
  );

  // Várias escolhas: vale o rascunho quando a lista fecha.
  useEffect(() => {
    if (aberta || rascunho === null) return;
    if (rascunho !== valorFora) mudar(rascunho);
    setRascunho(null);
  }, [aberta, rascunho, valorFora, mudar]);

  // Posição da lista: embaixo do botão, ou em cima se não couber.
  const posicionar = useCallback(() => {
    const b = botao.current?.getBoundingClientRect();
    if (!b) return;
    const altura = Math.min(320, opcoes.length * 40 + (comBusca ? 56 : 12));
    const acima =
      window.innerHeight - b.bottom < altura + 16 && b.top > altura + 16;
    setPos({
      left: Math.min(b.left, window.innerWidth - Math.max(b.width, 220) - 8),
      top: acima ? b.top - 6 : b.bottom + 6,
      width: b.width,
      acima,
    });
  }, [opcoes.length, comBusca]);

  useLayoutEffect(() => {
    if (aberta) posicionar();
    else setPos(null);
  }, [aberta, posicionar]);

  /** Abre já com a opção escolhida em destaque e a busca limpa. */
  function abrir() {
    setTermo("");
    setAtivo(
      Math.max(
        opcoes.findIndex((o) => o.valor === atual),
        0,
      ),
    );
    setAberta(true);
  }

  // A lista só existe depois de posicionada: o foco espera por ela.
  const pronta = aberta && pos !== null;
  useEffect(() => {
    if (!pronta) return;
    (comBusca ? campoBusca.current : lista.current)?.focus();
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!botao.current?.contains(alvo) && !lista.current?.contains(alvo))
        setAberta(false);
    };
    window.addEventListener("pointerdown", fora);
    window.addEventListener("resize", posicionar);
    window.addEventListener("scroll", posicionar, true);
    return () => {
      window.removeEventListener("pointerdown", fora);
      window.removeEventListener("resize", posicionar);
      window.removeEventListener("scroll", posicionar, true);
    };
  }, [pronta, comBusca, posicionar]);

  // Mantém a opção ativa visível ao andar com as setas.
  useEffect(() => {
    if (!aberta) return;
    document
      .getElementById(`${idBase}-op-${ativo}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [ativo, aberta, idBase]);

  /** Digitar letras pula para a próxima opção que começa com elas. */
  function pularPara(letra: string): number | null {
    const agora = Date.now();
    const d = digitado.current;
    d.texto = agora < d.ate ? d.texto + letra : letra;
    d.ate = agora + 700;
    const alvo = sem(d.texto);
    const i = visiveis.findIndex(
      (o) => !o.desabilitada && sem(o.rotulo).startsWith(alvo),
    );
    return i >= 0 ? i : null;
  }

  function andar(passo: number) {
    if (visiveis.length === 0) return;
    let i = ativo;
    for (let n = 0; n < visiveis.length; n++) {
      i = (i + passo + visiveis.length) % visiveis.length;
      if (!visiveis[i]?.desabilitada) break;
    }
    setAtivo(i);
  }

  function teclaNaLista(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      andar(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      andar(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setAtivo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setAtivo(visiveis.length - 1);
    } else if (e.key === "Enter" || (e.key === " " && !comBusca)) {
      e.preventDefault();
      const o = visiveis[ativo];
      if (o) escolher(o);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAberta(false);
      botao.current?.focus();
    } else if (e.key === "Tab") {
      setAberta(false);
    } else if (!comBusca && e.key.length === 1) {
      const i = pularPara(e.key);
      if (i !== null) setAtivo(i);
    }
  }

  function teclaNoBotao(e: React.KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      abrir();
    } else if (!multipla && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      // Fechada, digitar escolhe direto (como no <select> nativo).
      const i = pularPara(e.key);
      const o = i === null ? undefined : visiveis[i];
      if (o) mudar(o.valor);
    }
  }

  const opcaoAtiva = visiveis[ativo];

  return (
    <div className={`relative ${className}`}>
      <button
        ref={botao}
        id={idBotao}
        type="button"
        disabled={desabilitada}
        aria-haspopup="listbox"
        aria-expanded={aberta}
        aria-controls={aberta ? idLista : undefined}
        aria-label={rotulo}
        data-aberta={aberta}
        onClick={() => (aberta ? setAberta(false) : abrir())}
        onKeyDown={teclaNoBotao}
        className={`flex w-full items-center gap-2 text-left text-sm text-neutral-900 outline-none transition focus-visible:ring-4 focus-visible:ring-neutral-900/10 disabled:cursor-not-allowed disabled:opacity-60 ${ESTILO[variante]}`}
      >
        {icone && (
          <span className="shrink-0 text-neutral-500" aria-hidden>
            {icone}
          </span>
        )}
        <span
          className={`min-w-0 flex-1 truncate ${escolhida ? "" : "text-neutral-400"}`}
        >
          {escolhida?.rotulo ?? placeholder}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-neutral-500 transition-transform duration-200 ${aberta ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {name && (
        // Campo do formulário. Fica sobre o botão para o aviso de
        // "preencha este campo" do navegador aparecer no lugar certo.
        <input
          tabIndex={-1}
          aria-hidden
          name={name}
          value={atual}
          required={obrigatorio}
          onChange={() => undefined}
          onFocus={() => botao.current?.focus()}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
        />
      )}

      {aberta &&
        pos &&
        createPortal(
          <div
            ref={lista}
            id={idLista}
            role="listbox"
            aria-multiselectable={multipla || undefined}
            tabIndex={-1}
            aria-labelledby={idBotao}
            aria-activedescendant={
              opcaoAtiva ? `${idBase}-op-${ativo}` : undefined
            }
            onKeyDown={teclaNaLista}
            className="selecao-lista painel-modal fixed z-[60] flex max-h-80 flex-col overflow-hidden rounded-2xl p-1.5 text-sm text-neutral-900 outline-none"
            style={{
              left: pos.left,
              top: pos.top,
              minWidth: Math.max(pos.width, 220),
              maxWidth: "min(26rem, calc(100vw - 16px))",
              transform: pos.acima ? "translateY(-100%)" : undefined,
              transformOrigin: pos.acima ? "bottom" : "top",
            }}
          >
            {comBusca && (
              <label className="mb-1.5 flex shrink-0 items-center gap-2 rounded-xl bg-neutral-900/[0.05] px-2.5 py-2">
                <Search className="size-3.5 text-neutral-500" aria-hidden />
                <span className="sr-only">Buscar opção</span>
                <input
                  ref={campoBusca}
                  value={termo}
                  onChange={(e) => {
                    setTermo(e.target.value);
                    setAtivo(0);
                  }}
                  placeholder="Buscar…"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
                />
              </label>
            )}
            <div className="min-h-0 overflow-y-auto">
              {visiveis.length === 0 && (
                <p className="px-3 py-2 text-neutral-500">Nada encontrado.</p>
              )}
              {visiveis.map((o, k) => {
                const sim = marcada(o);
                return (
                  <button
                    key={o.valor}
                    id={`${idBase}-op-${k}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={sim}
                    aria-disabled={o.desabilitada}
                    onMouseEnter={() => setAtivo(k)}
                    onClick={() => escolher(o)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${k === ativo ? "bg-neutral-900/[0.07]" : ""} ${o.desabilitada ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate ${sim ? "font-semibold" : ""}`}
                      >
                        {o.rotulo}
                      </span>
                      {o.descricao && (
                        <span className="block truncate text-xs text-neutral-500">
                          {o.descricao}
                        </span>
                      )}
                    </span>
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full transition ${sim ? "bg-marca text-[#fff]" : multipla ? "border border-neutral-300" : "opacity-0"}`}
                      aria-hidden
                    >
                      <Check className="size-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
