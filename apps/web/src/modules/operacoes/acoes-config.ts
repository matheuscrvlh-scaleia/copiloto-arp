import { camposDoForm } from "@arp/shared/operacoes/parametros";
import type { Acao } from "@/components/form-acao";
import { acaoDaApi } from "@/lib/acao";
import { texto } from "./acoes";
import { chavesOp } from "./api";

// Gravações de Configurações de Operações (cadastros e parâmetros), com os
// nomes das Server Actions do sistema antigo.

const CADASTROS = [chavesOp.cadastros(), chavesOp.tudo];

export const salvarHidrometro: Acao = acaoDaApi({
  metodo: "POST",
  caminho: "/operacoes/cadastros/hidrometros",
  invalida: CADASTROS,
});

export const excluirHidrometro: Acao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/operacoes/cadastros/hidrometros/${texto(form, "id")}`,
  invalida: CADASTROS,
});

export const salvarSala: Acao = acaoDaApi({
  metodo: "POST",
  caminho: "/operacoes/cadastros/salas",
  invalida: CADASTROS,
});

export const excluirSala: Acao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/operacoes/cadastros/salas/${texto(form, "id")}`,
  invalida: CADASTROS,
});

// Os parâmetros valem na hora para todas as telas do módulo.
export const salvarParametros: Acao = acaoDaApi({
  metodo: "PATCH",
  caminho: "/operacoes/parametros",
  corpo: camposDoForm,
  invalida: [chavesOp.tudo],
});

export const removerExemplos: Acao = acaoDaApi({
  metodo: "DELETE",
  caminho: "/operacoes/parametros/exemplos",
  invalida: [chavesOp.tudo],
});

export const salvarUnidade: Acao = acaoDaApi({
  metodo: "POST",
  caminho: "/operacoes/parametros/unidades-energia",
  invalida: [chavesOp.tudo],
});
