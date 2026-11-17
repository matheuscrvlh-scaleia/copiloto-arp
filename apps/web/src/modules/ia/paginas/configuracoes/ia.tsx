import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
  formatarNumero,
  isoLocal,
} from "@arp/shared/formato";
import {
  type ConfigDaIa,
  configDaIa,
  ESFORCOS,
  type EsforcoDaIa,
  type RespostaConfig,
  ROTULO_DO_ESFORCO,
  ROTULO_DO_STATUS,
  tituloDoModulo,
} from "@arp/shared/ia/contratos";
import { formatarTokens } from "@arp/shared/ia/regras";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { Suspense, useDeferredValue, useMemo, useState } from "react";
import { BotoesDeEscolha } from "@/components/botoes-de-escolha";
import { AreaLinha } from "@/components/dashboard/graficos/area-linha";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import { Colunas } from "@/components/dashboard/graficos/colunas";
import { Rosca } from "@/components/dashboard/graficos/rosca";
import { CartaoIndicador } from "@/components/dashboard/indicador";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import { Carregando } from "@/components/page-header";
import { mensagemDoErro } from "@/lib/api";
import { Link } from "@/lib/navegacao";
import {
  consultaDaConfig,
  consultaDoUso,
  removerLimite,
  salvarConfig,
  salvarLimite,
} from "../../api";

// Administração › Configurações › IA (ia.gerenciar): quanto a IA ARP é
// usada (por dia, hora, pessoa, cargo e módulo), quanto custa, os limites
// de tokens por cargo e por pessoa e os ajustes. O gestor vê números de
// uso; o conteúdo das conversas é só de quem conversou.

type Aba = "uso" | "limites" | "ajustes";

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: "uso", rotulo: "Uso e custos" },
  { valor: "limites", rotulo: "Limites" },
  { valor: "ajustes", rotulo: "Ajustes" },
];

const dolar = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: v < 10 ? 2 : 0,
  });

const hojeEmBrasilia = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );

function diasAtras(fim: string, dias: number): string {
  const [a, m, d] = fim.split("-").map(Number) as [number, number, number];
  return isoLocal(new Date(a, m - 1, d - dias + 1));
}

export default function Page() {
  const [aba, setAba] = useState<Aba>("uso");
  const { data } = useSuspenseQuery(consultaDaConfig);
  return (
    <div className="flex flex-col gap-5">
      <Destaque config={data} />
      <div className="max-w-md">
        <BotoesDeEscolha
          nome="Seção"
          valor={aba}
          opcoes={ABAS}
          aoMudar={(v) => {
            const achada = ABAS.find((a) => a.valor === v);
            if (achada) setAba(achada.valor);
          }}
        />
      </div>
      {aba === "uso" && <Uso cotacao={data.config.cotacao_dolar} />}
      {aba === "limites" && <Limites dados={data} />}
      {aba === "ajustes" && <Ajustes dados={data} />}
    </div>
  );
}

function Destaque({ config: d }: { config: RespostaConfig }) {
  const ligada = d.config.ativa && d.configurada;
  return (
    <section className="destaque rounded-[2rem] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-[#58c069] to-[#2f7d3d] text-[#ffffff]">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm text-[rgb(255_255_255/0.6)]">IA ARP</p>
            <p className="text-3xl font-semibold tracking-tight">
              {ligada ? "Ligada" : d.config.ativa ? "Sem chave" : "Desligada"}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-[rgb(255_255_255/0.6)]">Modelo</dt>
            <dd className="font-medium">{d.modelo ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(255_255_255/0.6)]">
              Fontes de dados
            </dt>
            <dd className="font-medium">{d.fontes} leituras do sistema</dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(255_255_255/0.6)]">Esforço</dt>
            <dd className="font-medium">
              {ROTULO_DO_ESFORCO[d.config.esforco].split(" (")[0]}
            </dd>
          </div>
        </dl>
      </div>
      <p className="mt-5 max-w-3xl text-xs text-[rgb(255_255_255/0.6)]">
        A IA lê o sistema pelas mesmas telas de quem pergunta, com as mesmas
        permissões: o que a pessoa não vê, a IA também não vê. Cada leitura nova
        que o sistema ganha entra sozinha nas fontes. Quem usa: as permissões{" "}
        <strong className="text-[#ffffff]">IA – usar</strong> em{" "}
        <Link href="/admin/usuarios" className="underline underline-offset-2">
          Usuários e cargos
        </Link>
        .
      </p>
      {!d.configurada && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[rgb(255_255_255/0.08)] p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Falta a chave da Claude.{" "}
            <Link
              href="/admin/integracoes#claude"
              className="underline underline-offset-2"
            >
              Cadastre em Integrações
            </Link>
            .
          </span>
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Uso e custos
// ---------------------------------------------------------------------------

const PERIODOS = [
  { valor: "7", rotulo: "7 dias" },
  { valor: "30", rotulo: "30 dias" },
  { valor: "90", rotulo: "90 dias" },
  { valor: "365", rotulo: "12 meses" },
];

function Uso({ cotacao }: { cotacao: number }) {
  const [dias, setDias] = useState("30");
  const consulta = useMemo(() => {
    const ate = hojeEmBrasilia();
    return { de: diasAtras(ate, Number(dias)), ate };
  }, [dias]);
  const adiada = useDeferredValue(consulta);
  return (
    <>
      <div className="max-w-md">
        <BotoesDeEscolha
          nome="Período"
          valor={dias}
          opcoes={PERIODOS}
          aoMudar={setDias}
        />
      </div>
      <Suspense fallback={<Carregando />}>
        <PainelDeUso consulta={adiada} cotacao={cotacao} />
      </Suspense>
    </>
  );
}

type Metrica = "perguntas" | "tokens" | "custo_usd";

const CORES = [1, 2, 3, 4, 5] as const;

function PainelDeUso({
  consulta,
  cotacao,
}: {
  consulta: { de: string; ate: string };
  cotacao: number;
}) {
  const { data: u } = useSuspenseQuery(consultaDoUso(consulta));
  const { data: cfg } = useSuspenseQuery(consultaDaConfig);
  const [metrica, setMetrica] = useState<Metrica>("perguntas");
  const r = u.resumo;
  const avaliadas = r.positivas + r.negativas;
  const teto = cfg.config.orcamento_mes_usd;
  const semPreco = u.por_modelo.filter((m) => !(m.modelo in cfg.config.precos));

  const texto = (v: number, m: Metrica) =>
    m === "custo_usd"
      ? dolar(v)
      : m === "tokens"
        ? formatarTokens(v)
        : formatarNumero(v);

  return (
    <div className="flex flex-col gap-5">
      <section className="vidro rounded-[2rem] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-neutral-500">Gasto no mês corrente</p>
            <p className="text-3xl font-semibold tracking-tight text-neutral-900">
              {dolar(u.mes.custo_usd)}
              <span className="ml-2 text-base font-normal text-neutral-500">
                ≈ {formatarMoeda(u.mes.custo_usd * cotacao)}
              </span>
            </p>
          </div>
          <p className="text-sm text-neutral-500">
            {teto === null
              ? "Sem teto de gasto mensal"
              : `Teto: ${dolar(teto)} (${formatarNumero((u.mes.custo_usd / teto) * 100, 0)}% usado)`}
            {" · "}
            {formatarTokens(u.mes.tokens)} tokens contados
          </p>
        </div>
        {teto !== null && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200">
            <div
              className={`h-full rounded-full ${u.mes.custo_usd >= teto ? "bg-red-500" : u.mes.custo_usd >= teto * 0.8 ? "bg-amber-500" : "bg-marca"}`}
              style={{
                width: `${Math.min((u.mes.custo_usd / teto) * 100, 100)}%`,
              }}
            />
          </div>
        )}
      </section>

      {semPreco.length > 0 && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Modelo sem preço cadastrado (custo contado como zero):{" "}
          {semPreco.map((m) => m.modelo).join(", ")}. Inclua em Ajustes ›
          Preços.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <CartaoIndicador
          titulo="Perguntas"
          valor={formatarNumero(r.perguntas)}
          detalhe={`${formatarNumero(r.pessoas)} pessoas · ${formatarNumero(r.conversas)} conversas`}
          calculo="Perguntas respondidas ou tentadas no período (sem as barradas por limite)."
        />
        <CartaoIndicador
          titulo="Custo no período"
          valor={dolar(r.custo_usd)}
          detalhe={`≈ ${formatarMoeda(r.custo_usd * cotacao)} · ${r.perguntas ? dolar(r.custo_usd / r.perguntas) : "—"} por pergunta`}
          calculo="Tokens de cada tipo × preço do modelo (Ajustes › Preços). Em reais pela cotação dos Ajustes."
        />
        <CartaoIndicador
          titulo="Tokens"
          valor={formatarTokens(r.tokens_entrada + r.tokens_saida)}
          detalhe={`${formatarTokens(r.tokens_entrada)} de entrada · ${formatarTokens(r.tokens_saida)} de saída · ${formatarTokens(r.tokens_cache)} em cache`}
          calculo="Entrada e saída. O cache (instruções e catálogo reaproveitados) custa bem menos e aparece à parte."
        />
        <CartaoIndicador
          titulo="Tempo médio de resposta"
          valor={
            r.tempo_medio_ms
              ? `${formatarNumero(r.tempo_medio_ms / 1000, 1)} s`
              : "—"
          }
          detalhe={`${formatarNumero(r.perguntas ? r.consultas / r.perguntas : 0, 1)} leituras do sistema por pergunta`}
          calculo="Do envio da pergunta ao fim da resposta, nas respondidas."
        />
        <CartaoIndicador
          titulo="Satisfação"
          valor={
            avaliadas
              ? `${formatarNumero((r.positivas / avaliadas) * 100, 0)}%`
              : "—"
          }
          detalhe={`${r.positivas} 👍 · ${r.negativas} 👎 em ${formatarNumero(avaliadas)} avaliadas`}
          calculo="Respostas com 👍 entre as que receberam avaliação."
        />
        <CartaoIndicador
          titulo="Falhas"
          valor={
            r.perguntas
              ? `${formatarNumero((r.erros / r.perguntas) * 100, 1)}%`
              : "—"
          }
          detalhe={`${formatarNumero(r.erros)} perguntas com erro`}
          calculo="Perguntas que terminaram em erro (IA fora do ar, limite da Anthropic)."
        />
      </div>

      <section className="vidro rounded-[2rem] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-neutral-900">Uso por dia</h2>
          <div className="w-full max-w-sm">
            <BotoesDeEscolha
              nome="Medida"
              valor={metrica}
              opcoes={[
                { valor: "perguntas", rotulo: "Perguntas" },
                { valor: "tokens", rotulo: "Tokens" },
                { valor: "custo_usd", rotulo: "Custo" },
              ]}
              aoMudar={(v) =>
                setMetrica(
                  v === "tokens"
                    ? "tokens"
                    : v === "custo_usd"
                      ? "custo_usd"
                      : "perguntas",
                )
              }
            />
          </div>
        </div>
        <AreaLinha
          descricao={`Uso da IA por dia: ${metrica}`}
          itens={u.por_dia.map((d) => ({
            chave: d.dia,
            rotulo: formatarData(d.dia).slice(0, 5),
            titulo: formatarData(d.dia),
            valor: d[metrica],
            texto: texto(d[metrica], metrica),
          }))}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="vidro rounded-[2rem] p-5">
          <h2 className="mb-4 font-semibold text-neutral-900">
            Módulos mais consultados
          </h2>
          <BarrasHorizontais
            descricao="Leituras do sistema por módulo"
            vazio="Nenhuma leitura no período."
            itens={u.por_modulo.map((m) => ({
              chave: m.modulo,
              rotulo: tituloDoModulo(m.modulo),
              valor: m.consultas,
              texto: `${formatarNumero(m.consultas)} leituras`,
              detalhe: `${formatarNumero(m.perguntas)} perguntas`,
            }))}
          />
        </section>
        <section className="vidro rounded-[2rem] p-5">
          <h2 className="mb-4 font-semibold text-neutral-900">
            Custo por cargo
          </h2>
          <BarrasHorizontais
            descricao="Custo da IA por cargo"
            rotuloLargo
            itens={u.por_cargo.map((c) => ({
              chave: c.id ?? "sem",
              rotulo: c.nome,
              valor: c.custo_usd,
              texto: dolar(c.custo_usd),
              detalhe: `${formatarNumero(c.perguntas)} perguntas · ${formatarTokens(c.tokens)} tokens`,
            }))}
          />
        </section>
        <section className="vidro rounded-[2rem] p-5">
          <h2 className="mb-4 font-semibold text-neutral-900">
            Horário das perguntas
          </h2>
          <Colunas
            descricao="Perguntas por hora do dia (Brasília)"
            itens={Array.from({ length: 24 }, (_, h) => {
              const v = u.por_hora.find((x) => x.hora === h)?.perguntas ?? 0;
              return {
                chave: String(h),
                rotulo: `${h}h`,
                titulo: `${h}h às ${h + 1}h`,
                valor: v,
                texto: formatarNumero(v),
              };
            })}
          />
        </section>
        <section className="vidro rounded-[2rem] p-5">
          <h2 className="mb-4 font-semibold text-neutral-900">
            Resultado das perguntas
          </h2>
          <Rosca
            descricao="Perguntas por resultado"
            fatias={u.por_status.map((s, k) => ({
              chave: s.status,
              rotulo: ROTULO_DO_STATUS[s.status] ?? s.status,
              valor: s.perguntas,
              texto: formatarNumero(s.perguntas),
              cor: s.status === "ok" ? 1 : (CORES[k + 1] ?? "neutro"),
            }))}
            centro={{
              valor: formatarNumero(
                u.por_status.reduce((s, x) => s + x.perguntas, 0),
              ),
              rotulo: "pedidos",
            }}
          />
        </section>
      </div>

      <section className="vidro overflow-hidden rounded-[2rem]">
        <h2 className="px-5 pt-5 font-semibold text-neutral-900">Por pessoa</h2>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Pessoa</th>
                <th className="px-3 py-2 font-medium">Cargo</th>
                <th className="px-3 py-2 text-right font-medium">Perguntas</th>
                <th className="px-3 py-2 text-right font-medium">Tokens</th>
                <th className="px-3 py-2 text-right font-medium">Custo</th>
                <th className="px-3 py-2 font-medium">Última</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {u.por_usuario.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-neutral-500"
                  >
                    Ninguém usou a IA no período.
                  </td>
                </tr>
              ) : (
                u.por_usuario.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-medium text-neutral-900">
                      {p.nome}
                    </td>
                    <td className="px-3 py-2 text-neutral-500">
                      {p.cargo ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatarNumero(p.perguntas)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatarTokens(p.tokens)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {dolar(p.custo_usd)}
                    </td>
                    <td className="px-3 py-2 text-neutral-500">
                      {formatarDataHora(p.ultima)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {u.por_modelo.length > 0 && (
        <section className="vidro rounded-[2rem] p-5">
          <h2 className="mb-3 font-semibold text-neutral-900">Por modelo</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {u.por_modelo.map((m) => (
              <li
                key={m.modelo}
                className="flex flex-wrap justify-between gap-2"
              >
                <span className="font-mono text-xs">{m.modelo}</span>
                <span className="text-neutral-500 tabular-nums">
                  {formatarNumero(m.perguntas)} perguntas ·{" "}
                  {formatarTokens(m.tokens)} tokens · {dolar(m.custo_usd)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Limites
// ---------------------------------------------------------------------------

function Limites({ dados }: { dados: RespostaConfig }) {
  const [tipo, setTipo] = useState<"cargo" | "usuario">("cargo");
  const [id, setId] = useState("");
  const [tokens, setTokens] = useState("");
  const [enviando, setEnviando] = useState(false);
  const opcoes =
    tipo === "cargo"
      ? dados.cargos.map((c) => ({ id: c.id, nome: c.nome }))
      : dados.usuarios.map((u) => ({
          id: u.id,
          nome: u.cargo ? `${u.nome} (${u.cargo})` : u.nome,
        }));
  const padrao = dados.config.limite_padrao_mes;

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return notificar("erro", "Escolha o cargo ou a pessoa.");
    const valor =
      tokens.trim() === "" ? null : Number(tokens.replace(/\D/g, ""));
    if (valor !== null && !Number.isFinite(valor))
      return notificar("erro", "Tokens: use só números.");
    setEnviando(true);
    try {
      const r = await salvarLimite({ tipo, id, tokens_mes: valor });
      notificar("ok", r.mensagem);
      setId("");
      setTokens("");
    } catch (erro) {
      notificar("erro", mensagemDoErro(erro));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="vidro rounded-[2rem] p-5 text-sm text-neutral-600">
        <p>
          Cada pessoa tem um limite de tokens por mês. Vale o da pessoa; sem
          ele, o do cargo; sem ele, o padrão (
          {padrao === null ? "sem limite" : `${formatarTokens(padrao)} tokens`},
          em Ajustes). Ao chegar no limite, a IA para de responder para ela até
          o mês virar. Uma pergunta comum gasta de 10 a 40 mil tokens.
        </p>
      </section>

      <form
        onSubmit={adicionar}
        className="vidro grid gap-3 rounded-[2rem] p-5 md:grid-cols-[10rem_1fr_12rem_auto] md:items-end"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-600">Para</span>
          <select
            className={classeCampo}
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value === "usuario" ? "usuario" : "cargo");
              setId("");
            }}
          >
            <option value="cargo">Cargo</option>
            <option value="usuario">Pessoa</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-600">
            {tipo === "cargo" ? "Cargo" : "Pessoa"}
          </span>
          <select
            className={classeCampo}
            value={id}
            onChange={(e) => setId(e.target.value)}
          >
            <option value="">Escolha…</option>
            {opcoes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-600">Tokens por mês</span>
          <input
            className={classeCampo}
            inputMode="numeric"
            placeholder="vazio = sem limite"
            value={tokens}
            onChange={(e) => setTokens(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={enviando}
          className="flex h-10 items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 text-sm font-medium text-white disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden /> Salvar
        </button>
      </form>

      <section className="vidro overflow-hidden rounded-[2rem]">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-neutral-500">
            <tr>
              <th className="px-5 py-3 font-medium">Cargo ou pessoa</th>
              <th className="px-5 py-3 font-medium">Tipo</th>
              <th className="px-5 py-3 text-right font-medium">
                Tokens por mês
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {dados.limites.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-6 text-center text-neutral-500"
                >
                  Nenhum limite próprio: todo mundo segue o padrão.
                </td>
              </tr>
            ) : (
              dados.limites.map((l) => (
                <tr key={`${l.tipo}-${l.id}`}>
                  <td className="px-5 py-3 font-medium text-neutral-900">
                    {l.nome}
                  </td>
                  <td className="px-5 py-3 text-neutral-500">
                    {l.tipo === "cargo" ? "Cargo" : "Pessoa"}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {l.tokens_mes === null
                      ? "Sem limite"
                      : formatarNumero(l.tokens_mes)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      title="Remover limite"
                      onClick={async () => {
                        try {
                          notificar(
                            "ok",
                            (await removerLimite(l.tipo, l.id)).mensagem,
                          );
                        } catch (erro) {
                          notificar("erro", mensagemDoErro(erro));
                        }
                      }}
                      className="grid size-8 place-items-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      <span className="sr-only">Remover</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------

interface LinhaDePreco {
  modelo: string;
  entrada: string;
  saida: string;
  cache_escrita: string;
  cache_leitura: string;
}

const numeroOuNulo = (t: string): number | null => {
  const v = t.trim().replace(/\./g, "").replace(",", ".");
  return v === "" ? null : Number(v);
};
const decimal = (t: string): number => Number(t.trim().replace(",", "."));
const texto = (v: number | null) =>
  v === null ? "" : String(v).replace(".", ",");

function Ajustes({ dados }: { dados: RespostaConfig }) {
  const c = dados.config;
  const [ativa, setAtiva] = useState(c.ativa);
  const [esforco, setEsforco] = useState<EsforcoDaIa>(c.esforco);
  const [maxConsultas, setMaxConsultas] = useState(String(c.max_consultas));
  const [limite, setLimite] = useState(texto(c.limite_padrao_mes));
  const [orcamento, setOrcamento] = useState(texto(c.orcamento_mes_usd));
  const [dias, setDias] = useState(String(c.dias_de_guarda));
  const [cotacao, setCotacao] = useState(texto(c.cotacao_dolar));
  const [instrucoes, setInstrucoes] = useState(c.instrucoes);
  const [precos, setPrecos] = useState<LinhaDePreco[]>(
    Object.entries(c.precos).map(([modelo, p]) => ({
      modelo,
      entrada: texto(p.entrada),
      saida: texto(p.saida),
      cache_escrita: texto(p.cache_escrita),
      cache_leitura: texto(p.cache_leitura),
    })),
  );
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const candidato: ConfigDaIa = {
      ativa,
      esforco,
      max_consultas: Number(maxConsultas),
      limite_padrao_mes: numeroOuNulo(limite),
      orcamento_mes_usd: numeroOuNulo(orcamento),
      dias_de_guarda: Number(dias),
      cotacao_dolar: decimal(cotacao),
      instrucoes,
      precos: Object.fromEntries(
        precos
          .filter((p) => p.modelo.trim())
          .map((p) => [
            p.modelo.trim(),
            {
              entrada: decimal(p.entrada),
              saida: decimal(p.saida),
              cache_escrita: decimal(p.cache_escrita),
              cache_leitura: decimal(p.cache_leitura),
            },
          ]),
      ),
    };
    const lido = configDaIa.safeParse(candidato);
    if (!lido.success) {
      const [p] = lido.error.issues;
      return notificar(
        "erro",
        `${p?.path.join(" › ") ?? "Campo"}: ${p?.message ?? "inválido"}`,
      );
    }
    setEnviando(true);
    try {
      notificar("ok", (await salvarConfig(lido.data)).mensagem);
    } catch (erro) {
      notificar("erro", mensagemDoErro(erro));
    } finally {
      setEnviando(false);
    }
  }

  const campo = (rotulo: string, ajuda: string, filho: React.ReactNode) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: o controle vem em `filho`, dentro do label
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-neutral-800">{rotulo}</span>
      {filho}
      <span className="text-xs text-neutral-500">{ajuda}</span>
    </label>
  );

  return (
    <form onSubmit={salvar} className="flex flex-col gap-5">
      <section className="vidro grid gap-5 rounded-[2rem] p-5 md:grid-cols-2">
        <label className="flex items-start gap-3 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={ativa}
            onChange={(e) => setAtiva(e.target.checked)}
            className="mt-0.5 size-4 accent-neutral-900"
          />
          <span>
            <span className="font-medium text-neutral-800">IA ligada</span>
            <span className="block text-xs text-neutral-500">
              Desligada, o botão continua no cabeçalho, mas avisa que a IA está
              fora.
            </span>
          </span>
        </label>
        {campo(
          "Esforço",
          "Quanto a IA pensa antes de responder. Médio equilibra qualidade, tempo e custo.",
          <select
            className={classeCampo}
            value={esforco}
            onChange={(e) => {
              const v = ESFORCOS.find((x) => x === e.target.value);
              if (v) setEsforco(v);
            }}
          >
            {ESFORCOS.map((e) => (
              <option key={e} value={e}>
                {ROTULO_DO_ESFORCO[e]}
              </option>
            ))}
          </select>,
        )}
        {campo(
          "Leituras por pergunta",
          "Máximo de consultas ao sistema numa pergunta (1 a 40).",
          <input
            className={classeCampo}
            inputMode="numeric"
            value={maxConsultas}
            onChange={(e) => setMaxConsultas(e.target.value)}
          />,
        )}
        {campo(
          "Limite padrão por pessoa (tokens/mês)",
          "Vale para quem não tem limite próprio nem do cargo. Vazio: sem limite.",
          <input
            className={classeCampo}
            inputMode="numeric"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
          />,
        )}
        {campo(
          "Teto de gasto do mês (US$)",
          "Chegando nele, a IA para para todos até o mês virar. Vazio: sem teto.",
          <input
            className={classeCampo}
            inputMode="decimal"
            value={orcamento}
            onChange={(e) => setOrcamento(e.target.value)}
          />,
        )}
        {campo(
          "Guardar conversas por (dias)",
          "Depois disso a conversa é apagada. Os números de uso ficam.",
          <input
            className={classeCampo}
            inputMode="numeric"
            value={dias}
            onChange={(e) => setDias(e.target.value)}
          />,
        )}
        {campo(
          "Cotação do dólar (R$)",
          "Só para mostrar o custo em reais.",
          <input
            className={classeCampo}
            inputMode="decimal"
            value={cotacao}
            onChange={(e) => setCotacao(e.target.value)}
          />,
        )}
        <label className="flex flex-col gap-1 text-sm md:col-span-2">
          <span className="font-medium text-neutral-800">
            Orientações da empresa para a IA
          </span>
          <textarea
            className={`${classeCampo} min-h-28`}
            maxLength={4000}
            value={instrucoes}
            onChange={(e) => setInstrucoes(e.target.value)}
            placeholder="Ex.: Chame os locatários de lojistas. Valores sempre com e sem impostos."
          />
          <span className="text-xs text-neutral-500">
            Tom, termos internos e cuidados. Não dá mais acesso a dados: as
            permissões continuam valendo.
          </span>
        </label>
        <p className="text-xs text-neutral-500 md:col-span-2">
          Modelo e chave da Anthropic ficam em{" "}
          <Link
            href="/admin/integracoes#claude"
            className="underline underline-offset-2"
          >
            Administração › Integrações
          </Link>
          .
        </p>
      </section>

      <section className="vidro rounded-[2rem] p-5">
        <h2 className="font-semibold text-neutral-900">
          Preços (US$ por milhão de tokens)
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Da tabela da Anthropic. Usados para calcular o custo de cada pergunta
          pelo modelo que respondeu.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs text-neutral-500">
              <tr>
                <th className="px-2 py-2 font-medium">Modelo</th>
                <th className="px-2 py-2 font-medium">Entrada</th>
                <th className="px-2 py-2 font-medium">Saída</th>
                <th className="px-2 py-2 font-medium">Escrita do cache</th>
                <th className="px-2 py-2 font-medium">Leitura do cache</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {precos.map((p, k) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: linhas editáveis sem id
                <tr key={k}>
                  {(
                    [
                      "modelo",
                      "entrada",
                      "saida",
                      "cache_escrita",
                      "cache_leitura",
                    ] as const
                  ).map((campoDoPreco) => (
                    <td key={campoDoPreco} className="px-1 py-1">
                      <input
                        aria-label={campoDoPreco}
                        className={`${classeCampo} ${campoDoPreco === "modelo" ? "font-mono text-xs" : ""}`}
                        value={p[campoDoPreco]}
                        onChange={(e) =>
                          setPrecos((ps) =>
                            ps.map((x, j) =>
                              j === k
                                ? { ...x, [campoDoPreco]: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      title="Remover modelo"
                      onClick={() =>
                        setPrecos((ps) => ps.filter((_, j) => j !== k))
                      }
                      className="grid size-8 place-items-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      <span className="sr-only">Remover</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() =>
            setPrecos((ps) => [
              ...ps,
              {
                modelo: "",
                entrada: "",
                saida: "",
                cache_escrita: "",
                cache_leitura: "",
              },
            ])
          }
          className="mt-3 flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
        >
          <Plus className="size-4" aria-hidden /> Modelo
        </button>
      </section>

      <div>
        <button
          type="submit"
          disabled={enviando}
          className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {enviando ? "Salvando…" : "Salvar ajustes"}
        </button>
      </div>
    </form>
  );
}
