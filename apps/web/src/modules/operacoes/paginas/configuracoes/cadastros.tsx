import { useSuspenseQueries } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { AbasDaTela, TopoDaTela } from "@/components/dashboard/tela";
import { SemAcesso } from "@/components/protegido";
import { useParametrosDeBusca } from "@/lib/navegacao";
import { consultaDosHidrometrosCadastrados } from "../../api";
import { consultaDasSalasCadastradas } from "../../api-config";
import { CadastroDeHidrometros } from "../../components/cadastros/hidrometros";
import { CadastroDeSalas } from "../../components/cadastros/salas";
import { useContextoOp } from "../../contexto";

const ROTA = "/operacoes/configuracoes/cadastros";

export default function Page() {
  return (
    <>
      <p className="mb-6 max-w-3xl text-sm text-neutral-600">
        {
          "O que se cadastra uma vez e as importações usam: os hidrômetros e as salas da energia. Cadastre aqui; a importação usa o que estiver cadastrado."
        }
      </p>
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-[32rem]" />
          </TelaCarregando>
        }
      >
        <Tela />
      </Suspense>
    </>
  );
}

function Tela() {
  const ctx = useContextoOp();
  const sp = useParametrosDeBusca();
  const veHidrometros =
    ctx.pode("operacoes.agua.ver") || ctx.pode("operacoes.agua.importar");
  const veSalas =
    ctx.pode("operacoes.energia.ver") || ctx.pode("operacoes.agua.ver");
  const abas = [
    ...(veHidrometros
      ? [{ chave: "hidrometros", rotulo: "Hidrômetros", href: ROTA }]
      : []),
    ...(veSalas
      ? [
          {
            chave: "salas",
            rotulo: "Salas da energia",
            href: `${ROTA}?aba=salas`,
          },
        ]
      : []),
  ];
  if (!abas.length) return <SemAcesso />;
  const pedida = sp.get("aba") === "salas" ? "salas" : "hidrometros";
  const aba = abas.some((a) => a.chave === pedida) ? pedida : abas[0]?.chave;
  return (
    <Cadastros
      aba={aba ?? ""}
      abas={abas}
      veHidrometros={veHidrometros}
      veSalas={veSalas}
    />
  );
}

function Cadastros({
  aba,
  abas,
  veHidrometros,
  veSalas,
}: {
  aba: string;
  abas: { chave: string; rotulo: string; href: string }[];
  veHidrometros: boolean;
  veSalas: boolean;
}) {
  // Sem a permissão da aba, o RLS devolve a lista vazia (antes nem lia).
  const [h, s] = useSuspenseQueries({
    queries: [consultaDosHidrometrosCadastrados, consultaDasSalasCadastradas],
  });
  const ctx = useContextoOp(Math.max(h.dataUpdatedAt, s.dataUpdatedAt));
  const hidrometros = veHidrometros ? h.data.hidrometros : [];
  const salas = veSalas ? s.data.salas : [];
  const podeImportar = ctx.pode("operacoes.agua.importar");
  const porSala: Record<string, number> = {};
  for (const x of hidrometros)
    if (x.sala_id) porSala[x.sala_id] = (porSala[x.sala_id] ?? 0) + 1;

  return (
    <div className="flex flex-col gap-6">
      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={aba === "salas" ? "Salas da energia" : "Hidrômetros"}
      />
      <AbasDaTela rotulo="O que cadastrar" ativa={aba} abas={abas} />
      {aba === "salas" ? (
        <Secao
          titulo="Salas da energia"
          descricao="Uma linha por sala (código BLxx-sala). As caixas dos quadros de energia e os hidrômetros se ligam a ela."
        >
          <CadastroDeSalas
            salas={salas}
            hidrometrosPorSala={porSala}
            podeEditar={ctx.pode("operacoes.energia.editar")}
          />
        </Secao>
      ) : (
        <Secao
          titulo="Hidrômetros"
          descricao="Um cadastro por hidrômetro, com o bloco, a sala e a sala da energia. Todo hidrômetro é cadastrado aqui, à mão; a prévia da planilha avisa quando aparece um que não está cadastrado."
        >
          <CadastroDeHidrometros
            hidrometros={hidrometros}
            salas={salas.map((x) => ({ id: x.id, codigo: x.codigo }))}
            podeEditar={podeImportar || ctx.pode("operacoes.agua.vinculo")}
          />
        </Secao>
      )}
    </div>
  );
}
