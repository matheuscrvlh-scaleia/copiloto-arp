import type { Permissao } from "@arp/shared/permissions";
import { ROTA_ENTREVISTAS } from "@arp/shared/sustentabilidade/entrevistas-chamados";
import { type Aba, Abas } from "@/components/abas-de-configuracoes";
import { PageHeader } from "@/components/page-header";
import { type Sessao, useSessao } from "@/lib/sessao";

// Entrevistas é uma tela só no menu, com três abas: o controle por
// contrato, as respostas salvas e o editor do questionário. Cada aba tem a
// própria rota e aparece para quem tem a permissão dela.

const ABAS: (Aba & { permissoes: readonly Permissao[] })[] = [
  {
    href: ROTA_ENTREVISTAS,
    exata: true,
    rotulo: "Controle",
    descricao:
      "Para cada contrato ativo, se a entrevista está feita, pendente, a vencer ou vencida",
    permissoes: [
      "sustentabilidade.entrevistas.ver",
      "sustentabilidade.entrevistas.aplicar",
      "sustentabilidade.entrevistas.dispensar",
    ],
  },
  {
    href: `${ROTA_ENTREVISTAS}/respostas`,
    rotulo: "Respostas",
    descricao:
      "Todas as entrevistas salvas, com os gráficos e a planilha igual à do Forms",
    permissoes: ["sustentabilidade.entrevistas.respostas"],
  },
  {
    href: `${ROTA_ENTREVISTAS}/questionario`,
    rotulo: "Editar questionário",
    descricao:
      "Perguntas, opções e seções do questionário, com rascunho, publicação e versões",
    permissoes: ["sustentabilidade.entrevistas.questionario"],
  },
];

/** Abas que o usuário pode abrir. */
export function abasDeEntrevistas(sessao: Sessao): Aba[] {
  return ABAS.filter((a) => sessao.pode(a.permissoes)).map(
    ({ permissoes: _, ...aba }) => aba,
  );
}

/** Título "Entrevistas", a descrição da aba aberta e as abas. */
export function CabecalhoDeEntrevistas({ descricao }: { descricao: string }) {
  const sessao = useSessao();
  return (
    <>
      <PageHeader title="Entrevistas" description={descricao} />
      <div className="mb-6">
        <Abas abas={abasDeEntrevistas(sessao)} />
      </div>
    </>
  );
}
