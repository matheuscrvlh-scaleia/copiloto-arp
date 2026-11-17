import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { rotulo } from "@/modules/os/components/ordem/estilos";
import {
  anexarPapel,
  corrigirAtivacao,
  desfazerDispensa,
  dispensarEntrevista,
  prazoDoContrato,
  transferirEntrevista,
} from "../../api-entrevistas";

// Ações da ficha da entrevista (spec 4.4): dispensar (o chamado pendente é
// cancelado com o mesmo motivo), desfazer a dispensa, corrigir a data de
// inauguração, prazo específico do contrato, transferir entrevista para
// outro contrato do mesmo cliente e anexar o papel digitalizado. Só para
// "Entrevistas – dispensar ou corrigir" (o RLS confere de novo).

function Bloco({
  titulo,
  descricao,
  children,
  guia,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
  guia: string;
}) {
  return (
    <details
      data-guia={guia}
      className="group rounded-2xl border border-neutral-200 bg-white/70 px-4 py-3"
    >
      <summary className="cursor-pointer list-none text-sm font-medium text-neutral-800 marker:hidden">
        {titulo}
        <span className="ml-2 text-xs font-normal text-neutral-500">
          {descricao}
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function AcoesDaFicha({
  contratoId,
  dispensada,
  motivos,
  ativacaoCorrigida,
  validadeEspecifica,
  entrevistas,
  mesmoCliente,
}: {
  contratoId: string;
  dispensada: boolean;
  motivos: string[];
  ativacaoCorrigida: string | null;
  validadeEspecifica: number | null;
  entrevistas: { id: string; rotulo: string }[];
  mesmoCliente: { id: string; rotulo: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {dispensada ? (
        <Bloco
          guia="desfazer-dispensa"
          titulo="Desfazer dispensa"
          descricao="O contrato volta para a lista e o chamado é reaberto."
        >
          <FormAcao
            acao={desfazerDispensa}
            rotulo="Desfazer dispensa"
            rotuloEnviando="Desfazendo…"
            confirmar="O contrato volta a precisar de entrevista e ganha um chamado novo. Continuar?"
          >
            <input type="hidden" name="contrato_id" value={contratoId} />
          </FormAcao>
        </Bloco>
      ) : (
        <Bloco
          guia="dispensar"
          titulo="Dispensar entrevista"
          descricao="Com motivo; o chamado pendente é cancelado com o mesmo motivo."
        >
          <FormAcao
            acao={dispensarEntrevista}
            rotulo="Dispensar"
            rotuloEnviando="Dispensando…"
            variante="perigo"
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="contrato_id" value={contratoId} />
            <label className={rotulo}>
              Motivo
              <select name="motivo" required className={classeCampo}>
                {motivos.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className={rotulo}>
              Observação
              <textarea
                name="observacao"
                maxLength={400}
                rows={2}
                className={classeCampo}
                placeholder="Obrigatória com o motivo “Outro”"
              />
            </label>
          </FormAcao>
        </Bloco>
      )}

      <Bloco
        guia="corrigir-inauguracao"
        titulo="Corrigir data de inauguração"
        descricao="Quando a data do cadastro não é a da abertura da loja."
      >
        <FormAcao
          acao={corrigirAtivacao}
          rotulo="Salvar correção"
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="contrato_id" value={contratoId} />
          <label className={rotulo}>
            Data de inauguração (vazio volta à data do cadastro)
            <input
              type="date"
              name="data"
              defaultValue={ativacaoCorrigida ?? ""}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Motivo (obrigatório)
            <input
              name="motivo"
              maxLength={500}
              className={classeCampo}
              placeholder="Ex.: a loja abriu depois da assinatura do contrato"
            />
          </label>
        </FormAcao>
      </Bloco>

      <Bloco
        guia="prazo-especifico"
        titulo="Prazo específico do contrato"
        descricao="Troca a validade do setor só para este contrato."
      >
        <FormAcao
          acao={prazoDoContrato}
          rotulo="Salvar prazo"
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="contrato_id" value={contratoId} />
          <label className={rotulo}>
            Validade em meses (vazio volta ao prazo do setor)
            <input
              name="meses"
              inputMode="numeric"
              pattern="\d*"
              maxLength={3}
              defaultValue={validadeEspecifica ?? ""}
              className={classeCampo}
            />
          </label>
        </FormAcao>
      </Bloco>

      {entrevistas.length > 0 && (
        <Bloco
          guia="transferir"
          titulo="Transferir entrevista"
          descricao="Para outro contrato do mesmo cliente (mudou de LUC, mesma atividade)."
        >
          {mesmoCliente.length === 0 ? (
            <p className="text-sm text-neutral-500">
              O cliente não tem outro contrato (mesmo CPF ou CNPJ) para receber
              a entrevista.
            </p>
          ) : (
            <FormAcao
              acao={transferirEntrevista}
              rotulo="Transferir"
              rotuloEnviando="Transferindo…"
              confirmar="A entrevista passa a valer para o outro contrato e sai deste. Continuar?"
              className="flex flex-col gap-3"
            >
              <label className={rotulo}>
                Entrevista
                <select name="entrevista_id" className={classeCampo}>
                  {entrevistas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.rotulo}
                    </option>
                  ))}
                </select>
              </label>
              <label className={rotulo}>
                Para o contrato
                <select name="para_contrato_id" className={classeCampo}>
                  {mesmoCliente.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.rotulo}
                    </option>
                  ))}
                </select>
              </label>
              <label className={rotulo}>
                Motivo
                <input
                  name="motivo"
                  required
                  minLength={3}
                  maxLength={500}
                  className={classeCampo}
                  placeholder="Ex.: mudou da LUC 11_129 para a 11_140"
                />
              </label>
            </FormAcao>
          )}
        </Bloco>
      )}
    </div>
  );
}

/** Anexar o papel digitalizado a uma entrevista salva. */
export function AnexarPapel({ entrevistaId }: { entrevistaId: string }) {
  return (
    <FormAcao
      acao={anexarPapel}
      rotulo="Anexar"
      rotuloEnviando="Enviando…"
      variante="secundario"
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="entrevista_id" value={entrevistaId} />
      <label className={`${rotulo} min-w-0 flex-1`}>
        Papel digitalizado (PDF, JPG ou PNG, até 9 MB)
        <input
          type="file"
          name="arquivo"
          required
          accept="application/pdf,image/jpeg,image/png"
          className="text-sm"
        />
      </label>
    </FormAcao>
  );
}
