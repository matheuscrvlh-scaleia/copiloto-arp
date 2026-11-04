"use client";

import { ClipboardCheck, ExternalLink, Loader } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { notificar } from "@/components/notificacoes";
import {
  CONDICAO_FISICA,
  type DadosContrato,
  type ItemFisico,
  STATUS_ENTREGA,
} from "@/lib/comercial/contrato";
import { idCampo } from "@/lib/comercial/contrato-revisao";
import { formatarData } from "@/lib/formato";
import { rotaVistoria } from "@/lib/os/rotas";
import { puxarVistoria } from "@/server/comercial/acoes/contratos";
import {
  Aviso,
  Bloco,
  BOTAO_SEC,
  Data,
  Escolha,
  Grade,
  Numero,
  opcoesDeRotulos,
  Texto,
  TextoLongo,
} from "./campos";

type Entrega = DadosContrato["entrega"];

export function EtapaEntrega({
  valor,
  aoMudar,
  lucs,
  editar,
}: {
  valor: Entrega;
  aoMudar: (v: Entrega) => void;
  lucs: string[];
  editar: boolean;
}) {
  const up = (m: Partial<Entrega>) => aoMudar({ ...valor, ...m });
  const [puxando, setPuxando] = useState(false);
  const [semVistoria, setSemVistoria] = useState<string | null>(null);

  async function puxar() {
    setPuxando(true);
    setSemVistoria(null);
    const r = await puxarVistoria(lucs);
    setPuxando(false);
    if (!r.ok) {
      setSemVistoria(r.erro);
      return;
    }
    up({
      fisica: { ...valor.fisica, ...r.fisica },
      vistoria: {
        id: r.vistoria.id,
        codigo: r.vistoria.codigo,
        data: r.vistoria.data,
      },
    });
    notificar(
      "ok",
      `Itens copiados da vistoria de entrada ${r.vistoria.codigo}. Ajuste o que precisar.`,
    );
  }

  return (
    <>
      <Bloco titulo="Padrão de entrega">
        <Grade>
          <Texto
            id={idCampo("ent", "tipo_imovel")}
            rotulo="Tipo de imóvel"
            obrigatorio
            max={60}
            valor={valor.tipo_imovel}
            aoMudar={(v) => up({ tipo_imovel: v })}
          />
          <Texto
            id={idCampo("ent", "padrao")}
            rotulo="Padrão"
            largura={4}
            obrigatorio
            max={100}
            valor={valor.padrao}
            aoMudar={(v) => up({ padrao: v })}
          />
          <Numero
            id={idCampo("ent", "prazo_implantacao")}
            rotulo="Prazo de implantação"
            obrigatorio
            sufixo="dias"
            valor={valor.prazo_implantacao}
            aoMudar={(v) => up({ prazo_implantacao: v })}
          />
          <Texto
            id={idCampo("ent", "nc004")}
            rotulo="Versão da NC004"
            obrigatorio
            max={20}
            valor={valor.nc004}
            aoMudar={(v) => up({ nc004: v })}
          />
          <Escolha
            id={idCampo("ent", "status")}
            rotulo="Status"
            obrigatorio
            valor={valor.status}
            aoMudar={(v) => up({ status: v as Entrega["status"] })}
            opcoes={opcoesDeRotulos(STATUS_ENTREGA)}
          />
          <Data
            id={idCampo("ent", "data_termo")}
            rotulo="Data do termo de entrada"
            obrigatorio={valor.status === "concluida"}
            valor={valor.data_termo}
            aoMudar={(v) => up({ data_termo: v })}
          />
        </Grade>
        <Aviso>
          O sistema controla o status, e não um Sim/Não que possa ficar
          desatualizado.
        </Aviso>
      </Bloco>

      <Bloco
        titulo="Prazos da cláusula de obras"
        dica="Vêm dos parâmetros; mude só se este contrato for diferente."
      >
        <Grade>
          <Numero
            id={idCampo("ent", "prazos", "tapume")}
            rotulo="Tapume"
            sufixo="dias"
            valor={valor.prazos.tapume}
            aoMudar={(v) => up({ prazos: { ...valor.prazos, tapume: v } })}
          />
          <Numero
            id={idCampo("ent", "prazos", "retirada")}
            rotulo="Retirada"
            sufixo="dias"
            valor={valor.prazos.retirada}
            aoMudar={(v) => up({ prazos: { ...valor.prazos, retirada: v } })}
          />
          <Numero
            id={idCampo("ent", "prazos", "projetos")}
            rotulo="Projetos"
            sufixo="dias"
            valor={valor.prazos.projetos}
            aoMudar={(v) => up({ prazos: { ...valor.prazos, projetos: v } })}
          />
        </Grade>
      </Bloco>

      <Bloco
        titulo="Condição física"
        dica="Vira a cláusula XXII — Das Obras, um item por linha."
        acoes={
          editar ? (
            <button
              type="button"
              className={BOTAO_SEC}
              disabled={puxando || !lucs.length}
              onClick={() => void puxar()}
              title={
                lucs.length
                  ? "Copia os itens da vistoria de entrada do LUC no Tickets"
                  : "Escolha o LUC na etapa Imóvel"
              }
            >
              {puxando ? (
                <Loader className="size-4 animate-spin" aria-hidden />
              ) : (
                <ClipboardCheck className="size-4" aria-hidden />
              )}
              Puxar da vistoria
            </button>
          ) : undefined
        }
      >
        {valor.vistoria && (
          <Aviso tom="ok">
            Itens da vistoria de entrada {valor.vistoria.codigo} de{" "}
            {formatarData(valor.vistoria.data)}.{" "}
            <Link
              href={rotaVistoria(valor.vistoria.id)}
              className="inline-flex items-center gap-1 font-medium underline"
            >
              Abrir no Tickets
              <ExternalLink className="size-3" aria-hidden />
            </Link>
          </Aviso>
        )}
        {semVistoria && <Aviso tom="atencao">{semVistoria}</Aviso>}
        <Grade>
          {(Object.keys(CONDICAO_FISICA) as ItemFisico[]).map((k) => (
            <TextoLongo
              key={k}
              id={idCampo("ent", "fisica", k)}
              rotulo={CONDICAO_FISICA[k]}
              largura={k === "observacoes" ? 6 : 3}
              linhas={2}
              valor={valor.fisica[k]}
              aoMudar={(v) => up({ fisica: { ...valor.fisica, [k]: v } })}
            />
          ))}
        </Grade>
      </Bloco>
    </>
  );
}
