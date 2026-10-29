import { Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { FormAsana } from "@/components/marketing/parametros/asana";
import { CargaLocatarios } from "@/components/marketing/parametros/carga";
import { FormLocatario } from "@/components/marketing/parametros/locatario";
import { FormReputacao } from "@/components/marketing/parametros/reputacao";
import { Selecao } from "@/components/selecao";
import { formatarData, formatarMes } from "@/lib/formato";
import { metaVigente } from "@/lib/indicadores";
import {
  AREAS,
  avisoSemDados,
  type ConferenciaAsana,
  FORMAS_ACESSO,
  type FormaAcesso,
  INTERESSES_LP,
  type LinhaLandingPage,
  NIVEIS,
  REGRAS,
} from "@/lib/marketing/parametros";
import {
  alterarMeta,
  confirmarCargaLocatarios,
  incluirMeta,
  lerCargaLocatarios,
  removerCodigoRonda,
  removerLocatario,
  removerMeta,
  salvarAsana,
  salvarCodigoRonda,
  salvarEstacionamento,
  salvarLandingPage,
  salvarLocatario,
  salvarRegra,
  salvarReputacao,
  salvarTema,
} from "@/server/marketing/acoes/parametros";
import {
  type CodigoRonda,
  INDICADORES_MKT,
  type IndicadorMkt,
  type Locatario,
  type MetaMkt,
  type Parametros,
  type RegraAlerta,
  type Tema,
} from "@/server/marketing/base";

// Os blocos de Marketing › Configurações (spec 4.12), um por aba. Cada linha é
// um formulário próprio: salvar uma não mexe nas outras. A mudança vale nas
// telas na próxima atualização (a ação invalida o cache do cadastro).

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const selo = "rounded-full px-2 py-0.5 text-[11px] font-medium";
const SELO = {
  aviso: `${selo} bg-amber-400/20 text-amber-800`,
  neutro: `${selo} bg-neutral-900/[0.06] text-neutral-600`,
  ok: `${selo} bg-green-400/20 text-green-700`,
};
const lista = "flex flex-col divide-y divide-neutral-900/[0.06]";
const resumo =
  "flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 py-3 marker:hidden [&::-webkit-details-marker]:hidden";

const opcoes = (o: Record<string, string>) =>
  Object.entries(o).map(([valor, r]) => ({ valor, rotulo: r }));

function Marcar({
  nome,
  marcado,
  texto,
}: {
  nome: string;
  marcado: boolean;
  texto: string;
}) {
  return (
    <label className="flex items-center gap-2 pb-2 text-sm">
      <input
        type="checkbox"
        name={nome}
        defaultChecked={marcado}
        className="size-4 accent-neutral-900"
      />
      {texto}
    </label>
  );
}

// ---------------------------------------------------------------------------

export function BlocoLocatarios({
  locatarios,
  hoje,
  semDados,
}: {
  locatarios: Locatario[];
  hoje: string;
  semDados: number;
}) {
  const outros = locatarios.map((l) => ({ id: l.id, nome: l.nome }));
  const categorias = [...new Set(locatarios.map((l) => l.categoria))].sort();
  const ativos = locatarios.filter((l) => l.ativo).length;
  return (
    <>
      <Secao
        titulo="Locatários monitorados"
        descricao={`${ativos} ativos de ${locatarios.length}${semDados ? `; ${semDados} ativo(s) com “sem dados” na Reputação` : ""}. Link inválido ou sem acesso salva com aviso; nome repetido não salva.`}
      >
        <details className="mb-4 rounded-2xl bg-white/60 px-4 ring-1 ring-neutral-900/[0.06]">
          <summary className={`${resumo} text-sm font-medium`}>
            + Incluir locatário
          </summary>
          <div className="pb-4">
            <FormLocatario
              key={locatarios.length}
              acao={salvarLocatario}
              outros={outros}
              categorias={categorias}
              hoje={hoje}
            />
          </div>
        </details>
        {locatarios.length === 0 && (
          <p className="py-4 text-sm text-neutral-500">
            Nenhum locatário cadastrado. Inclua um a um ou carregue a planilha
            abaixo.
          </p>
        )}
        <div className={lista}>
          {locatarios.map((l) => {
            const aviso = avisoSemDados(l);
            return (
              <details key={l.id} className="group">
                <summary className={resumo}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{l.nome}</span>
                    <span className="block text-xs text-neutral-500">
                      {l.categoria} ·{" "}
                      {FORMAS_ACESSO[l.forma_acesso as FormaAcesso] ??
                        l.forma_acesso}{" "}
                      · desde {formatarData(l.entrada_em)}
                      {l.saida_em ? ` até ${formatarData(l.saida_em)}` : ""}
                    </span>
                  </span>
                  {aviso && (
                    <span className={SELO.aviso} title={aviso}>
                      sem dados
                    </span>
                  )}
                  <span className={l.ativo ? SELO.ok : SELO.neutro}>
                    {l.ativo ? "Ativo" : "Inativo"}
                  </span>
                  <span className="text-xs text-neutral-400 group-open:hidden">
                    Editar
                  </span>
                </summary>
                <div className="flex flex-col gap-3 pb-4">
                  {aviso && <p className="text-xs text-amber-700">{aviso}</p>}
                  <FormLocatario
                    acao={salvarLocatario}
                    locatario={l}
                    outros={outros}
                    categorias={categorias}
                    hoje={hoje}
                  />
                  <FormAcao
                    acao={removerLocatario}
                    rotulo="Remover"
                    rotuloEnviando="Removendo…"
                    variante="perigo"
                    confirmar={`Remover “${l.nome}” da lista? Para tirar da Reputação sem apagar, desmarque “Ativo” e informe a saída.`}
                  >
                    <input type="hidden" name="id" value={l.id} />
                  </FormAcao>
                </div>
              </details>
            );
          })}
        </div>
      </Secao>
      <Secao
        titulo="Carga da planilha de locatários"
        descricao="Para a carga inicial (a planilha com os links). Mostra a prévia com as linhas com problema e só grava quando você confirma. Nome já cadastrado é atualizado, nunca duplicado."
      >
        <CargaLocatarios
          ler={lerCargaLocatarios}
          confirmar={confirmarCargaLocatarios}
          existentes={locatarios.map((l) => ({
            id: l.id,
            nome: l.nome,
            ativo: l.ativo,
          }))}
        />
      </Secao>
    </>
  );
}

// ---------------------------------------------------------------------------

export function BlocoLandingPages({ linhas }: { linhas: LinhaLandingPage[] }) {
  return (
    <Secao
      titulo="Landing pages"
      descricao="A lista vem do RD Station. Landing page nova entra como “Sem tipo” (aviso no Painel) até alguém escolher o interesse: Evento, Locação ou Outro. O interesse separa os leads nas telas de Anúncios e Site."
    >
      {linhas.length === 0 && (
        <p className="py-4 text-sm text-neutral-500">
          Nenhuma landing page no RD.
        </p>
      )}
      <div className={lista}>
        {linhas.map((l) => (
          <FormAcao
            key={l.identificador}
            acao={salvarLandingPage}
            className={`grid items-center gap-3 py-3 sm:grid-cols-[1fr_14rem_auto] ${l.interesse === null ? "-mx-3 rounded-2xl bg-amber-400/10 px-3" : ""}`}
          >
            <input type="hidden" name="identificador" value={l.identificador} />
            <input type="hidden" name="nome" value={l.nome} />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {l.nome}
                {l.interesse === null && (
                  <span className={SELO.aviso}>Sem tipo: classifique</span>
                )}
                {!l.noRd && (
                  <span className={SELO.neutro}>não aparece mais no RD</span>
                )}
              </p>
              <p className="truncate text-xs text-neutral-500">
                {l.identificador}
              </p>
            </div>
            <Selecao
              name="interesse"
              obrigatorio
              rotulo={`Interesse de ${l.nome}`}
              valorInicial={l.interesse ?? ""}
              placeholder="Escolha o interesse…"
              opcoes={opcoes(INTERESSES_LP)}
            />
          </FormAcao>
        ))}
      </div>
    </Secao>
  );
}

// ---------------------------------------------------------------------------

const UNIDADE: Record<string, string> = {
  quantidade: "quantidade",
  nota: "nota de 1 a 5",
  reais: "R$",
};

export function BlocoMetas({
  metas,
  hoje,
}: {
  metas: MetaMkt[];
  hoje: string;
}) {
  const mesAtual = `${hoje.slice(0, 7)}-01`;
  const indicadores = Object.keys(INDICADORES_MKT) as IndicadorMkt[];
  return (
    <>
      <Secao
        titulo="Incluir meta"
        descricao="Cada meta vale a partir do mês escolhido até o mês anterior à próxima meta do mesmo indicador; meses passados continuam com a meta da época. Um indicador não pode ter duas metas no mesmo mês. Limite de atenção (opcional): até onde o indicador fica amarelo antes de ficar vermelho."
      >
        <FormAcao
          acao={incluirMeta}
          rotulo="Incluir"
          rotuloEnviando="Incluindo…"
          className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_10rem_8rem_8rem_auto]"
        >
          <label className={rotulo}>
            Indicador
            <Selecao
              name="indicador"
              obrigatorio
              placeholder="Escolha o indicador…"
              opcoes={indicadores.map((i) => ({
                valor: i,
                rotulo: INDICADORES_MKT[i].nome,
                descricao:
                  INDICADORES_MKT[i].direcao === "menor_melhor"
                    ? "Menor é melhor"
                    : "Maior é melhor",
              }))}
            />
          </label>
          <label className={rotulo}>
            Vale a partir de
            <input
              type="month"
              name="mes"
              required
              defaultValue={hoje.slice(0, 7)}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Meta
            <input
              name="meta"
              inputMode="decimal"
              required
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Atenção até
            <input
              name="limite_atencao"
              inputMode="decimal"
              placeholder="opcional"
              className={classeCampo}
            />
          </label>
        </FormAcao>
      </Secao>
      {indicadores.map((i) => {
        const def = INDICADORES_MKT[i];
        const doIndicador = metas
          .filter((m) => m.indicador === i)
          .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde));
        const vigente = metaVigente(metas, i, mesAtual);
        return (
          <Secao
            key={i}
            titulo={def.nome}
            descricao={`${def.direcao === "menor_melhor" ? "Menor é melhor" : "Maior é melhor"} · em ${UNIDADE[def.unidade] ?? def.unidade}`}
          >
            {doIndicador.length === 0 && (
              <p className="text-sm text-neutral-500">
                Sem meta: o indicador aparece sem semáforo.
              </p>
            )}
            <div className={lista}>
              {doIndicador.map((m) => (
                <div key={m.id} className="flex flex-wrap items-end gap-3 py-3">
                  <FormAcao
                    acao={alterarMeta}
                    className="grid flex-1 items-end gap-3 sm:grid-cols-[10rem_8rem_8rem_auto]"
                  >
                    <input type="hidden" name="id" value={m.id} />
                    <p className="flex flex-wrap items-center gap-2 pb-2 text-sm font-medium">
                      desde {formatarMes(m.vigente_desde)}
                      {vigente?.id === m.id && (
                        <span className={SELO.ok}>vale agora</span>
                      )}
                      {m.vigente_desde > mesAtual && (
                        <span className={SELO.neutro}>futura</span>
                      )}
                    </p>
                    <label className={rotulo}>
                      Meta
                      <input
                        name="meta"
                        inputMode="decimal"
                        required
                        defaultValue={String(m.meta).replace(".", ",")}
                        className={classeCampo}
                      />
                    </label>
                    <label className={rotulo}>
                      Atenção até
                      <input
                        name="limite_atencao"
                        inputMode="decimal"
                        placeholder="opcional"
                        defaultValue={
                          m.limite_atencao === null
                            ? ""
                            : String(m.limite_atencao).replace(".", ",")
                        }
                        className={classeCampo}
                      />
                    </label>
                  </FormAcao>
                  <FormAcao
                    acao={removerMeta}
                    rotulo="Remover"
                    rotuloEnviando="Removendo…"
                    variante="perigo"
                    confirmar={`Remover a meta de “${def.nome}” desde ${formatarMes(m.vigente_desde)}? Os meses dela passam a usar a meta anterior.`}
                  >
                    <input type="hidden" name="id" value={m.id} />
                  </FormAcao>
                </div>
              ))}
            </div>
          </Secao>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------

export function BlocoRegras({ regras }: { regras: RegraAlerta[] }) {
  const porCodigo = new Map(regras.map((r) => [r.regra, r]));
  return (
    <Secao
      titulo="Regras de alerta"
      descricao="Quando cada aviso aparece no Painel do Marketing e com que nível. O limite só existe nas regras que contam algo; as outras comparam com a meta ou com a situação."
    >
      <div className={lista}>
        {(Object.keys(REGRAS) as (keyof typeof REGRAS)[]).map((codigo) => {
          const def = REGRAS[codigo];
          const r = porCodigo.get(codigo);
          if (!r) return null;
          return (
            <FormAcao
              key={codigo}
              acao={salvarRegra}
              className="grid items-end gap-3 py-3 sm:grid-cols-[1fr_8rem_10rem_6rem_auto]"
            >
              <input type="hidden" name="regra" value={codigo} />
              <p className="pb-2 text-sm font-medium">{def.rotulo}</p>
              {def.limite ? (
                <label className={rotulo}>
                  {def.limite === "dias" ? "N (dias)" : "Limite"}
                  <input
                    name="limite"
                    inputMode="decimal"
                    required
                    defaultValue={r.limite ?? ""}
                    className={classeCampo}
                  />
                </label>
              ) : (
                <p className="pb-2 text-xs text-neutral-400">sem limite</p>
              )}
              <label className={rotulo}>
                Nível
                <Selecao
                  name="nivel"
                  obrigatorio
                  valorInicial={r.nivel}
                  opcoes={opcoes(NIVEIS)}
                />
              </label>
              <Marcar nome="ativa" marcado={r.ativa} texto="Ativa" />
            </FormAcao>
          );
        })}
      </div>
    </Secao>
  );
}

// ---------------------------------------------------------------------------

export function BlocoReputacao({
  parametros: p,
  temas,
}: {
  parametros: Parametros;
  temas: Tema[];
}) {
  const proxima = Math.max(0, ...temas.map((t) => t.ordem)) + 1;
  return (
    <>
      <Secao
        titulo="Situação dos locatários"
        descricao="Reclamação é a avaliação com as estrelas marcadas. Na janela de dias, o locatário entra em Atenção a partir do limite de Atenção e em Alerta a partir do limite de Alerta (precisa ser maior). Também entra em Atenção quando a nota média das avaliações novas fica abaixo da nota informada."
      >
        <FormReputacao
          acao={salvarReputacao}
          valores={{
            estrelas_reclamacao: p.estrelas_reclamacao,
            janela_reputacao_dias: p.janela_reputacao_dias,
            reclamacoes_atencao: p.reclamacoes_atencao,
            reclamacoes_alerta: p.reclamacoes_alerta,
            nota_atencao: Number(p.nota_atencao),
          }}
        />
      </Secao>
      <Secao
        titulo="Temas das avaliações"
        descricao="Lista usada para classificar cada avaliação. Tema desativado sai da classificação, sem apagar o que já foi classificado. A ordem é a da tela de Reputação."
      >
        <div className={lista}>
          {temas.map((t) => (
            <FormAcao
              key={t.id}
              acao={salvarTema}
              className="grid items-end gap-3 py-3 sm:grid-cols-[1fr_6rem_6rem_auto]"
            >
              <input type="hidden" name="id" value={t.id} />
              <label className={rotulo}>
                Tema
                <input
                  name="nome"
                  required
                  maxLength={60}
                  defaultValue={t.nome}
                  className={classeCampo}
                />
              </label>
              <label className={rotulo}>
                Ordem
                <input
                  name="ordem"
                  inputMode="numeric"
                  required
                  defaultValue={t.ordem}
                  className={classeCampo}
                />
              </label>
              <Marcar nome="ativo" marcado={t.ativo} texto="Ativo" />
            </FormAcao>
          ))}
        </div>
        <FormAcao
          acao={salvarTema}
          rotulo="Incluir tema"
          rotuloEnviando="Incluindo…"
          className="mt-4 grid items-end gap-3 border-t border-neutral-900/[0.06] pt-4 sm:grid-cols-[1fr_6rem_auto]"
        >
          <input type="hidden" name="ativo" value="on" />
          <label className={rotulo}>
            Novo tema
            <input
              name="nome"
              required
              maxLength={60}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Ordem
            <input
              name="ordem"
              inputMode="numeric"
              required
              defaultValue={proxima}
              className={classeCampo}
            />
          </label>
        </FormAcao>
      </Secao>
    </>
  );
}

// ---------------------------------------------------------------------------

export function BlocoAsana({
  parametros: p,
  projetos,
  tags,
  faltando,
}: {
  parametros: Parametros;
  projetos: string[];
  tags: string[];
  faltando: ConferenciaAsana[];
}) {
  return (
    <Secao
      titulo="Asana"
      descricao="Nomes dos projetos e das tags que o Radar lê. Os nomes mudam no Asana: confira aqui se ainda existem (projeto arquivado conta como não existe)."
    >
      {faltando.length > 0 && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-amber-400/15 px-3 py-2 text-sm text-amber-800"
        >
          Não existe mais no Asana:{" "}
          {faltando.map((f) => `${f.rotulo} “${f.nome}”`).join("; ")}. O Radar
          avisa no topo até corrigir.
        </p>
      )}
      <FormAsana
        acao={salvarAsana}
        projetos={projetos}
        tags={tags}
        valores={{
          asana_projetos_marketing: p.asana_projetos_marketing,
          asana_projeto_calendario: p.asana_projeto_calendario,
          asana_projeto_ronda: p.asana_projeto_ronda,
          asana_tag_locatario: p.asana_tag_locatario,
          asana_tag_terceiro: p.asana_tag_terceiro,
          asana_tag_gratuita: p.asana_tag_gratuita,
          asana_tag_paga: p.asana_tag_paga,
          sinalizacao_antiga_dias: p.sinalizacao_antiga_dias,
        }}
      />
    </Secao>
  );
}

// ---------------------------------------------------------------------------

export function BlocoRonda({ codigos }: { codigos: CodigoRonda[] }) {
  return (
    <Secao
      titulo="Códigos da ronda de ambiência"
      descricao="O código fica no início do nome da tarefa no projeto da ronda (ex.: “S - Placa apagada”). A área diz quem resolve; as do Marketing entram como sinalizações no Radar. Código repetido não salva."
    >
      <div className={lista}>
        {codigos.map((c) => (
          <div key={c.codigo} className="flex flex-wrap items-end gap-3 py-3">
            <FormAcao
              acao={salvarCodigoRonda}
              className="grid flex-1 items-end gap-3 sm:grid-cols-[4rem_1fr_12rem_auto]"
            >
              <input type="hidden" name="codigo" value={c.codigo} />
              <p className="pb-2 font-mono text-sm font-semibold">{c.codigo}</p>
              <label className={rotulo}>
                Descrição
                <input
                  name="descricao"
                  required
                  maxLength={120}
                  defaultValue={c.descricao}
                  className={classeCampo}
                />
              </label>
              <label className={rotulo}>
                Área
                <Selecao
                  name="area"
                  obrigatorio
                  valorInicial={c.area}
                  opcoes={opcoes(AREAS)}
                />
              </label>
            </FormAcao>
            <FormAcao
              acao={removerCodigoRonda}
              rotulo="Remover"
              rotuloEnviando="Removendo…"
              variante="perigo"
              confirmar={`Remover o código “${c.codigo}”? Tarefas da ronda com ele deixam de ser classificadas.`}
            >
              <input type="hidden" name="codigo" value={c.codigo} />
            </FormAcao>
          </div>
        ))}
      </div>
      <FormAcao
        acao={salvarCodigoRonda}
        rotulo="Incluir código"
        rotuloEnviando="Incluindo…"
        className="mt-4 grid items-end gap-3 border-t border-neutral-900/[0.06] pt-4 sm:grid-cols-[6rem_1fr_12rem_auto]"
      >
        <input type="hidden" name="novo" value="on" />
        <label className={rotulo}>
          Código
          <input
            name="codigo"
            required
            maxLength={5}
            pattern="[A-Za-z0-9]{1,5}"
            title="De 1 a 5 letras ou números"
            className={`${classeCampo} font-mono uppercase`}
          />
        </label>
        <label className={rotulo}>
          Descrição
          <input
            name="descricao"
            required
            maxLength={120}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Área
          <Selecao
            name="area"
            obrigatorio
            placeholder="Escolha a área…"
            opcoes={opcoes(AREAS)}
          />
        </label>
      </FormAcao>
    </Secao>
  );
}

// ---------------------------------------------------------------------------

export function BlocoEstacionamento({
  parametros: p,
}: {
  parametros: Parametros;
}) {
  return (
    <Secao
      titulo="Estacionamento"
      descricao="Vagas: base da ocupação na tela Público e visitação. Janela de recorrência: um carro que volta dentro desses dias conta como recorrente."
    >
      <FormAcao
        acao={salvarEstacionamento}
        className="grid items-end gap-3 sm:grid-cols-[10rem_14rem_auto]"
      >
        <label className={rotulo}>
          Quantidade de vagas
          <input
            name="vagas"
            inputMode="numeric"
            required
            defaultValue={p.vagas}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Janela de recorrência (dias)
          <input
            name="janela_recorrencia_dias"
            inputMode="numeric"
            required
            defaultValue={p.janela_recorrencia_dias}
            className={classeCampo}
          />
        </label>
      </FormAcao>
    </Secao>
  );
}
