import {
  CircleAlert,
  CircleCheck,
  CircleX,
  FlaskConical,
  RotateCcw,
} from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { Situacao } from "@/components/admin/ui";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao, Tabela } from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { CopiarFotos } from "@/components/os/importacao/copiar-fotos";
import { EnvioDoBackup } from "@/components/os/importacao/envio";
import { Protegido } from "@/components/protegido";
import { Selecao } from "@/components/selecao";
import { formatarDataHora, formatarMoeda, formatarNumero } from "@/lib/formato";
import {
  ESCOLHAS_CHAMADO,
  ESCOLHAS_VISTORIA,
  type Previa,
} from "@/lib/os/importacao-conferencia";
import { LAYOUT_DO_PACOTE } from "@/lib/os/importacao-modelo";
import { STATUS, STATUS_VISTORIA } from "@/lib/os/rotulos";
import {
  apagarExemplo,
  confirmar,
  copiarLoteDeFotos,
  descartar,
  desfazer,
  gerarExemplo,
  lerEnvio,
  prepararEnvio,
  relerPrevia,
  salvarMapeamento,
} from "@/server/os/acoes/config-importacao";
import { nomes } from "@/server/os/base";
import { exemploAtual } from "@/server/os/exemplo";
import {
  type Importacao,
  importacoesRecentes,
  lerResumo,
  type ResumoDaImportacao,
} from "@/server/os/importacao/previa";

export const metadata: Metadata = { title: "Importação e exemplos" };

// Ler e gravar um backup inteiro leva tempo: as ações desta tela podem
// passar do padrão de uma requisição.
export const maxDuration = 300;

// Etapa 1 da spec (dados de exemplo) e 4.14 (importação única do sistema de
// OS atual): envia o backup sem editar → confere a prévia → confirma; o
// resultado fica no histórico, com "Desfazer".

export default function Page() {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Protegido permissao="os.importacao">
        <Tela />
      </Protegido>
    </Suspense>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-40" />
      <CartaoCarregando altura="h-[26rem]" />
      <CartaoCarregando altura="h-48" />
    </TelaCarregando>
  );
}

async function Tela() {
  const [exemplo, lista, nomesPorId] = await Promise.all([
    exemploAtual(),
    importacoesRecentes(),
    nomes(),
  ]);
  const aberta = lista.find((i) => i.status === "previa");
  const comFotos = lista.filter((i) => {
    const f = lerResumo(i.resumo).fotos;
    return i.status === "confirmada" && f && f.copiadas < f.total;
  });

  return (
    <div className="flex flex-col gap-6">
      <Exemplo contagens={exemplo} />

      <Secao
        id="importar"
        titulo="Importação do sistema de OS atual"
        descricao="Todo o histórico do O.S Arp 4.42 entra uma vez, antes de ele ser desligado. Pode ser testada quantas vezes for preciso e desfeita."
      >
        <ol className="mb-5 flex flex-wrap gap-2 text-xs">
          {["Envie o backup", "Confira a prévia", "Confirme"].map((p, i) => {
            const atual = aberta ? 1 : 0;
            return (
              <li
                key={p}
                aria-current={i === atual ? "step" : undefined}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${i === atual ? "bg-neutral-900 font-medium text-white" : "bg-neutral-900/[0.05] text-neutral-600"}`}
              >
                <span className="tabular-nums">{i + 1}.</span>
                {p}
              </li>
            );
          })}
        </ol>
        {aberta ? (
          <PreviaAberta imp={aberta} />
        ) : (
          <EnvioDoBackup preparar={prepararEnvio} ler={lerEnvio} />
        )}
      </Secao>

      {comFotos.map((i) => {
        const f = lerResumo(i.resumo).fotos;
        return (
          <Secao
            key={i.id}
            titulo="Fotos da importação"
            descricao={`Importação de ${formatarDataHora(i.criado_em)}: as fotos vão do pacote para o arquivo do sistema aos poucos. Pode fechar a tela e continuar depois.`}
          >
            <CopiarFotos
              importacaoId={i.id}
              copiadas={f?.copiadas ?? 0}
              total={f?.total ?? 0}
              copiar={copiarLoteDeFotos}
            />
          </Secao>
        );
      })}

      <Secao
        id="historico"
        titulo="Histórico de importações"
        descricao="Cada importação confirmada pode ser desfeita: sai só o que ela trouxe. Categorias criadas a partir dos tipos de serviço ficam (podem ser desativadas no Catálogo)."
      >
        <Historico lista={lista} nomes={nomesPorId} />
      </Secao>

      <Secao
        id="formato"
        titulo="Formato do pacote"
        descricao="O formato do Backup Geral do sistema atual ainda não chegou. Até lá, a importação lê este pacote; quem escrever o conversor do backup segue este formato (ou escreve o leitor do Backup Geral, já previsto no sistema)."
      >
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            Ver o formato esperado
          </summary>
          <pre className="mt-3 max-h-[32rem] overflow-auto rounded-2xl bg-neutral-900/[0.04] p-4 text-xs leading-relaxed whitespace-pre text-neutral-700">
            {LAYOUT_DO_PACOTE}
          </pre>
        </details>
      </Secao>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dados de exemplo
// ---------------------------------------------------------------------------

function Exemplo({ contagens: c }: { contagens: Record<string, number> }) {
  const existe = Object.values(c).some((n) => n > 0);
  return (
    <Secao
      id="exemplo"
      titulo="Dados de exemplo"
      descricao="Para ver o módulo funcionando antes da importação: mais de 200 lojas, centenas de chamados e OS com técnicos e custos, ativos com histórico e vistorias com fotos de exemplo. Tudo fictício e marcado como exemplo."
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-400/20 text-violet-700">
            <FlaskConical className="size-5" aria-hidden />
          </span>
          <p className="text-sm text-neutral-700">
            {existe
              ? `Existem dados de exemplo: ${formatarNumero(c.lojas ?? 0)} lojas, ${formatarNumero(c.chamados ?? 0)} chamados (${formatarNumero(c.os ?? 0)} OS), ${formatarNumero(c.ativos ?? 0)} ativos e ${formatarNumero(c.vistorias ?? 0)} vistorias.`
              : "Nenhum dado de exemplo no sistema."}
            <span className="mt-1 block text-xs text-neutral-500">
              Quem usa o módulo e não está em nenhum setor entra num, para a
              Minha caixa mostrar a fila. Apagar tira só o que é exemplo.
            </span>
          </p>
        </div>
        {existe ? (
          <FormAcao
            acao={apagarExemplo}
            rotulo="Apagar dados de exemplo"
            rotuloEnviando="Apagando…"
            variante="perigo"
            confirmar="Apagar todos os dados de exemplo? Some tudo o que está marcado como exemplo (lojas, chamados, OS, ativos, vistorias e fotos). Os dados reais não mudam."
            className="shrink-0"
          />
        ) : (
          <FormAcao
            acao={gerarExemplo}
            rotulo="Gerar dados de exemplo"
            rotuloEnviando="Gerando… (leva até um minuto)"
            confirmar="Gerar os dados de exemplo? Cria lojas, chamados, OS, ativos e vistorias fictícios, marcados como exemplo. Dá para apagar depois."
            className="shrink-0"
          />
        )}
      </div>
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Prévia
// ---------------------------------------------------------------------------

function PreviaAberta({ imp }: { imp: Importacao }) {
  const resumo = lerResumo(imp.resumo);
  const p = resumo.previa;
  return (
    <div className="flex flex-col gap-6">
      <Cabecalho imp={imp} resumo={resumo} />
      {resumo.erro || !p ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
          {resumo.erro ?? "A prévia ainda não foi montada."}
        </p>
      ) : (
        <ConteudoDaPrevia imp={imp} p={p} />
      )}
      <div className="flex flex-wrap items-start gap-3 border-t border-neutral-900/[0.06] pt-5">
        {p &&
          !resumo.erro &&
          (p.podeConfirmar ? (
            <FormAcao
              acao={confirmar}
              rotulo="Confirmar importação"
              rotuloEnviando="Importando… (pode levar alguns minutos)"
              confirmar="Confirmar a importação? Tudo da prévia entra no módulo. Dá para desfazer depois pelo histórico."
            >
              <input type="hidden" name="importacao_id" value={imp.id} />
            </FormAcao>
          ) : (
            <p className="flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm text-red-700">
              <CircleX className="size-4" aria-hidden />
              Resolva o que impede para confirmar.
            </p>
          ))}
        <FormAcao
          acao={relerPrevia}
          rotulo="Ler de novo"
          rotuloEnviando="Lendo…"
          variante="secundario"
        >
          <input type="hidden" name="importacao_id" value={imp.id} />
        </FormAcao>
        <FormAcao
          acao={descartar}
          rotulo="Descartar"
          rotuloEnviando="Descartando…"
          variante="perigo"
          confirmar="Descartar esta prévia? Os arquivos enviados são apagados; nada entrou no módulo."
        >
          <input type="hidden" name="importacao_id" value={imp.id} />
        </FormAcao>
      </div>
    </div>
  );
}

function Cabecalho({
  imp,
  resumo,
}: {
  imp: Importacao;
  resumo: ResumoDaImportacao;
}) {
  const p = resumo.previa;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-base font-semibold">
        {p?.sistema ?? "Pacote enviado"}
        {p?.geradoEm ? ` · gerado em ${p.geradoEm}` : ""}
      </p>
      <p className="text-xs text-neutral-500">
        Enviado em {formatarDataHora(imp.criado_em)}
        {resumo.leitor ? ` · lido como ${resumo.leitor}` : ""} ·{" "}
        {resumo.arquivos.length}{" "}
        {resumo.arquivos.length === 1 ? "arquivo" : "arquivos"}:{" "}
        {resumo.arquivos.map((a) => a.nome).join(", ")}
      </p>
    </div>
  );
}

function ConteudoDaPrevia({ imp, p }: { imp: Importacao; p: Previa }) {
  const pendentes = p.status.filter((s) => !s.novo);
  return (
    <>
      <section aria-labelledby="totais">
        <h3 id="totais" className="mb-2 text-sm font-semibold">
          Quantos registros entram
        </h3>
        <Tabela
          colunas={[
            { titulo: "Tipo", valor: (c) => c.rotulo },
            {
              titulo: "Sistema atual",
              valor: (c) =>
                c.sistemaAtual === null ? "—" : formatarNumero(c.sistemaAtual),
              numero: true,
            },
            {
              titulo: "No pacote",
              valor: (c) => formatarNumero(c.lidos),
              numero: true,
            },
            {
              titulo: "Recusados",
              valor: (c) => (c.recusados ? formatarNumero(c.recusados) : "—"),
              numero: true,
            },
            {
              titulo: "Confere",
              valor: (c) => (
                <Situacao tipo={c.bate ? "ok" : "erro"}>
                  {c.bate ? "Bate" : "Não bate"}
                </Situacao>
              ),
            },
          ]}
          linhas={p.contagens}
          chave={(c) => c.tipo}
          vazio="O pacote não trouxe nenhum registro."
        />
      </section>

      <section aria-labelledby="problemas">
        <h3 id="problemas" className="mb-2 text-sm font-semibold">
          Conferências
        </h3>
        {p.problemas.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-green-700">
            <CircleCheck className="size-4" aria-hidden />
            Tudo confere.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {p.problemas.map((x) => (
              <li
                key={x.texto}
                className={`flex items-start gap-2 rounded-2xl px-4 py-2.5 text-sm ${x.bloqueia ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-900"}`}
              >
                {x.bloqueia ? (
                  <CircleX
                    className="mt-0.5 size-4 shrink-0"
                    aria-label="Impede confirmar"
                  />
                ) : (
                  <CircleAlert
                    className="mt-0.5 size-4 shrink-0"
                    aria-label="Aviso"
                  />
                )}
                <span>
                  <span className="font-medium">
                    {x.bloqueia ? "Impede confirmar: " : "Aviso: "}
                  </span>
                  {x.texto}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="status">
        <h3 id="status" className="mb-2 text-sm font-semibold">
          Como cada status antigo vai ficar
        </h3>
        <Tabela
          colunas={[
            {
              titulo: "Registro",
              valor: (s) =>
                ({ os: "OS", tarefa: "Tarefa", vistoria: "Vistoria" })[s.tipo],
            },
            { titulo: "Status antigo", valor: (s) => s.antigo },
            {
              titulo: "Fica",
              valor: (s) =>
                s.novo ?? (
                  <span className="font-medium text-red-700">
                    Escolha abaixo
                  </span>
                ),
            },
            {
              titulo: "Origem",
              valor: (s) =>
                s.novo ? (s.daTabela ? "Tabela" : "Escolhido") : "—",
            },
            {
              titulo: "Quantos",
              valor: (s) => formatarNumero(s.quantidade),
              numero: true,
            },
          ]}
          linhas={p.status}
          chave={(s) => `${s.tipo}:${s.antigo}`}
          vazio="Nenhum registro com status."
        />
        {pendentes.length > 0 && (
          <FormAcao
            acao={salvarMapeamento}
            rotulo="Salvar e conferir de novo"
            rotuloEnviando="Conferindo…"
            className="mt-4 flex flex-col gap-3 rounded-2xl bg-amber-50/60 p-4"
          >
            <input type="hidden" name="importacao_id" value={imp.id} />
            <p className="text-sm text-amber-900">
              Estes status não estão na tabela de correspondência. Escolha como
              cada um fica no módulo (a escolha fica guardada na importação).
            </p>
            {pendentes.map((s) => {
              const opcoes =
                s.tipo === "vistoria"
                  ? ESCOLHAS_VISTORIA.map((v) => ({
                      valor: v,
                      rotulo: STATUS_VISTORIA[v],
                    }))
                  : ESCOLHAS_CHAMADO.map((v) => ({
                      valor: v,
                      rotulo: STATUS[v],
                    }));
              return (
                <div
                  key={`${s.tipo}:${s.antigo}`}
                  className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_16rem]"
                >
                  <span className="text-sm">
                    {s.tipo === "os"
                      ? "OS"
                      : s.tipo === "tarefa"
                        ? "Tarefa"
                        : "Vistoria"}{" "}
                    <span className="font-medium">“{s.antigo}”</span> (
                    {s.quantidade})
                  </span>
                  <Selecao
                    name={`status:${s.tipo}:${s.antigo}`}
                    rotulo={`Status novo para “${s.antigo}”`}
                    obrigatorio
                    placeholder="Fica como…"
                    opcoes={opcoes}
                  />
                </div>
              );
            })}
          </FormAcao>
        )}
      </section>

      <section aria-labelledby="custos">
        <h3 id="custos" className="mb-1 text-sm font-semibold">
          Custo e minuto-homem recalculados
        </h3>
        <p className="mb-2 text-xs text-neutral-500">
          {formatarNumero(p.custosConferidos)} OS com valor no sistema atual,
          recalculadas pelo cálculo do módulo.{" "}
          {p.diferencasDeCusto.length
            ? `${p.diferencasDeCusto.length} com diferença (os dois valores ficam guardados na OS).`
            : "Todas batem centavo a centavo."}
        </p>
        {p.diferencasDeCusto.length > 0 && (
          <Tabela
            colunas={[
              { titulo: "OS", valor: (d) => `#${d.numero}`, numero: true },
              { titulo: "Campo", valor: (d) => d.campo },
              {
                titulo: "Sistema atual",
                valor: (d) => d.valor(d.antigo),
                numero: true,
              },
              {
                titulo: "Recalculado",
                valor: (d) => d.valor(d.novo),
                numero: true,
              },
            ]}
            linhas={p.diferencasDeCusto.slice(0, 200).flatMap((d) =>
              d.campos.map((c) => ({
                chave: `${d.tipo}:${d.numero}:${c.campo}`,
                numero: d.numero,
                campo: c.campo,
                antigo: c.antigo,
                novo: c.novo,
                valor: (v: number) =>
                  c.campo.startsWith("Minut")
                    ? `${formatarNumero(v)} min`
                    : formatarMoeda(v),
              })),
            )}
            chave={(d) => d.chave}
          />
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Lista
          titulo={`Fotos citadas sem arquivo (${p.fotosFaltando.length} de ${p.fotos})`}
          vazio={
            p.fotos
              ? "Todas as fotos citadas estão no pacote."
              : "O pacote não cita fotos."
          }
          itens={p.fotosFaltando.map((f) => `${f.onde}: ${f.arquivo}`)}
        />
        <Lista
          titulo={`Técnicos sem valor por minuto (${p.tecnicosSemValor.length})`}
          vazio="Todos os técnicos têm valor por minuto."
          itens={p.tecnicosSemValor.map((t) => `${t}: completar em Parâmetros`)}
        />
        <Lista
          titulo={`Técnicos ligados a usuários pelo nome (${p.tecnicosLigados.length})`}
          vazio="Nenhum técnico tem o mesmo nome de um usuário."
          itens={p.tecnicosLigados.map((t) => t.nome)}
        />
        <Lista
          titulo={`Números de OS já usados no módulo (${p.numeros.length})`}
          vazio="Nenhum número de OS repetido: todas mantêm o número."
          itens={p.numeros.map(
            (n) =>
              `${n.tipo} nº ${n.numero}: ${n.decisao === "atualizar" ? "atualiza a importada antes" : "entra com número novo"}`,
          )}
        />
        {p.recusadas.length > 0 && (
          <Lista
            titulo={`Linhas recusadas (${p.recusadas.length})`}
            vazio=""
            itens={p.recusadas.map(
              (r) => `${r.arquivo}, linha ${r.linha}: ${r.motivo}`,
            )}
          />
        )}
      </div>
    </>
  );
}

function Lista({
  titulo,
  vazio,
  itens,
}: {
  titulo: string;
  vazio: string;
  itens: string[];
}) {
  return (
    <details
      className="rounded-2xl bg-white/50 px-4 py-3 ring-1 ring-neutral-900/[0.06]"
      open={itens.length > 0 && itens.length <= 5}
    >
      <summary className="cursor-pointer text-sm font-medium">{titulo}</summary>
      {itens.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-500">{vazio}</p>
      ) : (
        <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto text-xs text-neutral-700">
          {itens.slice(0, 500).map((i) => (
            <li key={i} className="break-words">
              {i}
            </li>
          ))}
          {itens.length > 500 && (
            <li className="text-neutral-500">… e mais {itens.length - 500}.</li>
          )}
        </ul>
      )}
    </details>
  );
}

// ---------------------------------------------------------------------------
// Histórico
// ---------------------------------------------------------------------------

const SITUACAO = {
  previa: { tipo: "rodando", rotulo: "Em prévia" },
  confirmada: { tipo: "ok", rotulo: "Confirmada" },
  desfeita: { tipo: "neutro", rotulo: "Desfeita" },
} as const;

function Historico({
  lista,
  nomes: nomesPorId,
}: {
  lista: Importacao[];
  nomes: Map<string, string>;
}) {
  if (!lista.length)
    return (
      <p className="py-6 text-sm text-neutral-500">Nenhuma importação ainda.</p>
    );
  return (
    <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
      {lista.map((i) => {
        const r = lerResumo(i.resumo);
        const s =
          SITUACAO[i.status as keyof typeof SITUACAO] ?? SITUACAO.previa;
        const g = r.gravacao;
        const quem = (id: string | null) =>
          id ? (nomesPorId.get(id) ?? "—") : "—";
        return (
          <li
            key={i.id}
            className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {formatarDataHora(i.criado_em)}
                </span>
                <Situacao tipo={s.tipo}>{s.rotulo}</Situacao>
              </div>
              <p
                className="truncate text-xs text-neutral-500"
                title={i.arquivo_nome}
              >
                {i.arquivo_nome}
              </p>
              <p className="text-xs text-neutral-600">
                {g
                  ? `${formatarNumero(g.os ?? 0)} OS · ${formatarNumero(g.tarefas ?? 0)} tarefas · ${formatarNumero(g.vistorias ?? 0)} vistorias · ${formatarNumero(g.tecnicos ?? 0)} técnicos · ${formatarNumero(g.ativos ?? 0)} equipamentos`
                  : "Nada gravado."}
                {r.fotos
                  ? ` · fotos: ${r.fotos.copiadas} de ${r.fotos.total}`
                  : ""}
              </p>
              <p className="text-xs text-neutral-500">
                Enviada por {quem(i.enviado_por)}
                {i.confirmado_em
                  ? ` · confirmada por ${quem(i.confirmado_por)} em ${formatarDataHora(i.confirmado_em)}`
                  : ""}
                {i.desfeito_em
                  ? ` · desfeita por ${quem(i.desfeito_por)} em ${formatarDataHora(i.desfeito_em)}`
                  : ""}
              </p>
              {r.erro && i.status === "confirmada" && (
                <p className="mt-1 text-xs text-red-700">{r.erro}</p>
              )}
              {r.avisos && r.avisos.length > 0 && (
                <ul className="mt-1 text-xs text-amber-900">
                  {r.avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
            </div>
            {i.status === "confirmada" && (
              <AcaoRapida
                acao={desfazer}
                campos={{ importacao_id: i.id }}
                rotulo="Desfazer"
                icone={<RotateCcw className="size-4" aria-hidden />}
                comTexto
                perigo
                confirmar="Desfazer esta importação? Sai do módulo tudo o que ela trouxe (OS, tarefas, vistorias, técnicos sem OS nova, equipamentos, contatos, compromissos e fotos)."
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
