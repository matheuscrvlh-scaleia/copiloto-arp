import {
  type ItemLista,
  listasDoBloco,
  type NomeLista,
} from "@/lib/comercial/parametros";
import type { Lista } from "@/server/comercial/base";
import { EditorLista } from "../campos";

// Os blocos de Comercial › Configurações › Parâmetros, um por linha do quadro
// de 4.13. Cada formulário salva só o seu pedaço; a mudança vale nas telas na
// próxima atualização (a ação invalida a tag do cadastro).

export const lista = "flex flex-col divide-y divide-neutral-900/[0.06]";
export const opcoes = (vs: string[]) =>
  vs.map((v) => ({ valor: v, rotulo: v }));
export const separador = "mt-4 border-t border-neutral-900/[0.06] pt-4";

function itensDa(todas: Lista[], l: NomeLista): ItemLista[] {
  return todas
    .filter((x) => x.lista === l)
    .map((x) => ({
      id: x.id,
      valor: x.valor,
      ordem: x.ordem,
      ativo: x.ativo,
      extra: (x.extra ?? {}) as Record<string, unknown>,
    }));
}

/** As listas do bloco, cada uma com o seu editor. */
export function ListasDoBloco({
  bloco,
  listas,
}: {
  bloco: Parameters<typeof listasDoBloco>[0];
  listas: Lista[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {listasDoBloco(bloco).map((l) => (
        <EditorLista key={l} lista={l} itens={itensDa(listas, l)} />
      ))}
    </div>
  );
}

export const ativosDa = (todas: Lista[], l: NomeLista) =>
  itensDa(todas, l)
    .filter((i) => i.ativo)
    .sort((a, b) => a.ordem - b.ordem)
    .map((i) => i.valor);
