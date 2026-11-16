import type { IconeTipo } from "@arp/shared/calendario";
import { ehChaveDe } from "@arp/shared/calendario/contratos";
import {
  Cake,
  CalendarDays,
  Flag,
  GraduationCap,
  HardHat,
  type LucideIcon,
  Megaphone,
  PartyPopper,
  Plane,
  SquareCheckBig,
  TriangleAlert,
  Users,
  Wrench,
} from "lucide-react";

// Desenho de cada ícone que um tipo de item pode usar (lib/calendario).

export const ICONE: Record<IconeTipo, LucideIcon> = {
  evento: CalendarDays,
  reuniao: Users,
  tarefa: SquareCheckBig,
  obra: HardHat,
  feriado: PartyPopper,
  aniversario: Cake,
  viagem: Plane,
  treinamento: GraduationCap,
  manutencao: Wrench,
  marketing: Megaphone,
  prazo: Flag,
  alerta: TriangleAlert,
};

export function IconeDoTipo({
  icone,
  className = "size-3.5",
  style,
}: {
  icone: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icone = ehChaveDe(ICONE, icone) ? ICONE[icone] : CalendarDays;
  return <Icone aria-hidden className={className} style={style} />;
}
