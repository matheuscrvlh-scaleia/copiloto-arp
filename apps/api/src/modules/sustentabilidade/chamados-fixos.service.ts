import { lerRecorrencia } from "@arp/shared/os/automacao";
import { descreverRecorrencia, proximaData } from "@arp/shared/os/recorrencia";
import { rotaChamado } from "@arp/shared/os/rotas";
import { hojeEmBrasilia, somarDias } from "@arp/shared/os/tempo";
import type { EstadoDoChamadoFixo } from "@arp/shared/sustentabilidade/contratos/chamados-fixos";
import { MODULO_DOS_CHAMADOS } from "@arp/shared/sustentabilidade/entrevistas-chamados";
import {
  CHAMADOS_FIXOS,
  type ChamadoFixo,
  recorrenciaDoChamadoFixo,
} from "@arp/shared/sustentabilidade/painel-parametros";
import type { Contexto } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { usuariosComPermissao } from "@/modules/comercial/jobs.repository";
import { criarChamadoSistema } from "@/modules/os/criar.service";
import { logarSustentabilidade, podeAgora } from "./acesso";
import { EM_ABERTO } from "./rotinas.repository";
import { categoriaDoModulo, prazoNoDia } from "./rotinas.service";

// Chamados fixos do módulo (ronda dos coletores, nota do RCC, relatório do
// mês). O spec manda recorrência e responsável configurados no próprio
// chamado ("Repetir" do Chamados), e não em Parâmetros: aqui só se cria o
// primeiro chamado recorrente, já com Repetir e responsável, e se mostra se
// ele existe. Depois a rotina de recorrências do Chamados cria os seguintes,
// copiando a ação, a conclusão pelo módulo e a origem.
//
// Tudo pela service role, depois de conferir sustentabilidade.parametros.

const AUTOR = "Sistema (Sustentabilidade)";
const PARAMETROS = "sustentabilidade.parametros" as const;
const TIPOS = Object.keys(CHAMADOS_FIXOS) as ChamadoFixo[];

export interface Candidato {
  id: string;
  nome: string;
}

function candidatosNoEscopo(tx: Tx, tipo: ChamadoFixo): Promise<Candidato[]> {
  return usuariosComPermissao(tx, CHAMADOS_FIXOS[tipo].permissao).then((ids) =>
    ids.length
      ? tx
          .selectFrom("core.usuarios")
          .select(["id", "nome"])
          .where("id", "in", ids)
          .orderBy("nome")
          .execute()
      : [],
  );
}

async function estadosNoEscopo(tx: Tx): Promise<EstadoDoChamadoFixo[]> {
  const abertos = await tx
    .selectFrom("os.chamados as c")
    .leftJoin("core.usuarios as u", "u.id", "c.responsavel_id")
    .select([
      "c.id",
      "c.numero",
      "c.prazo",
      "c.recorrencia",
      "c.origem_ref",
      "u.nome as responsavel",
    ])
    .where("c.origem_modulo", "=", MODULO_DOS_CHAMADOS)
    .where("c.origem_ref", "in", TIPOS)
    .where("c.status", "in", EM_ABERTO)
    .orderBy("c.criado_em")
    .execute();
  return TIPOS.map((tipo) => {
    const c = abertos.find((x) => x.origem_ref === tipo);
    const r = c ? lerRecorrencia(c.recorrencia) : null;
    return {
      tipo,
      aberto: c
        ? {
            id: c.id,
            numero: c.numero,
            href: rotaChamado(c.id),
            prazo: c.prazo,
            responsavel: c.responsavel,
            repeticao: r ? descreverRecorrencia(r) : null,
          }
        : null,
    };
  });
}

/** Quem pode receber o chamado: quem tem a permissão da área dele. */
export async function candidatosAResponsavel(
  ctx: Contexto,
  tipo: ChamadoFixo,
): Promise<Candidato[]> {
  if (!(await podeAgora(ctx, PARAMETROS))) return [];
  return banco.comoServico((tx) => candidatosNoEscopo(tx, tipo));
}

/** Se cada chamado fixo já existe (em aberto); null sem a permissão. */
export async function chamadosFixos(
  ctx: Contexto,
): Promise<EstadoDoChamadoFixo[] | null> {
  if (!(await podeAgora(ctx, PARAMETROS))) return null;
  return banco.comoServico(estadosNoEscopo);
}

/**
 * Cria o chamado recorrente (Repetir) do tipo, com o responsável escolhido,
 * o "Executar" da tela do módulo e a conclusão só pelo módulo. Se já existe
 * um em aberto, não cria outro. O prazo do primeiro é o fim do expediente da
 * primeira data da recorrência a partir de hoje. Devolve a mensagem.
 */
export async function criarChamadoFixo(
  ctx: Contexto,
  p: {
    tipo: ChamadoFixo;
    responsavelId: string;
    diaSemana?: number;
    diaMes?: number;
  },
  agora = new Date(),
): Promise<string> {
  if (!(await podeAgora(ctx, PARAMETROS)))
    throw new ErroDePermissao(
      "Você não tem permissão para alterar os parâmetros de Sustentabilidade.",
    );
  const def = CHAMADOS_FIXOS[p.tipo];
  const criado = await banco.comoServico(async (tx) => {
    const candidatos = await candidatosNoEscopo(tx, p.tipo);
    if (!candidatos.some((c) => c.id === p.responsavelId))
      throw new ErroDeNegocio(
        "O responsável precisa ser alguém com acesso a essa área do módulo.",
      );
    const existente = (await estadosNoEscopo(tx)).find(
      (e) => e.tipo === p.tipo,
    )?.aberto;
    if (existente)
      throw new ErroDeNegocio(
        `Já existe o chamado #${existente.numero} em aberto. Mude o Repetir ou o responsável direto nele.`,
      );
    const categoria = await categoriaDoModulo(tx, def.categoria);
    if (!categoria)
      throw new ErroDeNegocio(
        `A categoria “${def.categoria}” não existe no Chamados. Peça ao administrador para recriá-la.`,
      );
    const recorrencia = recorrenciaDoChamadoFixo(p.tipo, {
      diaSemana: p.diaSemana,
      diaMes: p.diaMes,
    });
    const primeira = proximaData(
      recorrencia,
      somarDias(hojeEmBrasilia(agora), -1),
    );
    if (!primeira)
      throw new ErroDeNegocio("Não foi possível calcular a primeira data.");
    const novo = await criarChamadoSistema(
      tx,
      {
        setorId: categoria.setorId,
        categoriaId: categoria.id,
        titulo: def.titulo,
        descricao: `${def.descricao} Toque em Executar para abrir a tela do módulo; o chamado fecha sozinho ao salvar ${def.acaoRotulo}, e o próximo nasce pelo Repetir.`,
        tipo: "tarefa",
        origem: "modulo",
        abertoPor: ctx.usuario.id,
        autorNome: AUTOR,
        responsavelId: p.responsavelId,
        prazo: await prazoNoDia(tx, primeira),
        recorrencia,
        acaoUrl: def.acaoUrl,
        acaoRotulo: def.acaoRotulo,
        conclusaoExterna: true,
        origemModulo: MODULO_DOS_CHAMADOS,
        origemRef: p.tipo,
      },
      agora,
    );
    if (!novo)
      throw new ErroDeNegocio("O chamado já existia. Atualize a página.");
    return { ...novo, repeticao: descreverRecorrencia(recorrencia) };
  });
  logarSustentabilidade(
    ctx,
    "sustentabilidade_parametros",
    `Criou o chamado recorrente “${p.tipo}” (#${criado.numero})`,
    { grupo: "chamados", tipo: p.tipo, chamado: criado.id },
  );
  return `Chamado #${criado.numero} criado (${criado.repeticao.toLowerCase()}). Ajuste o Repetir ou o responsável direto nele, quando quiser.`;
}
