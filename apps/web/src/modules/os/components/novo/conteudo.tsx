import { useSuspenseQueries } from "@tanstack/react-query";
import { Cartao } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { useBusca } from "@/lib/navegacao";
import { usePermissao } from "@/lib/sessao";
import { consultaDoFormulario, consultaDoInicial } from "@/modules/os/api";
import { NovoNaPagina } from "./novo-na-pagina";

// Abrir chamado (/os/novo) ou OS (/os/ordens/nova) com contexto pela URL:
// ?ativo=<id> (etiqueta QR do ativo), ?loja=<id>, ?vinculado=<id> (chamado
// ligado), ?vistoria=<id>&ambiente=<id> ("Gerar OS"), ?duplicar=<id> e
// ?titulo=&descricao= (texto pronto, como o "Precisa de outro setor?" do
// Comercial). Um não vira o outro: a cópia e o vínculo só valem dentro do
// que a página abre. Quem lê o contexto é a API (GET /os/formulario/inicial),
// pela sessão: só o que a pessoa vê.

export function ConteudoDoNovo({ ehOS }: { ehOS: boolean }) {
  if (!usePermissao("os.acessar")) return <SemAcesso />;
  return <Conteudo ehOS={ehOS} />;
}

function Conteudo({ ehOS }: { ehOS: boolean }) {
  const busca = useBusca();
  // O formulário e o contexto da URL não dependem um do outro.
  const [{ data: dados }, { data: inicial }] = useSuspenseQueries({
    queries: [consultaDoFormulario, consultaDoInicial(busca, ehOS)],
  });
  return (
    <Cartao className="p-5 md:p-7">
      <NovoNaPagina dados={dados} inicial={inicial} />
    </Cartao>
  );
}
