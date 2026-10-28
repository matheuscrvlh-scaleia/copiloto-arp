"use client";

import { Eraser, Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Secao } from "@/components/admin/ui";
import { classeCampo } from "@/components/estilos";
import { type EstadoAcao, FormAcao } from "@/components/form-acao";
import { ModalConfirmacao } from "@/components/modal-confirmacao";
import { useNotificarEstado } from "@/components/notificacoes";
import { Selecao } from "@/components/selecao";
import { ROTAS_OS } from "@/lib/os/rotas";
import {
  STATUS_VISTORIA,
  type StatusVistoria,
  TIPOS_VISTORIA,
  type TipoVistoria,
} from "@/lib/os/rotulos";
import { localEData, rotuloCampoDoTipo, rotuloDaData } from "@/lib/os/vistoria";
import {
  faltando,
  type TextosDoTipo,
  textosEditados,
} from "@/lib/os/vistoria-regras";
import { duplicarVistoria, salvarVistoria } from "@/server/os/acoes/vistorias";
import { Ambientes } from "./ambientes";
import { Assinatura } from "./assinatura";
import { BotoesDeEscolha } from "./escolha";
import {
  type AmbienteEditado,
  type CampoDoTipo,
  type CamposVistoria,
  type ChamadoDaVistoria,
  type LojaEscolhida,
  OPCOES_CAMPO_DO_TIPO,
} from "./tipos";

// Formulário da vistoria (4.10): dados, ambientes, textos do laudo e
// assinaturas. Os ambientes e as fotos salvam sozinhos; o resto vai com
// "Salvar rascunho" (sem conferir obrigatórios) ou "Salvar vistoria".

const rotulo = "flex flex-col gap-1.5 text-xs font-medium text-neutral-600";
const obrigatorio = <span className="text-red-700"> *</span>;

interface Pergunta {
  texto: string;
  rotulo: string;
  perigo?: boolean;
  acao: () => void;
}

export function EditorVistoria({
  id,
  inicial,
  ambientesIniciais,
  chamados,
  entrada,
  pessoas,
  lojas,
  textos,
  local,
  assinaturas,
  children,
}: {
  id: string;
  inicial: CamposVistoria;
  ambientesIniciais: AmbienteEditado[];
  chamados: ChamadoDaVistoria[];
  /** Entrada do mesmo contrato ("ARP05 · 01/02/2026"), na saída. */
  entrada: string | null;
  pessoas: { id: string; nome: string }[];
  lojas: LojaEscolhida[];
  textos: Record<TipoVistoria, TextosDoTipo>;
  /** "Nova Friburgo - RJ" (Parâmetros). */
  local: string;
  assinaturas: { locador: string | null; locatario: string | null };
  /** Blocos que o servidor monta (OS geradas). */
  children?: React.ReactNode;
}) {
  const [campos, setCampos] = useState(inicial);
  const [ambientes, setAmbientes] = useState(ambientesIniciais);
  const [sujo, setSujo] = useState(false);
  const [estado, setEstado] = useState<EstadoAcao>({});
  const [salvando, iniciar] = useTransition();
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const tipoAnterior = useRef(inicial.tipo);
  const router = useRouter();
  // "Salvo." e os erros aparecem na notificação do canto da tela.
  useNotificarEstado(estado);

  // Sair com alterações não salvas pede confirmação do navegador.
  useEffect(() => {
    if (!sujo) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sujo]);

  function mudar(m: Partial<CamposVistoria>) {
    setCampos((c) => ({ ...c, ...m }));
    setSujo(true);
    setEstado({});
  }

  function trocarTipo(tipo: TipoVistoria) {
    const anterior = tipoAnterior.current;
    tipoAnterior.current = tipo;
    const campo = rotuloCampoDoTipo(tipo) ? campos.campo_tipo : null;
    const padrao = textos[tipo];
    const editado = textosEditados(
      { observacao: campos.observacao, termo: campos.termo },
      textos[anterior],
    );
    mudar({ tipo, campo_tipo: campo });
    if (!editado) {
      mudar({ observacao: padrao.observacao, termo: padrao.termo });
      return;
    }
    setPergunta({
      texto: `Trocar a observação e o termo pelo padrão da ${TIPOS_VISTORIA[tipo]}? Você editou esses textos; trocando, as edições se perdem.`,
      rotulo: "Trocar os textos",
      acao: () => mudar({ observacao: padrao.observacao, termo: padrao.termo }),
    });
  }

  function trocarData(data: string) {
    // Local e data acompanham a data enquanto não forem editados à mão.
    const automatico = localEData(local, campos.data);
    mudar({
      data,
      ...(data && campos.local_data === automatico
        ? { local_data: localEData(local, data) }
        : {}),
    });
  }

  function escolherLoja(lojaId: string) {
    const l = lojas.find((x) => x.id === lojaId);
    mudar(
      l
        ? {
            loja_id: l.id,
            locatario: l.locatario,
            bloco: l.bloco,
            unidade: l.unidade,
          }
        : { loja_id: null },
    );
  }

  function limpar() {
    setPergunta({
      texto:
        "Limpar o formulário? Locatário, bloco, unidade, campo do tipo, itens anteriores e considerações ficam em branco e os textos voltam ao padrão. Ambientes, fotos e assinaturas continuam.",
      rotulo: "Limpar",
      perigo: true,
      acao: () =>
        mudar({
          loja_id: null,
          locatario: "",
          bloco: "",
          unidade: "",
          campo_tipo: null,
          itens_anteriores: "",
          consideracoes: "",
          observacao: textos[campos.tipo].observacao,
          termo: textos[campos.tipo].termo,
          local_data: campos.data ? localEData(local, campos.data) : "",
        }),
    });
  }

  function salvar(rascunho: boolean) {
    if (!rascunho) {
      const falta = faltando({
        tipo: campos.tipo,
        codigo: campos.codigo,
        status: campos.status,
        data: campos.data,
        vistoriador: campos.vistoriador_nome,
        locador: campos.locador,
        locatario: campos.locatario,
      });
      if (falta.length) {
        setEstado({ erro: `Preencha: ${falta.join(", ")}.` });
        return;
      }
    }
    iniciar(async () => {
      const r = await gravar(rascunho);
      setEstado(r);
      if (r.ok) setSujo(false);
      // Vistoria salva (não rascunho) fecha a tela e volta para a lista.
      if (r.ok && !rascunho) router.push(ROTAS_OS.vistorias);
    });
  }

  function gravar(rascunho: boolean) {
    return salvarVistoria({
      id,
      rascunho,
      ...campos,
      hora: campos.hora || null,
      itens_anteriores: campos.itens_anteriores || null,
      consideracoes: campos.consideracoes || null,
      ambientes: ambientes.map((a) => ({
        id: a.id,
        titulo: a.titulo,
        resposta: a.resposta,
        descricao: a.descricao || null,
        problema: a.problema,
      })),
    });
  }

  /** "Gerar OS" sai da tela: o que não foi salvo vai antes, como rascunho. */
  async function salvarAntesDeSair() {
    if (!sujo) return true;
    const r = await gravar(true);
    setEstado(r);
    if (r.ok) setSujo(false);
    return Boolean(r.ok);
  }

  const vistoriadores = pessoas.some((p) => p.id === campos.vistoriador_id)
    ? pessoas
    : [
        ...(campos.vistoriador_nome
          ? [
              {
                id: campos.vistoriador_id ?? "nome",
                nome: campos.vistoriador_nome,
              },
            ]
          : []),
        ...pessoas,
      ];
  const campoDoTipo = rotuloCampoDoTipo(campos.tipo);

  return (
    <div className="flex flex-col gap-6">
      <div className="vidro rounded-[1.75rem] p-5 md:p-6">
        <Secao
          titulo="Dados da vistoria"
          descricao="Os campos com * são obrigatórios para salvar a vistoria (o rascunho salva assim mesmo)."
        >
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs font-medium text-neutral-600">
              Tipo{obrigatorio}
            </legend>
            <BotoesDeEscolha
              nome="Tipo da vistoria"
              valor={campos.tipo}
              aoMudar={(v) => trocarTipo(v as TipoVistoria)}
              opcoes={Object.entries(TIPOS_VISTORIA).map(([valor, r]) => ({
                valor,
                rotulo: r,
              }))}
            />
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={rotulo}>
              <span>Código do laudo / projeto{obrigatorio}</span>
              <input
                value={campos.codigo}
                onChange={(e) =>
                  mudar({ codigo: e.target.value.toUpperCase() })
                }
                maxLength={30}
                className={classeCampo}
              />
            </label>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-xs font-medium text-neutral-600">
                Status{obrigatorio}
              </legend>
              <BotoesDeEscolha
                nome="Status da vistoria"
                valor={campos.status}
                aoMudar={(v) => mudar({ status: v as StatusVistoria })}
                opcoes={Object.entries(STATUS_VISTORIA).map(([valor, r]) => ({
                  valor,
                  rotulo: r,
                }))}
              />
            </fieldset>
            <label className={rotulo}>
              <span>
                {rotuloDaData(campos.tipo)}
                {obrigatorio}
              </span>
              <input
                type="date"
                value={campos.data}
                onChange={(e) => trocarData(e.target.value)}
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              Hora
              <input
                type="time"
                value={campos.hora}
                onChange={(e) => mudar({ hora: e.target.value })}
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              <span>Vistoriador / responsável{obrigatorio}</span>
              <Selecao
                rotulo="Vistoriador / responsável"
                valor={
                  campos.vistoriador_id ??
                  (campos.vistoriador_nome ? "nome" : "")
                }
                aoMudar={(v) => {
                  const p = vistoriadores.find((x) => x.id === v);
                  if (p)
                    mudar({
                      vistoriador_id: v === "nome" ? null : v,
                      vistoriador_nome: p.nome,
                    });
                }}
                opcoes={vistoriadores.map((p) => ({
                  valor: p.id,
                  rotulo: p.nome,
                }))}
              />
            </label>
            <label className={rotulo}>
              <span>Locador{obrigatorio}</span>
              <input
                value={campos.locador}
                onChange={(e) => mudar({ locador: e.target.value })}
                maxLength={200}
                className={classeCampo}
              />
            </label>
          </div>

          <label className={rotulo}>
            Loja (contrato)
            <Selecao
              rotulo="Loja do contrato"
              valor={campos.loja_id ?? ""}
              aoMudar={escolherLoja}
              busca
              opcoes={[
                {
                  valor: "",
                  rotulo: "Sem contrato no sistema",
                  descricao: "Locatário digitado à mão",
                },
                ...lojas.map((l) => ({
                  valor: l.id,
                  rotulo: l.rotulo,
                  descricao: l.descricao,
                })),
              ]}
            />
            <span className="font-normal text-neutral-500">
              Escolher a loja preenche locatário, bloco e unidade.
            </span>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className={`${rotulo} sm:col-span-3`}>
              <span>Locatário(a){obrigatorio}</span>
              <input
                value={campos.locatario}
                onChange={(e) => mudar({ locatario: e.target.value })}
                maxLength={200}
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              Bloco / Área
              <input
                value={campos.bloco}
                onChange={(e) => mudar({ bloco: e.target.value })}
                maxLength={100}
                className={classeCampo}
              />
            </label>
            <label className={`${rotulo} sm:col-span-2`}>
              Locação / Unidade
              <input
                value={campos.unidade}
                onChange={(e) => mudar({ unidade: e.target.value })}
                maxLength={100}
                className={classeCampo}
              />
            </label>
          </div>

          {campoDoTipo && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-xs font-medium text-neutral-600">
                {campoDoTipo}
              </legend>
              <BotoesDeEscolha
                nome={campoDoTipo}
                valor={campos.campo_tipo ?? ""}
                aoMudar={(v) => mudar({ campo_tipo: v as CampoDoTipo })}
                opcoes={OPCOES_CAMPO_DO_TIPO}
              />
            </fieldset>
          )}

          <label className={rotulo}>
            Possui itens de locações anteriores?
            <textarea
              value={campos.itens_anteriores}
              onChange={(e) => mudar({ itens_anteriores: e.target.value })}
              rows={2}
              maxLength={2000}
              placeholder="Ex.: balcão e prateleiras do locatário anterior"
              className={classeCampo}
            />
          </label>

          {campos.tipo === "saida" && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={campos.comparar_no_laudo}
                onChange={(e) => mudar({ comparar_no_laudo: e.target.checked })}
                className="size-5 accent-neutral-900"
              />
              Pôr as fotos da entrada no laudo (comparação lado a lado)
            </label>
          )}
        </Secao>

        <Secao
          titulo="Ambientes"
          descricao="Um de cada vez: resposta, descrição e fotos. Cada ambiente salva sozinho. Ambiente com problema vira OS."
        >
          <Ambientes
            vistoriaId={id}
            saida={campos.tipo === "saida"}
            entrada={entrada}
            ambientes={ambientes}
            aoMudar={setAmbientes}
            chamados={chamados}
            antesDeSair={salvarAntesDeSair}
          />
        </Secao>

        <Secao
          titulo="Textos do laudo"
          descricao="Vêm do padrão do tipo (Parâmetros). Pode editar só nesta vistoria."
        >
          <label className={rotulo}>
            Observação do laudo
            <textarea
              value={campos.observacao}
              onChange={(e) => mudar({ observacao: e.target.value })}
              rows={5}
              maxLength={6000}
              className={`${classeCampo} uppercase`}
            />
            <span className="font-normal text-neutral-500">
              Sai em maiúsculas no laudo.
            </span>
          </label>
          <label className={rotulo}>
            Considerações adicionais
            <textarea
              value={campos.consideracoes}
              onChange={(e) => mudar({ consideracoes: e.target.value })}
              rows={3}
              maxLength={6000}
              placeholder="Vazio: a seção não aparece no laudo"
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Termo de responsabilidade
            <textarea
              value={campos.termo}
              onChange={(e) => mudar({ termo: e.target.value })}
              rows={7}
              maxLength={10000}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Local e data da assinatura
            <input
              value={campos.local_data}
              onChange={(e) => mudar({ local_data: e.target.value })}
              maxLength={200}
              className={classeCampo}
            />
          </label>
        </Secao>

        <Secao
          titulo="Assinaturas"
          descricao="Na tela, com o dedo ou a caneta. A ARP assina como locador; o locatário assina aqui ou pelo link (Enviar para o locatário assinar, depois de finalizar). Sem assinatura, as linhas saem em branco no laudo."
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Assinatura
              vistoriaId={id}
              parte="locador"
              papel="LOCADOR (A)"
              nome={campos.locador}
              url={assinaturas.locador}
            />
            <Assinatura
              vistoriaId={id}
              parte="locatario"
              papel="LOCATÁRIO (A)"
              nome={campos.locatario}
              url={assinaturas.locatario}
            />
          </div>
        </Secao>

        {children}
      </div>

      <div className="vidro sticky bottom-3 z-20 flex flex-col gap-2 rounded-[1.75rem] p-2 shadow-lg sm:flex-row sm:items-center sm:rounded-full">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={limpar}
            className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-neutral-600 transition hover:bg-white/70 hover:text-neutral-900"
          >
            <Eraser className="size-4" aria-hidden />
            Limpar
          </button>
          <FormAcao
            acao={duplicarVistoria}
            rotulo="Duplicar termo"
            rotuloEnviando="Duplicando…"
            variante="secundario"
            confirmar="Duplicar esta vistoria? Uma vistoria nova é criada com os mesmos dados, textos e ambientes, sem fotos nem assinaturas. O que não foi salvo fica de fora."
          >
            <input type="hidden" name="id" value={id} />
          </FormAcao>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <span className="min-w-0 flex-1 text-xs text-neutral-500 sm:text-right">
            {sujo && "Alterações não salvas"}
          </span>
          <button
            type="button"
            onClick={() => salvar(true)}
            disabled={salvando}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:cursor-wait disabled:opacity-60 sm:flex-none"
          >
            Salvar rascunho
          </button>
          <button
            type="button"
            onClick={() => salvar(false)}
            disabled={salvando}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60 sm:flex-none"
          >
            {salvando && (
              <Loader
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            )}
            Salvar vistoria
          </button>
        </div>
      </div>

      <ModalConfirmacao
        aberto={!!pergunta}
        pergunta={pergunta?.texto}
        rotulo={pergunta?.rotulo ?? "Confirmar"}
        perigo={pergunta?.perigo}
        enviando={false}
        aoConfirmar={() => {
          pergunta?.acao();
          setPergunta(null);
        }}
        aoFechar={() => setPergunta(null)}
      />
    </div>
  );
}
