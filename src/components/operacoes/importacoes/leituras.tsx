"use client";

import { Camera, ImageOff, Pencil, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { CampoTexto, Painel } from "@/components/operacoes/painel-lateral";
import { formatarData, formatarMoeda } from "@/lib/formato";
import {
  formatarM3,
  formatarVisor,
  ROTULO_TIPO,
  TIPOS_AGUA,
} from "@/lib/operacoes/agua-formato";
import {
  excluirLeituraAgua,
  salvarLeituraAgua,
  tirarFotoLeitura,
  trocarFotoLeitura,
} from "@/server/operacoes/acoes/importacoes-dados";
import type { LeituraImportada } from "@/server/operacoes/importacoes-dados";
import { paraCampo } from "../agua/campos-conta";

// Leituras que a importação da água gravou, convertidas em dado: busca,
// filtro por bloco, a foto do visor ao lado e, para quem importa a água,
// corrigir (painel lateral), trocar a foto ou excluir a leitura. Só a
// leitura que vale se corrige (prévia, mês desfeito ou substituído: só ver).

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function LeiturasImportadas({
  leituras,
  podeEditar,
  comValores,
}: {
  leituras: LeituraImportada[];
  podeEditar: boolean;
  comValores: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [bloco, setBloco] = useState("");
  const [soSemFoto, setSoSemFoto] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const blocos = useMemo(
    () => [...new Set(leituras.map((l) => l.bloco))].sort(),
    [leituras],
  );
  const termo = sem(busca.trim());
  const visiveis = leituras.filter(
    (l) =>
      (!bloco || l.bloco === bloco) &&
      (!soSemFoto || !l.foto) &&
      (!termo || sem(`${l.hidrometro} ${l.sala} ${l.cliente}`).includes(termo)),
  );
  const atual = leituras.find((l) => l.id === aberta) ?? null;
  const semFoto = leituras.filter((l) => !l.foto).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium text-neutral-600">
          Buscar
          <span className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
              aria-hidden
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Hidrômetro, sala ou cliente"
              className={`${classeCampo} pl-9`}
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Bloco
          <select
            value={bloco}
            onChange={(e) => setBloco(e.target.value)}
            className={classeCampo}
          >
            <option value="">Todos</option>
            {blocos.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={soSemFoto}
            onChange={(e) => setSoSemFoto(e.target.checked)}
            className="size-4"
          />
          Só sem foto ({semFoto})
        </label>
      </div>
      <p className="text-xs text-neutral-500" aria-live="polite">
        {visiveis.length === leituras.length
          ? `${leituras.length} leituras`
          : `${visiveis.length} de ${leituras.length} leituras`}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-neutral-900/[0.06]">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-neutral-900/[0.03] text-left text-xs text-neutral-600">
            <tr>
              <th className="px-3 py-2 font-medium">Foto</th>
              <th className="px-3 py-2 font-medium">Bloco · sala</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Hidrômetro</th>
              <th className="px-3 py-2 text-right font-medium">
                Anterior → atual
              </th>
              <th className="px-3 py-2 text-right font-medium">Consumo</th>
              <th className="px-3 py-2 text-right font-medium">Faturado</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              {comValores && (
                <th className="px-3 py-2 text-right font-medium">Valor</th>
              )}
              {podeEditar && (
                <th className="px-3 py-2">
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900/[0.06]">
            {visiveis.map((l) => (
              <tr key={l.id} className="align-middle">
                <td className="px-3 py-2">
                  <Miniatura l={l} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {l.bloco} · {l.sala || "—"}
                </td>
                <td className="max-w-56 truncate px-3 py-2" title={l.cliente}>
                  {l.cliente || "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{l.hidrometro}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                  {formatarVisor(l.leituraAnterior)} →{" "}
                  {formatarVisor(l.leituraAtual)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatarM3(l.consumo)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatarM3(l.volumeFaturado)}
                </td>
                <td className="px-3 py-2">{ROTULO_TIPO[l.tipo]}</td>
                {comValores && (
                  <td className="px-3 py-2 text-right tabular-nums">
                    {l.valor === null ? "—" : formatarMoeda(l.valor)}
                  </td>
                )}
                {podeEditar && (
                  <td className="px-3 py-2">
                    {l.vigente && (
                      <button
                        type="button"
                        onClick={() => setAberta(l.id)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-900/[0.06]"
                        aria-label={`Corrigir a leitura do hidrômetro ${l.hidrometro}`}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Corrigir
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {visiveis.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-8 text-center text-sm text-neutral-500"
                >
                  Nenhuma leitura com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {atual && (
        <Painel
          titulo={`Hidrômetro ${atual.hidrometro}`}
          aoFechar={() => setAberta(null)}
        >
          <Edicao
            key={atual.id}
            l={atual}
            comValores={comValores}
            aoExcluir={() => setAberta(null)}
          />
        </Painel>
      )}
    </div>
  );
}

function Miniatura({ l }: { l: LeituraImportada }) {
  if (!l.fotoUrl)
    return (
      <span
        className="grid size-10 place-items-center rounded-lg bg-neutral-900/[0.04] text-neutral-400"
        title="Sem foto"
      >
        <ImageOff className="size-4" aria-hidden />
        <span className="sr-only">Sem foto</span>
      </span>
    );
  return (
    <a
      href={l.fotoUrl}
      target="_blank"
      rel="noreferrer"
      title="Abrir a foto do visor"
    >
      {/* biome-ignore lint/performance/noImgElement: arquivo privado com link temporário */}
      <img
        src={l.fotoUrl}
        alt={`Visor do hidrômetro ${l.hidrometro}`}
        loading="lazy"
        className="size-10 rounded-lg border border-neutral-900/[0.06] object-cover"
      />
    </a>
  );
}

function Edicao({
  l,
  comValores,
  aoExcluir,
}: {
  l: LeituraImportada;
  comValores: boolean;
  aoExcluir: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Foto do visor</h3>
        {l.fotoUrl ? (
          <a href={l.fotoUrl} target="_blank" rel="noreferrer">
            {/* biome-ignore lint/performance/noImgElement: arquivo privado com link temporário */}
            <img
              src={l.fotoUrl}
              alt={`Visor do hidrômetro ${l.hidrometro}`}
              className="max-h-72 w-full rounded-2xl border border-neutral-900/[0.06] bg-white object-contain"
            />
          </a>
        ) : (
          <p className="rounded-2xl bg-neutral-900/[0.03] px-4 py-6 text-center text-sm text-neutral-500">
            Esta leitura está sem foto.
          </p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <FormAcao
            acao={trocarFotoLeitura}
            rotulo={l.foto ? "Trocar a foto" : "Pôr a foto"}
            rotuloEnviando="Enviando…"
            variante="secundario"
            className="flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="id" value={l.id} />
            <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
              <span className="inline-flex items-center gap-1.5">
                <Camera className="size-3.5" aria-hidden />
                Nova foto (.jpg, .png, .webp)
              </span>
              <input
                name="foto"
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                required
                className="text-sm"
              />
            </label>
          </FormAcao>
          {l.foto && (
            <AcaoRapida
              acao={tirarFotoLeitura}
              campos={{ id: l.id }}
              rotulo="Tirar a foto"
              icone={<ImageOff className="size-4" aria-hidden />}
              confirmar="Tirar a foto desta leitura? O arquivo continua guardado na importação."
              comTexto
            />
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Dados da leitura</h3>
        {l.linhaArquivo !== null && (
          <p className="text-xs text-neutral-500">
            Veio da linha {l.linhaArquivo} do arquivo.
          </p>
        )}
        <FormAcao acao={salvarLeituraAgua} rotulo="Salvar correção">
          <input type="hidden" name="id" value={l.id} />
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CampoTexto
              rotulo="Bloco"
              nome="bloco"
              valor={l.bloco}
              obrigatorio
            />
            <CampoTexto rotulo="Sala" nome="sala" valor={l.sala} />
            <CampoTexto rotulo="Cliente" nome="cliente" valor={l.cliente} />
            <CampoTexto
              rotulo="Hidrômetro"
              nome="hidrometro"
              valor={l.hidrometro}
              obrigatorio
            />
            <CampoTexto
              rotulo="Data anterior"
              nome="data_anterior"
              tipo="date"
              valor={l.dataAnterior ?? ""}
            />
            <CampoTexto
              rotulo="Data atual"
              nome="data_atual"
              tipo="date"
              valor={l.dataAtual ?? ""}
            />
            <CampoTexto
              rotulo="Leitura anterior (m³)"
              nome="leitura_anterior"
              valor={paraCampo(l.leituraAnterior)}
              numerico
            />
            <CampoTexto
              rotulo="Leitura atual (m³)"
              nome="leitura_atual"
              valor={paraCampo(l.leituraAtual)}
              numerico
            />
            <CampoTexto
              rotulo="Dias"
              nome="dias"
              valor={l.dias === null ? "" : String(l.dias)}
              numerico
            />
            <CampoTexto
              rotulo="Consumo (m³)"
              nome="consumo"
              valor={paraCampo(l.consumo)}
              numerico
              obrigatorio
            />
            <CampoTexto
              rotulo="Volume faturado (m³)"
              nome="volume_faturado"
              valor={paraCampo(l.volumeFaturado)}
              numerico
              obrigatorio
            />
            <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
              Tipo de faturamento
              <select name="tipo" defaultValue={l.tipo} className={classeCampo}>
                {TIPOS_AGUA.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO[t]}
                  </option>
                ))}
              </select>
            </label>
            {comValores && (
              <CampoTexto
                rotulo="Valor (R$)"
                nome="valor"
                valor={paraCampo(l.valor, 2)}
                numerico
              />
            )}
          </div>
        </FormAcao>
        {l.dataAtual && (
          <p className="text-xs text-neutral-500">
            Leitura de {formatarData(l.dataAtual)}. A correção fica no histórico
            do sistema com o valor de antes.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-neutral-900/[0.06] pt-4">
        <h3 className="text-sm font-semibold text-red-800">
          Excluir a leitura
        </h3>
        <p className="text-xs text-neutral-500">
          Tira esta leitura do mês (extrato, painel e totais). Para refazer o
          mês inteiro, use o Desfazer da importação.
        </p>
        <div>
          <ExcluirLeitura l={l} aoExcluir={aoExcluir} />
        </div>
      </section>
    </div>
  );
}

function ExcluirLeitura({
  l,
  aoExcluir,
}: {
  l: LeituraImportada;
  aoExcluir: () => void;
}) {
  return (
    <FormAcao
      acao={excluirLeituraAgua}
      rotulo="Excluir leitura"
      rotuloEnviando="Excluindo…"
      variante="perigo"
      confirmar={`Excluir a leitura do hidrômetro ${l.hidrometro} (bloco ${l.bloco}, sala ${l.sala || "—"})? Fica registrada no histórico.`}
      aoConcluir={aoExcluir}
    >
      <input type="hidden" name="id" value={l.id} />
    </FormAcao>
  );
}
