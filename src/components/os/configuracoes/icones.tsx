import {
  AlarmClock,
  Archive,
  BadgeCheck,
  BadgeX,
  Banknote,
  Boxes,
  Briefcase,
  Bug,
  Building,
  Building2,
  Calculator,
  CalendarCheck,
  CalendarClock,
  Camera,
  Car,
  Cctv,
  CircleParking,
  ClipboardCheck,
  ClipboardList,
  CloudRain,
  Cog,
  Construction,
  CornerDownRight,
  CreditCard,
  DoorClosed,
  DoorOpen,
  Droplets,
  Fan,
  FilePen,
  FileText,
  FileUp,
  Flame,
  FolderOpen,
  Gauge,
  Gift,
  Hammer,
  Handshake,
  HardHat,
  HeartPulse,
  House,
  Inbox,
  KeyRound,
  Landmark,
  Leaf,
  Lightbulb,
  Link,
  Lock,
  type LucideIcon,
  Mail,
  Megaphone,
  MessagesSquare,
  Monitor,
  Package,
  Paintbrush,
  PaintRoller,
  PartyPopper,
  Phone,
  Plug,
  Presentation,
  Printer,
  QrCode,
  Receipt,
  Recycle,
  Scale,
  ShieldCheck,
  ShoppingBag,
  ShowerHead,
  Signpost,
  Siren,
  Snowflake,
  Sparkles,
  SprayCan,
  Stamp,
  Store,
  Sun,
  Tag,
  Thermometer,
  Ticket,
  Toilet,
  Trash2,
  TreePine,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";

// Ícones que setores e categorias podem usar (o banco guarda o nome do
// lucide, ex.: "wrench"). Uma lista curta e escolhida, agrupada por assunto
// para a escolha ficar rápida; nome desconhecido cai na etiqueta.

export const GRUPOS_DE_ICONES: {
  grupo: string;
  icones: Record<string, LucideIcon>;
}[] = [
  {
    grupo: "Manutenção",
    icones: {
      wrench: Wrench,
      hammer: Hammer,
      zap: Zap,
      plug: Plug,
      lightbulb: Lightbulb,
      droplets: Droplets,
      "shower-head": ShowerHead,
      toilet: Toilet,
      fan: Fan,
      snowflake: Snowflake,
      thermometer: Thermometer,
      flame: Flame,
      "paint-roller": PaintRoller,
      paintbrush: Paintbrush,
      "spray-can": SprayCan,
      "hard-hat": HardHat,
      construction: Construction,
      cog: Cog,
      gauge: Gauge,
      bug: Bug,
    },
  },
  {
    grupo: "Prédio e lojas",
    icones: {
      building: Building,
      "building-2": Building2,
      house: House,
      store: Store,
      warehouse: Warehouse,
      "door-open": DoorOpen,
      "door-closed": DoorClosed,
      "key-round": KeyRound,
      lock: Lock,
      cctv: Cctv,
      "shield-check": ShieldCheck,
      siren: Siren,
      "cloud-rain": CloudRain,
      sun: Sun,
      "tree-pine": TreePine,
      leaf: Leaf,
      recycle: Recycle,
      "trash-2": Trash2,
    },
  },
  {
    grupo: "Pessoas e atendimento",
    icones: {
      handshake: Handshake,
      users: Users,
      "messages-square": MessagesSquare,
      phone: Phone,
      mail: Mail,
      megaphone: Megaphone,
      signpost: Signpost,
      sparkles: Sparkles,
      "party-popper": PartyPopper,
      gift: Gift,
      "heart-pulse": HeartPulse,
      "shopping-bag": ShoppingBag,
      ticket: Ticket,
      car: Car,
      "circle-parking": CircleParking,
      truck: Truck,
    },
  },
  {
    grupo: "Papéis e gestão",
    icones: {
      inbox: Inbox,
      tag: Tag,
      "clipboard-list": ClipboardList,
      "clipboard-check": ClipboardCheck,
      "file-text": FileText,
      "file-up": FileUp,
      "file-pen": FilePen,
      "folder-open": FolderOpen,
      archive: Archive,
      stamp: Stamp,
      "badge-check": BadgeCheck,
      "badge-x": BadgeX,
      "calendar-check": CalendarCheck,
      "calendar-clock": CalendarClock,
      "alarm-clock": AlarmClock,
      briefcase: Briefcase,
      presentation: Presentation,
      scale: Scale,
      landmark: Landmark,
      wallet: Wallet,
      banknote: Banknote,
      "credit-card": CreditCard,
      receipt: Receipt,
      calculator: Calculator,
      package: Package,
      boxes: Boxes,
      "qr-code": QrCode,
      camera: Camera,
      monitor: Monitor,
      printer: Printer,
      wifi: Wifi,
      link: Link,
      "corner-down-right": CornerDownRight,
    },
  },
];

const TODOS: Record<string, LucideIcon> = Object.assign(
  {},
  ...GRUPOS_DE_ICONES.map((g) => g.icones),
);

/** Ícone pelo nome gravado no banco (setor ou categoria). */
export function IconeCatalogo({
  nome,
  className = "size-4",
}: {
  nome: string | null | undefined;
  className?: string;
}) {
  const Icone = (nome && TODOS[nome]) || Tag;
  return <Icone className={className} aria-hidden />;
}

/**
 * Ícone dentro de um círculo com a cor (do setor ou da categoria). A cor é
 * só enfeite: o nome sempre aparece ao lado.
 */
export function SeloIcone({
  nome,
  cor,
  tamanho = "md",
}: {
  nome: string | null | undefined;
  cor: string | null | undefined;
  tamanho?: "sm" | "md";
}) {
  const caixa = tamanho === "sm" ? "size-7" : "size-9";
  const icone = tamanho === "sm" ? "size-3.5" : "size-4";
  return (
    <span
      aria-hidden
      className={`grid ${caixa} shrink-0 place-items-center rounded-full text-white shadow-sm`}
      style={{ backgroundColor: cor ?? "#525252" }}
    >
      <IconeCatalogo nome={nome} className={icone} />
    </span>
  );
}
