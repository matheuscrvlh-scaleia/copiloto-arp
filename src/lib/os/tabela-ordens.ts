import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";
import type {
  Execucao,
  MotivoAguardando,
  StatusChamado,
} from "@/lib/os/rotulos";
import { STATUS } from "@/lib/os/rotulos";

// Linha da lista de OS como a tela e o arquivo exportado mostram. Fica fora
// da lista (componente do navegador) porque a exportação monta as mesmas
// colunas no servidor, com o filtro inteiro.

export interface LinhaOSTela {
  id: string;
  numero: number;
  titulo: string;
  status: StatusChamado;
  aguardando: MotivoAguardando | null;
  execucao: Execucao | null;
  tipoServico: string;
  local: string;
  tecnicos: string;
  periodos: string;
  minutos: number;
  duracao: string;
  minutoHomem: number;
  hh: string;
  rodando: boolean;
  rateio: boolean;
  /** null: quem vê não tem os.custos. */
  valor: number | null;
  valorRateio: number | null;
  exemplo: boolean;
  /** A mesma tela com ?c=<id> (janela lateral). */
  href: string;
}

export function colunasDeOS(comCustos: boolean): ColunaExportar[] {
  return [
    { titulo: "Nº", numero: true },
    { titulo: "Título" },
    { titulo: "Tipo" },
    { titulo: "Status" },
    { titulo: "Local" },
    { titulo: "Técnicos" },
    { titulo: "Períodos" },
    { titulo: "Duração" },
    { titulo: "H.H." },
    { titulo: "Rateio" },
    ...(comCustos
      ? [
          { titulo: "Valor", numero: true, formato: "#,##0.00" },
          { titulo: "Valor com rateio", numero: true, formato: "#,##0.00" },
        ]
      : []),
  ];
}

export function linhaDeOS(
  l: LinhaOSTela,
  comCustos: boolean,
): CelulaExportar[] {
  return [
    l.numero,
    l.titulo,
    l.tipoServico,
    STATUS[l.status],
    l.local,
    l.tecnicos,
    l.periodos,
    l.duracao,
    l.hh,
    l.rateio ? "Sim" : "Não",
    ...(comCustos ? [l.valor, l.valorRateio] : []),
  ];
}
