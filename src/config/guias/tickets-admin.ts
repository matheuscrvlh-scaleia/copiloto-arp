import {
  abas,
  abertura,
  busca,
  cartoes,
  exportar,
  filtros,
  menuDoModulo,
  secao,
  tabela,
} from "./comum";
import type { Guia } from "./tipos";

export const GUIAS_ADMIN: Record<string, Guia> = {
  "/admin/usuarios": {
    versao: 1,
    passos: [
      abertura(
        "Usuários e cargos",
        "Quem acessa o sistema e o que cada um vê. O cargo dá um conjunto de permissões; dá para somar permissões individuais.",
      ),
      abas(
        "<b>Usuários</b>: as pessoas. <b>Cargos</b>: os conjuntos de permissões. Mudar um cargo vale na hora para todos os usuários dele.",
      ),
      busca("Procure pelo nome ou e-mail."),
      tabela(
        "Clique num usuário para trocar o cargo, as permissões ou o acesso.",
      ),
    ],
  },
  "/admin/empresa": {
    versao: 1,
    passos: [
      abertura(
        "Empresa",
        "A identificação da empresa usada nas telas e nos relatórios exportados.",
      ),
      secao(),
    ],
  },
  "/admin/integracoes": {
    versao: 1,
    passos: [
      abertura(
        "Integrações",
        "O acesso de cada sistema externo (ENET, RD Station, Secullum, Meta…). Senhas e tokens são cifrados no servidor antes de gravar e nunca voltam para a tela.",
      ),
      secao(
        "Cada bloco é um sistema: preencha o acesso, teste a conexão e veja a última sincronização. Se uma tela mostrar dado de exemplo, a integração dela ainda não foi ligada aqui.",
      ),
    ],
  },
  "/admin/historico": {
    versao: 1,
    passos: [
      abertura(
        "Histórico de alterações",
        "Tudo o que acontece no sistema: quem alterou cada dado (com o antes e o depois), acessos, importações, testes e sincronizações.",
      ),
      filtros("Filtre por período, módulo, pessoa ou tipo de evento."),
      busca(),
      tabela("Clique numa linha para ver o antes e o depois."),
    ],
  },
};
