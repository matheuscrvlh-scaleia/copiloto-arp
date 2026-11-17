import { formatarDocumento } from "@arp/shared/documentos";
import { Plus } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { type Acao, FormAcao } from "@/components/form-acao";
import { Janela } from "@/components/janela";
import { Selecao } from "@/components/selecao";
import { pilulaEscolha, rotulo } from "@/modules/os/components/ordem/estilos";

// "Novo participante" (spec 4.5): o cliente escolhido na lista de contratos
// (busca por nome, CPF ou CNPJ e LUC; o nome vem do contrato) ou o cadastro
// manual de quem não é locatário (nome, CPF ou CNPJ validado e contato).
// Contato só aparece para quem tem "Ver contato". O Clube é por cliente, não
// por LUC.

export interface ClienteDaLista {
  doc: string;
  nome: string;
  lucs: string[];
}

export function NovoParticipante({
  acao,
  clientes,
  formas,
  podeContato,
  abertaInicial = false,
}: {
  acao: Acao;
  clientes: ClienteDaLista[];
  /** clube_formas dos Parâmetros. */
  formas: string[];
  podeContato: boolean;
  abertaInicial?: boolean;
}) {
  const [aberta, setAberta] = useState(abertaInicial);
  const [origem, setOrigem] = useState<"cliente" | "manual">(
    clientes.length ? "cliente" : "manual",
  );
  const [cliente, setCliente] = useState("");

  return (
    <>
      <button
        type="button"
        data-guia="novo-participante"
        onClick={() => setAberta(true)}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
      >
        <Plus className="size-4" aria-hidden />
        Novo participante
      </button>
      <Janela
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Novo participante do Clube"
        descricao="O clube é por cliente (CPF ou CNPJ), não por loja: continua valendo se a empresa mudar de LUC."
      >
        <FormAcao
          acao={acao}
          rotulo="Cadastrar participante"
          rotuloEnviando="Cadastrando…"
          className="flex flex-col gap-4"
        >
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Origem do cadastro</legend>
            {(
              [
                ["cliente", "Cliente com contrato"],
                ["manual", "Cadastro manual (não locatário)"],
              ] as const
            ).map(([valor, texto]) => (
              <label key={valor} className={pilulaEscolha}>
                <input
                  type="radio"
                  name="origem"
                  value={valor}
                  checked={origem === valor}
                  onChange={() => setOrigem(valor)}
                  className="sr-only"
                />
                {texto}
              </label>
            ))}
          </fieldset>

          {origem === "cliente" ? (
            <label className={rotulo}>
              Cliente
              <Selecao
                name="cliente_doc"
                obrigatorio
                busca
                valor={cliente}
                aoMudar={setCliente}
                placeholder="Busque por nome, CNPJ ou LUC"
                opcoes={clientes.map((c) => ({
                  valor: c.doc,
                  rotulo: c.nome,
                  descricao: `${formatarDocumento(c.doc)}${c.lucs.length ? ` · ${c.lucs.join(", ")}` : ""}`,
                }))}
              />
              <span className="font-normal text-neutral-500">
                Só aparecem clientes com contrato vigente que ainda não são
                participantes.
              </span>
            </label>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={`${rotulo} sm:col-span-2`}>
                Nome
                <input
                  name="nome"
                  required
                  maxLength={200}
                  className={classeCampo}
                  placeholder="Nome da pessoa ou da empresa"
                />
              </label>
              <label className={rotulo}>
                CPF ou CNPJ
                <input
                  name="documento"
                  required
                  inputMode="numeric"
                  maxLength={30}
                  className={classeCampo}
                  placeholder="Só números ou com pontos"
                />
              </label>
            </div>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-medium text-neutral-600">
              Formas de participação (pode marcar mais de uma)
            </legend>
            <div className="flex flex-wrap gap-2">
              {formas.map((f) => (
                <label key={f} className={pilulaEscolha}>
                  <input
                    type="checkbox"
                    name="forma"
                    value={f}
                    className="sr-only"
                  />
                  {f}
                </label>
              ))}
              {formas.length === 0 && (
                <span className="text-sm text-neutral-500">
                  Nenhuma forma cadastrada nos Parâmetros.
                </span>
              )}
            </div>
          </fieldset>

          {podeContato && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className={rotulo}>
                Contato (nome)
                <input name="contato" maxLength={200} className={classeCampo} />
              </label>
              <label className={rotulo}>
                E-mail
                <input
                  name="email"
                  type="email"
                  maxLength={200}
                  className={classeCampo}
                />
              </label>
              <label className={rotulo}>
                Telefone
                <input
                  name="telefone"
                  type="tel"
                  maxLength={40}
                  className={classeCampo}
                />
              </label>
            </div>
          )}
        </FormAcao>
      </Janela>
    </>
  );
}
