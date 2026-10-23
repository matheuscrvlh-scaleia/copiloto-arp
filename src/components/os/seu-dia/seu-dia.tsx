import { criterioDoCartao, PREFERENCIA_SEU_DIA } from "@/lib/os/lista";
import { hojeEmBrasilia, paraBrasilia } from "@/lib/os/tempo";
import { contarChamados } from "@/server/os/base";
import { lerPreferencia } from "@/server/os/preferencias";
import { apoio } from "@/server/os/visoes";
import { ModalSeuDia } from "./modal";

// "Seu dia" (servidor): só na primeira entrada do dia. Lê o dia já visto
// em core.preferencias e, se ainda não foi hoje, conta o que pede atenção
// em toda a caixa da pessoa (sem os filtros da tela), só contando no banco.
// Use em <Suspense>.

const DIAS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function saudacao(hora: string): string {
  const h = Number(hora.slice(0, 2));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export async function SeuDia() {
  const [a, visto] = await Promise.all([
    apoio(),
    lerPreferencia(PREFERENCIA_SEU_DIA),
  ]);
  const hoje = hojeEmBrasilia(a.agora);
  const dia =
    visto && typeof visto === "object" && !Array.isArray(visto)
      ? visto.dia
      : null;
  if (dia === hoje) return null;

  const ctx = { agora: a.agora, eu: a.ctx.usuario.id };
  const [atrasados, venceHoje, confirmar] = await Promise.all([
    contarChamados({
      recorte: "minha_caixa",
      cartao: criterioDoCartao("atrasados", ctx),
    }),
    contarChamados({
      recorte: "minha_caixa",
      cartao: criterioDoCartao("vence_hoje", ctx),
    }),
    contarChamados({ recorte: "abertos_por_mim", status: ["concluido"] }),
  ]);
  const [ano, mes, d] = hoje.split("-").map(Number) as [number, number, number];

  return (
    <ModalSeuDia
      resumo={{
        nome: a.ctx.usuario.nome,
        saudacao: saudacao(paraBrasilia(a.agora).hora),
        data: `${DIAS[new Date(Date.UTC(ano, mes - 1, d)).getUTCDay()]}, ${d} de ${MESES[mes - 1]}`,
        atrasados,
        hoje: venceHoje,
        confirmar,
      }}
    />
  );
}
