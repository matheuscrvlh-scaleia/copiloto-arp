import { CircleCheck, Clock, Repeat, Square } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { CabecalhoOperacoes } from "@/components/os/operacoes";
import { SeloSetor, SeloStatusChamado } from "@/components/os/selos";
import { Protegido } from "@/components/protegido";
import { Selecao } from "@/components/selecao";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { lerRecorrencia, proximaDaSerie } from "@/lib/os/automacao";
import { andamentoDoDisparo } from "@/lib/os/modelos";
import { descreverRecorrencia } from "@/lib/os/recorrencia";
import { rotaChamado } from "@/lib/os/rotas";
import { TIPOS } from "@/lib/os/rotulos";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import {
  dispararModeloManual,
  pararSerie,
} from "@/server/os/acoes/config-modelos";
import { nomes, type Setor, setores } from "@/server/os/base";
import {
  type DisparoFeito,
  disparosFeitos,
  lojasParaDisparo,
  modelos,
  type Serie,
  seriesAtivas,
} from "@/server/os/modelos";

export const metadata: Metadata = { title: "Disparos e lembretes" };

// O disparo à mão pode passar do tempo padrão.
export const maxDuration = 300;

// Aba de Operações com o dia a dia dos modelos e lembretes (spec 4.12):
// disparar à mão, acompanhar quem falta em cada contrato e parar uma série.
// O cadastro dos modelos fica em Configurações › Modelos e lembretes.

export default function Page() {
  return (
    <>
      <CabecalhoOperacoes descricao="Disparos dos modelos de entrada e saída de cliente, quem falta em cada contrato e os lembretes recorrentes." />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="os.modelos">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-64" />
      <CartaoCarregando altura="h-48" />
    </TelaCarregando>
  );
}

async function Tela() {
  const [lista, todosSetores, lojas, disparos, series, nomesPorId] =
    await Promise.all([
      modelos(),
      setores(),
      lojasParaDisparo(),
      disparosFeitos(),
      seriesAtivas(),
      nomes(),
    ]);
  const porSetor = new Map(todosSetores.map((s) => [s.id, s]));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Secao
          id="disparar"
          titulo="Disparar modelo"
          descricao="À mão, quando o ENET não trouxer o dado ou num caso fora do comum. Cria o Aviso na hora, com as ações do modelo (vistoria, link do portal)."
        >
          <FormAcao
            acao={dispararModeloManual}
            rotulo="Disparar"
            rotuloEnviando="Disparando…"
            confirmar="Disparar o modelo para este contrato? Cria o Aviso para os setores e não pode ser disparado de novo para o mesmo contrato."
            className="flex flex-col gap-3"
          >
            <label
              className="flex flex-col gap-1 text-xs font-medium text-neutral-600"
              htmlFor="disparo-loja"
            >
              Contrato (loja)
              <Selecao
                id="disparo-loja"
                name="loja_id"
                obrigatorio
                busca
                placeholder="Escolha a loja…"
                opcoes={lojas.map((l) => ({
                  valor: l.id,
                  rotulo: `${l.nome} (${l.luc})`,
                  descricao: [
                    l.situacao === "encerrado" ? "Encerrado" : "Vigente",
                    l.inicio ? `início ${formatarData(l.inicio)}` : null,
                    l.fim ? `saída ${formatarData(l.fim)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                }))}
              />
            </label>
            <label
              className="flex flex-col gap-1 text-xs font-medium text-neutral-600"
              htmlFor="disparo-modelo"
            >
              Modelo
              <Selecao
                id="disparo-modelo"
                name="modelo_id"
                obrigatorio
                placeholder="Escolha o modelo…"
                opcoes={lista
                  .filter((m) => m.ativo)
                  .map((m) => ({
                    valor: m.id,
                    rotulo: m.nome,
                    descricao: `${m.itens.length} ${m.itens.length === 1 ? "item" : "itens"}`,
                  }))}
              />
            </label>
          </FormAcao>
          {lojas.length === 0 && (
            <p className="mt-3 text-xs text-neutral-500">
              Nenhuma loja cadastrada. Cadastre os contratos no Portal ou gere
              os dados de exemplo.
            </p>
          )}
        </Secao>

        <Secao
          id="disparos"
          titulo="Disparos por contrato"
          descricao="O Comercial acompanha quantos setores já concluíram a sua parte e quem falta. O histórico fica no contrato, não no imóvel."
        >
          <Disparos lista={disparos} porSetor={porSetor} />
        </Secao>
      </div>

      <Secao
        id="lembretes"
        titulo="Lembretes recorrentes"
        descricao="Chamados com Repetir: o sistema cria o próximo sozinho, alguns dias antes da data (Parâmetros), e nunca duas vezes na mesma data. Parar a série não apaga o que já foi criado."
      >
        <Series lista={series} porSetor={porSetor} nomes={nomesPorId} />
      </Secao>
    </div>
  );
}

function Disparos({
  lista,
  porSetor,
}: {
  lista: DisparoFeito[];
  porSetor: Map<string, Setor>;
}) {
  if (!lista.length)
    return (
      <p className="py-6 text-sm text-neutral-500">
        Nenhum modelo disparado ainda.
      </p>
    );
  return (
    <ul className="-mx-1 flex max-h-[30rem] flex-col divide-y divide-neutral-900/[0.06] overflow-y-auto px-1">
      {lista.map((d) => {
        const andamento = d.destinos ? andamentoDoDisparo(d.destinos) : null;
        const faltam = (d.destinos ?? []).filter(
          (x) => x.status !== "concluido",
        );
        return (
          <li key={d.id} className="flex flex-col gap-1.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {d.loja.nome}{" "}
                <span className="text-neutral-500">({d.loja.luc})</span>
              </span>
              <span className="text-xs text-neutral-500">
                {d.modelo} · {formatarDataHora(d.em)} ·{" "}
                {d.automatico ? "pela rotina" : "à mão"}
              </span>
              {d.chamado && <SeloStatusChamado status={d.chamado.status} />}
            </div>
            {andamento && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <CircleCheck
                    className={`size-4 ${andamento.concluidos === andamento.total ? "text-green-700" : "text-neutral-400"}`}
                    aria-hidden
                  />
                  {andamento.texto}
                </span>
                {faltam.length > 0 && (
                  <span className="text-xs text-neutral-500">
                    Falta:{" "}
                    {faltam
                      .map(
                        (f) =>
                          (f.setor_id
                            ? porSetor.get(f.setor_id)?.nome
                            : null) ??
                          f.titulo ??
                          "—",
                      )
                      .join(", ")}
                  </span>
                )}
              </div>
            )}
            {d.chamado ? (
              <Link
                href={rotaChamado(d.chamado.id)}
                className="self-start text-xs font-medium underline underline-offset-4"
              >
                Abrir o aviso #{d.chamado.numero}
              </Link>
            ) : (
              <span className="text-xs text-neutral-500">
                Você não vê este aviso (é de outros setores).
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Series({
  lista,
  porSetor,
  nomes: nomesPorId,
}: {
  lista: Serie[];
  porSetor: Map<string, Setor>;
  nomes: Map<string, string>;
}) {
  if (!lista.length)
    return (
      <p className="py-6 text-sm text-neutral-500">
        Nenhum lembrete recorrente ativo. Para criar, abra um chamado e use
        Repetir.
      </p>
    );
  const hoje = hojeEmBrasilia(new Date());
  return (
    <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
      {lista.map((s) => {
        const r = lerRecorrencia(s.recorrencia);
        const proxima = r ? proximaDaSerie(r, s.ultimaData, hoje) : null;
        const setor = porSetor.get(s.setor_id);
        return (
          <li
            key={s.serieId}
            className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-900/[0.06]">
              <Repeat className="size-4 text-neutral-600" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={rotaChamado(s.ultimaId)}
                className="font-medium underline-offset-2 hover:underline"
              >
                {s.titulo}
              </Link>
              <p className="text-xs text-neutral-500">
                {TIPOS[s.tipo]} ·{" "}
                {r ? descreverRecorrencia(r) : "Repetir inválido"} ·{" "}
                {s.ocorrencias}{" "}
                {s.ocorrencias === 1 ? "ocorrência" : "ocorrências"}
                {s.responsavel_id
                  ? ` · ${nomesPorId.get(s.responsavel_id) ?? "Pessoa sem acesso"}`
                  : " · fila do setor"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {setor && <SeloSetor nome={setor.nome} cor={setor.cor} />}
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
                <Clock className="size-3.5" aria-hidden />
                {proxima
                  ? `Próxima: ${formatarData(proxima)}`
                  : "Série terminou"}
              </span>
              <AcaoRapida
                acao={pararSerie}
                campos={{ serie_id: s.serieId, ultima_id: s.ultimaId }}
                rotulo="Parar a série"
                icone={<Square className="size-4" aria-hidden />}
                perigo
                confirmar="Parar a série? Nenhuma ocorrência nova será criada. As que já existem continuam."
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
