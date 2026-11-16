import type { Modulo } from "@/app/rota";
import {
  EsqueletoDoInicio,
  EsqueletoDoNovoPedido,
  EsqueletoDoPedido,
} from "./components/portal/publico/esqueletos";

// Telas do Tickets (módulo `os`). Tudo fica dentro do layout de /os (o botão
// "+ Novo" de todas as telas): cada área acrescenta as suas telas em
// `filhas`, com o caminho relativo a "os". A permissão é conferida dentro de
// cada página (o cabeçalho aparece mesmo sem acesso, como antes).

export const os: Modulo = {
  nome: "os",
  autenticadas: [
    {
      // app/(app)/os/layout.tsx
      caminho: "os",
      pagina: () => import("./paginas/layout"),
      filhas: [
        // app/(app)/os/page.tsx
        {
          indice: true,
          titulo: "Minha caixa",
          pagina: () => import("./paginas/caixa"),
        },
        // app/(app)/os/chamados/[id]/page.tsx
        {
          caminho: "chamados/:id",
          titulo: "Chamado",
          pagina: () => import("./paginas/chamado"),
        },
        // app/(app)/os/chamados/[id]/imprimir/page.tsx
        {
          caminho: "chamados/:id/imprimir",
          titulo: "Imprimir chamado",
          pagina: () => import("./paginas/chamado-imprimir"),
        },
        // app/(app)/os/novo/page.tsx
        {
          caminho: "novo",
          titulo: "Novo chamado",
          pagina: () => import("./paginas/novo"),
        },
        // app/(app)/os/quadro/page.tsx
        {
          caminho: "quadro",
          titulo: "Quadro",
          pagina: () => import("./paginas/quadro"),
        },
        // app/(app)/os/meu-setor/page.tsx
        {
          caminho: "meu-setor",
          titulo: "Geral",
          pagina: () => import("./paginas/meu-setor"),
        },
        // app/(app)/os/avisos/page.tsx
        {
          caminho: "avisos",
          titulo: "Avisos",
          pagina: () => import("./paginas/avisos"),
        },
        // app/(app)/os/calendario/page.tsx
        {
          caminho: "calendario",
          titulo: "Calendário",
          pagina: () => import("./paginas/calendario"),
        },
        // app/(app)/os/disparos/page.tsx
        {
          caminho: "disparos",
          titulo: "Disparos e lembretes",
          pagina: () => import("./paginas/disparos"),
        },
        // app/(app)/os/ordens/page.tsx
        {
          caminho: "ordens",
          titulo: "Acompanhamento das OS",
          pagina: () => import("./paginas/ordens/acompanhamento"),
        },
        // app/(app)/os/ordens/caixa/page.tsx
        {
          caminho: "ordens/caixa",
          titulo: "Minha caixa das OS",
          pagina: () => import("./paginas/ordens/caixa"),
        },
        // app/(app)/os/ordens/meu-setor/page.tsx
        {
          caminho: "ordens/meu-setor",
          titulo: "Meu setor (OS)",
          pagina: () => import("./paginas/ordens/meu-setor"),
        },
        // app/(app)/os/ordens/quadro/page.tsx
        {
          caminho: "ordens/quadro",
          titulo: "Quadro das OS",
          pagina: () => import("./paginas/ordens/quadro"),
        },
        // app/(app)/os/ordens/nova/page.tsx
        {
          caminho: "ordens/nova",
          titulo: "Nova Ordem de Serviço",
          pagina: () => import("./paginas/ordens/nova"),
        },
        // app/(app)/os/ordens/[id]/page.tsx
        {
          caminho: "ordens/:id",
          titulo: "Ordem de serviço",
          pagina: () => import("./paginas/ordens/ordem"),
        },
        // app/(app)/os/paineis/page.tsx
        {
          caminho: "paineis",
          titulo: "Painéis",
          pagina: () => import("./paginas/paineis"),
        },
        // app/(app)/os/paineis/[setor]/page.tsx
        {
          caminho: "paineis/:setor",
          titulo: "Painel do setor",
          pagina: () => import("./paginas/paineis-setor"),
        },
        // app/(app)/os/ativos/** (lista, ficha, cadastro, categorias,
        // etiquetas e saídas; os PDFs passam para a API)
        {
          caminho: "ativos",
          titulo: "Ativos",
          pagina: () => import("./paginas/ativos/lista"),
        },
        {
          caminho: "ativos/novo",
          titulo: "Novo ativo",
          pagina: () => import("./paginas/ativos/novo"),
        },
        {
          caminho: "ativos/categorias",
          titulo: "Categorias de ativo",
          pagina: () => import("./paginas/ativos/categorias"),
        },
        {
          caminho: "ativos/etiquetas",
          titulo: "Etiquetas de ativos",
          pagina: () => import("./paginas/ativos/etiquetas"),
        },
        {
          caminho: "ativos/etiquetas/pdf",
          titulo: "Etiquetas de ativos",
          pagina: () => import("./paginas/pdf/etiquetas"),
        },
        {
          caminho: "ativos/saidas",
          titulo: "Saídas de ativos",
          pagina: () => import("./paginas/ativos/saidas"),
        },
        {
          caminho: "ativos/saidas/:id/recibo",
          titulo: "Recibo de saída",
          pagina: () => import("./paginas/pdf/recibo"),
        },
        {
          caminho: "ativos/:id",
          titulo: "Ativo",
          pagina: () => import("./paginas/ativos/ficha"),
        },
        {
          caminho: "ativos/:id/editar",
          titulo: "Editar ativo",
          pagina: () => import("./paginas/ativos/editar"),
        },
        // app/(app)/os/vistorias/**
        {
          caminho: "vistorias",
          titulo: "Vistorias",
          pagina: () => import("./paginas/vistorias/lista"),
        },
        {
          caminho: "vistorias/nova",
          titulo: "Nova vistoria",
          pagina: () => import("./paginas/vistorias/nova"),
        },
        {
          caminho: "vistorias/:id",
          titulo: "Vistoria",
          pagina: () => import("./paginas/vistorias/vistoria"),
        },
        {
          caminho: "vistorias/:id/comparar",
          titulo: "Entrada × saída",
          pagina: () => import("./paginas/vistorias/comparar"),
        },
        {
          caminho: "vistorias/:id/laudo",
          titulo: "Laudo da vistoria",
          pagina: () => import("./paginas/pdf/laudo"),
        },
        // app/(app)/os/portal/layout.tsx + as páginas dentro dele
        {
          caminho: "portal",
          pagina: () => import("./paginas/portal/layout"),
          filhas: [
            {
              indice: true,
              titulo: "Portal lojista",
              pagina: () => import("./paginas/portal/links"),
            },
            {
              caminho: "lojas",
              titulo: "Lojas · Portal lojista",
              pagina: () => import("./paginas/portal/lojas"),
            },
            {
              caminho: "lojas/nova",
              titulo: "Nova loja · Portal lojista",
              pagina: () => import("./paginas/portal/loja-nova"),
            },
            {
              caminho: "lojas/:id",
              titulo: "Loja · Portal lojista",
              pagina: () => import("./paginas/portal/loja"),
            },
            {
              caminho: "agendas",
              titulo: "Agendas · Portal lojista",
              pagina: () => import("./paginas/portal/agendas"),
            },
            {
              caminho: "agendas/nova",
              titulo: "Nova agenda · Portal lojista",
              pagina: () => import("./paginas/portal/agenda-nova"),
            },
            {
              caminho: "agendas/:id",
              titulo: "Agenda · Portal lojista",
              pagina: () => import("./paginas/portal/agenda"),
            },
          ],
        },
        // app/(app)/os/configuracoes/layout.tsx + as páginas dentro dele
        {
          caminho: "configuracoes",
          pagina: () => import("./paginas/configuracoes/layout"),
          filhas: [
            {
              indice: true,
              pagina: () => import("./paginas/configuracoes/inicio"),
            },
            {
              caminho: "catalogo",
              titulo: "Catálogo de chamados",
              pagina: () => import("./paginas/configuracoes/catalogo"),
            },
            {
              caminho: "catalogo/nova",
              titulo: "Nova categoria",
              pagina: () => import("./paginas/configuracoes/catalogo-nova"),
            },
            {
              caminho: "catalogo/:id",
              titulo: "Categoria",
              pagina: () =>
                import("./paginas/configuracoes/catalogo-categoria"),
            },
            {
              caminho: "setores",
              titulo: "Setores e pessoas",
              pagina: () => import("./paginas/configuracoes/setores"),
            },
            {
              caminho: "modelos",
              titulo: "Modelos e lembretes",
              pagina: () => import("./paginas/configuracoes/modelos"),
            },
            {
              caminho: "terceirizados",
              titulo: "Internos e terceirizados",
              pagina: () => import("./paginas/configuracoes/terceirizados"),
            },
            {
              caminho: "parametros",
              titulo: "Parâmetros de chamados",
              pagina: () => import("./paginas/configuracoes/parametros"),
            },
            {
              caminho: "historico",
              titulo: "Histórico de chamados",
              pagina: () => import("./paginas/configuracoes/historico"),
            },
          ],
        },
      ],
    },
  ],
  publicas: [
    // app/ordem/[token]/page.tsx: a OS para o terceirizado, sem login
    {
      caminho: "ordem/:token",
      titulo: "Ordem de serviço",
      pagina: () => import("./paginas/ordens/publica"),
    },
    // app/vistoria/[token]/**: a vistoria para o locatário, sem login
    {
      caminho: "vistoria/:token",
      titulo: "Vistoria",
      pagina: () => import("./paginas/vistorias/publica"),
    },
    {
      caminho: "vistoria/:token/laudo",
      titulo: "Laudo da vistoria",
      pagina: () => import("./paginas/pdf/laudo-publico"),
    },
    // app/portal/layout.tsx: o portal do lojista, sem casca e sem sessão
    {
      caminho: "portal",
      pagina: () => import("./paginas/portal-publico/layout"),
      filhas: [
        {
          indice: true,
          titulo: "Portal do lojista",
          pagina: () => import("./paginas/portal-publico/inicio"),
          carregando: <EsqueletoDoInicio />,
        },
        {
          caminho: "novo/:categoria",
          titulo: "Portal do lojista",
          pagina: () => import("./paginas/portal-publico/novo"),
          carregando: <EsqueletoDoNovoPedido />,
        },
        {
          caminho: "pedidos/:id",
          titulo: "Portal do lojista",
          pagina: () => import("./paginas/portal-publico/pedido"),
          carregando: <EsqueletoDoPedido />,
        },
        // app/portal/[...antigo]: links antigos, um por loja
        {
          caminho: "*",
          titulo: "Portal do lojista",
          pagina: () => import("./paginas/portal-publico/antigo"),
        },
      ],
    },
  ],
};
