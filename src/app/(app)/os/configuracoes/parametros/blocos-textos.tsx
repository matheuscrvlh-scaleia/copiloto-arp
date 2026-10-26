import { ImageOff, Info, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { UltimasAlteracoes } from "@/components/os/configuracoes/alteracoes";
import { MensagensWhatsApp } from "@/components/os/configuracoes/mensagens";
import { FormVistorias } from "@/components/os/configuracoes/vistorias";
import { Selecao } from "@/components/selecao";
import { formatarNumero } from "@/lib/formato";
import {
  INDICADORES_META,
  type IndicadorMeta,
  lerMensagens,
  lerTextosVistoria,
  PAPEL_TIMBRADO,
} from "@/lib/os/configuracoes";
import { ROTAS_OS } from "@/lib/os/rotas";
import {
  AMBIENTES_PADRAO,
  LOCADOR_PADRAO,
  LOCAL_PADRAO,
} from "@/lib/os/vistoria";
import {
  enviarPapelTimbrado,
  removerMeta,
  removerPapelTimbrado,
  salvarMensagens,
  salvarMeta,
  salvarPortal,
  salvarVistorias,
} from "@/server/os/acoes/config-parametros";
import type { Tabela } from "@/server/os/base";
import { categorias, parametros, setores } from "@/server/os/base";
import {
  metas,
  papelTimbradoAtual,
  ultimasAlteracoes,
} from "@/server/os/configuracoes";
import { MARGENS } from "@/server/os/pdf/papel-timbrado";

// Blocos de textos e metas: vistorias (laudo), portal, metas dos painéis,
// mensagens do WhatsApp e o papel timbrado dos PDFs.

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
/** Milímetros → "3,8 cm". */
const cm = (mm: number) => `${formatarNumero(mm / 10, 1)} cm`;

export async function BlocoVistorias() {
  const [p, alteracoes] = await Promise.all([
    parametros(),
    ultimasAlteracoes(["os.parametros"], {
      campos: [
        "vistoria_ambientes",
        "vistoria_locador",
        "vistoria_local",
        "vistoria_textos",
      ],
    }),
  ]);
  return (
    <Secao
      id="vistorias"
      titulo="Vistorias"
      descricao="O que a vistoria nova já traz: ambientes, locador, local e os textos do laudo de cada tipo. Vistorias já feitas guardam os textos da época."
    >
      <div className="flex flex-col gap-5">
        <FormVistorias
          acao={salvarVistorias}
          ambientes={
            p.vistoria_ambientes.length
              ? p.vistoria_ambientes
              : AMBIENTES_PADRAO
          }
          locador={p.vistoria_locador || LOCADOR_PADRAO}
          local={p.vistoria_local || LOCAL_PADRAO}
          textos={lerTextosVistoria(p.vistoria_textos)}
        />
        <UltimasAlteracoes lista={alteracoes} tabela="os.parametros" />
      </div>
    </Secao>
  );
}

export async function BlocoPortal() {
  const [p, alteracoes] = await Promise.all([
    parametros(),
    ultimasAlteracoes(["os.parametros"], { campos: ["portal_boas_vindas"] }),
  ]);
  return (
    <Secao
      id="portal"
      titulo="Portal do lojista"
      descricao="A primeira coisa que o lojista lê ao abrir o link da loja."
    >
      <div className="flex flex-col gap-5">
        <FormAcao acao={salvarPortal} className="flex flex-col gap-3">
          <label className={rotulo}>
            Texto de boas-vindas
            <textarea
              name="portal_boas_vindas"
              rows={3}
              maxLength={1000}
              defaultValue={p.portal_boas_vindas}
              className={classeCampo}
            />
          </label>
          <p className="flex items-start gap-1.5 text-xs text-neutral-500">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Quais pedidos aparecem no portal se define em cada categoria do
              Catálogo. Horários, limites e bloqueios das agendas ficam em{" "}
              <Link href={ROTAS_OS.portal} className="underline">
                Portal e agenda
              </Link>
              .
            </span>
          </p>
        </FormAcao>
        <UltimasAlteracoes lista={alteracoes} tabela="os.parametros" />
      </div>
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Metas
// ---------------------------------------------------------------------------

const UNIDADE: Record<IndicadorMeta, string> = {
  pct_no_prazo: "%",
  tempo_medio_horas: "h",
};

const AJUDA_META: Record<IndicadorMeta, string> = {
  pct_no_prazo:
    "Quanto maior, melhor. Ex.: meta 90% e atenção 80% → verde a partir de 90%, amarelo de 80% a 90%, vermelho abaixo de 80%.",
  tempo_medio_horas:
    "Quanto menor, melhor. Ex.: meta 24 h e atenção 36 h → verde até 24 h, amarelo até 36 h, vermelho acima.",
};

export async function BlocoMetas() {
  const [lista, listaSetores, listaCategorias, alteracoes] = await Promise.all([
    metas(),
    setores(),
    categorias(),
    ultimasAlteracoes(["os.metas"]),
  ]);
  const nomeSetor = new Map(listaSetores.map((s) => [s.id, s.nome]));
  const opcoesEscopo = [
    { valor: "geral", rotulo: "Geral (todos os setores)" },
    ...listaSetores.map((s) => ({
      valor: `setor:${s.id}`,
      rotulo: s.nome,
      descricao: "Setor",
    })),
    ...listaCategorias
      .filter((c) => c.ativo)
      .map((c) => ({
        valor: `categoria:${c.id}`,
        rotulo: c.nome,
        descricao: `Categoria de ${nomeSetor.get(c.setor_id) ?? "—"}`,
      })),
  ];
  const escopoDe = (m: Tabela<"metas">) =>
    m.categoria_id
      ? `categoria:${m.categoria_id}`
      : m.setor_id
        ? `setor:${m.setor_id}`
        : "geral";
  const nomeDoEscopo = (m: Tabela<"metas">) =>
    opcoesEscopo.find((o) => o.valor === escopoDe(m))?.rotulo ??
    "Item removido";
  const ordenadas = [...lista].sort(
    (a, b) =>
      Number(!!a.setor_id || !!a.categoria_id) -
        Number(!!b.setor_id || !!b.categoria_id) ||
      nomeDoEscopo(a).localeCompare(nomeDoEscopo(b), "pt-BR") ||
      a.indicador.localeCompare(b.indicador),
  );

  return (
    <Secao
      id="metas"
      titulo="Metas dos painéis"
      descricao="% no prazo e tempo médio de resolução, geral, por setor e por categoria. Vale a mais específica; o limite de atenção é a faixa amarela."
    >
      <div className="flex flex-col gap-5">
        <ul className="grid grid-cols-1 gap-2 text-xs text-neutral-500 md:grid-cols-2">
          {(Object.keys(INDICADORES_META) as IndicadorMeta[]).map((i) => (
            <li key={i} className="rounded-2xl bg-neutral-900/[0.04] px-3 py-2">
              <strong className="font-medium text-neutral-700">
                {INDICADORES_META[i]}:
              </strong>{" "}
              {AJUDA_META[i]}
            </li>
          ))}
        </ul>
        {ordenadas.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nenhuma meta definida: os painéis mostram os números sem cor de
            meta.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ordenadas.map((m) => (
              <li key={m.id}>
                <FormMeta m={m} opcoes={opcoesEscopo} escopo={escopoDe(m)} />
              </li>
            ))}
          </ul>
        )}
        <details className="group rounded-2xl border border-dashed border-neutral-300 px-4 py-3 open:border-solid open:bg-white/50">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <Plus
              className="size-4 transition group-open:rotate-45"
              aria-hidden
            />
            Nova meta
          </summary>
          <div className="mt-4">
            <FormMeta opcoes={opcoesEscopo} />
          </div>
        </details>
        <UltimasAlteracoes lista={alteracoes} tabela="os.metas" />
      </div>
    </Secao>
  );
}

function FormMeta({
  m,
  opcoes,
  escopo,
}: {
  m?: Tabela<"metas">;
  opcoes: { valor: string; rotulo: string; descricao?: string }[];
  escopo?: string;
}) {
  const num = (v: number | null) =>
    v === null
      ? ""
      : formatarNumero(Number(v), Number.isInteger(Number(v)) ? 0 : 1);
  return (
    <div className="flex items-end gap-1">
      <FormAcao
        acao={salvarMeta}
        rotulo={m ? "Salvar" : "Incluir meta"}
        variante={m ? "secundario" : "primario"}
        className="grid min-w-0 flex-1 grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_14rem_7rem_7rem_auto]"
      >
        {m && <input type="hidden" name="id" value={m.id} />}
        <label className={`${rotulo} col-span-2 sm:col-span-1`}>
          Para quem
          <Selecao
            name="escopo"
            obrigatorio
            valorInicial={escopo ?? "geral"}
            opcoes={opcoes}
          />
        </label>
        <label className={`${rotulo} col-span-2 sm:col-span-1`}>
          Indicador
          <Selecao
            name="indicador"
            obrigatorio
            valorInicial={m?.indicador ?? "pct_no_prazo"}
            opcoes={(Object.keys(INDICADORES_META) as IndicadorMeta[]).map(
              (i) => ({
                valor: i,
                rotulo: INDICADORES_META[i],
              }),
            )}
          />
        </label>
        <label className={rotulo}>
          Meta
          <input
            name="meta"
            inputMode="decimal"
            required
            defaultValue={num(m?.meta ?? null)}
            placeholder={m ? undefined : "ex.: 90"}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Atenção até
          <input
            name="limite_atencao"
            inputMode="decimal"
            defaultValue={num(m?.limite_atencao ?? null)}
            placeholder="sem"
            className={classeCampo}
          />
        </label>
      </FormAcao>
      {m && (
        <AcaoRapida
          acao={removerMeta}
          campos={{ id: m.id }}
          rotulo="Remover meta"
          icone={<Trash2 className="size-4" aria-hidden />}
          confirmar={`Remover a meta de ${INDICADORES_META[m.indicador as IndicadorMeta] ?? m.indicador} (${num(m.meta)}${UNIDADE[m.indicador as IndicadorMeta] ?? ""})? Os painéis passam a usar a meta mais geral.`}
          perigo
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WhatsApp e papel timbrado
// ---------------------------------------------------------------------------

export async function BlocoWhatsApp() {
  const [p, alteracoes] = await Promise.all([
    parametros(),
    ultimasAlteracoes(["os.parametros"], { campos: ["mensagens"] }),
  ]);
  return (
    <Secao
      id="whatsapp"
      titulo="Mensagens do WhatsApp"
      descricao="Textos prontos dos botões de WhatsApp. O sistema troca cada {{campo}} pelo dado do chamado; quem envia é a pessoa, no WhatsApp dela."
    >
      <div className="flex flex-col gap-5">
        <MensagensWhatsApp
          acao={salvarMensagens}
          iniciais={lerMensagens(p.mensagens)}
        />
        <UltimasAlteracoes lista={alteracoes} tabela="os.parametros" />
      </div>
    </Secao>
  );
}

export async function BlocoPapelTimbrado() {
  const atual = await papelTimbradoAtual();
  return (
    <Secao
      id="papel-timbrado"
      titulo="Papel timbrado"
      descricao={`Imagem oficial que vira o fundo de todos os PDFs (OS, laudo de vistoria, relatórios). PNG ou JPG em A4 de pé, ${PAPEL_TIMBRADO.largura} × ${PAPEL_TIMBRADO.altura} pixels.`}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[12rem_minmax(0,1fr)]">
        <div className="mx-auto w-40 md:mx-0 md:w-full">
          {atual ? (
            <a
              href={atual.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir a imagem"
            >
              {/* biome-ignore lint/performance/noImgElement: endereço temporário do bucket privado */}
              <img
                src={atual.url}
                alt="Papel timbrado atual"
                className="aspect-[1654/2339] w-full rounded-lg border border-neutral-200 bg-white object-cover shadow-sm"
              />
            </a>
          ) : (
            <div className="grid aspect-[1654/2339] w-full place-items-center rounded-lg border border-dashed border-neutral-300 bg-white/50 p-3 text-center text-xs text-neutral-500">
              <span>
                <ImageOff className="mx-auto mb-2 size-5" aria-hidden />
                Sem imagem: os PDFs saem com o desenho padrão.
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <FormAcao
            acao={enviarPapelTimbrado}
            rotulo={atual ? "Trocar imagem" : "Enviar imagem"}
            rotuloEnviando="Enviando…"
            className="flex flex-col gap-3"
          >
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium">Imagem do papel timbrado</span>
              <input
                type="file"
                name="arquivo"
                accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                required
                className="max-w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-neutral-200"
              />
            </label>
            <p className="text-xs text-neutral-500">
              Deixe livre a área de texto (margens de {cm(MARGENS.topo)} em
              cima, {cm(MARGENS.base)} embaixo e {cm(MARGENS.lateral)} dos
              lados). Até 4 MB. A nova imagem substitui a atual.
            </p>
          </FormAcao>
          {atual && (
            <div>
              <AcaoRapida
                acao={removerPapelTimbrado}
                campos={{}}
                rotulo="Remover imagem"
                icone={<Trash2 className="size-4" aria-hidden />}
                confirmar="Remover o papel timbrado? Os próximos PDFs saem com o desenho padrão."
                perigo
                comTexto
              />
            </div>
          )}
        </div>
      </div>
    </Secao>
  );
}
