import { abertura, busca, filtros, secao, tabela } from "./comum";
import type { Guia } from "./tipos";

export const GUIAS_ADMIN: Record<string, Guia> = {
  "/admin/usuarios": {
    versao: 2,
    passos: [
      abertura(
        "Usuários e cargos",
        "Quem acessa o sistema e o que cada um vê. O cargo dá um conjunto de permissões; dá para somar permissões individuais.",
      ),
      {
        alvo: "aba:Usuários",
        titulo: "Passo 1. Dê acesso a uma pessoa",
        texto:
          "Cadastre o usuário e escolha o cargo. Clique num usuário para trocar o cargo, somar permissões ou bloquear o acesso.",
      },
      {
        alvo: "aba:Cargos",
        titulo: "Passo 2. Ajuste o que um grupo vê",
        texto:
          "Cada cargo é um conjunto de permissões. Mudar um cargo vale na hora para todos os usuários dele.",
      },
      busca("Busque pelo nome ou e-mail."),
      tabela(),
    ],
  },
  "/admin/empresa": {
    versao: 2,
    passos: [
      abertura(
        "Empresa",
        "A identificação da empresa usada nas telas e nos relatórios exportados.",
      ),
      secao(
        "Confira os dados e salve. Valem para os próximos arquivos exportados.",
      ),
    ],
  },
  "/admin/integracoes": {
    versao: 2,
    passos: [
      abertura(
        "Integrações",
        "O acesso de cada sistema externo (ENET, RD Station, Secullum, Meta…). Senhas e tokens são cifrados no servidor antes de gravar e nunca voltam para a tela.",
      ),
      secao(
        "<b>Passo 1.</b> Preencha o acesso do sistema. <b>Passo 2.</b> Teste a conexão. <b>Passo 3.</b> Confira a última sincronização. Tela com dado de exemplo é sinal de integração ainda não ligada aqui.",
      ),
    ],
  },
  "/admin/historico": {
    versao: 2,
    passos: [
      abertura(
        "Histórico de alterações",
        "Tudo o que acontece no sistema: quem alterou cada dado (com o antes e o depois), acessos, importações, testes e sincronizações.",
      ),
      filtros("<b>Passo 1.</b> Filtre por período, módulo, pessoa ou tipo."),
      busca(),
      tabela("<b>Passo 2.</b> Clique numa linha para ver o antes e o depois."),
    ],
  },
};
