"use client";

import { Trash2, TriangleAlert } from "lucide-react";
import { useRef } from "react";
import { notificar } from "@/components/notificacoes";
import {
  cnaeDaReceita,
  DOCUMENTOS_IDENTIFICACAO,
  ESTADOS_CIVIS,
  NATUREZAS_JURIDICAS,
  naturezaDaReceita,
  PATRIMONIOS,
  pedeConjuge,
  type RespostasFicha,
} from "@/lib/comercial/ficha";
import { cnpjValido, UFS } from "@/lib/documentos";
import { consultarCnpj } from "@/server/comercial/consultas";
import {
  Data,
  Digitos,
  Endereco,
  Erro,
  Escolha,
  Marca,
  Secao,
  Texto,
  Valor,
} from "./campos";
import { alta, type Caminho, useFicha } from "./contexto";

// ---------------------------------------------------------------------------
// Blocos de perguntas
// ---------------------------------------------------------------------------

function Identificacao({ base, n }: { base: Caminho; n: number[] }) {
  return (
    <>
      <Texto n={n[0]} rotulo="Nome completo" caminho={`${base}.nome`} />
      <Digitos n={n[1]} tipo="cpf" rotulo="CPF" caminho={`${base}.cpf`} />
      <div className="grid grid-cols-2 gap-3">
        <Escolha
          n={n[2]}
          rotulo="Documento de identificação"
          caminho={`${base}.doc_tipo`}
          opcoes={DOCUMENTOS_IDENTIFICACAO}
        />
        <Texto
          rotulo="Número do documento"
          caminho={`${base}.doc_numero`}
          max={30}
        />
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Texto
          n={n[3]}
          rotulo="Órgão expedidor"
          caminho={`${base}.orgao`}
          max={60}
          placeholder="Ex.: DETRAN"
        />
        <Escolha
          rotulo="UF"
          caminho={`${base}.orgao_uf`}
          opcoes={UFS}
          vazio="UF"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Data
          n={n[4]}
          rotulo="Data de expedição"
          caminho={`${base}.expedicao`}
          passado
        />
        <Data
          n={n[5]}
          rotulo="Data de nascimento"
          caminho={`${base}.nascimento`}
          passado
        />
      </div>
      <Texto
        n={n[6]}
        rotulo="Nacionalidade"
        caminho={`${base}.nacionalidade`}
        max={60}
      />
    </>
  );
}

export function Pessoa({
  i,
  titulo,
  remover,
}: {
  i: number;
  titulo: string;
  remover?: () => void;
}) {
  const { r } = useFicha();
  const base = `pessoas.${i}`;
  const casado = pedeConjuge(r.pessoas[i]?.estado_civil ?? "");
  return (
    <>
      <Secao titulo={titulo}>
        {remover && (
          <button
            type="button"
            onClick={remover}
            className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-red-700 hover:underline"
          >
            <Trash2 className="size-3.5" aria-hidden />
            Tirar este sócio
          </button>
        )}
        <Identificacao base={base} n={[15, 16, 17, 18, 19, 20, 21]} />
        <Escolha
          n={22}
          rotulo="Estado civil"
          caminho={`${base}.estado_civil`}
          opcoes={ESTADOS_CIVIS}
          dica="Casado(a) ou em união estável: em seguida pedimos os dados do cônjuge."
        />
        <Endereco
          n={23}
          rotulo="Endereço completo"
          caminho={`${base}.endereco`}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Digitos
            n={24}
            tipo="telefone"
            rotulo="Telefone (com DDD)"
            caminho={`${base}.telefone`}
          />
          <Digitos
            n={25}
            tipo="telefone"
            rotulo="Telefone secundário"
            caminho={`${base}.telefone2`}
            obrigatoria={false}
          />
        </div>
        <Texto
          n={26}
          rotulo="E-mail"
          caminho={`${base}.email`}
          email
          max={160}
        />
      </Secao>
      {casado && (
        <Secao
          titulo={
            i > 0
              ? `Cônjuge ou convivente do sócio ${i + 1}`
              : "Dados do cônjuge ou convivente"
          }
          descricao="Perguntas 27 a 37. Todas obrigatórias, menos o telefone secundário."
        >
          <Identificacao
            base={`${base}.conjuge`}
            n={[27, 28, 29, 31, 30, 32, 33]}
          />
          <Texto
            n={34}
            rotulo="Profissão ou ocupação"
            caminho={`${base}.conjuge.profissao`}
            max={80}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Digitos
              n={35}
              tipo="telefone"
              rotulo="Telefone (com DDD)"
              caminho={`${base}.conjuge.telefone`}
            />
            <Digitos
              n={36}
              tipo="telefone"
              rotulo="Telefone secundário"
              caminho={`${base}.conjuge.telefone2`}
              obrigatoria={false}
            />
          </div>
          <Texto
            n={37}
            rotulo="E-mail"
            caminho={`${base}.conjuge.email`}
            email
            max={160}
          />
        </Secao>
      )}
    </>
  );
}

export function Empresa() {
  const { r, definir, token } = useFicha();
  const e = r.empresa;
  const consultado = useRef("");
  async function buscar(cnpj: string) {
    if (!cnpjValido(cnpj) || consultado.current === cnpj) return;
    consultado.current = cnpj;
    const x = await consultarCnpj(cnpj, token);
    if (!x) {
      notificar(
        "info",
        "Não foi possível consultar o CNPJ agora. Preencha os dados normalmente.",
      );
      return;
    }
    const { cnae, ramo } = cnaeDaReceita(x.cnaePrincipal);
    const end = x.endereco;
    definir("empresa", (e: RespostasFicha["empresa"]) => ({
      ...e,
      cnpj,
      razao_social: alta(x.razaoSocial),
      nome_fantasia: alta(x.nomeFantasia),
      natureza:
        naturezaDaReceita(x.naturezaJuridica, x.socios.length) || e.natureza,
      cnae,
      ramo: e.ramo || alta(ramo),
      capital_social: x.capitalSocial ?? e.capital_social,
      endereco: {
        cep: end.cep,
        logradouro: alta(end.logradouro),
        numero: alta(end.numero),
        complemento: alta(end.complemento),
        bairro: alta(end.bairro),
        cidade: alta(end.cidade),
        uf: end.uf,
      },
    }));
    const admin = x.socios.find((s) => /administrador/i.test(s.qualificacao));
    if (admin && !r.pessoas[0]?.nome)
      definir("pessoas.0.nome", alta(admin.nome));
    notificar("ok", "CNPJ consultado: confira os dados preenchidos.");
  }
  return (
    <Secao
      titulo="Dados cadastrais — pessoa jurídica"
      descricao="Comece pelo CNPJ: preenchemos o resto com os dados da Receita para você conferir."
    >
      <Digitos
        n={6}
        tipo="cnpj"
        rotulo="CNPJ"
        caminho="empresa.cnpj"
        aoCompletar={buscar}
      />
      <Texto
        n={5}
        rotulo="Razão social"
        caminho="empresa.razao_social"
        max={200}
      />
      <Escolha
        n={7}
        rotulo="Natureza jurídica"
        caminho="empresa.natureza"
        opcoes={NATUREZAS_JURIDICAS}
      />
      <div className="flex flex-col gap-2">
        <Texto
          n={8}
          rotulo="Inscrição estadual"
          caminho="empresa.ie"
          max={30}
          desligado={e.ie_isento}
        />
        <Marca caminho="empresa.ie_isento" rotulo="Isento" />
      </div>
      <div className="flex flex-col gap-2">
        <Texto
          n={9}
          rotulo="Inscrição municipal"
          caminho="empresa.im"
          max={30}
          desligado={e.im_nao_tem}
        />
        <Marca caminho="empresa.im_nao_tem" rotulo="Não tem" />
      </div>
      <Texto
        n={10}
        rotulo="CNAE principal (nº)"
        caminho="empresa.cnae"
        max={200}
      />
      <Texto n={11} rotulo="Ramo de atuação" caminho="empresa.ramo" />
      <Endereco n={12} rotulo="Endereço completo" caminho="empresa.endereco" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Valor
          n={13}
          rotulo="Capital social atual"
          caminho="empresa.capital_social"
          obrigatoria={false}
        />
        <Data
          n={14}
          rotulo="Última alteração social"
          caminho="empresa.ultima_alteracao"
          obrigatoria={false}
          passado
        />
      </div>
      <p className="flex gap-2 rounded-2xl bg-amber-400/15 p-4 text-sm text-amber-900">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <b>ATENÇÃO.</b> Preencha as próximas perguntas com as informações do
          sócio administrador, que possui poderes para a representação da
          empresa em contratos, cujo objetivo é o proposto junto à ARP.
        </span>
      </p>
    </Secao>
  );
}

export function Renda() {
  const { r, definir } = useFicha();
  const d = r.renda;
  const marcar = (p: (typeof PATRIMONIOS)[number], sim: boolean) =>
    definir(
      "renda.patrimonio",
      sim ? [...d.patrimonio, p] : d.patrimonio.filter((x) => x !== p),
    );
  return (
    <Secao
      titulo="Dados profissionais, renda e garantia"
      descricao="Perguntas 38 a 47."
    >
      <Texto
        n={38}
        rotulo="Profissão"
        caminho="renda.profissao"
        obrigatoria={false}
        max={80}
      />
      <Texto n={39} rotulo="Empresa" caminho="renda.empresa" />
      <Endereco
        n={40}
        rotulo="Endereço completo da empresa"
        caminho="renda.endereco"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Digitos
          n={41}
          tipo="telefone"
          rotulo="Telefone da empresa"
          caminho="renda.telefone"
        />
        <Texto
          n={42}
          rotulo="E-mail da empresa"
          caminho="renda.email"
          email
          obrigatoria={false}
          max={160}
        />
      </div>
      <Valor n={43} rotulo="Renda mensal" caminho="renda.renda" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Texto
          n={44}
          rotulo="Referência pessoal (nome)"
          caminho="renda.referencia_nome"
          obrigatoria={false}
        />
        <Digitos
          tipo="telefone"
          rotulo="Telefone da referência"
          caminho="renda.referencia_telefone"
          obrigatoria={false}
        />
      </div>
      <Texto
        n={45}
        rotulo="Outras rendas e origem"
        caminho="renda.outras_rendas"
        obrigatoria={false}
        max={300}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-neutral-800">
          <span className="text-neutral-400">46. </span>Patrimônio
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {PATRIMONIOS.map((p) => (
            <label
              key={p}
              className="inline-flex items-center gap-2 text-sm text-neutral-700"
            >
              <input
                type="checkbox"
                checked={d.patrimonio.includes(p)}
                onChange={(e) => marcar(p, e.target.checked)}
                className="size-4 accent-neutral-900"
              />
              {p}
            </label>
          ))}
        </div>
        {d.patrimonio.includes("Outro") && (
          <Texto
            rotulo="Qual outro patrimônio?"
            caminho="renda.patrimonio_outro"
          />
        )}
        <Erro caminho="renda.patrimonio" />
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-neutral-800">
          <span className="text-neutral-400">47. </span>Paga aluguel?
        </legend>
        <div className="flex gap-2">
          {[
            [true, "Sim"],
            [false, "Não"],
          ].map(([v, t]) => (
            <button
              key={String(t)}
              type="button"
              aria-pressed={d.paga_aluguel === v}
              onClick={() => definir("renda.paga_aluguel", v)}
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition aria-pressed:border-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white"
            >
              {t}
            </button>
          ))}
        </div>
        {d.paga_aluguel && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Texto
              rotulo="Referência do aluguel (nome)"
              caminho="renda.aluguel_nome"
            />
            <Digitos
              tipo="telefone"
              rotulo="Telefone da referência"
              caminho="renda.aluguel_telefone"
            />
          </div>
        )}
      </fieldset>
    </Secao>
  );
}
