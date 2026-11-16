import type { Config, Driver } from "driver.js";
import type { Passo, Trilha } from "@/config/guias";

// Motor das trilhas (processo de ponta a ponta). Um passo por vez: se o passo
// é de outra tela, grava onde parou, fecha as janelas abertas e navega; o
// botão Guia da tela nova retoma (retomar). Passo com `ate` avança sozinho
// quando aquele ponto aparece (a pessoa abriu o formulário, abriu uma OS).

const CHAVE = "guia-trilha";

/** O primeiro elemento visível com o alvo (fora: gaveta fechada, sem permissão, sem dado). */
export function alvoNaTela(
  alvo: NonNullable<Passo["alvo"]>,
): Element | undefined {
  const [tipo, titulo] = alvo.split(/:(.*)/s);
  const seletor = titulo
    ? `[data-guia="${tipo}"][data-guia-titulo="${CSS.escape(titulo)}"]`
    : `[data-guia="${alvo}"]`;
  return [...document.querySelectorAll(seletor)].find(
    (el) => el.getClientRects().length > 0,
  );
}

export function trilhaEmAndamento(): { id: string; i: number } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHAVE) ?? "null");
    return v && typeof v.id === "string" && Number.isInteger(v.i) ? v : null;
  } catch {
    return null;
  }
}

function gravar(v: { id: string; i: number } | null) {
  try {
    if (v) sessionStorage.setItem(CHAVE, JSON.stringify(v));
    else sessionStorage.removeItem(CHAVE);
  } catch {
    // Sem armazenamento: a trilha não sobrevive à troca de tela.
  }
}

/** A tela do passo: a dele ou a do último passo antes dele que tinha rota. */
export function rotaDoPasso(t: Trilha, i: number): string | undefined {
  for (let k = i; k >= 0; k--) {
    const rota = t.passos[k]?.rota;
    if (rota) return rota;
  }
  return undefined;
}

/** Espera o ponto aparecer (tela carregando, janela abrindo) até `ms`. */
function esperarAlvo(
  alvo: NonNullable<Passo["alvo"]>,
  ms: number,
  cancelado: () => boolean,
): Promise<Element | undefined> {
  const inicio = Date.now();
  return new Promise((fim) => {
    const tentar = () => {
      if (cancelado()) return fim(undefined);
      const el = alvoNaTela(alvo);
      if (el || Date.now() - inicio >= ms) return fim(el);
      setTimeout(tentar, 150);
    };
    tentar();
  });
}

/** Fecha formulário e janelas abertas antes de trocar de tela (o Esc da camada de cima). */
function fecharJanelas() {
  for (let n = 0; n < 3 && document.querySelector("[aria-modal=true]"); n++)
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
}

export function criarTrilha(opcoes: {
  base: Config;
  navegar: (rota: string) => void;
}) {
  let atual: Driver | null = null;
  let geracao = 0;
  let vigia: number | undefined;

  /** Tira o passo da tela sem encerrar a trilha. */
  function soltar() {
    geracao++;
    window.clearInterval(vigia);
    const d = atual;
    atual = null;
    d?.destroy();
  }

  function encerrar() {
    gravar(null);
    soltar();
  }

  async function mostrar(t: Trilha, pedido: number) {
    soltar();
    const total = t.passos.length;
    if (pedido >= total) return encerrar();
    const i = Math.max(0, pedido);
    const p = t.passos[i];
    if (!p) return encerrar();
    gravar({ id: t.id, i });

    // Passo que começa numa tela: fecha o formulário ou o detalhe abertos
    // (mesmo sem trocar de endereço, como a caixa com uma OS aberta ao lado).
    if (p.rota) fecharJanelas();
    const rota = rotaDoPasso(t, i);
    if (rota && window.location.pathname !== rota) {
      opcoes.navegar(rota);
      return;
    }

    const minha = geracao;
    const el = p.alvo
      ? await esperarAlvo(p.alvo, 5000, () => minha !== geracao)
      : undefined;
    const { driver } = await import("driver.js");
    if (minha !== geracao) return;

    const ultimo = i === total - 1;
    const proximo = ultimo ? "Concluir" : "Próximo";
    const d = driver({
      ...opcoes.base,
      overlayClickBehavior: () => {},
      onDestroyed: () => {
        // Fechou pelo X ou pelo Esc (não foi a troca de passo): acabou.
        if (atual !== d) return;
        atual = null;
        window.clearInterval(vigia);
        gravar(null);
      },
      steps: [
        {
          element: el,
          popover: {
            title: p.titulo,
            description: p.alvo && !el ? (p.semAlvo ?? p.texto) : p.texto,
            showProgress: true,
            progressText: `${i + 1} de ${total}`,
            showButtons: ["next", "previous", "close"],
            disableButtons: i === 0 ? ["previous"] : [],
            nextBtnText: proximo,
            doneBtnText: proximo,
            onNextClick: () => void mostrar(t, i + 1),
            onPrevClick: () => void mostrar(t, i - 1),
          },
        },
      ],
    });
    atual = d;
    d.drive();

    const ate = p.ate;
    if (ate)
      vigia = window.setInterval(() => {
        if (alvoNaTela(ate)) void mostrar(t, i + 1);
      }, 250);
  }

  return { mostrar, encerrar, ativa: () => atual !== null };
}
