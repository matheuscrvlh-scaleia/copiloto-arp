import type { SetorDoApoio as Setor } from "@arp/shared/os/contratos/base";
import type { ModeloComItens } from "@arp/shared/os/contratos/configuracoes";
import {
  ACOES,
  type AcaoItem,
  CONDICOES,
  type Condicao,
  GATILHOS,
  type Gatilho,
} from "@arp/shared/os/modelos";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Power, Send } from "lucide-react";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { Protegido } from "@/components/protegido";
import { usePermissao } from "@/lib/sessao";
import { AcaoRapida } from "@/modules/admin/components/acao-rapida";
import { Situacao } from "@/modules/admin/components/ui";
import {
  alternarModelo,
  consultaDosModelos,
  rodarRotinasAgora,
  salvarModelo,
} from "@/modules/os/api-configuracoes";
import { useApoio } from "@/modules/os/apoio";
import {
  EditorDeModelo,
  type ModeloEditavel,
} from "@/modules/os/components/automacao/editor-modelo";
import { RodarRotinas } from "@/modules/os/components/automacao/rodar-rotinas";
import { SeloSetor } from "@/modules/os/components/selos";

// app/(app)/os/configuracoes/modelos/page.tsx

const ehGatilho = (g: string): g is Gatilho => Object.hasOwn(GATILHOS, g);
const ehCondicao = (c: string): c is Condicao => Object.hasOwn(CONDICOES, c);
const ehAcao = (a: string): a is AcaoItem => Object.hasOwn(ACOES, a);

// Cadastro dos modelos de entrada e saída de cliente (spec 4.12) e rotinas
// sem esperar o cron. Disparar, acompanhar os disparos e parar um lembrete
// recorrente ficam em Operações › Disparos e lembretes.

export default function Page() {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Protegido permissao="os.modelos">
        <Tela />
      </Protegido>
    </Suspense>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-[28rem]" />
      <CartaoCarregando altura="h-48" />
    </TelaCarregando>
  );
}

function Tela() {
  const {
    setores: todosSetores,
    categorias: todasCategorias,
    pessoas: gente,
  } = useApoio();
  const { data: lista } = useSuspenseQuery(consultaDosModelos);
  const ativos = todosSetores.filter((s) => s.ativo);
  const cats = todasCategorias
    .filter((c) => c.ativo)
    .map((c) => ({ id: c.id, nome: c.nome, setor_id: c.setor_id }));
  const porSetor = new Map(todosSetores.map((s) => [s.id, s]));

  return (
    <div className="flex flex-col gap-6">
      <Secao
        id="modelos"
        titulo="Modelos de entrada e saída de cliente"
        descricao="Contrato novo (ou saída) no ENET vira um Aviso com uma parte para cada setor, cada uma com título e prazo. Dispara uma vez só por contrato. Até a API do ENET, a rotina acha os contratos cadastrados à mão."
      >
        <div className="flex flex-col gap-4">
          {lista.map((m) => (
            <Modelo
              key={m.id}
              m={m}
              setores={ativos}
              categorias={cats}
              pessoas={gente}
              porSetor={porSetor}
            />
          ))}
          <details className="group rounded-3xl border border-dashed border-neutral-900/15 px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
              <Plus className="size-4" aria-hidden />
              Novo modelo
            </summary>
            <div className="mt-4">
              <EditorDeModelo
                modelo={{
                  id: null,
                  nome: "",
                  gatilho: "manual",
                  descricao: null,
                  itens: [],
                }}
                setores={ativos}
                categorias={cats}
                pessoas={gente}
                acao={salvarModelo}
              />
            </div>
          </details>
        </div>
      </Secao>

      <Rotinas />
    </div>
  );
}

function Modelo({
  m,
  setores: lista,
  categorias: cats,
  pessoas: gente,
  porSetor,
}: {
  m: ModeloComItens;
  setores: Setor[];
  categorias: { id: string; nome: string; setor_id: string }[];
  pessoas: { id: string; nome: string }[];
  porSetor: Map<string, Setor>;
}) {
  const editavel: ModeloEditavel = {
    id: m.id,
    nome: m.nome,
    gatilho: ehGatilho(m.gatilho) ? m.gatilho : "manual",
    descricao: m.descricao,
    itens: m.itens.map((i) => ({
      id: i.id,
      setor_id: i.setor_id,
      categoria_id: i.categoria_id,
      titulo: i.titulo,
      prazo_dias: i.prazo_dias,
      responsavel_id: i.responsavel_id,
      condicao: ehCondicao(i.condicao) ? i.condicao : "sempre",
      acao: ehAcao(i.acao) ? i.acao : "nenhuma",
    })),
  };
  return (
    <details className="group rounded-3xl bg-white/50 ring-1 ring-neutral-900/[0.06] open:bg-white/70">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{m.nome}</span>
          <span className="block text-xs text-neutral-500">
            {ehGatilho(m.gatilho) ? GATILHOS[m.gatilho] : m.gatilho} ·{" "}
            {m.itens.length} {m.itens.length === 1 ? "item" : "itens"}
          </span>
        </span>
        <span className="flex flex-wrap gap-1.5">
          {[...new Set(m.itens.map((i) => i.setor_id))].map((s) => {
            const setor = porSetor.get(s);
            return setor ? (
              <SeloSetor key={s} nome={setor.nome} cor={setor.cor} />
            ) : null;
          })}
        </span>
        <Situacao tipo={m.ativo ? "ok" : "neutro"}>
          {m.ativo ? "Ativo" : "Desativado"}
        </Situacao>
      </summary>
      <div className="flex flex-col gap-4 border-t border-neutral-900/[0.06] px-4 py-4">
        <div className="flex justify-end">
          <AcaoRapida
            acao={alternarModelo}
            campos={{ id: m.id, ativo: m.ativo ? "false" : "true" }}
            rotulo={m.ativo ? "Desativar" : "Ativar"}
            icone={<Power className="size-4" aria-hidden />}
            comTexto
            confirmar={
              m.ativo
                ? "Desativar o modelo? Ele para de disparar sozinho; os avisos já criados continuam."
                : undefined
            }
          />
        </div>
        <EditorDeModelo
          modelo={editavel}
          setores={lista}
          categorias={cats}
          pessoas={gente}
          acao={salvarModelo}
        />
      </div>
    </details>
  );
}

/** Só para quem configura parâmetros ou modelos. */
function Rotinas() {
  const pode = usePermissao(["os.parametros", "os.modelos"]);
  if (!pode) return null;
  return (
    <Secao
      id="rotinas"
      titulo="Rotinas automáticas"
      descricao="De hora em hora o sistema fecha o que passou do prazo de aceite, avisa o que vence e o que venceu, cria os lembretes recorrentes e as preventivas, dispara os modelos de contrato novo e cobra o terceirizado. Rode agora para testar."
    >
      <RodarRotinas acao={rodarRotinasAgora} />
      <div className="mt-4">
        <Nota>
          <Send className="mr-1 inline size-3" aria-hidden />
          Tudo o que as rotinas fazem fica na linha do tempo de cada chamado e
          no histórico do sistema. Rodar de novo não cria nada repetido.
        </Nota>
      </div>
    </Secao>
  );
}
