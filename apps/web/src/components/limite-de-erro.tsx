import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Component, type ReactNode } from "react";
import { ErroDaApi } from "@/lib/api";
import { ErroDeNaoEncontrado } from "@/lib/navegacao";
import { NaoEncontrada } from "./nao-encontrada";
import { Cartao } from "./page-header";
import { SemAcesso } from "./protegido";

// Limite de erro das telas: uma consulta que falha (useSuspenseQuery) ou um
// erro ao desenhar cai aqui, e o resto do sistema (menu, barra) continua de
// pé. "Tentar de novo" refaz as consultas que falharam.

interface Props {
  /** Mudou (a pessoa foi para outra tela): o erro anterior é esquecido. */
  chave?: string;
  aoTentarDeNovo: () => void;
  children: ReactNode;
}

class Limite extends Component<Props, { erro: unknown }> {
  override state: { erro: unknown } = { erro: null };

  static getDerivedStateFromError(erro: unknown) {
    return { erro: erro ?? new Error("Erro desconhecido") };
  }

  override componentDidUpdate(anterior: Props) {
    if (this.state.erro !== null && anterior.chave !== this.props.chave)
      this.limpar();
  }

  limpar = () => {
    this.props.aoTentarDeNovo();
    this.setState({ erro: null });
  };

  override render() {
    const { erro } = this.state;
    if (erro === null) return this.props.children;
    if (erro instanceof ErroDeNaoEncontrado) return <NaoEncontrada />;
    if (erro instanceof ErroDaApi) {
      if (erro.codigo === "nao_encontrado") return <NaoEncontrada />;
      if (erro.codigo === "sem_permissao") return <SemAcesso />;
    }
    return <AvisoDeErro erro={erro} aoTentarDeNovo={this.limpar} />;
  }
}

export function LimiteDeErro({
  chave,
  children,
}: {
  chave?: string;
  children: ReactNode;
}) {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <Limite chave={chave} aoTentarDeNovo={reset}>
      {children}
    </Limite>
  );
}

/** Cartão de "não deu para carregar", com o botão de tentar de novo. */
export function AvisoDeErro({
  erro,
  aoTentarDeNovo,
  rotulo = "Tentar de novo",
}: {
  erro: unknown;
  aoTentarDeNovo: () => void;
  rotulo?: string;
}) {
  const mensagem =
    erro instanceof ErroDaApi
      ? erro.mensagem
      : "Não foi possível carregar esta tela.";
  return (
    <Cartao>
      <div role="alert" className="flex flex-col items-start gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            Algo não saiu como esperado
          </p>
          <p className="mt-1 text-sm text-neutral-600">{mensagem}</p>
        </div>
        <button
          type="button"
          onClick={aoTentarDeNovo}
          className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          {rotulo}
        </button>
      </div>
    </Cartao>
  );
}
