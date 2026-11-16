import { formatarData, formatarDataHora } from "@arp/shared/formato";
import type {
  ChamadoDaVistoria,
  DetalheDaVistoria,
} from "@arp/shared/os/contratos/vistorias";
import { ROTAS_OS, rotaDo, rotaVistoria } from "@arp/shared/os/rotas";
import {
  localDaUnidade,
  situacaoDaVistoria,
} from "@arp/shared/os/vistoria-regras";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CircleCheck, Columns2, FileText } from "lucide-react";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { NotificarAoAbrir } from "@/components/notificacoes";
import { Protegido } from "@/components/protegido";
import { Link, naoEncontrado, useBusca, useParametro } from "@/lib/navegacao";
import { Secao } from "@/modules/admin/components/ui";
import { consultaDaVistoria, hrefDoLaudo } from "@/modules/os/api-vistorias";
import { SeloStatusChamado, SeloTipo } from "@/modules/os/components/selos";
import { EditorVistoria } from "@/modules/os/components/vistorias/editor";
import { EnviarLaudo } from "@/modules/os/components/vistorias/enviar";
import {
  SeloSituacaoVistoria,
  SeloTipoVistoria,
} from "@/modules/os/components/vistorias/selos";
import type {
  AmbienteEditado,
  CampoDoTipo,
  CamposVistoria,
  LojaEscolhida,
} from "@/modules/os/components/vistorias/tipos";

// /os/vistorias/:id: o editor da vistoria (ambientes, fotos, assinaturas),
// as OS geradas e o envio do laudo.

type Vistoria = DetalheDaVistoria["vistoria"];

/** Locatário, bloco e unidade que a loja (contrato) preenche. */
function dadosDaLoja(l: {
  locatario: string | null;
  nome: string;
  bloco: string | null;
  luc: string;
}) {
  return {
    locatario: (l.locatario || l.nome).trim(),
    bloco: l.bloco?.trim() ?? "",
    unidade: l.luc.trim(),
  };
}

export default function Pagina() {
  return (
    <>
      <Link
        href={ROTAS_OS.vistorias}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Vistorias
      </Link>
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="os.vistorias">
          <Conteudo />
        </Protegido>
      </Suspense>
    </>
  );
}

const CAMPOS_DO_TIPO: CampoDoTipo[] = ["sim", "nao", "nao_se_aplica"];
const ehCampoDoTipo = (v: string | null): v is CampoDoTipo =>
  CAMPOS_DO_TIPO.some((c) => c === v);

function camposIniciais(v: Vistoria): CamposVistoria {
  return {
    tipo: v.tipo,
    codigo: v.codigo,
    status: v.status,
    data: v.data,
    hora: v.hora?.slice(0, 5) ?? "",
    vistoriador_id: v.vistoriador_id,
    vistoriador_nome: v.vistoriador_nome,
    locador: v.locador,
    loja_id: v.loja_id,
    locatario: v.locatario,
    bloco: v.bloco,
    unidade: v.unidade,
    campo_tipo: ehCampoDoTipo(v.campo_tipo) ? v.campo_tipo : null,
    itens_anteriores: v.itens_anteriores ?? "",
    observacao: v.observacao,
    consideracoes: v.consideracoes ?? "",
    termo: v.termo,
    local_data: v.local_data,
    comparar_no_laudo: v.comparar_no_laudo,
  };
}

function Conteudo() {
  const id = useParametro("id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) naoEncontrado();
  const sp = useBusca();
  const { data: dados } = useSuspenseQuery(consultaDaVistoria(id));
  const { lojas, pessoas: todasPessoas, padroes } = dados;
  const { vistoria: v } = dados;
  const situacao = situacaoDaVistoria(v);
  const laudo = hrefDoLaudo(v.id);
  const comEntrada = v.tipo === "saida" && dados.entrada;

  const escolhas: LojaEscolhida[] = lojas.map((l) => ({
    id: l.id,
    rotulo: `${localDaUnidade(l.bloco, l.luc)} · ${l.nome}`,
    descricao: [
      l.locatario,
      l.situacao === "encerrado" ? "contrato encerrado" : null,
    ]
      .filter(Boolean)
      .join(" · "),
    ...dadosDaLoja(l),
  }));
  const ambientes: AmbienteEditado[] = dados.ambientes.map((a) => ({
    id: a.id,
    titulo: a.titulo,
    resposta: a.resposta,
    descricao: a.descricao ?? "",
    problema: a.problema,
    fotos: a.fotos,
    entrada: a.entrada,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="flex flex-wrap items-center gap-3 text-4xl font-semibold tracking-tight md:text-5xl">
            {v.codigo}
            <SeloTipoVistoria tipo={v.tipo} />
            <SeloSituacaoVistoria situacao={situacao} />
            {v.rascunho && (
              <span className="rounded-full bg-neutral-900/[0.06] px-2.5 py-1 text-xs font-medium text-neutral-600">
                Rascunho
              </span>
            )}
          </h1>
          <p className="text-sm text-neutral-500">
            {[
              v.locatario || "Sem locatário",
              localDaUnidade(v.bloco, v.unidade),
              formatarData(v.data),
              v.vistoriador_nome,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <LinkDoLocatario v={v} />
        </div>
        {/* Ações no canto direito: as secundárias antes, o PDF por último. */}
        <div className="flex flex-wrap items-center gap-2 lg:max-w-[55%] lg:shrink-0 lg:justify-end lg:pt-2">
          {comEntrada && (
            <Link
              href={`${rotaVistoria(v.id)}/comparar`}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
            >
              <Columns2 className="size-4" aria-hidden />
              Entrada × saída
            </Link>
          )}
          {v.status !== "cancelado" && !v.assinatura_locatario_path && (
            <EnviarLaudo vistoriaId={v.id} modo="assinatura" />
          )}
          <EnviarLaudo vistoriaId={v.id} />
          <a
            href={laudo}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-neutral-900 px-4 text-sm font-medium text-white shadow-lg transition hover:bg-neutral-800"
          >
            <FileText className="size-4" aria-hidden />
            Laudo em PDF
          </a>
        </div>
      </header>

      {sp.duplicada === "1" && (
        <NotificarAoAbrir
          texto="Vistoria duplicada. Confira os dados, fotografe os ambientes e salve."
          parametro="duplicada"
        />
      )}

      <EditorVistoria
        key={v.id}
        id={v.id}
        inicial={camposIniciais(v)}
        ambientesIniciais={ambientes}
        chamados={dados.chamados}
        entrada={
          dados.entrada
            ? `${dados.entrada.codigo} · ${formatarData(dados.entrada.data)}`
            : null
        }
        pessoas={todasPessoas.map((p) => ({ id: p.id, nome: p.nome }))}
        lojas={escolhas}
        textos={padroes.textos}
        local={padroes.local}
        assinaturas={dados.assinaturas}
      >
        <ChamadosDaVistoria chamados={dados.chamados} />
      </EditorVistoria>
    </div>
  );
}

/** OS e chamados ligados à vistoria (os dos ambientes e o Aviso da loja). */
function ChamadosDaVistoria({ chamados }: { chamados: ChamadoDaVistoria[] }) {
  return (
    <Secao
      titulo="OS geradas"
      descricao="Chamados abertos a partir desta vistoria. Marque um ambiente com problema para gerar a OS dele."
    >
      {chamados.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma OS gerada ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {chamados.map((c) => (
            <li key={c.id}>
              <Link
                href={rotaDo(c)}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-900/[0.06] bg-white/60 px-3 py-2.5 text-sm transition hover:bg-white"
              >
                <span className="font-medium tabular-nums">#{c.numero}</span>
                <SeloTipo tipo={c.tipo} />
                <span className="min-w-0 flex-1 truncate">{c.titulo}</span>
                <SeloStatusChamado status={c.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-32" />
      <CartaoCarregando altura="h-[48rem]" />
    </TelaCarregando>
  );
}

/** Onde está a assinatura do locatário pelo link. */
function LinkDoLocatario({ v }: { v: Vistoria }) {
  if (v.locatario_assinado_em && v.assinatura_locatario_path)
    return (
      <p className="flex items-center gap-2 text-sm text-green-800">
        <CircleCheck className="size-4 shrink-0" aria-hidden />
        Assinada pelo locatário pelo link em{" "}
        {formatarDataHora(v.locatario_assinado_em)} (
        {[v.locatario_assinatura_nome, v.locatario_assinatura_documento]
          .filter(Boolean)
          .join(" · ")}
        ).
      </p>
    );
  if (v.assinatura_enviada_em && !v.assinatura_locatario_path)
    return (
      <p className="text-sm text-neutral-500">
        Link para assinar enviado em {formatarDataHora(v.assinatura_enviada_em)}
        . Aguardando o locatário.
      </p>
    );
  return null;
}
