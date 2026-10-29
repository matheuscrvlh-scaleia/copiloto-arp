"use client";

import { ArrowUpRight, CircleCheck, Plus, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CartaoCarregando } from "@/components/carregando";
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  Janela,
} from "@/components/os/chamado/janela";
import { formatarNumeroChamado, formatarNumeroOS } from "@/lib/os/numeros";
import { ROTAS_OS, rotaDo } from "@/lib/os/rotas";
import type { DadosDoFormulario } from "./tipos";

// O formulário (com o catálogo de ícones e a citação com @) só vem quando
// a janela abre; o botão já adianta a carga ao passar o mouse ou focar.
const carregarFormulario = () => import("./formulario");
const FormularioChamado = dynamic(
  () => carregarFormulario().then((m) => m.FormularioChamado),
  {
    loading: () => (
      <div className="px-5 pb-5 sm:px-7 sm:pb-7">
        <CartaoCarregando altura="h-[28rem]" />
      </div>
    ),
  },
);

// Botão "+ Novo" flutuante de todas as telas do módulo. Fica no canto
// inferior direito; se a página tiver avisos (que usam o mesmo canto), sobe
// para cima deles. No celular some ao rolar para baixo (não cobre o fim da
// lista) e volta ao rolar para cima. Na vistoria (nova e edição) não
// aparece: cobriria a barra de salvar. Nas telas da OS (/os/ordens) abre
// uma OS; no resto, um chamado.

interface Criado {
  id: string;
  numero: number;
  aviso?: string;
}

/** Quanto subir para não cobrir os avisos da página (mesmo canto). */
function useDesvioDosAvisos(): number {
  const [desvio, setDesvio] = useState(0);
  useEffect(() => {
    const medir = () => {
      const avisos = document.querySelector<HTMLElement>(
        'section[aria-label="Avisos desta página"], .aviso-bolha',
      );
      if (!avisos) return setDesvio(0);
      const topo = avisos.getBoundingClientRect().top;
      setDesvio(Math.max(0, window.innerHeight - topo));
    };
    // Uma medida por quadro, por mais que a página mude.
    let quadro = 0;
    const agendar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(medir);
    };
    medir();
    const observador = new MutationObserver(agendar);
    observador.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", agendar);
    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      window.removeEventListener("resize", agendar);
    };
  }, []);
  return desvio;
}

/** Esconde ao rolar para baixo; mostra ao rolar para cima ou no topo. */
function useVisivelAoRolar(): boolean {
  const [visivel, setVisivel] = useState(true);
  useEffect(() => {
    let ultimo = window.scrollY;
    const rolar = () => {
      const y = window.scrollY;
      if (Math.abs(y - ultimo) < 8) return;
      setVisivel(y < ultimo || y < 80);
      ultimo = y;
    };
    window.addEventListener("scroll", rolar, { passive: true });
    return () => window.removeEventListener("scroll", rolar);
  }, []);
  return visivel;
}

export function NovoChamado({ dados }: { dados: DadosDoFormulario }) {
  const [aberta, setAberta] = useState(false);
  const [criado, setCriado] = useState<Criado | null>(null);
  const [rodada, setRodada] = useState(0);
  const [montado, setMontado] = useState(false);
  const desvio = useDesvioDosAvisos();
  const visivel = useVisivelAoRolar();
  const caminho = usePathname();
  // /os/vistorias/nova e /os/vistorias/<id>.
  const naVistoria =
    caminho.startsWith(`${ROTAS_OS.vistorias}/`) &&
    !caminho.slice(ROTAS_OS.vistorias.length + 1).includes("/");
  const ehOS =
    caminho === ROTAS_OS.ordens || caminho.startsWith(`${ROTAS_OS.ordens}/`);
  useEffect(() => setMontado(true), []);

  function fechar() {
    setAberta(false);
    setCriado(null);
    setRodada((r) => r + 1);
  }

  const botao = (
    <button
      type="button"
      onClick={() => setAberta(true)}
      onPointerEnter={carregarFormulario}
      onFocus={carregarFormulario}
      aria-haspopup="dialog"
      aria-label={ehOS ? "Abrir nova OS" : "Abrir novo chamado"}
      title={ehOS ? "Nova OS" : "Novo chamado"}
      style={{ bottom: desvio ? desvio + 12 : undefined }}
      data-escondido={!visivel && !aberta}
      className="group fixed right-4 bottom-4 z-40 flex h-14 items-center gap-2 rounded-full bg-neutral-900 pr-5 pl-4 text-white shadow-[0_18px_36px_-12px_rgb(0_0_0/0.55)] ring-1 ring-white/10 transition-[transform,opacity,bottom] duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca data-[escondido=true]:pointer-events-none data-[escondido=true]:translate-y-24 data-[escondido=true]:opacity-0 md:right-6 md:bottom-6 md:data-[escondido=true]:translate-y-0 md:data-[escondido=true]:opacity-100 md:data-[escondido=true]:pointer-events-auto print:hidden motion-reduce:transition-none"
    >
      <span className="grid size-8 place-items-center rounded-full bg-marca text-[#fff] transition-transform duration-300 group-hover:rotate-90">
        <Plus className="size-5" aria-hidden />
      </span>
      <span className="text-sm font-semibold">{ehOS ? "Nova OS" : "Novo"}</span>
    </button>
  );

  return (
    <>
      {montado &&
        !naVistoria &&
        caminho !== ROTAS_OS.novaOrdem &&
        createPortal(botao, document.body)}
      <Janela
        aberta={aberta}
        aoFechar={fechar}
        largura={criado ? "lg" : "xl"}
        cheia={!criado}
        titulo={
          criado ? "Pronto!" : ehOS ? "Nova Ordem de Serviço" : "Novo chamado"
        }
      >
        {criado ? (
          <Sucesso
            criado={criado}
            ehOS={ehOS}
            aoFechar={fechar}
            aoAbrirOutro={() => {
              setCriado(null);
              setRodada((r) => r + 1);
            }}
          />
        ) : (
          <FormularioChamado
            // Trocar de tela (chamado ↔ OS) recomeça o formulário.
            key={`${rodada}-${ehOS}`}
            dados={dados}
            inicial={ehOS ? { tipo: "os", contexto: [] } : undefined}
            naJanela
            aoCriar={setCriado}
          />
        )}
      </Janela>
    </>
  );
}

export function Sucesso({
  criado,
  ehOS = false,
  aoFechar,
  aoAbrirOutro,
}: {
  criado: Criado;
  /** Abriu uma OS (numeração e página próprias). */
  ehOS?: boolean;
  aoFechar?: () => void;
  aoAbrirOutro: () => void;
}) {
  const alvo = { id: criado.id, tipo: ehOS ? "os" : "solicitacao" };
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-green-50 text-green-700">
        <CircleCheck className="size-8" aria-hidden />
      </span>
      <div>
        <p className="text-xl font-semibold tracking-tight">
          {ehOS
            ? `${formatarNumeroOS(criado.numero)} aberta`
            : `Chamado ${formatarNumeroChamado(criado.numero)} aberto`}
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          Quem precisa saber já foi avisado.
        </p>
      </div>
      {criado.aviso && (
        <p
          role="alert"
          className="flex max-w-md items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-left text-sm text-amber-900"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {criado.aviso}
        </p>
      )}
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Link href={rotaDo(alvo)} onClick={aoFechar} className={BOTAO_PRIMARIO}>
          {ehOS ? "Ver OS" : "Ver chamado"}
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={aoAbrirOutro}
          className={BOTAO_SECUNDARIO}
        >
          Abrir outro
        </button>
      </div>
    </div>
  );
}
