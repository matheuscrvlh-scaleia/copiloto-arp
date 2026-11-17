// Configurações › Parâmetros do Comercial (spec 4.13): um bloco por linha do
// quadro, a validação de cada um (a mesma no formulário e no "salvar"), a
// sincronização das listas editáveis e a leitura do histórico
// (core.auditoria). Funções puras.

export { feriado } from "./calendario";
export { numeroDigitado } from "./campo";
export * from "./campos";
export {
  CAMPOS_GARANTIA,
  GARANTIAS,
  type Garantia,
  INDICES,
  obrigatoriosDoForm,
} from "./contratos";
export {
  conferirFaixasEvento,
  type FaixaDigitada,
  faixaEvento,
} from "./eventos";
export { fonteDePara } from "./funil";
export * from "./historico";
export * from "./listas";
export { tipoLuc } from "./ocupacao";
export { faixasM2 } from "./pesquisa";
export * from "./quadro";
