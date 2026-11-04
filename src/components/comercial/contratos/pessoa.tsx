"use client";

import {
  type Conjuge,
  DOCUMENTOS_IDENTIDADE,
  ESTADOS_CIVIS,
  type PessoaFisica,
  type Representante,
} from "@/lib/comercial/contrato";
import { idCampo } from "@/lib/comercial/contrato-revisao";
import { formatarCpf, soDigitos } from "@/lib/documentos";
import {
  CamposEndereco,
  Data,
  Escolha,
  Grade,
  OPCOES_UF,
  opcoesDe,
  opcoesDeRotulos,
  Texto,
} from "./campos";

// Qualificação de pessoa física, cônjuge e representante legal: a mesma
// para o locatário (etapa Partes) e para cada fiador (etapa Garantia).

const OPCOES_DOC = opcoesDe(DOCUMENTOS_IDENTIDADE);
const OPCOES_CIVIL = opcoesDeRotulos(ESTADOS_CIVIS);

export function CampoCpf({
  id,
  rotulo = "CPF",
  valor,
  aoMudar,
  largura = 2,
  obrigatorio = true,
}: {
  id: string;
  rotulo?: string;
  valor: string;
  aoMudar: (v: string) => void;
  largura?: 1 | 2 | 3;
  obrigatorio?: boolean;
}) {
  return (
    <Texto
      id={id}
      rotulo={rotulo}
      largura={largura}
      obrigatorio={obrigatorio}
      livre
      max={14}
      placeholder="000.000.000-00"
      valor={valor.length === 11 ? formatarCpf(valor) : valor}
      aoMudar={(v) => aoMudar(soDigitos(v).slice(0, 11))}
    />
  );
}

export function CamposPessoaFisica({
  pre,
  valor,
  aoMudar,
}: {
  pre: string;
  valor: PessoaFisica;
  aoMudar: (p: PessoaFisica) => void;
}) {
  const up = (m: Partial<PessoaFisica>) => aoMudar({ ...valor, ...m });
  return (
    <>
      <Grade>
        <Texto
          id={idCampo(pre, "nome")}
          rotulo="Nome completo"
          largura={4}
          obrigatorio
          valor={valor.nome}
          aoMudar={(v) => up({ nome: v })}
        />
        <CampoCpf
          id={idCampo(pre, "cpf")}
          valor={valor.cpf}
          aoMudar={(v) => up({ cpf: v })}
        />
        <Escolha
          id={idCampo(pre, "doc_tipo")}
          rotulo="Documento de identificação"
          obrigatorio
          valor={valor.doc_tipo}
          aoMudar={(v) => up({ doc_tipo: v })}
          opcoes={OPCOES_DOC}
        />
        <Texto
          id={idCampo(pre, "doc_numero")}
          rotulo="Número do documento"
          obrigatorio
          max={40}
          valor={valor.doc_numero}
          aoMudar={(v) => up({ doc_numero: v })}
        />
        <Texto
          id={idCampo(pre, "orgao")}
          rotulo="Órgão expedidor"
          largura={1}
          obrigatorio
          max={60}
          valor={valor.orgao}
          aoMudar={(v) => up({ orgao: v })}
        />
        <Escolha
          id={idCampo(pre, "orgao_uf")}
          rotulo="UF do órgão"
          largura={1}
          obrigatorio
          valor={valor.orgao_uf}
          aoMudar={(v) => up({ orgao_uf: v })}
          opcoes={OPCOES_UF}
          placeholder="UF"
        />
        <Data
          id={idCampo(pre, "expedicao")}
          rotulo="Data de expedição"
          obrigatorio
          valor={valor.expedicao}
          aoMudar={(v) => up({ expedicao: v })}
        />
        <Data
          id={idCampo(pre, "nascimento")}
          rotulo="Data de nascimento"
          obrigatorio
          valor={valor.nascimento}
          aoMudar={(v) => up({ nascimento: v })}
        />
        <Texto
          id={idCampo(pre, "nacionalidade")}
          rotulo="Nacionalidade"
          obrigatorio
          max={60}
          valor={valor.nacionalidade}
          aoMudar={(v) => up({ nacionalidade: v })}
        />
        <Escolha
          id={idCampo(pre, "estado_civil")}
          rotulo="Estado civil"
          obrigatorio
          valor={valor.estado_civil}
          aoMudar={(v) =>
            up({ estado_civil: v as PessoaFisica["estado_civil"] })
          }
          opcoes={OPCOES_CIVIL}
        />
        <Texto
          id={idCampo(pre, "profissao")}
          rotulo="Profissão"
          max={100}
          valor={valor.profissao}
          aoMudar={(v) => up({ profissao: v })}
        />
        <Texto
          id={idCampo(pre, "email")}
          rotulo="E-mail"
          tipo="email"
          largura={3}
          obrigatorio
          valor={valor.email}
          aoMudar={(v) => up({ email: v })}
        />
        <Texto
          id={idCampo(pre, "telefone")}
          rotulo="Telefone (com DDD)"
          tipo="tel"
          largura={3}
          obrigatorio
          max={30}
          valor={valor.telefone}
          aoMudar={(v) => up({ telefone: v })}
        />
      </Grade>
      <CamposEndereco
        pre={`${pre}-end`}
        valor={valor.endereco}
        aoMudar={(endereco) => up({ endereco })}
      />
    </>
  );
}

export function CamposConjuge({
  pre,
  valor,
  aoMudar,
}: {
  pre: string;
  valor: Conjuge;
  aoMudar: (c: Conjuge) => void;
}) {
  const up = (m: Partial<Conjuge>) => aoMudar({ ...valor, ...m });
  return (
    <Grade>
      <Texto
        id={idCampo(pre, "nome")}
        rotulo="Nome completo"
        largura={4}
        obrigatorio
        valor={valor.nome}
        aoMudar={(v) => up({ nome: v })}
      />
      <CampoCpf
        id={idCampo(pre, "cpf")}
        valor={valor.cpf}
        aoMudar={(v) => up({ cpf: v })}
      />
      <Escolha
        id={idCampo(pre, "doc_tipo")}
        rotulo="Documento de identificação"
        valor={valor.doc_tipo}
        aoMudar={(v) => up({ doc_tipo: v })}
        opcoes={OPCOES_DOC}
      />
      <Texto
        id={idCampo(pre, "doc_numero")}
        rotulo="Número do documento"
        obrigatorio
        max={40}
        valor={valor.doc_numero}
        aoMudar={(v) => up({ doc_numero: v })}
      />
      <Texto
        id={idCampo(pre, "orgao")}
        rotulo="Órgão expedidor"
        largura={1}
        max={60}
        valor={valor.orgao}
        aoMudar={(v) => up({ orgao: v })}
      />
      <Escolha
        id={idCampo(pre, "orgao_uf")}
        rotulo="UF do órgão"
        largura={1}
        valor={valor.orgao_uf}
        aoMudar={(v) => up({ orgao_uf: v })}
        opcoes={OPCOES_UF}
        placeholder="UF"
      />
      <Data
        id={idCampo(pre, "expedicao")}
        rotulo="Data de expedição"
        valor={valor.expedicao}
        aoMudar={(v) => up({ expedicao: v })}
      />
      <Data
        id={idCampo(pre, "nascimento")}
        rotulo="Data de nascimento"
        valor={valor.nascimento}
        aoMudar={(v) => up({ nascimento: v })}
      />
      <Texto
        id={idCampo(pre, "nacionalidade")}
        rotulo="Nacionalidade"
        obrigatorio
        max={60}
        valor={valor.nacionalidade}
        aoMudar={(v) => up({ nacionalidade: v })}
      />
      <Texto
        id={idCampo(pre, "profissao")}
        rotulo="Profissão ou ocupação"
        max={100}
        valor={valor.profissao}
        aoMudar={(v) => up({ profissao: v })}
      />
      <Texto
        id={idCampo(pre, "telefone")}
        rotulo="Telefone"
        tipo="tel"
        max={30}
        valor={valor.telefone}
        aoMudar={(v) => up({ telefone: v })}
      />
      <Texto
        id={idCampo(pre, "telefone_secundario")}
        rotulo="Telefone secundário"
        tipo="tel"
        max={30}
        valor={valor.telefone_secundario}
        aoMudar={(v) => up({ telefone_secundario: v })}
      />
      <Texto
        id={idCampo(pre, "email")}
        rotulo="E-mail"
        tipo="email"
        largura={4}
        valor={valor.email}
        aoMudar={(v) => up({ email: v })}
      />
    </Grade>
  );
}

export function CamposRepresentante({
  pre,
  valor,
  aoMudar,
  completo = true,
}: {
  pre: string;
  valor: Representante;
  aoMudar: (r: Representante) => void;
  /** false: só nome e CPF (sócia da fiadora PJ). */
  completo?: boolean;
}) {
  const up = (m: Partial<Representante>) => aoMudar({ ...valor, ...m });
  return (
    <>
      <Grade>
        <Texto
          id={idCampo(pre, "nome")}
          rotulo="Nome completo"
          largura={4}
          obrigatorio
          valor={valor.nome}
          aoMudar={(v) => up({ nome: v })}
        />
        <CampoCpf
          id={idCampo(pre, "cpf")}
          valor={valor.cpf}
          aoMudar={(v) => up({ cpf: v })}
        />
        {completo && (
          <>
            <Texto
              id={idCampo(pre, "rg")}
              rotulo="RG"
              obrigatorio
              max={40}
              valor={valor.rg}
              aoMudar={(v) => up({ rg: v })}
            />
            <Texto
              id={idCampo(pre, "orgao")}
              rotulo="Órgão expedidor"
              obrigatorio
              max={60}
              valor={valor.orgao}
              aoMudar={(v) => up({ orgao: v })}
            />
            <Escolha
              id={idCampo(pre, "rg_uf")}
              rotulo="UF do RG"
              obrigatorio
              valor={valor.rg_uf}
              aoMudar={(v) => up({ rg_uf: v })}
              opcoes={OPCOES_UF}
              placeholder="UF"
            />
            <Texto
              id={idCampo(pre, "cargo")}
              rotulo="Cargo / função"
              largura={3}
              obrigatorio
              max={100}
              valor={valor.cargo}
              aoMudar={(v) => up({ cargo: v })}
            />
            <Texto
              id={idCampo(pre, "nacionalidade")}
              rotulo="Nacionalidade"
              largura={3}
              obrigatorio
              novo
              max={60}
              valor={valor.nacionalidade}
              aoMudar={(v) => up({ nacionalidade: v })}
            />
            <Escolha
              id={idCampo(pre, "estado_civil")}
              rotulo="Estado civil"
              largura={3}
              obrigatorio
              novo
              valor={valor.estado_civil}
              aoMudar={(v) =>
                up({ estado_civil: v as Representante["estado_civil"] })
              }
              opcoes={OPCOES_CIVIL}
            />
            <Texto
              id={idCampo(pre, "profissao")}
              rotulo="Profissão"
              largura={3}
              obrigatorio
              novo
              max={100}
              valor={valor.profissao}
              aoMudar={(v) => up({ profissao: v })}
            />
          </>
        )}
      </Grade>
      {completo && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-neutral-600">
            Endereço do representante{" "}
            <span className="rounded-full bg-marca/30 px-1.5 py-px text-[10px] font-semibold text-neutral-800">
              novo
            </span>
          </p>
          <CamposEndereco
            pre={`${pre}-end`}
            valor={valor.endereco}
            aoMudar={(endereco) => up({ endereco })}
          />
        </div>
      )}
    </>
  );
}
