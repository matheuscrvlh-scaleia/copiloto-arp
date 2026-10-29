import {
  Archive,
  CircleCheck,
  CircleDashed,
  Pause,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import {
  CartaoCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { CartaoIndicador } from "@/components/dashboard/indicador";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { ProvedorDetalhe } from "@/components/modal-detalhe";
import { AnexosDoAtivo } from "@/components/os/ativos/anexos";
import { detalheDoSinal } from "@/components/os/ativos/detalhe-sinal";
import { GraficoCustoAtivo } from "@/components/os/ativos/grafico-custo";
import { Janela } from "@/components/os/ativos/janela";
import { PlanosDoAtivo } from "@/components/os/ativos/planos";
import { QrDoAtivo } from "@/components/os/ativos/qr";
import {
  SeloGarantia,
  SeloIncompleto,
  SeloSinal,
  SeloSituacaoAtivo,
} from "@/components/os/ativos/selos";
import { SeloStatusChamado, SeloTipo } from "@/components/os/selos";
import { tonsDaTela } from "@/components/os/tons";
import { SemAcesso } from "@/components/protegido";
import {
  formatarData,
  formatarMoeda,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import { listaEmTexto, situacaoDaGarantia } from "@/lib/os/ativos";
import { formatarDuracao } from "@/lib/os/calculos";
import { formatarNumeroChamado } from "@/lib/os/numeros";
import { ROTAS_OS, rotaAtivo, rotaDo } from "@/lib/os/rotas";
import { hojeEmBrasilia, paraBrasilia } from "@/lib/os/tempo";
import { linkWhatsApp } from "@/lib/os/whatsapp";
import {
  alternarPlano,
  darBaixa,
  enviarAnexo,
  excluirPlano,
  gerarPreventivaAgora,
  mudarSituacao,
  removerAnexo,
  salvarPlano,
} from "@/server/os/acoes/ativos";
import { type Ficha, fichaDoAtivo, type OSDoAtivo } from "@/server/os/ativos";
import {
  categorias,
  contexto,
  nomes,
  parametros,
  pessoas,
  setores,
  urlDoSistema,
} from "@/server/os/base";

export const metadata: Metadata = { title: "Ativo" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function Page({ params, searchParams }: Props) {
  return (
    <>
      <Link
        href={ROTAS_OS.ativos}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Ativos
      </Link>
      <Suspense fallback={<Esqueleto />}>
        <Conteudo params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Conteudo({ params, searchParams }: Props) {
  const [ctx, { id }, sp] = await Promise.all([
    contexto(),
    params,
    searchParams,
  ]);
  if (!ctx.pode("os.ativos") && !ctx.pode("os.ativos_gerenciar"))
    return <SemAcesso />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const agora = new Date();
  const [ficha, { garantia_aviso_dias: avisoGarantiaDias }] = await Promise.all(
    [fichaDoAtivo(id, agora), parametros()],
  );
  if (!ficha) notFound();
  const hoje = hojeEmBrasilia(agora);
  const gerenciar = ctx.pode("os.ativos_gerenciar");
  const { ativo: a, sinal, resumo } = ficha;
  const baixado = a.situacao === "baixado";

  return (
    <ProvedorDetalhe exportar={ctx.pode("os.exportar")}>
      <div className="flex flex-col gap-6">
        <Cabecalho ficha={ficha} gerenciar={gerenciar} agora={agora} />

        {sp.criado === "1" && (
          <output className="flex items-center gap-2 rounded-3xl bg-green-50 px-4 py-3 text-sm text-green-800">
            <CircleCheck className="size-4 shrink-0" aria-hidden />
            Ativo cadastrado com o código {a.codigo}. Imprima a etiqueta e cole
            no equipamento.
          </output>
        )}
        {sp.salvo === "1" && (
          <output className="flex items-center gap-2 rounded-3xl bg-green-50 px-4 py-3 text-sm text-green-800">
            <CircleCheck className="size-4 shrink-0" aria-hidden />
            Cadastro salvo.
          </output>
        )}
        {sp.foto === "0" && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-3xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <CircleDashed className="size-4 shrink-0" aria-hidden />
            Não foi possível enviar a foto. Anexe de novo em Arquivos.
          </p>
        )}
        {baixado && (
          <p className="flex items-start gap-2 rounded-3xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
            <Archive className="mt-0.5 size-4 shrink-0" aria-hidden />
            Baixado em {formatarData(a.baixa_data)}: {a.baixa_motivo}. O
            histórico continua; não recebe chamado nem preventiva.
          </p>
        )}
        {ficha.faltas.length > 0 && (
          <div className="flex flex-col gap-2 rounded-3xl border border-dashed border-amber-300 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center">
            <CircleDashed className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">
              Cadastro incompleto: falta {listaEmTexto(ficha.faltas)}.
              {sinal.sinal === "incompleto" &&
                " Sem esses dados o sinal de troca não sai."}
            </span>
            {gerenciar && (
              <Link
                href={`${rotaAtivo(a.id)}/editar`}
                className="font-medium whitespace-nowrap underline-offset-2 hover:underline"
              >
                Completar cadastro →
              </Link>
            )}
          </div>
        )}

        <Indicadores ficha={ficha} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-6">
            <Secao
              titulo="Custo de manutenção"
              descricao="Acumulado desde a compra, mês a mês. Quando a área encosta na linha tracejada, a manutenção já custou um equipamento novo."
            >
              {ficha.custoMensal ? (
                ficha.custoMensal.some((m) => m.valor > 0) ? (
                  <GraficoCustoAtivo
                    meses={ficha.custoMensal}
                    reposicao={a.valor_reposicao}
                  />
                ) : (
                  <p className="py-6 text-sm text-neutral-500">
                    Nenhuma OS com custo calculado ainda.
                  </p>
                )
              ) : (
                <p className="py-6 text-sm text-neutral-500">
                  Os valores em reais ficam com quem vê custos. O peso da
                  manutenção ({formatarPct(sinal.pesoPct, 0)}) e o sinal valem
                  para todos.
                </p>
              )}
            </Secao>

            <Secao
              titulo="Linha do tempo"
              descricao="Todas as OS e chamados deste ativo, do mais novo para o mais antigo."
            >
              <LinhaDoTempo
                ordens={ficha.ordens}
                verCustos={ficha.verCustos}
                agora={agora}
              />
            </Secao>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <Secao
              titulo="Mais números"
              descricao="Últimos 12 meses, salvo indicação."
            >
              <MaisNumeros
                ficha={ficha}
                hoje={hoje}
                avisoGarantiaDias={avisoGarantiaDias}
              />
            </Secao>

            <Secao
              titulo="Planos preventivos"
              descricao="A OS preventiva sai sozinha, já ligada ao ativo, com responsável e checklist."
            >
              <Planos ficha={ficha} hoje={hoje} gerenciar={gerenciar} />
            </Secao>

            <Secao titulo="Cadastro">
              <Cadastro ficha={ficha} />
            </Secao>

            <Secao titulo="Arquivos" descricao="Manual, nota fiscal e laudos.">
              <AnexosDoAtivo
                ativoId={a.id}
                anexos={ficha.anexos}
                gerenciar={gerenciar}
                enviar={enviarAnexo}
                remover={removerAnexo}
              />
            </Secao>

            <Secao
              titulo="Etiqueta"
              descricao="Quem escaneia pelo celular, já logado, cai nesta ficha."
            >
              <div className="flex items-center gap-4">
                <QrDoAtivo
                  texto={urlDoSistema(rotaAtivo(a.id))}
                  rotulo={`QR da etiqueta de ${a.codigo}`}
                  className="size-28 shrink-0"
                />
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="font-mono text-lg font-semibold">{a.codigo}</p>
                  <p className="text-xs text-neutral-500">{ficha.local}</p>
                  {gerenciar && (
                    <a
                      href={`${ROTAS_OS.ativos}/etiquetas/pdf?id=${a.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
                    >
                      <Printer className="size-4" aria-hidden />
                      Imprimir etiqueta
                    </a>
                  )}
                </div>
              </div>
            </Secao>
          </div>
        </div>

        <Nota>
          Custo, corretivas e preventivas somam todas as OS do ativo (sem as
          canceladas), pela data de abertura. A linha do tempo e o gráfico
          mostram as OS que você pode ver.{" "}
          {resumo.ultimaOs
            ? `Última OS em ${formatarData(paraBrasilia(new Date(resumo.ultimaOs)).data)}.`
            : ""}
        </Nota>
      </div>
    </ProvedorDetalhe>
  );
}

// ---------------------------------------------------------------------------

function Cabecalho({
  ficha,
  gerenciar,
  agora,
}: {
  ficha: Ficha;
  gerenciar: boolean;
  agora: Date;
}) {
  const a = ficha.ativo;
  const baixado = a.situacao === "baixado";
  const outras = (["em_uso", "em_manutencao", "parado"] as const).filter(
    (s) => s !== a.situacao,
  );
  const ICONE = { em_uso: CircleCheck, em_manutencao: Wrench, parado: Pause };
  const ROTULO = {
    em_uso: baixado ? "Reativar" : "Em uso",
    em_manutencao: "Em manutenção",
    parado: "Parado",
  };
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        {ficha.foto && (
          // biome-ignore lint/performance/noImgElement: endereço assinado e temporário do bucket privado
          <img
            src={ficha.foto}
            alt={`Foto de ${a.nome}`}
            className="size-20 shrink-0 rounded-2xl object-cover md:size-24"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm text-neutral-500">
            {a.codigo}
            {ficha.categoria ? ` · ${ficha.categoria.nome}` : ""}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight break-words md:text-5xl">
            {a.nome}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">{ficha.local}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SeloSituacaoAtivo situacao={a.situacao} />
            <SeloSinal sinal={ficha.sinal.sinal} />
            {ficha.faltas.length > 0 && ficha.sinal.sinal !== "incompleto" && (
              <SeloIncompleto faltas={ficha.faltas} />
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        Atualizado às {paraBrasilia(agora).hora}
      </p>

      {!baixado && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`${ROTAS_OS.novaOrdem}?ativo=${a.id}`}
            className="flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-neutral-800 sm:w-fit sm:py-3"
          >
            <Plus className="size-5" aria-hidden />
            Abrir OS para este ativo
          </Link>
          <Link
            href={`${ROTAS_OS.novo}?ativo=${a.id}`}
            className="flex items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-base font-semibold text-neutral-900 ring-1 ring-neutral-900/10 transition hover:bg-neutral-50 sm:w-fit sm:py-3"
          >
            Abrir chamado
          </Link>
        </div>
      )}

      {gerenciar && (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${rotaAtivo(a.id)}/editar`}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
          >
            <Pencil className="size-4" aria-hidden />
            Editar
          </Link>
          {outras.map((s) => {
            const Icone = baixado ? RotateCcw : ICONE[s];
            if (baixado && s !== "em_uso") return null;
            return (
              <AcaoRapida
                key={s}
                acao={mudarSituacao}
                campos={{ id: a.id, situacao: s }}
                rotulo={ROTULO[s]}
                icone={<Icone className="size-4" aria-hidden />}
                confirmar={
                  baixado
                    ? `Reativar ${a.nome}? Volta para "Em uso"; a baixa sai do cadastro.`
                    : undefined
                }
                comTexto
              />
            );
          })}
          {!baixado && (
            <Janela
              acao={darBaixa}
              variante="perigo"
              perigo
              rotulo="Dar baixa"
              icone={<Archive className="size-4" aria-hidden />}
              titulo={`Dar baixa em ${a.nome}`}
              descricao="O ativo sai de uso e os planos preventivos param. O histórico fica."
              enviar="Dar baixa"
              enviando="Registrando…"
            >
              <input type="hidden" name="id" value={a.id} />
              <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
                Data da baixa
                <input
                  type="date"
                  name="baixa_data"
                  required
                  defaultValue={hojeEmBrasilia(agora)}
                  max={hojeEmBrasilia(agora)}
                  className={classeCampo}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
                Motivo
                <textarea
                  name="baixa_motivo"
                  required
                  minLength={3}
                  maxLength={500}
                  rows={3}
                  placeholder="Ex.: trocado por um novo; conserto não compensava."
                  className={classeCampo}
                />
              </label>
            </Janela>
          )}
        </div>
      )}
    </header>
  );
}

const TONS = tonsDaTela("ficha-do-ativo");

function Indicadores({ ficha }: { ficha: Ficha }) {
  const { resumo, sinal, faixas, ativo: a } = ficha;
  const corretivas = sinal.criterios.corretivas;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {ficha.verCustos ? (
        <CartaoIndicador
          tom={TONS[0]}
          titulo="Custo de manutenção em 12 meses"
          valor={formatarMoeda(resumo.custo12m)}
          detalhe={
            sinal.pesoPct === null
              ? "sem valor de reposição para comparar"
              : `${formatarPct(sinal.pesoPct, 0)} do valor de reposição`
          }
        />
      ) : (
        <CartaoIndicador
          tom={TONS[0]}
          titulo="Peso da manutenção"
          valor={sinal.pesoPct === null ? "—" : formatarPct(sinal.pesoPct, 0)}
          detalhe="custo de 12 meses ÷ valor de reposição"
        />
      )}
      <CartaoIndicador
        tom={TONS[1]}
        titulo="Corretivas em 12 meses"
        valor={formatarNumero(resumo.corretivas12m)}
        detalhe={`${resumo.preventivas12m} preventivas no mesmo período`}
        status={
          corretivas === "trocar"
            ? "fora"
            : corretivas === "avaliar"
              ? "atencao"
              : "ok"
        }
        meta={`Avaliar a partir de ${faixas.corretivasAvaliar}, trocar a partir de ${faixas.corretivasTrocar}`}
      />
      <CartaoIndicador
        tom={TONS[2]}
        titulo="Dias parado em 12 meses"
        valor={formatarNumero(ficha.diasParado12m, 1)}
        detalhe="em Parado ou Em manutenção"
      />
      <CartaoIndicador
        tom={TONS[3]}
        titulo="Sinal"
        valor={
          {
            manter: "Manter",
            avaliar: "Avaliar",
            trocar: "Trocar",
            incompleto: "—",
          }[sinal.sinal]
        }
        status={
          sinal.sinal === "trocar"
            ? "fora"
            : sinal.sinal === "avaliar"
              ? "atencao"
              : sinal.sinal === "manter"
                ? "ok"
                : "sem_dado"
        }
        detalhe={
          sinal.sinal === "incompleto"
            ? "cadastro incompleto: o sistema não chuta"
            : "o pior de peso, corretivas e idade"
        }
        meta="Clique para ver os três critérios"
        origem={detalheDoSinal({
          nome: a.nome,
          sinal,
          faixas,
          corretivas12m: resumo.corretivas12m,
          idadeAnos: ficha.idadeAnos,
          vidaUtilAnos: a.vida_util_anos,
          faltas: ficha.faltas,
        })}
      />
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  detalhe,
  children,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-neutral-900/[0.035] px-4 py-3">
      <dt className="text-xs text-neutral-500">{rotulo}</dt>
      <dd className="text-lg font-semibold tabular-nums">{valor}</dd>
      {detalhe && <dd className="text-xs text-neutral-500">{detalhe}</dd>}
      {children}
    </div>
  );
}

function MaisNumeros({
  ficha,
  hoje,
  avisoGarantiaDias,
}: {
  ficha: Ficha;
  hoje: string;
  /** Parâmetros: garantia "vencendo" a partir de N dias do fim. */
  avisoGarantiaDias: number;
}) {
  const { resumo, ativo: a, sinal } = ficha;
  const garantia = situacaoDaGarantia(a.garantia_fim, hoje, avisoGarantiaDias);
  const proxima = ficha.planos
    .filter((p) => p.ativo)
    .map((p) => p.proxima_data)
    .sort()[0];
  return (
    <dl className="grid grid-cols-2 gap-2">
      {ficha.verCustos && (
        <Numero
          rotulo="Custo acumulado"
          valor={formatarMoeda(resumo.custoTotal, 0)}
          detalhe={
            a.compra_data
              ? `desde ${formatarData(a.compra_data)}`
              : "desde a primeira OS"
          }
        />
      )}
      <Numero
        rotulo="Peso da manutenção"
        valor={sinal.pesoPct === null ? "—" : formatarPct(sinal.pesoPct, 0)}
        detalhe={
          sinal.pesoPct === null
            ? "falta o valor de reposição"
            : "custo 12m ÷ reposição"
        }
      />
      <Numero
        rotulo="Idade"
        valor={
          ficha.idadeAnos === null
            ? "—"
            : `${formatarNumero(ficha.idadeAnos, 1)} anos`
        }
        detalhe={
          a.vida_util_anos
            ? `vida útil de ${formatarNumero(a.vida_util_anos, 0)} anos${sinal.idadePct !== null ? ` (${formatarPct(sinal.idadePct, 0)})` : ""}`
            : "falta a vida útil"
        }
      />
      <Numero
        rotulo="Tempo médio entre falhas"
        valor={
          ficha.mtbfDias === null
            ? "—"
            : `${formatarNumero(ficha.mtbfDias, 1)} dias`
        }
        detalhe={
          ficha.mtbfDias === null
            ? "precisa de 2 corretivas"
            : "entre corretivas seguidas"
        }
      />
      <Numero
        rotulo="Tempo médio de reparo"
        valor={ficha.mttrMin === null ? "—" : formatarDuracao(ficha.mttrMin)}
        detalhe="da abertura à conclusão, sem Aguardando"
      />
      <Numero
        rotulo="OS abertas"
        valor={formatarNumero(resumo.osAbertas)}
        detalhe={`${resumo.preventivas12m} preventivas em 12 meses`}
      />
      <Numero
        rotulo="Próxima preventiva"
        valor={proxima ? formatarData(proxima) : "—"}
        detalhe={proxima ? undefined : "nenhum plano ativo"}
      />
      <Numero
        rotulo="Garantia"
        valor={a.garantia_fim ? formatarData(a.garantia_fim) : "—"}
      >
        {garantia && (
          <dd className="mt-1">
            <SeloGarantia situacao={garantia} />
          </dd>
        )}
      </Numero>
    </dl>
  );
}

async function Planos({
  ficha,
  hoje,
  gerenciar,
}: {
  ficha: Ficha;
  hoje: string;
  gerenciar: boolean;
}) {
  const [listaSetores, cats, quem, nomesPorId] = await Promise.all([
    setores(),
    categorias(),
    pessoas(),
    nomes(),
  ]);
  const a = ficha.ativo;
  const nomeSetor = new Map(listaSetores.map((s) => [s.id, s.nome]));
  const ativas = cats.filter((c) => c.ativo);
  const setorPadrao = a.setor_id ?? listaSetores.find((s) => s.ativo)?.id ?? "";
  const categoriaPadrao =
    ativas.find((c) => c.preventiva && c.setor_id === setorPadrao)?.id ??
    ativas.find((c) => c.preventiva)?.id ??
    "";
  return (
    <PlanosDoAtivo
      ativoId={a.id}
      ativoNome={a.nome}
      baixado={a.situacao === "baixado"}
      planos={ficha.planos}
      hoje={hoje}
      gerenciar={gerenciar}
      nomes={nomesPorId}
      acoes={{
        salvar: salvarPlano,
        alternar: alternarPlano,
        excluir: excluirPlano,
        gerar: gerarPreventivaAgora,
      }}
      opcoes={{
        setores: listaSetores
          .filter((s) => s.ativo)
          .map((s) => ({ id: s.id, nome: s.nome })),
        categorias: ativas
          .map((c) => ({
            id: c.id,
            nome: `${nomeSetor.get(c.setor_id) ?? ""} › ${c.nome}`,
            setorId: c.setor_id,
            preventiva: c.preventiva,
          }))
          .sort((x, y) => Number(y.preventiva) - Number(x.preventiva)),
        pessoas: quem.map((p) => ({ id: p.id, nome: p.nome })),
        antecedenciaPadrao: ficha.antecedenciaPadrao,
      }}
      padrao={{
        setorId: setorPadrao,
        categoriaId: categoriaPadrao,
        responsavelId: a.responsavel_id ?? "",
      }}
    />
  );
}

function Cadastro({ ficha }: { ficha: Ficha }) {
  const a = ficha.ativo;
  const f = ficha.fornecedor;
  const fornecedor = f ? (
    <span className="flex flex-col">
      {f.nome}
      {(f.contato || f.telefone || f.email) && (
        <span className="text-xs text-neutral-500">
          {[f.contato, f.telefone, f.email].filter(Boolean).join(" · ")}
        </span>
      )}
      {f.telefone && (
        <a
          href={linkWhatsApp(
            f.telefone,
            `Olá! Sobre o equipamento ${a.codigo} (${a.nome}):`,
          )}
          target="_blank"
          rel="noreferrer"
          className="mt-1 w-fit text-xs font-medium text-green-700 underline-offset-2 hover:underline"
        >
          Chamar no WhatsApp
        </a>
      )}
    </span>
  ) : null;
  const linhas: [string, React.ReactNode][] = [
    ["Fabricante", a.fabricante],
    ["Modelo", a.modelo],
    ["Número de série", a.numero_serie],
    [
      "Compra ou instalação",
      a.compra_data ? formatarData(a.compra_data) : null,
    ],
    ...(ficha.verCustos
      ? ([
          [
            "Valor de compra",
            a.compra_valor === null ? null : formatarMoeda(a.compra_valor),
          ],
          [
            "Valor de reposição",
            a.valor_reposicao === null
              ? null
              : formatarMoeda(a.valor_reposicao),
          ],
        ] as [string, React.ReactNode][])
      : []),
    [
      "Vida útil",
      a.vida_util_anos
        ? `${formatarNumero(a.vida_util_anos, 1).replace(",0", "")} anos`
        : null,
    ],
    ["Fim da garantia", a.garantia_fim ? formatarData(a.garantia_fim) : null],
    ["Fornecedor", fornecedor],
    ["Setor", ficha.setor],
    ["Responsável", ficha.responsavel],
    ["Observação", a.observacao],
  ];
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
      {linhas.map(([rotulo, valor]) => (
        <div
          key={rotulo}
          className={rotulo === "Observação" ? "sm:col-span-2" : ""}
        >
          <dt className="text-xs text-neutral-500">{rotulo}</dt>
          <dd className={valor ? "whitespace-pre-line" : "text-neutral-400"}>
            {valor || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function LinhaDoTempo({
  ordens,
  verCustos,
  agora,
}: {
  ordens: OSDoAtivo[];
  verCustos: boolean;
  agora: Date;
}) {
  if (!ordens.length)
    return (
      <p className="py-4 text-sm text-neutral-500">
        Nenhum chamado neste ativo ainda.
      </p>
    );
  return (
    <ol className="relative flex flex-col gap-1 before:absolute before:top-3 before:bottom-3 before:left-[7px] before:w-px before:bg-neutral-900/10">
      {ordens.map((o) => {
        const tipo =
          o.tipo !== "os" ? null : o.preventiva ? "Preventiva" : "Corretiva";
        const atrasada =
          o.prazo &&
          ["aberto", "em_andamento", "aguardando"].includes(o.status) &&
          new Date(o.prazo).getTime() < agora.getTime();
        return (
          <li key={o.id} className="relative flex gap-3 pl-6">
            <span
              aria-hidden
              className={`absolute top-3 left-0.5 size-3 rounded-full ${tipo === "Corretiva" ? "bg-neutral-900" : "bg-neutral-400"}`}
            />
            <Link
              href={rotaDo(o)}
              className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-2xl px-3 py-2.5 transition hover:bg-white/60 sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs text-neutral-500 tabular-nums">
                    {formatarData(paraBrasilia(new Date(o.criado_em)).data)}
                  </span>
                  <span className="font-mono text-xs text-neutral-500">
                    {formatarNumeroChamado(o.numero)}
                  </span>
                  <span className="text-sm font-medium">{o.titulo}</span>
                </span>
                {o.causa_falha && (
                  <span className="block text-xs text-neutral-500">
                    Causa: {o.causa_falha}
                  </span>
                )}
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {tipo ? (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${tipo === "Corretiva" ? "bg-neutral-900 text-white" : "bg-neutral-900/[0.06] text-neutral-700"}`}
                  >
                    {tipo}
                  </span>
                ) : (
                  <SeloTipo tipo={o.tipo} />
                )}
                <SeloStatusChamado status={o.status} />
                {atrasada && (
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                    Atrasada
                  </span>
                )}
                {verCustos && o.tipo === "os" && (
                  <span className="w-24 text-right text-sm font-medium tabular-nums">
                    {o.custo === null ? "—" : formatarMoeda(o.custo)}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-40" />
      <IndicadoresCarregando quantidade={4} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <CartaoCarregando altura="h-96" />
        <CartaoCarregando altura="h-96" />
      </div>
    </TelaCarregando>
  );
}
