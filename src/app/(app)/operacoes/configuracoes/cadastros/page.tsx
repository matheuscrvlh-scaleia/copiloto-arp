import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { AbasDaTela, TopoDaTela } from "@/components/dashboard/tela";
import { CadastroDeHidrometros } from "@/components/operacoes/cadastros/hidrometros";
import { CadastroDeSalas } from "@/components/operacoes/cadastros/salas";
import { SemAcesso } from "@/components/protegido";
import { contextoOp } from "@/server/operacoes/base";
import {
  hidrometrosCadastrados,
  salasCadastradas,
} from "@/server/operacoes/cadastros";

export const metadata: Metadata = { title: "Cadastros de Operações" };

type Busca = Record<string, string | string[] | undefined>;

const ROTA = "/operacoes/configuracoes/cadastros";

export default function Page({
  searchParams,
}: PageProps<"/operacoes/configuracoes/cadastros">) {
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
        <Tela busca={searchParams} />
      </Suspense>
    </>
  );
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const [ctx, sp] = await Promise.all([contextoOp(), busca]);
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
  const pedida = sp.aba === "salas" ? "salas" : "hidrometros";
  const aba = abas.some((a) => a.chave === pedida) ? pedida : abas[0]?.chave;
  const [hidrometros, salas] = await Promise.all([
    veHidrometros ? hidrometrosCadastrados() : [],
    veSalas ? salasCadastradas() : [],
  ]);
  const podeImportar = ctx.pode("operacoes.agua.importar");
  const porSala: Record<string, number> = {};
  for (const h of hidrometros)
    if (h.sala_id) porSala[h.sala_id] = (porSala[h.sala_id] ?? 0) + 1;

  return (
    <div className="flex flex-col gap-6">
      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={aba === "salas" ? "Salas da energia" : "Hidrômetros"}
      />
      <AbasDaTela rotulo="O que cadastrar" ativa={aba ?? ""} abas={abas} />
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
          descricao="Um cadastro por hidrômetro, com o bloco, a sala e a sala da energia. A importação da planilha do mês cadastra sozinha o hidrômetro novo; os cadastrados aqui aparecem na escolha da foto do visor em Importações."
        >
          <CadastroDeHidrometros
            hidrometros={hidrometros}
            salas={salas.map((s) => ({ id: s.id, codigo: s.codigo }))}
            podeEditar={podeImportar || ctx.pode("operacoes.agua.vinculo")}
          />
        </Secao>
      )}
    </div>
  );
}
