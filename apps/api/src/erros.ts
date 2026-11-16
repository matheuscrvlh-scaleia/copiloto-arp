import type { CodigoDeErro } from "@arp/shared/contratos/erro";

// Erros que o service lança e o plugin de erros (http/erros.ts) converte em
// resposta. `message` é para a pessoa ler: português, sem detalhe técnico.

export class ErroDaApi extends Error {
  constructor(
    readonly codigo: CodigoDeErro,
    readonly statusCode: number,
    mensagem: string,
    readonly campos?: Record<string, string>,
  ) {
    super(mensagem);
    this.name = new.target.name;
  }
}

/** 400: entrada inválida. `campos`: campo → mensagem. */
export class ErroDeValidacao extends ErroDaApi {
  constructor(mensagem: string, campos?: Record<string, string>) {
    super("validacao", 400, mensagem, campos);
  }
}

/** 401: sem sessão válida. */
export class ErroNaoAutenticado extends ErroDaApi {
  constructor(mensagem = "Entre no sistema para continuar.") {
    super("nao_autenticado", 401, mensagem);
  }
}

/** 403: logado, mas sem a permissão. */
export class ErroDePermissao extends ErroDaApi {
  constructor(mensagem = "Você não tem permissão para isso.") {
    super("sem_permissao", 403, mensagem);
  }
}

/** 403: precisa trocar a senha provisória antes de qualquer outra coisa. */
export class ErroDeSenhaProvisoria extends ErroDaApi {
  constructor() {
    super("senha_provisoria", 403, "Defina a sua senha para continuar.");
  }
}

/** 404. */
export class ErroNaoEncontrado extends ErroDaApi {
  constructor(mensagem = "Registro não encontrado.") {
    super("nao_encontrado", 404, mensagem);
  }
}

/** 409: já existe ou mudou no meio do caminho. */
export class ErroDeConflito extends ErroDaApi {
  constructor(mensagem: string) {
    super("conflito", 409, mensagem);
  }
}

/** 422: regra de negócio. */
export class ErroDeNegocio extends ErroDaApi {
  constructor(mensagem: string) {
    super("regra", 422, mensagem);
  }
}

/** 429: muitas tentativas. */
export class ErroDeLimite extends ErroDaApi {
  constructor(
    mensagem = "Muitas requisições. Aguarde um instante e tente de novo.",
  ) {
    super("limite", 429, mensagem);
  }
}
