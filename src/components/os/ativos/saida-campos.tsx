"use client";

import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { type Opcao, Selecao } from "@/components/selecao";
import { ehVenda, LIMITE_ANEXOS } from "@/lib/os/saidas";

// Campos do "Registrar saída" (dentro da Janela): tipo, data, quantidade,
// valor (obrigatório na venda), recebimento, destinatário, responsável,
// motivo, nota fiscal e anexos. Com `sobra`, pede também o que está saindo
// (material sem cadastro anterior), que vira um ativo já baixado.

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const ajuda = "font-normal text-neutral-500";
const grade = "grid grid-cols-1 gap-3 sm:grid-cols-2";

export function CamposDaSaida({
  ativoId,
  tipos,
  formas,
  pessoas,
  hoje,
  responsavelPadrao,
  sobra,
}: {
  /** Ativo da ficha; sem ele, é a saída de uma sobra sem cadastro. */
  ativoId?: string;
  tipos: string[];
  formas: string[];
  pessoas: Opcao[];
  hoje: string;
  responsavelPadrao?: string;
  sobra?: { categorias: Opcao[] };
}) {
  const [tipo, setTipo] = useState(tipos[0] ?? "");
  const [nf, setNf] = useState(false);
  const venda = ehVenda(tipo);

  return (
    <>
      {ativoId && <input type="hidden" name="ativo_id" value={ativoId} />}
      {sobra && (
        <fieldset className="m-0 flex flex-col gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/50 p-3">
          <legend className="px-1 text-xs font-semibold text-neutral-700">
            O que está saindo
          </legend>
          <label className={rotulo}>
            Descrição
            <input
              name="nome"
              required
              minLength={2}
              maxLength={200}
              placeholder="Ex.: telhas de amianto da obra do Bloco 05"
              className={classeCampo}
            />
          </label>
          <div className={grade}>
            <div className={rotulo}>
              <span>Categoria</span>
              <Selecao
                name="categoria_id"
                rotulo="Categoria"
                opcoes={[
                  { valor: "", rotulo: "Sem categoria" },
                  ...sobra.categorias,
                ]}
              />
            </div>
            <label className={rotulo}>
              Bloco
              <input name="bloco" maxLength={80} className={classeCampo} />
            </label>
          </div>
          <label className={rotulo}>
            Local
            <input
              name="area"
              maxLength={200}
              placeholder="Ex.: canteiro de obras"
              className={classeCampo}
            />
          </label>
        </fieldset>
      )}

      <div className={grade}>
        <div className={rotulo}>
          <span>Tipo de saída</span>
          <Selecao
            name="tipo"
            rotulo="Tipo de saída"
            obrigatorio
            valor={tipo}
            aoMudar={setTipo}
            opcoes={tipos.map((t) => ({ valor: t, rotulo: t }))}
          />
        </div>
        <label className={rotulo}>
          Data
          <input
            type="date"
            name="data"
            required
            defaultValue={hoje}
            max={hoje}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Quantidade
          <input
            name="quantidade"
            maxLength={60}
            placeholder="Ex.: 40 telhas"
            className={classeCampo}
          />
          <span className={ajuda}>Para itens em lote.</span>
        </label>
        <label className={rotulo}>
          Valor (R$){venda ? " *" : ""}
          <input
            name="valor"
            inputMode="decimal"
            required={venda}
            placeholder={venda ? "Ex.: 150,00 (pode ser 0)" : "Opcional"}
            className={classeCampo}
          />
          {venda && (
            <span className={ajuda}>
              Obrigatório na venda; pode ser zero ou simbólico.
            </span>
          )}
        </label>
        <div className={rotulo}>
          <span>Forma de recebimento</span>
          <Selecao
            name="forma"
            rotulo="Forma de recebimento"
            opcoes={[
              { valor: "", rotulo: "Não se aplica" },
              ...formas.map((f) => ({ valor: f, rotulo: f })),
            ]}
          />
        </div>
        <label className={rotulo}>
          Quem recebeu o valor
          <input name="recebido_por" maxLength={120} className={classeCampo} />
        </label>
        <label className={rotulo}>
          Destinatário (nome)
          <input
            name="destinatario"
            maxLength={200}
            placeholder="Quem comprou ou recebeu"
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          CPF ou CNPJ do destinatário
          <input
            name="documento"
            inputMode="numeric"
            maxLength={18}
            placeholder="Opcional"
            className={classeCampo}
          />
        </label>
      </div>

      <div className={rotulo}>
        <span>Responsável pela saída</span>
        <Selecao
          name="responsavel_id"
          rotulo="Responsável pela saída"
          valorInicial={responsavelPadrao ?? ""}
          opcoes={[{ valor: "", rotulo: "Sem responsável" }, ...pessoas]}
        />
      </div>
      <label className={rotulo}>
        Motivo
        <textarea
          name="motivo"
          rows={2}
          maxLength={500}
          placeholder="Ex.: sobra da reforma; não tem mais uso."
          className={classeCampo}
        />
      </label>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="text-xs font-medium text-neutral-600">
          Tem nota fiscal?
        </legend>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="nf"
              value="nao"
              checked={!nf}
              onChange={() => setNf(false)}
            />
            Não
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="nf"
              value="sim"
              checked={nf}
              onChange={() => setNf(true)}
            />
            Sim
          </label>
          {nf && (
            <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium text-neutral-600">
              Número da nota
              <input
                name="nf_numero"
                required
                maxLength={60}
                className={classeCampo}
              />
            </label>
          )}
        </div>
      </fieldset>

      <label className={rotulo}>
        Anexos (fotos, recibo, termo de doação)
        <input
          type="file"
          name="anexos"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="text-sm text-neutral-700 file:mr-3 file:rounded-full file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
        />
        <span className={ajuda}>
          Até {LIMITE_ANEXOS} arquivos, 4 MB cada (JPG, PNG, WebP ou PDF).
        </span>
      </label>
      <label className={rotulo}>
        Observações
        <textarea
          name="observacoes"
          rows={2}
          maxLength={2000}
          className={classeCampo}
        />
      </label>
    </>
  );
}
