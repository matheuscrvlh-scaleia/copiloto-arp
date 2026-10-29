import {
  CalendarClock,
  Car,
  Globe,
  HardHat,
  KeyRound,
  ListChecks,
  type LucideIcon,
  Megaphone,
  Music2,
  Search,
  Send,
  Users,
} from "lucide-react";
import { Situacao } from "@/components/admin/ui";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { formatarDataHora } from "@/lib/formato";
import { INTEGRACOES, type Sistema } from "@/lib/integracoes";
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
  mkt_google: Search,
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

const SINCRONIZA: Sistema[] = ["secullum", "copiloto_rh", "wps"];

export function CartaoIntegracao({
  i,
  cofre,
}: {
  i: IntegracaoNaTela;
  cofre: boolean;
}) {
  const def = INTEGRACOES[i.sistema];
  const Icone = ICONE[i.sistema];
  const s = situacao(i);
  const salva = i.origem === "tela";

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
        <fieldset disabled={!cofre} className="flex flex-col gap-4">
          <legend className="sr-only">Acesso a {def.nome}</legend>
          {def.campos.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {def.campos.map((c) => (
                <label key={c.nome} className={rotulo}>
                  <span>
                    {c.rotulo}
                    {c.opcional && (
                      <span className="font-normal text-neutral-400">
                        {" "}
                        (opcional)
                      </span>
                    )}
                  </span>
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
                  {c.ajuda && (
                    <span className="font-normal text-neutral-400">
                      {c.ajuda}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
          {def.segredos.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {def.segredos.map((sg) => (
                <label
                  key={sg.nome}
                  className={`${rotulo} ${def.segredos.length === 1 ? "md:col-span-2" : ""}`}
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
        </fieldset>
      </FormAcao>
    </section>
  );
}
