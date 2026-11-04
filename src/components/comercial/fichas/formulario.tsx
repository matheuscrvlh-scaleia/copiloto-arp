"use client";

import {
  CircleAlert,
  FileCheck2,
  Paperclip,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  createContext,
  use,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import {
  cnaeDaReceita,
  DOCUMENTOS_IDENTIFICACAO,
  type DocumentoExigido,
  ESTADOS_CIVIS,
  LUC_NAO_SEI,
  MAXIMO_SOCIOS,
  NATUREZAS_JURIDICAS,
  naturezaDaReceita,
  PATRIMONIOS,
  type Problema,
  pedeConjuge,
  pessoaVazia,
  type RespostasFicha,
  ROTULO_TIPO,
  TIPOS_FICHA,
  type TipoFicha,
} from "@/lib/comercial/ficha";
import { cnpjValido, cpfValido, soDigitos, UFS } from "@/lib/documentos";
import { formatarNumero, lerValorBr } from "@/lib/formato";
import {
  enviarDocumentoPeloLink,
  removerDocumentoPeloLink,
  salvarFichaPeloLink,
} from "@/server/comercial/acoes/ficha-publica";
import { consultarCep, consultarCnpj } from "@/server/comercial/consultas";

// A ficha cadastral que o interessado preenche pelo link (spec 4.12): as 48
// perguntas na ordem do Forms, com os saltos (PJ → empresa e sócios; casado
// ou união estável → cônjuge), celular primeiro. As respostas ficam aqui
// até "Salvar e continuar depois" ou "Enviar ficha"; os documentos sobem na
// hora. CEP e CNPJ preenchem campos; se a consulta falhar, a pessoa digita.

type Caminho = string;

interface Contexto {
  r: RespostasFicha;
  definir: (caminho: Caminho, valor: unknown) => void;
  erros: Record<string, string>;
  hoje: string;
}

const Ctx = createContext<Contexto | null>(null);
const useFicha = () => {
  const c = use(Ctx);
  if (!c) throw new Error("campo fora da ficha");
  return c;
};

function ler(obj: unknown, caminho: Caminho): unknown {
  return caminho
    .split(".")
    .reduce<unknown>(
      (o, k) =>
        o && typeof o === "object"
          ? (o as Record<string, unknown>)[k]
          : undefined,
      obj,
    );
}

function com<T>(obj: T, caminho: string[], valor: unknown): T {
  const [k, ...resto] = caminho;
  if (k === undefined)
    return (typeof valor === "function" ? valor(obj) : valor) as T;
  if (Array.isArray(obj)) {
    const copia = [...obj];
    copia[Number(k)] = com(copia[Number(k)], resto, valor);
    return copia as T;
  }
  const o = (obj ?? {}) as Record<string, unknown>;
  return { ...o, [k]: com(o[k], resto, valor) } as T;
}

const idDo = (caminho: Caminho) =>
  `campo-${caminho.normalize("NFD").replace(/[^A-Za-z0-9_]+/g, "-")}`;
const alta = (v: string) => v.toLocaleUpperCase("pt-BR");

function mascara(digitos: string, molde: string): string {
  let i = 0;
  let s = "";
  for (const c of molde) {
    if (i >= digitos.length) break;
    s += c === "0" ? digitos[i++] : c;
  }
  return s;
}
const mascaraTelefone = (d: string) =>
  mascara(d, d.length > 10 ? "(00) 00000-0000" : "(00) 0000-00000");

// ---------------------------------------------------------------------------
// Campos
// ---------------------------------------------------------------------------

function Rotulo({
  n,
  rotulo,
  obrigatoria,
  htmlFor,
}: {
  n?: number;
  rotulo: string;
  obrigatoria: boolean;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-neutral-800">
      {n !== undefined && <span className="text-neutral-400">{n}. </span>}
      {rotulo}
      {obrigatoria && (
        <span className="text-red-600" aria-hidden>
          {" "}
          *
        </span>
      )}
    </label>
  );
}

function Erro({ caminho }: { caminho: Caminho }) {
  const { erros } = useFicha();
  const e = erros[caminho];
  if (!e) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-700" role="alert">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden />
      {e}
    </p>
  );
}

interface PropsCampo {
  n?: number;
  rotulo: string;
  caminho: Caminho;
  obrigatoria?: boolean;
  dica?: string;
  className?: string;
}

function Campo({
  n,
  rotulo,
  caminho,
  obrigatoria = true,
  dica,
  className = "",
  children,
}: PropsCampo & { children: React.ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <Rotulo
        n={n}
        rotulo={rotulo}
        obrigatoria={obrigatoria}
        htmlFor={idDo(caminho)}
      />
      {children}
      {dica && <p className="text-xs text-neutral-500">{dica}</p>}
      <Erro caminho={caminho} />
    </div>
  );
}

const classe = (erro: boolean) =>
  `${classeCampo} ${erro ? "border-red-400 focus:border-red-600" : ""}`;

function Texto(
  p: PropsCampo & {
    max?: number;
    placeholder?: string;
    email?: boolean;
    aoSair?: (v: string) => void;
    desligado?: boolean;
  },
) {
  const { r, definir, erros } = useFicha();
  const v = String(ler(r, p.caminho) ?? "");
  return (
    <Campo {...p}>
      <input
        id={idDo(p.caminho)}
        type={p.email ? "email" : "text"}
        inputMode={p.email ? "email" : undefined}
        autoCapitalize={p.email ? "none" : "characters"}
        value={v}
        maxLength={p.max ?? 150}
        placeholder={p.placeholder}
        disabled={p.desligado}
        aria-invalid={!!erros[p.caminho]}
        onChange={(e) =>
          definir(
            p.caminho,
            p.email ? e.target.value.toLowerCase() : alta(e.target.value),
          )
        }
        onBlur={(e) => p.aoSair?.(e.target.value)}
        className={classe(!!erros[p.caminho])}
      />
    </Campo>
  );
}

function Digitos(
  p: PropsCampo & {
    tipo: "cpf" | "cnpj" | "cep" | "telefone";
    aoCompletar?: (d: string) => void;
  },
) {
  const { r, definir, erros } = useFicha();
  const d = String(ler(r, p.caminho) ?? "");
  const [aviso, setAviso] = useState<string | null>(null);
  const max = { cpf: 11, cnpj: 14, cep: 8, telefone: 11 }[p.tipo];
  const mostrado =
    p.tipo === "cpf"
      ? mascara(d, "000.000.000-00")
      : p.tipo === "cnpj"
        ? mascara(d, "00.000.000/0000-00")
        : p.tipo === "cep"
          ? mascara(d, "00000-000")
          : mascaraTelefone(d);
  function sair() {
    if (!d) return setAviso(null);
    if (p.tipo === "cpf")
      setAviso(
        d.length === 11 && cpfValido(d)
          ? null
          : "CPF com número errado. Confira os 11 dígitos.",
      );
    else if (p.tipo === "cnpj")
      setAviso(
        d.length === 14 && cnpjValido(d)
          ? null
          : "CNPJ com número errado. Confira os 14 dígitos.",
      );
    else if (p.tipo === "telefone")
      setAviso(d.length >= 10 ? null : "Telefone com DDD: 10 ou 11 números.");
    else setAviso(d.length === 8 ? null : "CEP com 8 números.");
    if (d.length === max) p.aoCompletar?.(d);
  }
  return (
    <Campo {...p}>
      <input
        id={idDo(p.caminho)}
        type="text"
        inputMode={p.tipo === "telefone" ? "tel" : "numeric"}
        autoComplete={
          p.tipo === "cep"
            ? "postal-code"
            : p.tipo === "telefone"
              ? "tel"
              : "off"
        }
        value={mostrado}
        placeholder={
          {
            cpf: "000.000.000-00",
            cnpj: "00.000.000/0000-00",
            cep: "00000-000",
            telefone: "(00) 00000-0000",
          }[p.tipo]
        }
        aria-invalid={!!erros[p.caminho] || !!aviso}
        onChange={(e) =>
          definir(p.caminho, soDigitos(e.target.value).slice(0, max))
        }
        onBlur={sair}
        className={classe(!!erros[p.caminho] || !!aviso)}
      />
      {aviso && !erros[p.caminho] && (
        <p className="text-xs text-amber-700">{aviso}</p>
      )}
    </Campo>
  );
}

function Data(p: PropsCampo & { passado?: boolean }) {
  const { r, definir, erros, hoje } = useFicha();
  return (
    <Campo {...p}>
      <input
        id={idDo(p.caminho)}
        type="date"
        value={String(ler(r, p.caminho) ?? "")}
        max={p.passado ? hoje : undefined}
        aria-invalid={!!erros[p.caminho]}
        onChange={(e) => definir(p.caminho, e.target.value)}
        className={classe(!!erros[p.caminho])}
      />
    </Campo>
  );
}

function Valor(p: PropsCampo) {
  const { r, definir, erros } = useFicha();
  const atual = ler(r, p.caminho) as number | null;
  const [texto, setTexto] = useState(
    atual === null ? "" : formatarNumero(atual, 2),
  );
  const [invalido, setInvalido] = useState(false);
  // O valor pode mudar por fora (a consulta do CNPJ preenche o capital).
  useEffect(() => {
    setTexto(atual === null ? "" : formatarNumero(atual, 2));
  }, [atual]);
  return (
    <Campo {...p} dica={p.dica ?? "Em reais, ex.: 5.000,00"}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-neutral-400">
          R$
        </span>
        <input
          id={idDo(p.caminho)}
          type="text"
          inputMode="decimal"
          value={texto}
          aria-invalid={!!erros[p.caminho] || invalido}
          onChange={(e) => setTexto(e.target.value.replace(/[^\d.,]/g, ""))}
          onBlur={() => {
            const v = lerValorBr(texto);
            const ok = v === null || (Number.isFinite(v) && v >= 0);
            setInvalido(!ok);
            definir(p.caminho, ok ? v : null);
            if (ok && v !== null) setTexto(formatarNumero(v, 2));
          }}
          className={`${classe(!!erros[p.caminho] || invalido)} pl-9`}
        />
      </div>
      {invalido && (
        <p className="text-xs text-amber-700">
          Valor inválido. Use o formato 5.000,00.
        </p>
      )}
    </Campo>
  );
}

function Escolha(
  p: PropsCampo & {
    opcoes: readonly (string | { valor: string; rotulo: string })[];
    vazio?: string;
  },
) {
  const { r, definir, erros } = useFicha();
  return (
    <Campo {...p}>
      <select
        id={idDo(p.caminho)}
        value={String(ler(r, p.caminho) ?? "")}
        aria-invalid={!!erros[p.caminho]}
        onChange={(e) => definir(p.caminho, e.target.value)}
        className={classe(!!erros[p.caminho])}
      >
        <option value="">{p.vazio ?? "Selecione"}</option>
        {p.opcoes.map((o) => {
          const { valor, rotulo } =
            typeof o === "string" ? { valor: o, rotulo: o } : o;
          return (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          );
        })}
      </select>
    </Campo>
  );
}

function Marca({ caminho, rotulo }: { caminho: Caminho; rotulo: string }) {
  const { r, definir } = useFicha();
  return (
    <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
      <input
        type="checkbox"
        checked={ler(r, caminho) === true}
        onChange={(e) => definir(caminho, e.target.checked)}
        className="size-4 accent-neutral-900"
      />
      {rotulo}
    </label>
  );
}

function Endereco({
  n,
  rotulo,
  caminho,
  obrigatoria = true,
}: {
  n: number;
  rotulo: string;
  caminho: Caminho;
  obrigatoria?: boolean;
}) {
  const { definir } = useFicha();
  const consultado = useRef("");
  async function buscar(cep: string) {
    if (consultado.current === cep) return;
    consultado.current = cep;
    const e = await consultarCep(cep);
    if (!e) {
      notificar(
        "info",
        "Não achamos o CEP agora. Preencha o endereço normalmente.",
      );
      return;
    }
    definir(caminho, (atual: Record<string, string> = {}) => ({
      ...atual,
      cep: e.cep,
      logradouro: alta(e.logradouro) || atual.logradouro || "",
      bairro: alta(e.bairro) || atual.bairro || "",
      cidade: alta(e.cidade),
      uf: e.uf,
    }));
    notificar("ok", "CEP localizado. Confira o endereço e informe o número.");
  }
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-sm font-medium text-neutral-800">
        <span className="text-neutral-400">{n}. </span>
        {rotulo}
        {obrigatoria && <span className="text-red-600"> *</span>}
      </legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Digitos
          tipo="cep"
          rotulo="CEP"
          caminho={`${caminho}.cep`}
          obrigatoria={obrigatoria}
          aoCompletar={buscar}
          className="col-span-2 sm:col-span-2"
        />
        <Texto
          rotulo="Logradouro"
          caminho={`${caminho}.logradouro`}
          obrigatoria={obrigatoria}
          className="col-span-2 sm:col-span-4"
        />
        <Texto
          rotulo="Número"
          caminho={`${caminho}.numero`}
          obrigatoria={obrigatoria}
          max={20}
          className="col-span-1 sm:col-span-2"
        />
        <Texto
          rotulo="Complemento"
          caminho={`${caminho}.complemento`}
          obrigatoria={false}
          max={80}
          className="col-span-1 sm:col-span-4"
        />
        <Texto
          rotulo="Bairro"
          caminho={`${caminho}.bairro`}
          obrigatoria={obrigatoria}
          max={80}
          className="col-span-2 sm:col-span-3"
        />
        <Texto
          rotulo="Cidade"
          caminho={`${caminho}.cidade`}
          obrigatoria={obrigatoria}
          max={80}
          className="col-span-1 sm:col-span-2"
        />
        <Escolha
          rotulo="UF"
          caminho={`${caminho}.uf`}
          obrigatoria={obrigatoria}
          opcoes={UFS}
          vazio="UF"
          className="col-span-1 sm:col-span-1"
        />
      </div>
    </fieldset>
  );
}

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="vidro flex flex-col gap-4 rounded-[1.75rem] p-5">
      <div>
        <h2 className="text-base font-semibold">{titulo}</h2>
        {descricao && (
          <p className="mt-1 text-xs text-neutral-500">{descricao}</p>
        )}
      </div>
      {children}
    </section>
  );
}

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

function Pessoa({
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

function Empresa() {
  const { r, definir } = useFicha();
  const e = r.empresa;
  const consultado = useRef("");
  async function buscar(cnpj: string) {
    if (!cnpjValido(cnpj) || consultado.current === cnpj) return;
    consultado.current = cnpj;
    const x = await consultarCnpj(cnpj);
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

function Renda() {
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

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export interface DocumentoEnviado {
  id: string;
  documento: string;
  arquivo_nome: string;
}

function Documentos({
  token,
  tipo,
  aceite,
  exigidos,
  enviados,
  aoMudar,
}: {
  token: string | null;
  tipo: TipoFicha;
  aceite: boolean;
  exigidos: DocumentoExigido[];
  enviados: DocumentoEnviado[];
  aoMudar: (l: DocumentoEnviado[]) => void;
}) {
  const { erros } = useFicha();
  const [enviando, setEnviando] = useState<string | null>(null);
  const idBase = useId();
  async function enviar(documento: string, arquivo: File) {
    if (!token)
      return notificar("info", "Demonstração: nenhum arquivo é guardado.");
    const f = new FormData();
    f.set("token", token);
    f.set("tipo", tipo);
    f.set("documento", documento);
    f.set("aceite", aceite ? "1" : "");
    f.set("arquivo", arquivo);
    setEnviando(documento);
    try {
      const r = await enviarDocumentoPeloLink(f);
      if (r.erro) notificar("erro", r.erro);
      else if (r.documento) {
        aoMudar([
          ...enviados.filter((d) => d.documento !== documento),
          r.documento,
        ]);
        notificar("ok", `${documento}: arquivo enviado.`);
      }
    } catch {
      notificar(
        "erro",
        "O envio não chegou. Confira a internet e tente de novo.",
      );
    } finally {
      setEnviando(null);
    }
  }
  async function tirar(d: DocumentoEnviado) {
    if (!token) return;
    const f = new FormData();
    f.set("token", token);
    f.set("id", d.id);
    const r = await removerDocumentoPeloLink(f);
    if (r.erro) notificar("erro", r.erro);
    else aoMudar(enviados.filter((x) => x.id !== d.id));
  }
  return (
    <Secao
      titulo="Documentos comprobatórios"
      descricao="PDF ou foto (JPG, PNG, WEBP ou HEIC), até 8 MB cada. O arquivo sobe na hora; para trocar, envie outro."
    >
      {exigidos.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nenhum documento pedido para este tipo de ficha.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {exigidos.map((x, i) => {
          const enviado = enviados.find((d) => d.documento === x.documento);
          const id = `${idBase}-${i}`;
          return (
            <li
              key={x.documento}
              id={idDo(`documentos.${x.documento}`)}
              className={`flex flex-col gap-2 rounded-2xl border bg-white/70 p-4 ${erros[`documentos.${x.documento}`] ? "border-red-300" : "border-neutral-200"}`}
            >
              <p className="text-sm font-medium">
                {x.documento}
                {x.obrigatorio && <span className="text-red-600"> *</span>}
              </p>
              {enviado ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <FileCheck2 className="size-4 text-green-700" aria-hidden />
                  <span className="min-w-0 truncate text-neutral-700">
                    {enviado.arquivo_nome}
                  </span>
                  <button
                    type="button"
                    onClick={() => tirar(enviado)}
                    className="ml-auto text-xs font-medium text-red-700 hover:underline"
                  >
                    Tirar
                  </button>
                </div>
              ) : null}
              <label
                htmlFor={id}
                className="inline-flex cursor-pointer items-center gap-2 self-start rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
              >
                <Paperclip className="size-4" aria-hidden />
                {enviando === x.documento
                  ? "Enviando…"
                  : enviado
                    ? "Trocar arquivo"
                    : "Escolher arquivo"}
              </label>
              <input
                id={id}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic,.heif"
                className="sr-only"
                disabled={enviando !== null}
                onChange={(e) => {
                  const a = e.target.files?.[0];
                  e.target.value = "";
                  if (a) enviar(x.documento, a);
                }}
              />
              <Erro caminho={`documentos.${x.documento}`} />
            </li>
          );
        })}
      </ul>
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// A ficha
// ---------------------------------------------------------------------------

export function FormularioFicha({
  token,
  inicial,
  boasVindas,
  termoLgpd,
  documentos,
  enviados: enviadosIniciais,
  lucs,
  lucDoLink,
  hoje,
}: {
  /** null = demonstração (nada é gravado). */
  token: string | null;
  inicial: RespostasFicha;
  boasVindas: string;
  termoLgpd: string;
  documentos: Record<TipoFicha, DocumentoExigido[]>;
  enviados: DocumentoEnviado[];
  lucs: { valor: string; rotulo: string }[];
  lucDoLink: string | null;
  hoje: string;
}) {
  const [r, setR] = useState(inicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [enviados, setEnviados] = useState(enviadosIniciais);
  const [fim, setFim] = useState<"enviada" | string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const topo = useRef<HTMLDivElement>(null);

  const definir = (caminho: Caminho, valor: unknown) => {
    setR((atual) => com(atual, caminho.split("."), valor));
    setErros((e) => {
      if (!(caminho in e)) return e;
      const { [caminho]: _, ...resto } = e;
      return resto;
    });
  };

  function gravar(acao: "salvar" | "enviar", confirmar = false) {
    if (!token) {
      notificar(
        "info",
        "Demonstração: é assim que o interessado vê. Nada é gravado.",
      );
      return;
    }
    const f = new FormData();
    f.set("token", token);
    f.set("acao", acao);
    f.set("respostas", JSON.stringify(r));
    if (confirmar) f.set("confirmar", "1");
    iniciar(async () => {
      try {
        const res = await salvarFichaPeloLink({}, f);
        setProblemas(res.problemas ?? []);
        setErros(
          Object.fromEntries(
            (res.problemas ?? []).map((p) => [p.campo, p.mensagem]),
          ),
        );
        setAvisos(res.avisos ?? []);
        if (res.inativo) setFim(res.erro ?? "Este link não está mais ativo.");
        else if (res.enviada) setFim("enviada");
        if (res.ok) notificar("ok", res.ok);
        if (res.erro && !res.inativo) notificar("erro", res.erro);
        if (res.enviada || res.inativo)
          topo.current?.scrollIntoView({ behavior: "smooth" });
        const primeiro = res.problemas?.[0];
        if (primeiro)
          document
            .getElementById(idDo(primeiro.campo))
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        notificar(
          "erro",
          "Não deu para salvar agora. Confira a internet e tente de novo.",
        );
      }
    });
  }

  if (fim)
    return (
      <div
        ref={topo}
        className="vidro flex flex-col items-center gap-4 rounded-[1.75rem] px-6 py-12 text-center"
      >
        <span className="grid size-16 place-items-center rounded-full bg-neutral-900 text-white">
          <Send className="size-7" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold">
          {fim === "enviada"
            ? "Ficha enviada. Obrigado!"
            : "Este link não está mais ativo"}
        </h1>
        <p className="max-w-sm text-sm text-neutral-600">
          {fim === "enviada"
            ? "A equipe da ARP recebeu os seus dados e os documentos e entra em contato para os próximos passos."
            : fim}
        </p>
      </div>
    );

  const tipo = r.tipo || null;
  const pj = tipo === "pj";
  const opcoesLuc = [{ valor: LUC_NAO_SEI, rotulo: "Ainda não sei" }, ...lucs];

  return (
    <Ctx value={{ r, definir, erros, hoje }}>
      <div ref={topo} className="flex flex-col gap-4">
        <section className="destaque flex flex-col gap-3 rounded-[1.75rem] p-5">
          <p className="text-xs font-medium tracking-[0.14em] text-[rgb(255_255_255/0.6)] uppercase">
            Espaço ARP · Ficha cadastral
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Formulário cadastral
          </h1>
          <p className="text-sm whitespace-pre-wrap">{boasVindas}</p>
        </section>

        <Secao
          titulo="Para começar"
          descricao="Os campos com * são obrigatórios."
        >
          <Texto n={1} rotulo="E-mail" caminho="email" email max={160} />
          <div id={idDo("aceite")} className="flex flex-col gap-1.5">
            <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
              <input
                type="checkbox"
                checked={r.aceite}
                onChange={(e) => definir("aceite", e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-neutral-900"
              />
              <span>
                <b>2. </b>
                {termoLgpd}
                <span className="text-red-600"> *</span>
              </span>
            </label>
            <Erro caminho="aceite" />
          </div>
        </Secao>

        {!r.aceite ? (
          <p className="vidro rounded-[1.75rem] p-5 text-sm text-neutral-600">
            Marque o aceite do termo da LGPD (pergunta 2) para continuar a
            ficha.
          </p>
        ) : (
          <>
            <Secao titulo="Tipo de formulário e imóvel">
              <Escolha
                n={3}
                rotulo="Imóvel pretendido (bloco e nº da unidade)"
                caminho="luc"
                opcoes={opcoesLuc}
                dica={
                  lucDoLink && r.luc === lucDoLink
                    ? "Veio preenchido pelo link."
                    : undefined
                }
              />
              <fieldset id={idDo("tipo")} className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-neutral-800">
                  <span className="text-neutral-400">4. </span>Que tipo de
                  formulário você seguirá?
                  <span className="text-red-600"> *</span>
                </legend>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {TIPOS_FICHA.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={r.tipo === t}
                      onClick={() => definir("tipo", t)}
                      className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 aria-pressed:border-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white"
                    >
                      {ROTULO_TIPO[t]}
                    </button>
                  ))}
                </div>
                <Erro caminho="tipo" />
              </fieldset>
            </Secao>

            {pj && <Empresa />}
            {tipo &&
              (pj ? r.pessoas : r.pessoas.slice(0, 1)).map((_, i) => (
                <Pessoa
                  // biome-ignore lint/suspicious/noArrayIndexKey: a posição é o sócio
                  key={i}
                  i={i}
                  titulo={
                    pj
                      ? r.pessoas.length > 1
                        ? `Sócio administrador ${i + 1}`
                        : "Sócio administrador"
                      : tipo === "fiador"
                        ? "Dados cadastrais — fiador(a)"
                        : "Dados cadastrais — pessoa física"
                  }
                  remover={
                    pj && i > 0
                      ? () =>
                          definir(
                            "pessoas",
                            r.pessoas.filter((__, j) => j !== i),
                          )
                      : undefined
                  }
                />
              ))}
            {pj && r.pessoas.length < MAXIMO_SOCIOS && (
              <button
                type="button"
                onClick={() =>
                  definir("pessoas", [...r.pessoas, pessoaVazia()])
                }
                className="vidro inline-flex items-center justify-center gap-2 rounded-[1.75rem] p-4 text-sm font-medium text-neutral-800 transition hover:bg-white/80"
              >
                <Plus className="size-4" aria-hidden />
                Adicionar outro sócio administrador
              </button>
            )}
            {tipo && <Renda />}
            {tipo && (
              <Documentos
                token={token}
                tipo={tipo}
                aceite={r.aceite}
                exigidos={documentos[tipo]}
                enviados={enviados}
                aoMudar={setEnviados}
              />
            )}
            {tipo && (
              <Secao titulo="Envio do formulário">
                <p className="text-sm text-neutral-600">
                  Ao preencher seu nome completo abaixo, você confirma a
                  veracidade das informações e o consentimento de uso de dados.
                </p>
                <Texto n={48} rotulo="Nome completo" caminho="assinatura" />
              </Secao>
            )}
          </>
        )}

        {problemas.length > 0 && (
          <div
            role="alert"
            className="rounded-[1.75rem] bg-red-500/[0.08] p-5 text-sm text-red-800"
          >
            <p className="font-medium">Falta responder ou corrigir:</p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              {problemas.slice(0, 12).map((p) => (
                <li key={p.campo}>
                  <a
                    href={`#${idDo(p.campo)}`}
                    className="underline underline-offset-2"
                  >
                    {p.pergunta ? `${p.pergunta}. ` : ""}
                    {p.mensagem}
                  </a>
                </li>
              ))}
              {problemas.length > 12 && (
                <li>e mais {problemas.length - 12}.</li>
              )}
            </ul>
          </div>
        )}

        {avisos.length > 0 && (
          <div className="flex flex-col gap-3 rounded-[1.75rem] bg-amber-400/15 p-5 text-sm text-amber-900">
            {avisos.map((a) => (
              <p key={a} className="flex gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {a}
              </p>
            ))}
            <button
              type="button"
              disabled={ocupado}
              onClick={() => gravar("enviar", true)}
              className="self-start rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Está certo, enviar assim
            </button>
          </div>
        )}

        <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-2 rounded-[1.75rem] border border-neutral-900/[0.06] bg-white/85 p-3 backdrop-blur sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={ocupado || !r.aceite}
            onClick={() => gravar("salvar")}
            className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:opacity-60"
          >
            Salvar e continuar depois
          </button>
          <button
            type="button"
            disabled={ocupado || !r.aceite || !tipo}
            onClick={() => gravar("enviar")}
            className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {ocupado ? "Enviando…" : "Enviar ficha"}
          </button>
        </div>
      </div>
    </Ctx>
  );
}
