import { formatarNumero } from "@arp/shared/formato";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Janela } from "@/components/janela";
import {
  botao,
  pilulaEscolha,
  rotulo,
} from "@/modules/os/components/ordem/estilos";
import {
  reativarParticipante,
  registrarSaida,
  salvarContato,
  salvarDadosDoParticipante,
  salvarValorCombinado,
} from "../../api-clube";

// Dados do participante no detalhe (spec 4.5): formas de participação, nome
// (só no cadastro manual), contato (só com "Ver contato"), valor combinado
// por mês (só com "Ver valores") e "Saiu" com motivo. Quem não edita o Clube
// só lê.

export function FormasEDados({
  participanteId,
  formas,
  formasDoClube,
  nome,
  nomeEditavel,
}: {
  participanteId: string;
  formas: string[];
  /** clube_formas dos Parâmetros. */
  formasDoClube: string[];
  nome: string;
  /** Cadastro manual: o nome é nosso; o do ENET vem do contrato. */
  nomeEditavel: boolean;
}) {
  // Forma que saiu da lista dos Parâmetros mas ainda está no cadastro.
  const opcoes = [
    ...formasDoClube,
    ...formas.filter((f) => !formasDoClube.includes(f)),
  ];
  return (
    <FormAcao
      acao={salvarDadosDoParticipante}
      rotulo="Salvar"
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="participante_id" value={participanteId} />
      {nomeEditavel && (
        <label className={rotulo}>
          Nome
          <input
            name="nome"
            required
            defaultValue={nome}
            maxLength={200}
            className={classeCampo}
          />
        </label>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium text-neutral-600">
          Formas de participação (pode marcar mais de uma)
        </legend>
        <div className="flex flex-wrap gap-2">
          {opcoes.map((f) => (
            <label key={f} className={pilulaEscolha}>
              <input
                type="checkbox"
                name="forma"
                value={f}
                defaultChecked={formas.includes(f)}
                className="sr-only"
              />
              {f}
            </label>
          ))}
        </div>
      </fieldset>
    </FormAcao>
  );
}

export function FormContato({
  participanteId,
  contato,
}: {
  participanteId: string;
  contato: {
    email: string | null;
    telefone: string | null;
    contato: string | null;
  } | null;
}) {
  return (
    <FormAcao
      acao={salvarContato}
      rotulo="Salvar contato"
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="participante_id" value={participanteId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className={rotulo}>
          Contato (nome)
          <input
            name="contato"
            defaultValue={contato?.contato ?? ""}
            maxLength={200}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          E-mail
          <input
            name="email"
            type="email"
            defaultValue={contato?.email ?? ""}
            maxLength={200}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Telefone
          <input
            name="telefone"
            type="tel"
            defaultValue={contato?.telefone ?? ""}
            maxLength={40}
            className={classeCampo}
          />
        </label>
      </div>
    </FormAcao>
  );
}

export function FormValorCombinado({
  participanteId,
  valor,
}: {
  participanteId: string;
  valor: number | null;
}) {
  return (
    <FormAcao
      acao={salvarValorCombinado}
      rotulo="Salvar valor"
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="participante_id" value={participanteId} />
      <label className={`${rotulo} max-w-xs`}>
        Valor combinado por mês, em reais (deixe vazio se não houver)
        <input
          name="valor"
          inputMode="decimal"
          defaultValue={valor === null ? "" : formatarNumero(valor, 2)}
          placeholder="0,00"
          className={classeCampo}
        />
      </label>
    </FormAcao>
  );
}

export function SairDoClube({
  participanteId,
  hoje,
}: {
  participanteId: string;
  hoje: string;
}) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button
        type="button"
        data-guia="saiu"
        onClick={() => setAberta(true)}
        aria-haspopup="dialog"
        className={botao.perigo}
      >
        <LogOut className="size-4" aria-hidden />
        Registrar saída
      </button>
      <Janela
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Registrar saída do clube"
        descricao="O participante passa a Saiu e o chamado de renovação do termo, se estiver aberto, é cancelado. O histórico dos termos, contribuições e ações fica."
      >
        <FormAcao
          acao={registrarSaida}
          rotulo="Registrar saída"
          rotuloEnviando="Salvando…"
          variante="perigo"
          className="flex flex-col gap-3"
          aoConcluir={() => setAberta(false)}
        >
          <input type="hidden" name="participante_id" value={participanteId} />
          <label className={rotulo}>
            Data da saída
            <input
              type="date"
              name="saiu_em"
              required
              max={hoje}
              defaultValue={hoje}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Motivo
            <textarea
              name="motivo"
              required
              rows={3}
              maxLength={500}
              className={classeCampo}
              placeholder="Por que saiu do clube?"
            />
          </label>
        </FormAcao>
      </Janela>
    </>
  );
}

export function VoltarAoClube({ participanteId }: { participanteId: string }) {
  return (
    <FormAcao
      acao={reativarParticipante}
      rotulo="Voltar ao clube"
      rotuloEnviando="Salvando…"
      variante="secundario"
      confirmar="Tirar o Saiu e voltar o participante ao clube? A situação passa a valer pelo termo."
    >
      <input type="hidden" name="participante_id" value={participanteId} />
    </FormAcao>
  );
}
