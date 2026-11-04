import {
  CalendarClock,
  Car,
  Filter,
  Globe,
  HardHat,
  KeyRound,
  ListChecks,
  type LucideIcon,
  Megaphone,
  Music2,
  Play,
  Search,
  Send,
  Users,
} from "lucide-react";
import { Suspense } from "react";
import { Situacao } from "@/components/admin/ui";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { formatarDataHora } from "@/lib/formato";
import {
  type Descoberta,
  INTEGRACOES,
  type Sistema,
  valorDaEscolha,
} from "@/lib/integracoes";
import {
  removerIntegracao,
  salvarIntegracao,
  sincronizarAgora,
  testarIntegracao,
} from "@/server/admin/acoes/integracoes";
import type { IntegracaoNaTela } from "@/server/admin/dados";

// Cartão de uma integração: situação, último teste e o formulário de acesso.
// Usado em Administração › Integrações e em Marketing › Configurações ›
// Integrações.

const ICONE: Record<Sistema, LucideIcon> = {
  secullum: CalendarClock,
  wps: Car,
  diario_de_obras: HardHat,
  copiloto_rh: Users,
  rd_crm: Filter,
  mkt_google: Search,
  mkt_youtube: Play,
  mkt_meta: Megaphone,
  mkt_tiktok: Music2,
  mkt_rd_station: Send,
  mkt_asana: ListChecks,
  mkt_site: Globe,
};

export const COR_SITUACAO = {
  ok: "#58c069",
  erro: "#d03b3b",
  neutro: "#6e6e6e",
} as const;

export type TipoSituacao = keyof typeof COR_SITUACAO;

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

export function situacao(i: IntegracaoNaTela): {
  tipo: TipoSituacao;
  texto: string;
} {
  if (i.origem === null) return { tipo: "neutro", texto: "Não configurada" };
  if (!i.ativa) return { tipo: "neutro", texto: "Desativada" };
  if (i.origem === "ambiente")
    return { tipo: "neutro", texto: "Pelo ambiente do servidor" };
  if (i.testeOk === true) return { tipo: "ok", texto: "Conectada" };
  if (i.testeOk === false) return { tipo: "erro", texto: "Falhou no teste" };
  return { tipo: "neutro", texto: "Não testada" };
}

export function Ponto({ cor }: { cor: string }) {
  return (
    <span
      className="size-2.5 shrink-0 rounded-full shadow-[0_0_12px_currentColor]"
      style={{ backgroundColor: cor, color: cor }}
      aria-hidden
    />
  );
}

const SINCRONIZA: Sistema[] = [
  "secullum",
  "copiloto_rh",
  "wps",
  "mkt_rd_station",
  "mkt_meta",
];

/**
 * Lista de um campo de escolha: o que a conta conectada acessa. O salvo fica
 * na lista mesmo se a busca falhar, para não se perder ao salvar de novo.
 */
async function Escolha({
  id,
  nome,
  atual,
  descobertas,
}: {
  id: string;
  nome: string;
  atual: string;
  descobertas: Promise<Record<string, Descoberta> | null>;
}) {
  const d = (await descobertas)?.[nome];
  const opcoes = d?.opcoes ?? [];
  const lista =
    atual && !opcoes.some((o) => o.valor === atual)
      ? [{ valor: atual, rotulo: `${atual} (salvo)` }, ...opcoes]
      : opcoes;
  const vazio = !d
    ? "Conecte com o Google para escolher"
    : opcoes.length > 0
      ? "Não usar"
      : "Nada encontrado nesta conta";
  return (
    <>
      <select
        id={id}
        name={nome}
        defaultValue={atual}
        disabled={lista.length === 0}
        className={classeCampo}
      >
        <option value="">{vazio}</option>
        {lista.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      {d?.erro && <span className="font-normal text-amber-700">{d.erro}</span>}
    </>
  );
}

export function CartaoIntegracao({
  i,
  cofre,
  descobertas = Promise.resolve(null),
}: {
  i: IntegracaoNaTela;
  cofre: boolean;
  /** Para os campos de escolha (Google): o que a conta conectada acessa. */
  descobertas?: Promise<Record<string, Descoberta> | null>;
}) {
  const def = INTEGRACOES[i.sistema];
  const Icone = ICONE[i.sistema];
  const s = situacao(i);
  const salva = i.origem === "tela";
  const segredos = def.segredos.filter((sg) => !sg.gerado);
  const campos = def.campos.filter((c) => !c.gerado);

  return (
    <section
      id={i.sistema}
      className="vidro grid scroll-mt-6 grid-cols-1 gap-6 rounded-[2rem] p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
            <Icone className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{def.nome}</h2>
            <p className="text-sm text-neutral-500">{def.serve}</p>
          </div>
        </div>
        <div>
          <Situacao tipo={s.tipo}>{s.texto}</Situacao>
        </div>
        <dl className="flex flex-col gap-1 text-xs text-neutral-500">
          {i.testeMensagem && (
            <div>
              <dt className="sr-only">Último teste</dt>
              <dd className="text-sm break-words whitespace-pre-line text-neutral-700">
                {i.testeMensagem}
              </dd>
            </div>
          )}
          {i.testadoEm && (
            <div>
              <dt className="inline">Testada em </dt>
              <dd className="inline">{formatarDataHora(i.testadoEm)}</dd>
            </div>
          )}
          {salva && i.configuradoEm && (
            <div>
              <dt className="inline">Configurada em </dt>
              <dd className="inline">
                {formatarDataHora(i.configuradoEm)}
                {i.configuradoPor ? ` por ${i.configuradoPor}` : ""}
              </dd>
            </div>
          )}
          {i.origem === "ambiente" && (
            <div>
              <dt className="sr-only">Origem</dt>
              <dd>
                Funcionando com as variáveis de ambiente do servidor. Salve aqui
                para gerenciar pela tela; a credencial salva passa a valer.
              </dd>
            </div>
          )}
        </dl>
        {i.origem !== null && (
          <div className="mt-auto flex flex-wrap gap-2">
            <FormAcao
              acao={testarIntegracao}
              rotulo="Testar conexão"
              rotuloEnviando="Testando…"
              variante="secundario"
            >
              <input type="hidden" name="sistema" value={i.sistema} />
            </FormAcao>
            {SINCRONIZA.includes(i.sistema) && i.ativa && (
              <FormAcao
                acao={sincronizarAgora}
                rotulo="Sincronizar agora"
                rotuloEnviando="Iniciando…"
                variante="secundario"
              >
                <input type="hidden" name="sistema" value={i.sistema} />
              </FormAcao>
            )}
            {salva && (
              <FormAcao
                acao={removerIntegracao}
                rotulo="Remover"
                rotuloEnviando="Removendo…"
                variante="perigo"
                confirmar={`Remover a credencial de ${def.nome}? Sem ela, a integração volta a usar o ambiente do servidor (se houver) ou para.`}
              >
                <input type="hidden" name="sistema" value={i.sistema} />
              </FormAcao>
            )}
          </div>
        )}
      </div>

      <FormAcao
        acao={salvarIntegracao}
        rotulo="Salvar e testar"
        rotuloEnviando="Testando…"
        className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white/60 p-5"
      >
        <input type="hidden" name="sistema" value={i.sistema} />
        {def.campos
          .filter((c) => c.gerado)
          .map((c) => (
            <input
              key={c.nome}
              type="hidden"
              name={c.nome}
              value={salva ? String(i.parametros[c.nome] ?? "") : ""}
            />
          ))}
        <fieldset disabled={!cofre} className="flex flex-col gap-4">
          <legend className="sr-only">Acesso a {def.nome}</legend>
          {campos.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {campos.map((c) => (
                <label
                  key={c.nome}
                  className={rotulo}
                  htmlFor={c.escolha ? `${i.sistema}-${c.nome}` : undefined}
                >
                  <span>
                    {c.rotulo}
                    {c.opcional && !c.escolha && (
                      <span className="font-normal text-neutral-400">
                        {" "}
                        (opcional)
                      </span>
                    )}
                  </span>
                  {c.escolha ? (
                    <Suspense
                      fallback={
                        <select disabled className={classeCampo}>
                          <option>Buscando na conta…</option>
                        </select>
                      }
                    >
                      <Escolha
                        id={`${i.sistema}-${c.nome}`}
                        nome={c.nome}
                        atual={
                          salva ? valorDaEscolha(c.nome, i.parametros) : ""
                        }
                        descobertas={descobertas}
                      />
                    </Suspense>
                  ) : (
                    <input
                      name={c.nome}
                      type={c.tipo === "number" ? "text" : c.tipo}
                      inputMode={c.tipo === "number" ? "numeric" : undefined}
                      required={!c.opcional}
                      autoComplete="off"
                      placeholder={c.exemplo}
                      defaultValue={
                        salva ? String(i.parametros[c.nome] ?? "") : undefined
                      }
                      className={classeCampo}
                    />
                  )}
                  {c.ajuda && (
                    <span className="font-normal text-neutral-400">
                      {c.ajuda}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
          {segredos.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {segredos.map((sg) => (
                <label
                  key={sg.nome}
                  className={`${rotulo} ${segredos.length === 1 ? "md:col-span-2" : ""}`}
                >
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="size-3.5" aria-hidden />
                    {sg.rotulo}
                    {sg.opcional && (
                      <span className="font-normal text-neutral-400">
                        (opcional)
                      </span>
                    )}
                  </span>
                  <input
                    name={`segredo.${sg.nome}`}
                    type="password"
                    autoComplete="new-password"
                    required={!salva && !sg.opcional}
                    placeholder={
                      salva ? "•••••••• em branco mantém o salvo" : undefined
                    }
                    className={`${classeCampo} font-mono`}
                  />
                  {sg.ajuda && (
                    <span className="font-normal text-neutral-400">
                      {sg.ajuda}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="ativa"
                defaultChecked={salva ? i.ativa : true}
                className="size-4 accent-neutral-900"
              />
              Ativa
            </label>
            <label className="flex items-center gap-2 text-neutral-500">
              <input
                type="checkbox"
                name="sem_teste"
                className="size-4 accent-neutral-900"
              />
              Salvar mesmo se o teste falhar
            </label>
          </div>
          {def.autorizar && (
            <div className="flex flex-col gap-2 rounded-2xl bg-neutral-900/[0.03] p-4 text-xs text-neutral-500">
              <p>{def.autorizar.explicacao}</p>
              <button
                type="submit"
                name="autorizar"
                value="1"
                className="w-fit rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:border-neutral-400 disabled:opacity-60"
              >
                {def.autorizar.rotulo}
              </button>
            </div>
          )}
        </fieldset>
      </FormAcao>
    </section>
  );
}
