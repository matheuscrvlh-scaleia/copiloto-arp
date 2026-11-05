import {
  CheckCheck,
  CircleAlert,
  CirclePause,
  Lightbulb,
  Mail,
  RotateCcw,
  Star,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { BlocoOS, CronometroDaOS } from "@/components/os/ordem/bloco-os";
import {
  SeloPrazo,
  SeloPrioridade,
  SeloSetor,
  SeloStatusChamado,
  SeloTipo,
} from "@/components/os/selos";
import { formatarDataHora } from "@/lib/formato";
import { mensagemDoChamado, textoDoCampo } from "@/lib/os/chamado";
import { statusAoConcluir } from "@/lib/os/ciclo";
import { numeroDo } from "@/lib/os/numeros";
import { descreverRecorrencia, type Recorrencia } from "@/lib/os/recorrencia";
import { ROTAS_OS, rotaAtivo, rotaDo, rotaVistoria } from "@/lib/os/rotas";
import { MOTIVOS_AGUARDANDO, ORIGENS, STATUS, TIPOS } from "@/lib/os/rotulos";
import { tempoAtras } from "@/lib/os/texto";
import { pessoas, urlDoSistema } from "@/server/os/base";
import {
  carregarDetalhe,
  contatosSalvos,
  type DetalheChamado as Detalhe,
} from "@/server/os/chamado-detalhe";
import { dadosDoFormulario } from "@/server/os/formulario";
import { AcoesDoChamado } from "./acoes";
import { Checklist } from "./checklist";
import { Comentario } from "./comentario";
import { Destinos } from "./destinos";
import { Ferramentas } from "./ferramentas";
import { Gestao } from "./gestao";
import { BotaoLido, Leitura } from "./leitura";
import { LinhaDoTempo } from "./linha-do-tempo";

// Detalhe do chamado: uma tela com tudo o que aconteceu. Serve à página
// /os/chamados/[id] e à janela lateral das listas (compacto: uma coluna).

const CARTAO = "vidro rounded-[1.75rem] p-5 md:p-6";
const TITULO_SECAO =
  "mb-4 text-xs font-semibold tracking-[0.14em] text-neutral-500 uppercase";

export async function DetalheChamado({
  id,
  compacto = false,
}: {
  id: string;
  compacto?: boolean;
}) {
  // Contatos, pessoas e o formulário da gestão não dependem do chamado:
  // começam junto com ele (o formulário já é lido pelo botão "+ Novo").
  const pedidos = Promise.all([
    dadosDoFormulario(),
    contatosSalvos(),
    pessoas(),
  ]);
  // Sem o chamado ninguém espera por eles: a falha não fica solta.
  pedidos.catch(() => null);
  const d = await carregarDetalhe(id);
  if (!d)
    return (
      <div className={CARTAO}>
        <p className="text-sm text-neutral-600">
          Chamado não encontrado, ou você não tem acesso a ele.
        </p>
      </div>
    );
  const { ch } = d;
  const agora = new Date();
  const emAberto = ["aberto", "em_andamento", "aguardando"].includes(ch.status);
  const aviso = ch.tipo === "aviso";
  // Aviso não tem prazo: é para ler.
  const podeLer = !!d.leitura?.euRecebo && !d.leitura.liEm && emAberto;
  const podeGestao = {
    responsavel:
      d.pode.gerenciar || (d.papel.solicitante && ch.status === "aberto"),
    prazo: d.pode.editarPrazo && emAberto && !aviso,
    setor: d.pode.gerenciar || (d.papel.solicitante && ch.status === "aberto"),
  };
  const comGestao =
    emAberto &&
    (podeGestao.responsavel || podeGestao.prazo || podeGestao.setor);
  const [dados, contatos, gente] = await pedidos;
  const formulario = comGestao ? dados : null;
  const nome = (u: string | null) => (u ? (d.nomes[u] ?? "—") : null);
  const ehOS = ch.tipo === "os";
  // Tempo, materiais e custos: só na OS.
  const registraTempo = ehOS;

  const ferramentas = (
    <Ferramentas
      id={ch.id}
      links={{
        imprimir: ehOS
          ? `/os/ordens/pdf?ids=${ch.id}`
          : `${rotaDo(ch)}/imprimir`,
        duplicar: ehOS
          ? `${ROTAS_OS.novaOrdem}?duplicar=${ch.id}`
          : `${ROTAS_OS.novo}?duplicar=${ch.id}`,
        vinculado: ehOS ? null : `${ROTAS_OS.novo}?vinculado=${ch.id}`,
        ordem:
          ehOS || ch.tipo === "aviso"
            ? null
            : `${ROTAS_OS.novaOrdem}?vinculado=${ch.id}`,
        historico: d.pode.historico
          ? `/os/configuracoes/historico?registro=${ch.id}`
          : null,
      }}
      sigo={d.sigo}
      whatsapp={
        ehOS
          ? null
          : {
              mensagem: mensagemDoChamado(d.modeloMensagem, {
                numero: numeroDo(ch),
                titulo: ch.titulo,
                status: STATUS[ch.status],
                prazo: ch.prazo ? formatarDataHora(ch.prazo) : "Sem prazo",
                tipo: TIPOS[ch.tipo],
                setor: d.setor?.nome ?? "",
                descricao: ch.descricao ?? "",
                link: urlDoSistema(rotaDo(ch)),
              }),
              sugeridos: [
                ...(ch.solicitante_telefone
                  ? [
                      {
                        rotulo: ch.solicitante_nome ?? "Solicitante",
                        telefone: ch.solicitante_telefone,
                        descricao: "solicitante",
                      },
                    ]
                  : []),
                ...(d.loja?.telefone
                  ? [
                      {
                        rotulo: d.loja.nome,
                        telefone: d.loja.telefone,
                        descricao: "loja",
                      },
                    ]
                  : []),
              ],
              contatos: contatos.map((c) => ({
                rotulo: c.nome,
                telefone: c.telefone,
                descricao: c.empresa ?? undefined,
              })),
            }
      }
    />
  );

  const topo = (
    <header className="flex min-w-0 flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 pt-1.5">
          <span className="rounded-full bg-neutral-900 px-2.5 py-1 font-mono text-xs font-semibold text-white">
            {numeroDo(ch)}
          </span>
          <SeloTipo tipo={ch.tipo} />
          {aviso ? (
            <>
              {!emAberto && (
                <SeloStatusChamado status={ch.status} aguardando={null} />
              )}
              {d.leitura?.euRecebo && <SeloLido lido={!!d.leitura.liEm} />}
            </>
          ) : (
            <>
              <SeloStatusChamado
                status={ch.status}
                aguardando={ch.aguardando_tipo}
              />
              <SeloPrioridade prioridade={ch.prioridade} />
              <SeloPrazo
                prazo={ch.prazo}
                status={ch.status}
                agora={agora}
                avisoHoras={d.avisoHoras}
              />
            </>
          )}
        </div>
        {ferramentas}
      </div>
      {compacto ? (
        <h2 className="text-2xl font-semibold tracking-tight break-words">
          {ch.titulo}
        </h2>
      ) : (
        <h1 className="text-3xl font-semibold tracking-tight break-words md:text-4xl">
          {ch.titulo}
        </h1>
      )}
      <p className="text-sm text-neutral-500">
        {quemPediu(d)} · {tempoAtras(ch.criado_em, agora)} ·{" "}
        {aviso ? "Para:" : "Responsável:"}{" "}
        <span className="font-medium text-neutral-800">
          {aviso
            ? paraQuem(d)
            : (nome(ch.responsavel_id) ??
              `Fila de ${d.setor?.nome ?? "setor"}`)}
        </span>
      </p>
      {(d.acoes.length > 0 || comGestao || podeLer) && (
        <div
          data-guia="chamado-acoes"
          className="flex flex-wrap items-start gap-2"
        >
          {podeLer && <BotaoLido id={ch.id} />}
          <AcoesDoChamado
            id={ch.id}
            acoes={d.acoes}
            bloqueio={d.bloqueio}
            ehOS={ehOS}
            causasFalha={d.causasFalha}
            fechaAoConcluir={statusAoConcluir(ch) === "fechado"}
          />
          {comGestao && formulario && (
            <Gestao
              id={ch.id}
              atual={{
                responsavelId: ch.responsavel_id,
                prazo: ch.prazo,
                prioridade: ch.prioridade,
                setorId: ch.setor_id,
                categoriaId: ch.categoria_id,
              }}
              pode={podeGestao}
              opcoes={{
                pessoas: formulario.pessoas,
                setores: formulario.setores,
                categorias: formulario.categorias.map((c) => ({
                  id: c.id,
                  setorId: c.setorId,
                  nome: c.nome,
                  paiId: c.paiId,
                })),
              }}
            />
          )}
        </div>
      )}
    </header>
  );

  const informacoes = <Informacoes d={d} agora={agora} compacto={compacto} />;
  // Preso no topo enquanto rola: o técnico pausa sem voltar lá em cima.
  const cronometro = registraTempo && (
    <Suspense fallback={null}>
      <CronometroDaOS
        ordemId={ch.id}
        className={`sticky z-20 ${compacto ? "top-0" : "top-3"}`}
      />
    </Suspense>
  );

  const corpo = (
    <div className="flex min-w-0 flex-col gap-5">
      {(ch.descricao || d.campos.length > 0) && (
        <section data-guia="chamado-descricao" className={CARTAO}>
          <h3 className={TITULO_SECAO}>Descrição</h3>
          {ch.descricao ? (
            <p className="text-sm break-words whitespace-pre-wrap text-neutral-900">
              {ch.descricao}
            </p>
          ) : (
            <p className="text-sm text-neutral-500">Sem descrição.</p>
          )}
          {d.campos.length > 0 && (
            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {d.campos.map((c) => (
                <div
                  key={c.chave}
                  className="rounded-2xl bg-neutral-900/[0.03] px-4 py-3"
                >
                  <dt className="text-xs text-neutral-500">{c.rotulo}</dt>
                  <dd className="mt-0.5 text-sm font-medium break-words">
                    {textoDoCampo(
                      c,
                      (ch.campos as Record<string, unknown>)[c.chave],
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
      {d.checklist.length > 0 && (
        <section data-guia="chamado-checklist" className={CARTAO}>
          <h3 className={TITULO_SECAO}>Checklist</h3>
          <Checklist
            id={ch.id}
            itens={d.checklist}
            nomes={soOs(
              d.nomes,
              d.checklist.map((i) => i.por),
            )}
            editavel={d.pode.editar && emAberto}
          />
        </section>
      )}
      {d.leitura && (
        <section className={CARTAO}>
          <h3 className={TITULO_SECAO}>Leitura</h3>
          <Leitura
            para={d.destinos.map((x) => ({
              id: x.id,
              nome: x.nome,
              pessoa: !!x.usuario_id,
              titulo: x.titulo,
            }))}
            leitores={d.leitura.leitores}
          />
        </section>
      )}
      {d.andamento && (
        <section data-guia="chamado-destinos" className={CARTAO}>
          <h3 className={TITULO_SECAO}>
            {ch.destinos_em_ordem
              ? "Etapas em ordem"
              : "Andamento de cada destino"}
          </h3>
          <Destinos
            linhas={d.destinos.map((x) => ({
              id: x.id,
              nome: x.nome,
              pessoa: !!x.usuario_id,
              titulo: x.titulo,
              status: x.status,
              prazo: x.prazo,
              lidoEm: x.lido_em,
              concluidoEm: x.concluido_em,
              concluidoPor: x.concluido_por,
              meu: x.meu,
              espera: x.espera,
            }))}
            emOrdem={ch.destinos_em_ordem}
            andamento={d.andamento}
            nomes={soOs(
              d.nomes,
              d.destinos.map((x) => x.concluido_por),
            )}
            encerrado={!emAberto && ch.status !== "concluido"}
            definirTarefas={d.pode.definirTarefas && emAberto}
            reordenar={d.pode.reordenar && emAberto}
          />
        </section>
      )}
      {registraTempo && (
        <Suspense fallback={<CartaoCarregando altura="h-48" />}>
          <BlocoOS ordemId={ch.id} compacto={compacto} />
        </Suspense>
      )}
      <section
        data-guia="chamado-conversa"
        className={CARTAO}
        aria-labelledby={`conversa-${ch.id}`}
      >
        <h3 id={`conversa-${ch.id}`} className={TITULO_SECAO}>
          Conversa e histórico
        </h3>
        <LinhaDoTempo
          eventos={d.eventos}
          anexos={d.anexos}
          nomes={d.nomes}
          comLoja={!!ch.loja_id}
          agora={agora}
        />
        <div className="mt-5">
          <Comentario
            id={ch.id}
            pessoas={gente}
            comLoja={!!ch.loja_id}
            podeAnexar={d.pode.editar}
          />
        </div>
      </section>
    </div>
  );

  if (compacto)
    return (
      <article className="flex min-w-0 flex-col gap-5">
        {topo}
        {cronometro}
        <Avisos d={d} />
        <section className={CARTAO}>{informacoes}</section>
        {corpo}
      </article>
    );

  return (
    <article className="flex min-w-0 flex-col gap-5">
      {topo}
      {cronometro}
      <Avisos d={d} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {corpo}
        <aside
          className={`flex min-w-0 flex-col gap-5 lg:sticky lg:self-start ${registraTempo ? "lg:top-24" : "lg:top-5"}`}
        >
          <section data-guia="chamado-informacoes" className={CARTAO}>
            <h3 className={TITULO_SECAO}>Informações</h3>
            {informacoes}
          </section>
        </aside>
      </div>
    </article>
  );
}

function quemPediu(d: Detalhe): string {
  const { ch } = d;
  if (ch.origem === "portal")
    return `Portal – ${d.loja?.nome ?? ch.solicitante_nome ?? "lojista"}`;
  const nome = ch.aberto_por ? d.nomes[ch.aberto_por] : null;
  return `Aberto por ${nome ?? ch.solicitante_nome ?? ORIGENS[ch.origem]}`;
}

/** Aviso: os destinos (setores e pessoas) ou, sem eles, o responsável ou o setor. */
function paraQuem(d: Detalhe): string {
  if (d.destinos.length) return d.destinos.map((x) => x.nome).join(", ");
  const nome = d.ch.responsavel_id ? d.nomes[d.ch.responsavel_id] : null;
  return nome ?? d.setor?.nome ?? "setor";
}

function SeloLido({ lido }: { lido: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${lido ? "bg-green-50 text-green-700" : "bg-sky-50 text-sky-800"}`}
    >
      {lido ? (
        <CheckCheck className="size-3.5" aria-hidden />
      ) : (
        <Mail className="size-3.5" aria-hidden />
      )}
      {lido ? "Lido" : "Não lido"}
    </span>
  );
}

/** Faixas do momento: aguardando, concluído, cancelado, reaberto. */
function Avisos({ d }: { d: Detalhe }) {
  const { ch } = d;
  const faixas: {
    chave: string;
    Icone: typeof Star;
    classe: string;
    texto: React.ReactNode;
  }[] = [];
  const amarelo = "bg-amber-50 text-amber-900";
  const neutro = "bg-neutral-900/[0.05] text-neutral-800";
  if (ch.status === "aguardando" && ch.aguardando_tipo)
    faixas.push({
      chave: "aguardando",
      Icone: CirclePause,
      classe: amarelo,
      texto: `Aguardando ${MOTIVOS_AGUARDANDO[ch.aguardando_tipo].toLowerCase()}${ch.aguardando_motivo ? `: ${ch.aguardando_motivo}` : ""}. O relógio do prazo está parado.`,
    });
  if (ch.status === "concluido")
    faixas.push({
      chave: "concluido",
      Icone: CircleAlert,
      classe: amarelo,
      texto: d.papel.solicitante
        ? "Foi concluído. Confira e confirme, ou reabra com o motivo."
        : "Concluído. Aguardando a confirmação de quem pediu.",
    });
  if (ch.status === "cancelado" && ch.motivo_cancelamento)
    faixas.push({
      chave: "cancelado",
      Icone: XCircle,
      classe: neutro,
      texto: `Cancelado: ${ch.motivo_cancelamento}`,
    });
  if (
    ch.reaberto_vezes > 0 &&
    ch.ultimo_motivo_reabertura &&
    ch.status !== "fechado"
  )
    faixas.push({
      chave: "reaberto",
      Icone: RotateCcw,
      classe: neutro,
      texto: `Reaberto ${ch.reaberto_vezes === 1 ? "uma vez" : `${ch.reaberto_vezes} vezes`}. Último motivo: ${ch.ultimo_motivo_reabertura}`,
    });

  if (ch.solucao && ["concluido", "fechado"].includes(ch.status))
    faixas.push({
      chave: "solucao",
      Icone: Lightbulb,
      classe: "bg-green-50 text-green-700",
      texto: `Solução: ${ch.solucao}${ch.causa_falha ? ` · Causa: ${ch.causa_falha}` : ""}`,
    });
  if (!faixas.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {faixas.map((f) => (
        <p
          key={f.chave}
          className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm break-words ${f.classe}`}
        >
          <f.Icone className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0">{f.texto}</span>
        </p>
      ))}
    </div>
  );
}

function Linha({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-neutral-500">{rotulo}</dt>
      <dd className="min-w-0 text-sm break-words text-neutral-900">
        {children}
      </dd>
    </div>
  );
}

const LINK =
  "font-medium underline decoration-neutral-900/20 underline-offset-2 hover:decoration-neutral-900";

function Informacoes({
  d,
  agora,
  compacto,
}: {
  d: Detalhe;
  agora: Date;
  compacto: boolean;
}) {
  const { ch } = d;
  const recorrencia = ch.recorrencia as Recorrencia | null;
  return (
    <dl
      className={`grid grid-cols-1 gap-x-6 gap-y-4 min-[420px]:grid-cols-2 ${compacto ? "md:grid-cols-3" : "lg:grid-cols-1"}`}
    >
      <Linha rotulo="Setor e categoria">
        <span className="flex flex-wrap items-center gap-1.5">
          {d.setor && <SeloSetor nome={d.setor.nome} cor={d.setor.cor} />}
          {d.categoria && (
            <span>
              {d.categoriaPai ? `${d.categoriaPai.nome} › ` : ""}
              {d.categoria.nome}
            </span>
          )}
        </span>
      </Linha>
      <Linha rotulo="Quem pediu">
        {quemPediu(d).replace(/^Aberto por /, "")}
        {ch.solicitante_nome && ch.origem === "portal" && (
          <span className="block text-xs text-neutral-500">
            {ch.solicitante_nome}
            {ch.solicitante_telefone ? ` · ${ch.solicitante_telefone}` : ""}
          </span>
        )}
      </Linha>
      {ch.tipo !== "aviso" && (
        <Linha rotulo="Prazo">
          {ch.prazo ? formatarDataHora(ch.prazo) : "Sem prazo"}
          {ch.aguardando_min > 0 && (
            <span className="block text-xs text-neutral-500">
              Já empurrado pelo tempo em Aguardando.
            </span>
          )}
        </Linha>
      )}
      <Linha rotulo="Aberto em">
        {formatarDataHora(ch.criado_em)}
        {ch.primeira_resposta_em && (
          <span className="block text-xs text-neutral-500">
            1ª resposta {tempoAtras(ch.primeira_resposta_em, agora)}
          </span>
        )}
      </Linha>
      {ch.etiquetas.length > 0 && (
        <Linha rotulo="Etiquetas">
          <span className="flex flex-wrap gap-1">
            {ch.etiquetas.map((e) => (
              <span
                key={e}
                className="rounded-full bg-neutral-900/[0.06] px-2 py-0.5 text-xs"
              >
                {e}
              </span>
            ))}
          </span>
        </Linha>
      )}
      {recorrencia?.frequencia && (
        <Linha rotulo="Repete">{descreverRecorrencia(recorrencia)}</Linha>
      )}
      {ch.origem !== "sistema" && (
        <Linha rotulo="Origem">{ORIGENS[ch.origem]}</Linha>
      )}
      {d.loja && (
        <Linha rotulo="Loja">
          {d.loja.luc} · {d.loja.nome}
        </Linha>
      )}
      {d.ativo && (
        <Linha rotulo="Ativo">
          {d.pode.verAtivo ? (
            <Link href={rotaAtivo(d.ativo.id)} className={LINK}>
              {d.ativo.codigo} · {d.ativo.nome}
            </Link>
          ) : (
            `${d.ativo.codigo} · ${d.ativo.nome}`
          )}
          {d.ativo.local && (
            <span className="block text-xs text-neutral-500">
              {d.ativo.local}
            </span>
          )}
        </Linha>
      )}
      {ch.vistoria_id && (
        <Linha rotulo="Vistoria">
          {d.vistoria ? (
            <Link href={rotaVistoria(d.vistoria.id)} className={LINK}>
              Laudo {d.vistoria.codigo}
            </Link>
          ) : (
            "Vistoria vinculada"
          )}
        </Linha>
      )}
      {d.vinculado && (
        <Linha rotulo="Ligado ao chamado">
          <Link href={rotaDo(d.vinculado)} className={LINK}>
            {numeroDo(d.vinculado)} {d.vinculado.titulo}
          </Link>
          <span className="block text-xs text-neutral-500">
            {TIPOS[d.vinculado.tipo]} · {STATUS[d.vinculado.status]}
          </span>
        </Linha>
      )}
      {d.ordensLigadas.length > 0 && (
        <Linha rotulo="OS ligadas">
          {d.ordensLigadas.map((o) => (
            <span key={o.id} className="block">
              <Link href={rotaDo(o)} className={LINK}>
                {numeroDo(o)} {o.titulo}
              </Link>
              <span className="block text-xs text-neutral-500">
                {STATUS[o.status]}
              </span>
            </span>
          ))}
        </Linha>
      )}
      {ch.avaliacao && (
        <Linha rotulo="Avaliação do lojista">
          <span
            className="flex items-center gap-0.5"
            title={`${ch.avaliacao} de 5`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                aria-hidden
                className={`size-4 ${n <= (ch.avaliacao ?? 0) ? "fill-amber-400 text-amber-500" : "text-neutral-300"}`}
              />
            ))}
            <span className="ml-1.5 text-xs text-neutral-600">
              {ch.avaliacao} de 5
            </span>
          </span>
          {ch.avaliacao_comentario && (
            <span className="mt-1 block text-xs text-neutral-600">
              “{ch.avaliacao_comentario}”
            </span>
          )}
        </Linha>
      )}
    </dl>
  );
}

/** Esqueleto do detalhe (página e janela lateral). */
export function DetalheCarregando({
  compacto = false,
}: {
  compacto?: boolean;
}) {
  return (
    <output className="flex flex-col gap-5">
      <span className="sr-only">Carregando o chamado…</span>
      <div aria-hidden className="flex flex-col gap-3">
        <span className="carregando h-7 w-72 max-w-full rounded-full" />
        <span className="carregando h-10 w-full max-w-xl rounded-2xl" />
        <span className="carregando h-11 w-64 max-w-full rounded-full" />
      </div>
      <div
        className={`grid grid-cols-1 gap-5 ${compacto ? "" : "lg:grid-cols-[minmax(0,1fr)_20rem]"}`}
      >
        <div className="flex flex-col gap-5">
          <CartaoCarregando altura="h-40" />
          <CartaoCarregando altura="h-96" />
        </div>
        {!compacto && <CartaoCarregando altura="h-96" />}
      </div>
    </output>
  );
}

/** Só os nomes que o componente do navegador usa (não a lista inteira). */
function soOs(
  nomes: Record<string, string>,
  ids: (string | null | undefined)[],
): Record<string, string> {
  const r: Record<string, string> = {};
  for (const id of ids) if (id && nomes[id]) r[id] = nomes[id];
  return r;
}
