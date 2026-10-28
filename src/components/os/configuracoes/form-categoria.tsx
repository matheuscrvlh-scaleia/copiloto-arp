"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Secao } from "@/components/admin/ui";
import { classeCampo } from "@/components/estilos";
import { type Acao, EnvioDaAcao, FormAcao } from "@/components/form-acao";
import { IconeTipo } from "@/components/os/selos";
import { Selecao } from "@/components/selecao";
import { chaveUnica, mover } from "@/lib/os/catalogo";
import { lerCamposExtras, lerChecklist } from "@/lib/os/chamado";
import { ROTAS_OS } from "@/lib/os/rotas";
import {
  PRIORIDADES,
  TIPOS,
  TIPOS_CAMPO,
  type TipoCampo,
  type TipoChamado,
  UNIDADES_PRAZO,
} from "@/lib/os/rotulos";
import type { Database } from "@/lib/supabase/database.types";
import { EscolhaCor, EscolhaIcone } from "./escolhas";
import { BotaoAdicionar, ControlesDoItem, useIds } from "./lista-editavel";

export type CategoriaDoForm = Omit<
  Database["os"]["Tables"]["categorias"]["Row"],
  "id" | "criado_em" | "atualizado_em" | "ordem"
> & { id: string | null };

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const ALINHADO = "md:pl-[17rem]";

/** O que cada tipo faz, para quem configura escolher sem dúvida. */
const AJUDA_TIPO: Record<TipoChamado, string> = {
  tarefa: "Algo a fazer, com responsável e prazo.",
  solicitacao: "Pedido a outro setor, que confirma quando fica pronto.",
  os: "Serviço de manutenção: tempo, materiais, custo e assinatura.",
  aviso: "Comunicado a vários setores; cada um dá ciência.",
};

interface CampoEmEdicao {
  id: string;
  /** Campo já gravado mantém a chave (os chamados guardam o valor por ela). */
  chave: string | null;
  rotulo: string;
  tipo: TipoCampo;
  opcoes: string;
  obrigatorio: boolean;
}

interface ItemEmEdicao {
  id: string;
  texto: string;
  obrigatorio: boolean;
}

export function FormCategoria({
  acao,
  categoria: c,
  setores,
  raizes,
  temFilhas,
  pessoas,
  agendas,
}: {
  /** salvarCategoria (Server Action da página). */
  acao: Acao;
  categoria: CategoriaDoForm;
  setores: { id: string; nome: string; cor: string }[];
  /** Categorias principais (sem esta), para escolher o pai. */
  raizes: { id: string; nome: string; setor_id: string }[];
  temFilhas: boolean;
  pessoas: { id: string; nome: string; setores: string[] }[];
  agendas: { id: string; nome: string; ativo: boolean }[];
}) {
  const novoId = useIds();
  const [setorId, setSetorId] = useState(c.setor_id);
  const [paiId, setPaiId] = useState(c.pai_id ?? "");
  const [cor, setCor] = useState(c.cor ?? "");
  const [tipo, setTipo] = useState<TipoChamado>(c.tipo_padrao);
  const [noPortal, setNoPortal] = useState(c.no_portal);
  const [campos, setCampos] = useState<CampoEmEdicao[]>(() =>
    lerCamposExtras(c.campos).map((x) => ({
      id: novoId(),
      chave: x.chave,
      rotulo: x.rotulo,
      tipo: x.tipo,
      opcoes: (x.opcoes ?? []).join("\n"),
      obrigatorio: x.obrigatorio === true,
    })),
  );
  const [itens, setItens] = useState<ItemEmEdicao[]>(() =>
    lerChecklist(c.checklist).map((i) => ({
      id: novoId(),
      texto: i.texto,
      obrigatorio: i.obrigatorio,
    })),
  );

  const setor = setores.find((s) => s.id === setorId);
  const corDaPrevia = cor || setor?.cor || "#525252";
  const paisDoSetor = raizes.filter((r) => r.setor_id === setorId);
  const doSetor = pessoas.filter((p) => p.setores.includes(setorId));
  const outras = pessoas.filter((p) => !p.setores.includes(setorId));

  // Chave que cada campo vai ter (a mesma regra do servidor).
  const usadas = new Set<string>();
  const chaves = campos.map((x) => {
    const k =
      x.chave && !usadas.has(x.chave)
        ? x.chave
        : chaveUnica(x.rotulo || "campo", usadas);
    usadas.add(k);
    return k;
  });

  const camposJson = JSON.stringify(
    campos.map((x) => ({
      chave: x.chave,
      rotulo: x.rotulo,
      tipo: x.tipo,
      opcoes: x.tipo === "lista" ? x.opcoes.split("\n") : undefined,
      obrigatorio: x.obrigatorio,
    })),
  );
  const checklistJson = JSON.stringify(
    itens.map((i) => ({ texto: i.texto, obrigatorio: i.obrigatorio })),
  );

  const mudarCampo = (id: string, m: Partial<CampoEmEdicao>) =>
    setCampos((l) => l.map((x) => (x.id === id ? { ...x, ...m } : x)));

  return (
    <FormAcao
      acao={acao}
      botaoNoFim={false}
      rotulo={c.id ? "Salvar categoria" : "Criar categoria"}
      className="vidro rounded-[1.75rem] p-5 md:p-8"
    >
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <input type="hidden" name="campos" value={camposJson} />
      <input type="hidden" name="checklist" value={checklistJson} />

      <Secao
        titulo="Identificação"
        descricao="Como a categoria aparece na hora de abrir um chamado, nas listas e nos painéis."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={rotulo}>
            Nome
            <input
              name="nome"
              required
              maxLength={80}
              defaultValue={c.nome}
              placeholder="ex.: Elétrica"
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Setor dono
            <Selecao
              name="setor_id"
              obrigatorio
              valor={setorId}
              aoMudar={(v) => {
                setSetorId(v);
                setPaiId("");
              }}
              opcoes={setores.map((s) => ({ valor: s.id, rotulo: s.nome }))}
            />
          </label>
          <label className={rotulo}>
            Subcategoria de
            <Selecao
              name="pai_id"
              valor={paiId}
              aoMudar={setPaiId}
              desabilitada={temFilhas}
              opcoes={[
                { valor: "", rotulo: "Nenhuma (categoria principal)" },
                ...paisDoSetor.map((r) => ({ valor: r.id, rotulo: r.nome })),
              ]}
            />
            <span className="font-normal text-neutral-500">
              {temFilhas
                ? "Tem subcategorias, então fica como principal (um nível só)."
                : "Opcional, um nível só (ex.: Estrutura › Telhado)."}
            </span>
          </label>
          <label className="flex items-center gap-2 self-center text-sm">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={c.ativo}
              className="size-4 accent-neutral-900"
            />
            Ativa (aparece para abrir chamado)
          </label>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-600">Ícone</span>
          <EscolhaIcone name="icone" valorInicial={c.icone} cor={corDaPrevia} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-600">Cor</span>
          <EscolhaCor
            name="cor"
            valorInicial={c.cor ?? ""}
            aoMudar={setCor}
            opcional
          />
        </div>
      </Secao>

      <Secao
        titulo="Comportamento"
        descricao="O que o chamado já traz preenchido. Quem abre pode mudar o que tiver permissão."
      >
        <fieldset className="m-0 grid grid-cols-1 gap-2 p-0 sm:grid-cols-2">
          <legend className="mb-1.5 text-xs font-medium text-neutral-600">
            Tipo padrão
          </legend>
          {(Object.keys(TIPOS) as TipoChamado[]).map((t) => (
            <label
              key={t}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 bg-white/70 p-3 transition hover:border-neutral-400 has-[:checked]:border-neutral-900 has-[:checked]:bg-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neutral-900/20"
            >
              <input
                type="radio"
                name="tipo_padrao"
                value={t}
                checked={tipo === t}
                onChange={() => setTipo(t)}
                className="sr-only"
              />
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-900/[0.06] text-neutral-700">
                <IconeTipo tipo={t} />
              </span>
              <span>
                <span className="block text-sm font-medium">{TIPOS[t]}</span>
                <span className="block text-xs text-neutral-500">
                  {AJUDA_TIPO[t]}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={rotulo}>
            Responsável padrão
            <Selecao
              name="responsavel_padrao_id"
              valorInicial={c.responsavel_padrao_id ?? ""}
              opcoes={[
                {
                  valor: "",
                  rotulo: "Fila do setor",
                  descricao: "Quem for do setor assume",
                },
                ...doSetor.map((p) => ({
                  valor: p.id,
                  rotulo: p.nome,
                  descricao: setor ? `De ${setor.nome}` : undefined,
                })),
                ...outras.map((p) => ({
                  valor: p.id,
                  rotulo: p.nome,
                  descricao: "De outro setor",
                })),
              ]}
            />
          </label>
          <label className={rotulo}>
            Prioridade padrão
            <Selecao
              name="prioridade_padrao"
              obrigatorio
              valorInicial={c.prioridade_padrao}
              opcoes={Object.entries(PRIORIDADES).map(([valor, r]) => ({
                valor,
                rotulo: r,
              }))}
            />
          </label>
          <div className={rotulo}>
            <span id="rotulo-prazo">Prazo padrão</span>
            <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
              <input
                name="prazo_valor"
                type="number"
                min={1}
                max={9999}
                inputMode="numeric"
                defaultValue={c.prazo_valor ?? ""}
                placeholder="sem"
                aria-labelledby="rotulo-prazo"
                className={classeCampo}
              />
              <Selecao
                name="prazo_unidade"
                rotulo="Unidade do prazo"
                valorInicial={c.prazo_unidade}
                opcoes={Object.entries(UNIDADES_PRAZO).map(([valor, r]) => ({
                  valor,
                  rotulo: r,
                }))}
              />
            </div>
            <span className="font-normal text-neutral-500">
              Vazio: sem prazo. Dias úteis vencem no fim do expediente.
            </span>
          </div>
          <label className={rotulo}>
            Primeira resposta em até (horas)
            <input
              name="resposta_horas"
              type="number"
              min={1}
              max={9999}
              inputMode="numeric"
              defaultValue={c.resposta_horas ?? ""}
              placeholder="sem meta"
              className={classeCampo}
            />
            <span className="font-normal text-neutral-500">
              SLA de primeira resposta, em horas corridas.
            </span>
          </label>
        </div>
      </Secao>

      <Secao
        titulo="Confirmação"
        descricao="Quando pronto, o chamado fica Concluído até quem pediu confirmar (ou o aceite automático)."
      >
        {tipo === "aviso" ? (
          <p className="text-sm text-neutral-500">
            Aviso não pede confirmação: fecha quando todos derem ciência.
          </p>
        ) : (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="precisa_confirmacao"
              defaultChecked={c.precisa_confirmacao}
              className="mt-0.5 size-4 accent-neutral-900"
            />
            <span>
              Precisa da confirmação de quem pediu
              <span className="block text-xs text-neutral-500">
                Desmarcado, o chamado fecha direto ao concluir.
              </span>
            </span>
          </label>
        )}
      </Secao>

      <Secao
        titulo="Recursos"
        descricao="O que o chamado desta categoria pode usar. Só aparece na tela o que estiver ligado."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Marca
            name="registrar_tempo"
            inicial={c.registrar_tempo}
            titulo="Registrar tempo"
            ajuda="Sessões de trabalho e técnicos (custo da mão de obra)."
          />
          <Marca
            name="vincular_ativo"
            inicial={c.vincular_ativo}
            titulo="Vincular ativo"
            ajuda="Liga o chamado a um equipamento (histórico e sinal de troca)."
          />
          <Marca
            name="vincular_loja"
            inicial={c.vincular_loja}
            titulo="Vincular contrato / loja"
            ajuda="Liga o chamado ao contrato de locação."
          />
          <Marca
            name="preventiva"
            inicial={c.preventiva}
            titulo="Preventiva"
            ajuda="Não conta como corretiva no sinal de troca do ativo."
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={rotulo}>
            Reservar horário
            <Selecao
              name="agenda_id"
              valorInicial={c.agenda_id ?? ""}
              opcoes={[
                { valor: "", rotulo: "Não reserva horário" },
                ...agendas.map((a) => ({
                  valor: a.id,
                  rotulo: a.nome,
                  descricao: a.ativo ? undefined : "Agenda inativa",
                })),
              ]}
            />
            <span className="font-normal text-neutral-500">
              Horários e limite de cada agenda ficam em{" "}
              <Link href={ROTAS_OS.portal} className="underline">
                Portal lojista
              </Link>
              .
            </span>
          </label>
          <label className={rotulo}>
            Retorno do terceirizado (dias úteis)
            <input
              name="prazo_terceirizado_dias"
              type="number"
              min={1}
              max={365}
              inputMode="numeric"
              defaultValue={c.prazo_terceirizado_dias ?? ""}
              placeholder="padrão dos parâmetros"
              className={classeCampo}
            />
            <span className="font-normal text-neutral-500">
              Ex.: laudo do projeto de cliente em 7 dias úteis.
            </span>
          </label>
        </div>
      </Secao>

      <Secao
        titulo="Campos extras"
        descricao="Perguntas a mais na abertura (placa, quantidade, tipo de projeto…). Foto e anexo obrigatórios pedem o arquivo."
      >
        {campos.length === 0 && (
          <p className="text-sm text-neutral-500">Nenhum campo extra.</p>
        )}
        <ol className="flex flex-col gap-3">
          {campos.map((x, i) => (
            <li
              key={x.id}
              className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white/70 p-3"
            >
              <div className="flex items-start gap-2">
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <label className={rotulo}>
                    Pergunta
                    <input
                      value={x.rotulo}
                      onChange={(e) =>
                        mudarCampo(x.id, { rotulo: e.target.value })
                      }
                      maxLength={80}
                      placeholder="ex.: Placa do veículo"
                      className={classeCampo}
                    />
                  </label>
                  <label className={rotulo}>
                    Tipo
                    <Selecao
                      valor={x.tipo}
                      aoMudar={(v) =>
                        mudarCampo(x.id, { tipo: v as TipoCampo })
                      }
                      opcoes={Object.entries(TIPOS_CAMPO).map(([valor, r]) => ({
                        valor,
                        rotulo:
                          valor === "foto" || valor === "anexo"
                            ? `${r} (arquivo)`
                            : r,
                      }))}
                    />
                  </label>
                </div>
                <ControlesDoItem
                  indice={i}
                  total={campos.length}
                  nome={x.rotulo || `campo ${i + 1}`}
                  aoMover={(d) => setCampos((l) => mover(l, i, d))}
                  aoRemover={() =>
                    setCampos((l) => l.filter((y) => y.id !== x.id))
                  }
                />
              </div>
              {x.tipo === "lista" && (
                <label className={rotulo}>
                  Opções (uma por linha)
                  <textarea
                    value={x.opcoes}
                    onChange={(e) =>
                      mudarCampo(x.id, { opcoes: e.target.value })
                    }
                    rows={3}
                    placeholder={"Layout\nElétrico\nHidráulico"}
                    className={classeCampo}
                  />
                </label>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={x.obrigatorio}
                    onChange={(e) =>
                      mudarCampo(x.id, { obrigatorio: e.target.checked })
                    }
                    className="size-4 accent-neutral-900"
                  />
                  Obrigatório
                </label>
                <span className="font-mono text-[11px] text-neutral-400">
                  chave: {chaves[i]}
                </span>
              </div>
            </li>
          ))}
        </ol>
        <BotaoAdicionar
          onClick={() =>
            setCampos((l) => [
              ...l,
              {
                id: novoId(),
                chave: null,
                rotulo: "",
                tipo: "texto",
                opcoes: "",
                obrigatorio: false,
              },
            ])
          }
        >
          Adicionar campo
        </BotaoAdicionar>
        {campos.some((x) => x.chave) && (
          <p className="flex items-start gap-1.5 text-xs text-neutral-500">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Mudar a pergunta de um campo existente mantém a chave: as respostas
            dos chamados antigos continuam ligadas a ele.
          </p>
        )}
      </Secao>

      <Secao
        titulo="Checklist padrão"
        descricao="Copiado para cada chamado novo. Item obrigatório pendente impede concluir."
      >
        {itens.length === 0 && (
          <p className="text-sm text-neutral-500">Sem checklist.</p>
        )}
        <ol className="flex flex-col gap-2">
          {itens.map((item, i) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-2 sm:flex-nowrap"
            >
              <input
                value={item.texto}
                onChange={(e) =>
                  setItens((l) =>
                    l.map((y) =>
                      y.id === item.id ? { ...y, texto: e.target.value } : y,
                    ),
                  )
                }
                maxLength={200}
                aria-label={`Item ${i + 1}`}
                placeholder="ex.: Foto do depois"
                className={`${classeCampo} min-w-0 flex-1 basis-full sm:basis-auto`}
              />
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-600">
                <input
                  type="checkbox"
                  checked={item.obrigatorio}
                  onChange={(e) =>
                    setItens((l) =>
                      l.map((y) =>
                        y.id === item.id
                          ? { ...y, obrigatorio: e.target.checked }
                          : y,
                      ),
                    )
                  }
                  className="size-4 accent-neutral-900"
                />
                Obrigatório
              </label>
              <ControlesDoItem
                indice={i}
                total={itens.length}
                nome={item.texto || `item ${i + 1}`}
                aoMover={(d) => setItens((l) => mover(l, i, d))}
                aoRemover={() =>
                  setItens((l) => l.filter((y) => y.id !== item.id))
                }
              />
            </li>
          ))}
        </ol>
        <BotaoAdicionar
          onClick={() =>
            setItens((l) => [
              ...l,
              { id: novoId(), texto: "", obrigatorio: false },
            ])
          }
        >
          Adicionar item
        </BotaoAdicionar>
      </Secao>

      <Secao
        titulo="Portal do lojista"
        descricao="O lojista abre pedidos pelo link da loja, sem login. Só aparecem as categorias marcadas."
      >
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="no_portal"
            checked={noPortal}
            onChange={(e) => setNoPortal(e.target.checked)}
            className="mt-0.5 size-4 accent-neutral-900"
          />
          Aparece no portal do lojista
        </label>
        <label className={`${rotulo} ${noPortal ? "" : "hidden"}`}>
          Orientação ao lojista
          <textarea
            name="orientacao_portal"
            rows={3}
            maxLength={1000}
            defaultValue={c.orientacao_portal ?? ""}
            placeholder="ex.: Descreva o problema e, se puder, mande fotos."
            className={classeCampo}
          />
        </label>
      </Secao>

      <div className={`border-t border-neutral-200/70 pt-6 ${ALINHADO}`}>
        <EnvioDaAcao />
      </div>
    </FormAcao>
  );
}

function Marca({
  name,
  inicial,
  titulo,
  ajuda,
}: {
  name: string;
  inicial: boolean;
  titulo: string;
  ajuda: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 bg-white/70 p-3 transition hover:border-neutral-400 has-[:checked]:border-neutral-900 has-[:checked]:bg-white">
      <input
        type="checkbox"
        name={name}
        defaultChecked={inicial}
        className="mt-0.5 size-4 shrink-0 accent-neutral-900"
      />
      <span>
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="block text-xs text-neutral-500">{ajuda}</span>
      </span>
    </label>
  );
}
