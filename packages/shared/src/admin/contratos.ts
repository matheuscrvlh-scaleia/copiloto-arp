import { z } from "zod";
import { SENHA_MAXIMO, SENHA_MINIMO } from "../contratos/auth";
import { cnpjValido, soDigitos, UFS } from "../documentos";
import { MODULOS, TIPOS } from "../historico";
import { SISTEMAS } from "../integracoes";
import { PERMISSOES, type Permissao } from "../permissions";

// Contrato da Administração (/api/v1/admin/*), usado pela API e pela tela.
// As mensagens de validação já levam o nome do campo ("Nome: informe o
// nome"), como a tela sempre mostrou.
//
//   GET    /admin/usuarios                    → RespostaUsuarios
//   POST   /admin/usuarios                    EntradaNovoUsuario → RespostaCriado
//   GET    /admin/usuarios/:id                → RespostaUsuario
//   PATCH  /admin/usuarios/:id                EntradaUsuario → RespostaMensagem
//   PATCH  /admin/usuarios/:id/situacao       EntradaSituacao → RespostaMensagem
//   POST   /admin/usuarios/:id/senha          EntradaSenha → RespostaMensagem
//   DELETE /admin/usuarios/:id/permissoes     → RespostaMensagem
//   DELETE /admin/usuarios/:id                → RespostaMensagem
//   GET    /admin/cargos                      → RespostaCargos
//   POST   /admin/cargos                      EntradaCargo → RespostaCriado
//   PATCH  /admin/cargos/:id                  EntradaCargo → RespostaMensagem
//   PATCH  /admin/cargos/:id/situacao         EntradaSituacao → RespostaMensagem
//   DELETE /admin/cargos/:id                  → RespostaMensagem
//   GET    /admin/empresa                     → RespostaEmpresa
//   PATCH  /admin/empresa                     EntradaEmpresa → RespostaMensagem
//   GET    /admin/historico                   ConsultaDoHistorico → RespostaHistorico
//   GET    /admin/historico/autores           → RespostaAutores
//   GET    /admin/integracoes                 ConsultaDasIntegracoes → RespostaIntegracoes
//   PUT    /admin/integracoes/:sistema        EntradaIntegracao → RespostaIntegracaoSalva
//   POST   /admin/integracoes/:sistema/teste  → RespostaMensagem
//   POST   /admin/integracoes/:sistema/sincronizacao → RespostaMensagem
//   DELETE /admin/integracoes/:sistema        → RespostaMensagem

const ehPermissao = (p: string): p is Permissao => p in PERMISSOES;
const permissao = z.string().refine(ehPermissao);

/** Texto de formulário: "" e ausente viram null. */
const opcional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : String(v).trim()),
    schema.nullable(),
  );

export const parametrosDoId = z.object({ id: z.uuid() });
export type ParametrosDoId = z.infer<typeof parametrosDoId>;

export const respostaCriado = z.object({ id: z.uuid(), mensagem: z.string() });
export type RespostaCriado = z.infer<typeof respostaCriado>;

// ---------------------------------------------------------------------------
// Usuários e cargos
// ---------------------------------------------------------------------------

export const cargo = z.object({
  id: z.uuid(),
  nome: z.string(),
  descricao: z.string().nullable(),
  /** Inativo continua nos usuários, mas não dá permissão. */
  ativo: z.boolean(),
  permissoes: z.array(permissao),
  usuarios: z.number().int(),
});
export type Cargo = z.infer<typeof cargo>;

export const respostaCargos = z.object({ cargos: z.array(cargo) });
export type RespostaCargos = z.infer<typeof respostaCargos>;

export const usuarioAdmin = z.object({
  id: z.uuid(),
  nome: z.string(),
  email: z.string(),
  ativo: z.boolean(),
  cargoId: z.uuid().nullable(),
  /** Permissões individuais (fora as do cargo). */
  permissoes: z.array(permissao),
  criadoEm: z.string(),
  ultimoAcesso: z.string().nullable(),
});
export type UsuarioAdmin = z.infer<typeof usuarioAdmin>;

export const respostaUsuarios = z.object({ usuarios: z.array(usuarioAdmin) });
export type RespostaUsuarios = z.infer<typeof respostaUsuarios>;

export const respostaUsuario = z.object({ usuario: usuarioAdmin });
export type RespostaUsuario = z.infer<typeof respostaUsuario>;

const cargoId = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.uuid("Cargo: inválido").nullable(),
);
const nome = z.string().trim().min(2, "Nome: informe o nome");
const senha = z
  .string()
  .min(SENHA_MINIMO, "Senha: mínimo de 10 caracteres")
  .max(SENHA_MAXIMO, "Senha: máximo de 72 caracteres");

export const entradaNovoUsuario = z.object({
  nome,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("E-mail: e-mail inválido").max(320)),
  senha,
  cargo_id: cargoId,
});
export type EntradaNovoUsuario = z.infer<typeof entradaNovoUsuario>;

export const entradaUsuario = z.object({ nome, cargo_id: cargoId });
export type EntradaUsuario = z.infer<typeof entradaUsuario>;

/** `ativo` chega como texto do formulário ("true"/"false") ou booleano. */
export const entradaSituacao = z.object({
  ativo: z.preprocess(
    (v) => (v === "true" ? true : v === "false" ? false : v),
    z.boolean(),
  ),
});
export type EntradaSituacao = z.infer<typeof entradaSituacao>;

// Confirmação só para a própria senha; a provisória fica à vista na tela.
export const entradaSenha = z
  .object({ senha, confirmacao: z.string().max(200).optional() })
  .refine((v) => v.confirmacao === undefined || v.senha === v.confirmacao, {
    path: ["confirmacao"],
    message: "Confirmação: as senhas não conferem",
  });
export type EntradaSenha = z.infer<typeof entradaSenha>;

export const entradaCargo = z.object({
  nome,
  descricao: opcional(
    z.string().max(200, "Descrição: máximo de 200 caracteres"),
  ),
  /** Uma caixa marcada chega como texto solto; várias, como lista. */
  permissoes: z.preprocess(
    (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]),
    z.array(z.string().refine(ehPermissao, "permissoes: desconhecida")),
  ),
});
export type EntradaCargo = z.infer<typeof entradaCargo>;

// ---------------------------------------------------------------------------
// Empresa
// ---------------------------------------------------------------------------

export const empresa = z.object({
  nome: z.string(),
  razao_social: z.string().nullable(),
  cnpj: z.string().nullable(),
  email: z.string().nullable(),
  telefone: z.string().nullable(),
  site: z.string().nullable(),
  endereco: z.string().nullable(),
  cidade: z.string().nullable(),
  uf: z.string().nullable(),
  cep: z.string().nullable(),
  atualizado_em: z.string(),
});
export type Empresa = z.infer<typeof empresa>;

export const respostaEmpresa = z.object({ empresa: empresa.nullable() });
export type RespostaEmpresa = z.infer<typeof respostaEmpresa>;

export const entradaEmpresa = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Nome: informe o nome")
    .max(60, "Nome: máximo de 60"),
  razao_social: opcional(z.string().max(150, "Razão social: máximo de 150")),
  cnpj: opcional(
    z
      .string()
      .transform(soDigitos)
      .refine(cnpjValido, "CNPJ: dígitos não conferem"),
  ),
  email: opcional(z.email("E-mail: e-mail inválido")),
  telefone: opcional(z.string().max(30, "Telefone: máximo de 30")),
  site: opcional(
    z.url({ protocol: /^https?$/, error: "Site: use http(s)://…" }),
  ),
  endereco: opcional(z.string().max(200, "Endereço: máximo de 200")),
  cidade: opcional(z.string().max(80, "Cidade: máximo de 80")),
  uf: opcional(z.enum(UFS, "UF: escolha a UF")),
  cep: opcional(
    z
      .string()
      .transform(soDigitos)
      .refine((v) => v.length === 8, "CEP: 8 dígitos"),
  ),
});
export type EntradaEmpresa = z.infer<typeof entradaEmpresa>;

// ---------------------------------------------------------------------------
// Histórico
// ---------------------------------------------------------------------------

const chaveDe = <T extends string>(lista: Record<T, string>) =>
  z.string().refine((v): v is T => v in lista);
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Os filtros já lidos da URL da tela (@arp/shared/historico). */
export const consultaDoHistorico = z.object({
  busca: z.string().trim().max(100).optional(),
  modulo: chaveDe(MODULOS).optional(),
  tipo: chaveDe(TIPOS).optional(),
  usuario: z.uuid().optional(),
  de: dia.optional(),
  ate: dia.optional(),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
});
export type ConsultaDoHistorico = z.infer<typeof consultaDoHistorico>;

const objeto = z.record(z.string(), z.unknown()).nullable();

/** `tipo` e `modulo` vêm do banco: chaves de TIPOS e MODULOS (@arp/shared/historico). */
export const linhaHistorico = z.object({
  tipo: z.string(),
  id: z.string(),
  em: z.string(),
  modulo: z.string(),
  usuarioId: z.string().nullable(),
  usuarioNome: z.string().nullable(),
  acao: z.string(),
  objeto: z.string().nullable(),
  registroId: z.string().nullable(),
  descricao: z.string().nullable(),
  antes: objeto,
  depois: objeto,
});

export const respostaHistorico = z.object({
  linhas: z.array(linhaHistorico),
  total: z.number().int(),
});
export type RespostaHistorico = z.infer<typeof respostaHistorico>;

export const respostaAutores = z.object({
  autores: z.array(z.object({ id: z.uuid(), nome: z.string() })),
});
export type RespostaAutores = z.infer<typeof respostaAutores>;

// ---------------------------------------------------------------------------
// Integrações
// ---------------------------------------------------------------------------

const sistema = z.enum(SISTEMAS);

export const parametrosDoSistema = z.object({ sistema });
export type ParametrosDoSistema = z.infer<typeof parametrosDoSistema>;

export const consultaDasIntegracoes = z.object({
  modulo: z.enum(["admin", "marketing"]).default("admin"),
});
export type ConsultaDasIntegracoes = z.infer<typeof consultaDasIntegracoes>;

export const integracaoNaTela = z.object({
  sistema,
  /** "tela": salva na Administração; "ambiente": vem do .env; null: nenhuma. */
  origem: z.enum(["tela", "ambiente"]).nullable(),
  parametros: z.record(z.string(), z.unknown()),
  ativa: z.boolean(),
  configuradoPor: z.string().nullable(),
  configuradoEm: z.string().nullable(),
  testadoEm: z.string().nullable(),
  testeOk: z.boolean().nullable(),
  testeMensagem: z.string().nullable(),
});
export type IntegracaoNaTela = z.infer<typeof integracaoNaTela>;

export const execucao = z.object({
  sistema: z.string(),
  recurso: z.string(),
  status: z.enum(["rodando", "sucesso", "erro"]),
  iniciado_em: z.string(),
  finalizado_em: z.string().nullable(),
  registros: z.number(),
  erro: z.string().nullable(),
  /** O que a execução pediu para conferir (sem dado pessoal). */
  avisos: z.array(z.string()),
});
export type Execucao = z.infer<typeof execucao>;

export const respostaIntegracoes = z.object({
  cofre: z.boolean(),
  integracoes: z.array(integracaoNaTela),
  historico: z.array(execucao),
});
export type RespostaIntegracoes = z.infer<typeof respostaIntegracoes>;

export const entradaIntegracao = z.object({
  /** Campos comuns do cartão (validados pela definição da integração). */
  campos: z.record(z.string(), z.string().max(2000)),
  /** Segredo em branco mantém o salvo. */
  segredos: z.record(z.string(), z.string().max(8000)),
  ativa: z.boolean(),
  sem_teste: z.boolean(),
  /** O botão "Conectar com …" (OAuth). */
  autorizar: z.boolean(),
});
export type EntradaIntegracao = z.infer<typeof entradaIntegracao>;

export const respostaIntegracaoSalva = z.object({
  mensagem: z.string(),
  /** Tela de autorização da ferramenta (OAuth), para onde a pessoa segue. */
  redirecionar: z.url().optional(),
});
export type RespostaIntegracaoSalva = z.infer<typeof respostaIntegracaoSalva>;
