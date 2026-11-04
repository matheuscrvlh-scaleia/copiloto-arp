"use client";

import { X } from "lucide-react";
import { Selecao } from "@/components/selecao";
import {
  type DadosContrato,
  enderecoPadrao,
  imovelDosLucs,
  type ParametrosContrato,
} from "@/lib/comercial/contrato";
import { idCampo } from "@/lib/comercial/contrato-revisao";
import { areaPorExtenso } from "@/lib/comercial/extenso";
import { formatarNumero } from "@/lib/formato";
import type { LucParaContrato } from "@/server/comercial/contratos";
import {
  Aviso,
  Bloco,
  BOTAO_SEC,
  CamposEndereco,
  Grade,
  Numero,
  Texto,
} from "./campos";

type Imovel = DadosContrato["imovel"];

export function EtapaImovel({
  valor,
  aoMudar,
  lucs,
  parametros,
}: {
  valor: Imovel;
  aoMudar: (v: Imovel) => void;
  lucs: LucParaContrato[];
  parametros: ParametrosContrato;
}) {
  const up = (m: Partial<Imovel>) => aoMudar({ ...valor, ...m });
  const doEnet = new Map(lucs.map((l) => [l.numero, l]));
  const escolhidos = valor.lucs
    .map((n) => doEnet.get(n))
    .filter((l): l is LucParaContrato => Boolean(l));

  const definirLucs = (lista: string[]) =>
    aoMudar(imovelDosLucs(valor, lista, doEnet));

  const areaCorrigida =
    valor.area !== null &&
    valor.area_enet !== null &&
    valor.area !== valor.area_enet;

  return (
    <>
      <Bloco
        titulo="Identificação do imóvel"
        dica="O LUC permanece como identificador interno do sistema e não precisa aparecer no contrato."
      >
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
            LUC(s) <span className="text-red-700">*</span>
            <span className="rounded-full bg-marca/30 px-1.5 py-px text-[10px] font-semibold text-neutral-800">
              novo: mais de um
            </span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {escolhidos.map((l) => (
              <span
                key={l.numero}
                className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 py-1 pr-1.5 pl-3 text-xs font-medium text-white"
              >
                <span className="font-mono">{l.numero}</span>
                <span className="text-white/60">
                  {formatarNumero(l.abl, 2)} m²
                </span>
                <button
                  type="button"
                  aria-label={`Tirar o LUC ${l.numero}`}
                  onClick={() =>
                    definirLucs(valor.lucs.filter((n) => n !== l.numero))
                  }
                  className="grid size-5 place-items-center rounded-full hover:bg-white/20"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
            <div className="w-full sm:w-80">
              <Selecao
                id={idCampo("imovel", "lucs")}
                rotulo="Buscar LUC no ENET"
                placeholder={
                  valor.lucs.length
                    ? "Adicionar outro LUC…"
                    : "Buscar LUC (ex.: 11_131)…"
                }
                valor=""
                busca
                aoMudar={(n) => {
                  if (n && !valor.lucs.includes(n))
                    definirLucs([...valor.lucs, n]);
                }}
                opcoes={lucs
                  .filter((l) => !valor.lucs.includes(l.numero))
                  .map((l) => ({
                    valor: l.numero,
                    rotulo: l.numero,
                    descricao: `${l.local} · ${l.piso} · ${l.tipo} · ${formatarNumero(l.abl, 2)} m² · ${l.status}`,
                  }))}
              />
            </div>
          </div>
          <span className="text-xs text-neutral-500">
            Busca nos LUCs do ENET pelo código bloco_unidade. Dois LUCs vizinhos
            no mesmo contrato somam a área.
          </span>
          {escolhidos.some((l) => l.status === "Locado") && (
            <Aviso tom="atencao">
              {escolhidos
                .filter((l) => l.status === "Locado")
                .map((l) => l.numero)
                .join(", ")}{" "}
              aparece como locado no ENET. Confira antes de seguir.
            </Aviso>
          )}
        </div>
        <Grade>
          <Texto
            id={idCampo("imovel", "empreendimento")}
            rotulo="Empreendimento"
            obrigatorio
            max={100}
            valor={valor.empreendimento}
            aoMudar={(v) => up({ empreendimento: v })}
            dica={`Padrão dos parâmetros: ${parametros.empreendimento_nome}`}
          />
          <Texto
            id={idCampo("imovel", "bloco")}
            rotulo="Bloco"
            obrigatorio
            max={60}
            valor={valor.bloco}
            aoMudar={(v) => up({ bloco: v })}
          />
          <Texto
            id={idCampo("imovel", "pavimento")}
            rotulo="Pavimento"
            obrigatorio
            max={60}
            valor={valor.pavimento}
            aoMudar={(v) => up({ pavimento: v })}
          />
          <Texto
            id={idCampo("imovel", "unidade")}
            rotulo="Unidade / Loja"
            obrigatorio
            max={100}
            valor={valor.unidade}
            aoMudar={(v) => up({ unidade: v })}
          />
          <Numero
            id={idCampo("imovel", "area")}
            rotulo="Área / ABL"
            obrigatorio
            casas={2}
            sufixo="m²"
            valor={valor.area}
            aoMudar={(v) => up({ area: v })}
            dica={
              valor.area_enet !== null
                ? `ENET: ${formatarNumero(valor.area_enet, 2)} m²`
                : undefined
            }
          />
        </Grade>
        {areaCorrigida && (
          <Aviso tom="atencao">
            A área foi corrigida: o ENET informa{" "}
            {formatarNumero(valor.area_enet ?? 0, 2)} m². O contrato sai com a
            área digitada.
          </Aviso>
        )}
        {valor.area ? (
          <p className="text-sm text-neutral-700">
            Área no contrato:{" "}
            <span className="font-medium">{areaPorExtenso(valor.area)}</span>
          </p>
        ) : null}
      </Bloco>

      <Bloco
        titulo="Endereço do imóvel"
        dica="Padrão dos parâmetros; o CEP consulta o endereço."
        acoes={
          <button
            type="button"
            className={BOTAO_SEC}
            onClick={() => up({ endereco: enderecoPadrao(parametros) })}
          >
            Usar o padrão
          </button>
        }
      >
        <CamposEndereco
          pre="imovel-end"
          valor={valor.endereco}
          aoMudar={(endereco) => up({ endereco })}
        />
        <Aviso>
          A planta correspondente ao imóvel será anexada na etapa de Documentos.
        </Aviso>
      </Bloco>
    </>
  );
}
