import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  ClipboardCheck,
  Coins,
  HardHat,
  Package,
  Printer,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import type { Opcao } from "@/components/selecao";
import { Selecao } from "@/components/selecao";
import { formatarData, formatarMoeda } from "@/lib/formato";
import {
  formatarDuracao,
  minutoHomem,
  minutosDaSessao,
} from "@/lib/os/calculos";
import { etapaDoTerceirizado, linkAtivo, rotaPdfOS } from "@/lib/os/ordem";
import { dataHoraBr } from "@/lib/os/relatorios";
import { rotaChamado, rotaTerceirizado } from "@/lib/os/rotas";
import { EXECUCOES, PERIODOS, STATUS } from "@/lib/os/rotulos";
import { deBrasilia, hojeEmBrasilia } from "@/lib/os/tempo";
import { linkWhatsApp, preencher } from "@/lib/os/whatsapp";
import type { Json } from "@/lib/supabase/database.types";
import { urlDoSistema } from "@/server/os/base";
import { type DadosOS, dadosDaOS, modeloMensagem } from "@/server/os/ordem";
import { salvarResultado } from "@/server/os/ordem-acoes";
import { Assinatura } from "./assinatura";
import { Cronometro } from "./cronometro";
import { FormCustoTerceirizado, FormRateio, QuadroCustos } from "./custos";
import { aviso, quadro, rotulo, titulo } from "./estilos";
import { FormExecucao } from "./execucao";
import { type ArquivoDaOS, Fotos } from "./fotos";
import { Materiais } from "./materiais";
import { type SessaoLinha, Sessoes } from "./sessoes";
import {
  type LinkNaTela,
  type Localizacao,
  Terceirizado,
} from "./terceirizado";
import { WhatsAppOS } from "./whatsapp-os";

// Bloco da Ordem de Serviço no detalhe do chamado. Contrato: componente de
// servidor, use dentro de <Suspense>; recebe o id de um chamado do tipo
// "os" (ou de qualquer tipo cuja categoria registra tempo: aí só o Tempo).
//   <BlocoOS chamadoId="<uuid>" compacto={false} />
// `compacto`: versão resumida para a janela lateral.
// No celular, o técnico tem Iniciar/Pausar/Finalizar grandes no topo; no
// computador, o gestor tem as sessões numa tabela, materiais, custos com a
// memória de cálculo e as pendências em destaque.

export async function BlocoOS({
  chamadoId,
  compacto = false,
}: {
  chamadoId: string;
  compacto?: boolean;
}) {
  const d = await dadosDaOS(chamadoId);
  if (!d || (!d.ehOS && !d.categoria?.registrar_tempo)) return null;
  const agora = new Date();
  const hoje = hojeEmBrasilia(agora);
  const pendencias = pendenciasDa(d, hoje);
  const cronometro = (
    <Cronometro
      chamadoId={d.chamado.id}
      desde={
        d.minhaSessaoAberta
          ? deBrasilia(
              d.minhaSessaoAberta.data,
              d.minhaSessaoAberta.inicio,
            ).toISOString()
          : null
      }
      bloqueio={bloqueioDoCronometro(d)}
      outrosRodando={
        d.sessoes.filter(
          (s) => s.fim === null && s.id !== d.minhaSessaoAberta?.id,
        ).length
      }
      compacto={compacto}
    />
  );

  if (compacto)
    return <Compacto d={d} pendencias={pendencias} cronometro={cronometro} />;

  const terceirizada = d.chamado.execucao === "terceirizada";
  return (
    <section
      aria-label={d.ehOS ? "Ordem de Serviço" : "Tempo"}
      className="flex flex-col gap-4"
    >
      <div className={`${quadro} flex flex-col gap-4`}>
        <Cabecalho d={d} />
        {cronometro}
        <Resumo d={d} />
      </div>

      {pendencias.length > 0 && <Pendencias itens={pendencias} />}

      <Parte titulo="Tempo" icone={<Timer className="size-4" aria-hidden />}>
        <Sessoes
          chamadoId={d.chamado.id}
          podeEditar={d.podeEditar}
          sessoes={linhasDasSessoes(d)}
          tecnicos={[...d.cad.tecnicos.values()].map((t) => ({
            id: t.id,
            nome: t.nome,
            desligado: !!t.desligado_em && t.desligado_em <= hoje,
          }))}
          meuTecnico={d.meuTecnico}
          almocoPadrao={{
            inicio: d.parametros.almoco_inicio.slice(0, 5),
            fim: d.parametros.almoco_fim.slice(0, 5),
          }}
          hoje={hoje}
        />
      </Parte>

      {d.ehOS && (
        <>
          <Parte
            titulo="Execução e local"
            icone={
              terceirizada ? (
                <Building2 className="size-4" aria-hidden />
              ) : (
                <HardHat className="size-4" aria-hidden />
              )
            }
          >
            {d.podeEditar ? (
              <FormExecucao
                chamadoId={d.chamado.id}
                valores={{
                  execucao: d.chamado.execucao ?? "interna",
                  empresa_id: d.chamado.empresa_id,
                  profissionais: d.profissionais,
                  bloco: d.chamado.bloco,
                  loja_id: d.chamado.loja_id,
                  local: d.chamado.local,
                  ativo_id: d.chamado.ativo_id,
                  ativo_parado: d.chamado.ativo_parado,
                  visita_data: d.chamado.visita_data,
                  visita_periodo: d.chamado.visita_periodo,
                }}
                empresas={[...d.cad.empresas.values()]
                  .filter((e) => e.ativo || e.id === d.chamado.empresa_id)
                  .map((e) => ({
                    valor: e.id,
                    rotulo: e.nome,
                    descricao: e.servicos ?? undefined,
                  }))}
                profissionais={[...d.cad.profissionais.values()]
                  .filter((p) => p.ativo || d.profissionais.includes(p.id))
                  .map((p) => ({
                    id: p.id,
                    nome: p.nome,
                    empresa_id: p.empresa_id,
                  }))}
                lojas={opcoesDeLoja(d)}
                ativos={d.ativos.map((a) => ({
                  valor: a.id,
                  rotulo: `${a.codigo} · ${a.nome}`,
                  descricao: a.local || undefined,
                }))}
              />
            ) : (
              <ExecucaoLeitura d={d} />
            )}
          </Parte>

          {(terceirizada || d.links.length > 0) && (
            <Parte
              titulo="Terceirizado"
              icone={<Building2 className="size-4" aria-hidden />}
            >
              <Terceirizado
                chamadoId={d.chamado.id}
                link={linkNaTela(d)}
                podeEnviar={
                  d.podeTerceirizados &&
                  d.podeEditar &&
                  ["aberto", "em_andamento", "aguardando"].includes(
                    d.chamado.status,
                  )
                }
                podeEditar={d.podeEditar}
                comCustos={d.comCustos}
                telefones={telefonesDoTerceirizado(d)}
                solucaoAtual={d.chamado.solucao}
                cobranca={cobrancaDa(d, agora)}
                orcamento={{
                  ...d.orcamento,
                  podeAprovar: d.gerencia && d.podeEditar,
                }}
              />
              {d.comCustos && d.podeEditar && (
                <div className="mt-4 border-t border-neutral-200/70 pt-4">
                  <FormCustoTerceirizado
                    chamadoId={d.chamado.id}
                    valor={d.custos?.valor_terceirizado ?? null}
                    orcamento={d.custos?.orcamento_numero ?? null}
                  />
                </div>
              )}
              <div className="mt-4">
                <Fotos
                  chamadoId={d.chamado.id}
                  categoria="orcamento"
                  titulo="Orçamento, nota ou laudo"
                  documento
                  podeEditar={d.podeEditar}
                  arquivos={arquivosDa(d, ["orcamento", "laudo"])}
                />
              </div>
            </Parte>
          )}

          <Parte
            titulo="Materiais"
            icone={<Package className="size-4" aria-hidden />}
          >
            <Materiais
              chamadoId={d.chamado.id}
              podeEditar={d.podeEditar}
              comCustos={d.comCustos}
              materiais={d.materiais}
            />
          </Parte>

          <Parte
            titulo="Resultado"
            icone={<ClipboardCheck className="size-4" aria-hidden />}
          >
            <div className="flex flex-col gap-5">
              <Resultado d={d} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Fotos
                  chamadoId={d.chamado.id}
                  categoria="antes"
                  titulo="Fotos de antes"
                  podeEditar={d.podeEditar}
                  arquivos={arquivosDa(d, ["antes"])}
                />
                <Fotos
                  chamadoId={d.chamado.id}
                  categoria="depois"
                  titulo="Fotos de depois"
                  podeEditar={d.podeEditar}
                  arquivos={arquivosDa(d, ["depois"])}
                />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-neutral-600">
                  Assinatura do responsável
                </p>
                <Assinatura
                  chamadoId={d.chamado.id}
                  podeEditar={d.podeEditar}
                  atual={
                    d.chamado.assinado_em
                      ? {
                          url: d.assinaturaUrl,
                          nome: d.chamado.assinatura_nome,
                          em: d.chamado.assinado_em,
                        }
                      : null
                  }
                  nomeSugerido={
                    (d.chamado.responsavel_id &&
                      d.cad.pessoas.get(d.chamado.responsavel_id)) ||
                    ""
                  }
                />
              </div>
            </div>
          </Parte>

          <Parte
            titulo={d.comCustos ? "Custos e rateio" : "Rateio"}
            icone={<Coins className="size-4" aria-hidden />}
          >
            <div className="flex flex-col gap-5">
              {d.comCustos && (
                <QuadroCustos
                  resultado={d.resultado}
                  custos={d.custos}
                  nomes={
                    new Map(
                      [...d.cad.tecnicos.values()].map((t) => [t.id, t.nome]),
                    )
                  }
                  terceirizada={terceirizada}
                />
              )}
              {d.podeEditar ? (
                <FormRateio
                  chamadoId={d.chamado.id}
                  rateio={d.chamado.rateio}
                  regra={d.custos?.rateio_regra ?? null}
                  valor={d.custos?.rateio_valor ?? null}
                  comCustos={d.comCustos}
                />
              ) : (
                <p className="text-sm">
                  Rateio do condomínio: {d.chamado.rateio ? "Sim" : "Não"}
                </p>
              )}
            </div>
          </Parte>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Partes
// ---------------------------------------------------------------------------

function Parte({
  titulo: texto,
  icone,
  children,
}: {
  titulo: string;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={quadro}>
      <h3 className={`${titulo} mb-4 flex items-center gap-2`}>
        {icone}
        {texto}
      </h3>
      {children}
    </section>
  );
}

function Cabecalho({ d }: { d: DadosOS }) {
  const ch = d.chamado;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className={titulo}>{d.ehOS ? "Ordem de Serviço" : "Tempo"}</h3>
        {d.ehOS && (
          <p className="mt-1 text-sm text-neutral-600">
            {EXECUCOES[ch.execucao ?? "interna"]} · {d.local}
          </p>
        )}
      </div>
      {d.ehOS && (
        <div className="flex flex-wrap gap-2">
          <WhatsAppOS mensagem={d.mensagemOS} contatos={contatosDaOS(d)} />
          <a
            href={rotaPdfOS([ch.id])}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
          >
            <Printer className="size-4" aria-hidden />
            PDF
          </a>
        </div>
      )}
    </div>
  );
}

/** Duração, H.H. e (com os.custos) o valor: o que todo mundo procura. */
function Resumo({ d }: { d: DadosOS }) {
  const itens: [string, string][] = [
    ["Duração", formatarDuracao(d.resultado.minutos)],
    ["H.H.", formatarDuracao(d.resultado.minutoHomem)],
  ];
  if (d.ehOS && d.comCustos) {
    itens.push(["Valor da O.S.", formatarMoeda(d.resultado.total)]);
    if (d.chamado.rateio)
      itens.push(["Com rateio", formatarMoeda(d.resultado.valorRateio)]);
  }
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {itens.map(([nome, valor]) => (
        <div key={nome} className="rounded-2xl bg-neutral-900/[0.04] px-3 py-2">
          <dt className="text-xs text-neutral-500">{nome}</dt>
          <dd className="text-lg font-semibold tracking-tight tabular-nums">
            {valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Pendencias({ itens }: { itens: string[] }) {
  return (
    <div className={`${aviso.atencao} flex gap-3`}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">
          {itens.length === 1 ? "Pendência" : `${itens.length} pendências`}
        </p>
        <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4">
          {itens.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Resultado({ d }: { d: DadosOS }) {
  const ch = d.chamado;
  const terceirizada = ch.execucao === "terceirizada";
  if (!d.podeEditar)
    return (
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-neutral-500">
            {terceirizada ? "Solução para fechamento" : "Solução aplicada"}
          </dt>
          <dd className="whitespace-pre-wrap">{ch.solucao ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Causa da falha</dt>
          <dd>{ch.causa_falha ?? "—"}</dd>
        </div>
      </dl>
    );
  const causas = d.parametros.causas_falha;
  return (
    <FormAcao
      acao={salvarResultado}
      rotulo="Salvar resultado"
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="chamado_id" value={ch.id} />
      <label className={rotulo}>
        {terceirizada
          ? "Solução para fechamento (obrigatória para concluir)"
          : "Solução aplicada"}
        <textarea
          name="solucao"
          rows={3}
          maxLength={4000}
          defaultValue={ch.solucao ?? ""}
          placeholder="O que foi feito para resolver"
          className={classeCampo}
        />
      </label>
      {causas.length > 0 && (
        <label className={`${rotulo} sm:max-w-sm`}>
          Causa da falha
          <Selecao
            name="causa_falha"
            rotulo="Causa da falha"
            valorInicial={ch.causa_falha ?? ""}
            opcoes={[
              { valor: "", rotulo: "Não informada" },
              ...[
                ...new Set([
                  ...causas,
                  ...(ch.causa_falha ? [ch.causa_falha] : []),
                ]),
              ].map((c) => ({ valor: c, rotulo: c })),
            ]}
          />
        </label>
      )}
    </FormAcao>
  );
}

function ExecucaoLeitura({ d }: { d: DadosOS }) {
  const ch = d.chamado;
  const ativo = d.ativos.find((a) => a.id === ch.ativo_id);
  const itens: [string, string][] = [
    ["Execução", EXECUCOES[ch.execucao ?? "interna"]],
    ["Local", d.local],
    [
      "Ativo",
      ativo
        ? `${ativo.codigo} · ${ativo.nome}${ch.ativo_parado ? " (parado)" : ""}`
        : "—",
    ],
  ];
  if (ch.execucao === "terceirizada") {
    const empresa = ch.empresa_id ? d.cad.empresas.get(ch.empresa_id) : null;
    itens.push(["Empresa", empresa?.nome ?? "—"]);
    itens.push([
      "Profissionais",
      d.profissionais
        .map((p) => d.cad.profissionais.get(p)?.nome)
        .filter(Boolean)
        .join(", ") || "—",
    ]);
    itens.push([
      "Visita",
      ch.visita_data
        ? `${formatarData(ch.visita_data)}${ch.visita_periodo ? ` · ${PERIODOS[ch.visita_periodo]}` : ""}`
        : "A combinar",
    ]);
  }
  return (
    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      {itens.map(([nome, valor]) => (
        <div key={nome}>
          <dt className="text-xs text-neutral-500">{nome}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function Compacto({
  d,
  pendencias,
  cronometro,
}: {
  d: DadosOS;
  pendencias: string[];
  cronometro: React.ReactNode;
}) {
  return (
    <section className={`${quadro} flex flex-col gap-4`}>
      <Cabecalho d={d} />
      {cronometro}
      <Resumo d={d} />
      {pendencias.length > 0 && <Pendencias itens={pendencias} />}
      <p className="text-xs text-neutral-500">
        {d.sessoes.length} {d.sessoes.length === 1 ? "sessão" : "sessões"}
        {d.ehOS &&
          ` · ${d.materiais.length} ${d.materiais.length === 1 ? "material" : "materiais"}`}
        {d.ehOS && ` · Rateio: ${d.chamado.rateio ? "Sim" : "Não"}`}
      </p>
      <Link
        href={rotaChamado(d.chamado.id)}
        className="inline-flex items-center gap-1.5 self-start text-sm font-medium underline-offset-4 hover:underline"
      >
        {d.ehOS ? "Sessões, materiais e custos da OS" : "Corrigir as sessões"}
        <ArrowUpRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Dados para as partes
// ---------------------------------------------------------------------------

/** O que falta resolver, em destaque no topo do bloco. */
function pendenciasDa(d: DadosOS, hoje: string): string[] {
  const p: string[] = [];
  // Valor por minuto e preço de material: só para quem cuida dos custos.
  if (d.comCustos)
    for (const t of d.resultado.pendencias)
      p.push(
        t.startsWith("Sem valor por minuto")
          ? `${t}: cadastre o valor em Parâmetros.`
          : t,
      );
  for (const s of d.sessoes)
    if (s.fim === null && s.data < hoje)
      p.push(
        `Sessão de ${formatarData(s.data)} ainda está rodando: pause ou corrija o horário.`,
      );
  if (!d.ehOS) return p;
  if (d.orcamento.pendente)
    p.push("Orçamento do terceirizado acima do teto: falta a aprovação.");
  const aberta = ["aberto", "em_andamento", "aguardando"].includes(
    d.chamado.status,
  );
  if (
    aberta &&
    d.chamado.execucao === "terceirizada" &&
    !d.chamado.solucao?.trim()
  )
    p.push("Falta a solução para fechamento (obrigatória para concluir).");
  return p;
}

function bloqueioDoCronometro(d: DadosOS): string | null {
  if (!d.podeEditar) return "Você não pode registrar tempo nesta OS.";
  if (!["aberto", "em_andamento", "aguardando"].includes(d.chamado.status))
    return `${d.ehOS ? "OS" : "Chamado"} ${STATUS[d.chamado.status].toLowerCase()}: reabra para registrar tempo.`;
  return null;
}

/** Principal, Continuação (se são 2) ou Continuação 1, 2… */
function linhasDasSessoes(d: DadosOS): SessaoLinha[] {
  const ordem = [...d.sessoes].sort((a, b) =>
    `${a.data} ${a.inicio}`.localeCompare(`${b.data} ${b.inicio}`),
  );
  return ordem.map((s, i) => ({
    id: s.id,
    rotulo:
      i === 0
        ? "Principal"
        : ordem.length === 2
          ? "Continuação"
          : `Continuação ${i}`,
    data: s.data,
    inicio: s.inicio,
    fim: s.fim,
    almoco_inicio: s.almoco_inicio,
    almoco_fim: s.almoco_fim,
    tecnicos: s.tecnicos,
    observacao: s.observacao,
    minutos: s.fim === null ? "—" : formatarDuracao(minutosDaSessao(s)),
    minutoHomem: s.fim === null ? "—" : formatarDuracao(minutoHomem([s])),
  }));
}

function arquivosDa(d: DadosOS, categorias: string[]): ArquivoDaOS[] {
  return d.arquivos
    .filter((a) => categorias.includes(a.categoria))
    .map((a) => ({
      id: a.id,
      nome: a.nome,
      url: a.url,
      foto: a.imagem,
      legenda: a.enviadoPor ?? undefined,
      meu: a.meu,
    }));
}

function opcoesDeLoja(d: DadosOS): Opcao[] {
  return [...d.cad.lojas.values()]
    .filter((l) => l.situacao === "vigente" || l.id === d.chamado.loja_id)
    .map((l) => ({
      valor: l.id,
      rotulo: `${l.luc} · ${l.nome}`,
      descricao: l.bloco ? `Bloco ${l.bloco}` : undefined,
    }));
}

/** Contatos para o WhatsApp da OS (valor = telefone, sem repetir). */
function contatosDaOS(d: DadosOS): Opcao[] {
  const lista: Opcao[] = [];
  const loja = d.chamado.loja_id ? d.cad.lojas.get(d.chamado.loja_id) : null;
  if (loja?.telefone)
    lista.push({ valor: loja.telefone, rotulo: `Lojista · ${loja.nome}` });
  lista.push(...telefonesDoTerceirizado(d));
  for (const c of d.contatos)
    lista.push({
      valor: c.telefone,
      rotulo: c.nome,
      descricao: c.empresa ?? undefined,
    });
  return semRepetir(lista);
}

/** Profissionais da OS e a empresa primeiro; depois os contatos salvos. */
function telefonesDoTerceirizado(d: DadosOS): Opcao[] {
  const lista: Opcao[] = [];
  for (const id of d.profissionais) {
    const p = d.cad.profissionais.get(id);
    if (p?.telefone)
      lista.push({
        valor: p.telefone,
        rotulo: p.nome,
        descricao: "Profissional",
      });
  }
  const empresa = d.chamado.empresa_id
    ? d.cad.empresas.get(d.chamado.empresa_id)
    : null;
  if (empresa?.telefone)
    lista.push({
      valor: empresa.telefone,
      rotulo: empresa.contato
        ? `${empresa.contato} · ${empresa.nome}`
        : empresa.nome,
      descricao: "Empresa",
    });
  return semRepetir(lista);
}

function semRepetir(lista: Opcao[]): Opcao[] {
  const vistos = new Set<string>();
  return lista.filter((o) => {
    const chave = o.valor.replace(/\D/g, "");
    if (!chave || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

function localizacao(v: Json | null): Localizacao | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const { lat, lng } = v as Record<string, Json | undefined>;
  return typeof lat === "number" && typeof lng === "number"
    ? { lat, lng }
    : null;
}

function linkNaTela(d: DadosOS): LinkNaTela | null {
  const l = d.links[0];
  if (!l) return null;
  return {
    etapa: etapaDoTerceirizado(l),
    ativo: linkAtivo(l, d.chamado),
    url: urlDoSistema(rotaTerceirizado(l.token)),
    criado_em: l.criado_em,
    aceito_em: l.aceito_em,
    recusado_em: l.recusado_em,
    recusa_motivo: l.recusa_motivo,
    chegada_em: l.chegada_em,
    chegada_local: localizacao(l.chegada_local),
    saida_em: l.saida_em,
    saida_local: localizacao(l.saida_local),
    terminado_em: l.terminado_em,
    solucao: l.solucao,
    valor_informado: d.comCustos ? l.valor_informado : null,
    orcamento_numero: l.orcamento_numero,
    ultimo_acesso_em: l.ultimo_acesso_em,
  };
}

/** Prazo de retorno do terceirizado e o WhatsApp pronto para cobrar. */
function cobrancaDa(d: DadosOS, agora: Date) {
  const ch = d.chamado;
  const l = d.links[0];
  if (!ch.prazo_terceirizado || !l || l.terminado_em || !linkAtivo(l, ch))
    return null;
  if (!["aberto", "em_andamento", "aguardando"].includes(ch.status))
    return null;
  const prazo = new Date(ch.prazo_terceirizado);
  const telefone = telefonesDoTerceirizado(d)[0];
  const empresa = ch.empresa_id ? d.cad.empresas.get(ch.empresa_id) : null;
  const mensagem = preencher(
    modeloMensagem(d.parametros, "cobranca_terceirizado"),
    {
      nome: empresa?.contato ?? empresa?.nome ?? "",
      numero: ch.numero,
      local: d.local,
      prazo: dataHoraBr(ch.prazo_terceirizado).slice(0, 10),
      link: urlDoSistema(rotaTerceirizado(l.token)),
    },
  );
  return {
    prazo: dataHoraBr(ch.prazo_terceirizado),
    atrasado: prazo.getTime() < agora.getTime(),
    vencendo: prazo.getTime() - agora.getTime() < 86_400_000,
    whatsapp: linkWhatsApp(telefone?.valor ?? null, mensagem),
  };
}
