import Image from "next/image";

export function Marca() {
  return (
    <span className="flex items-center gap-3">
      <Image
        src="/brand/logo.png"
        alt="ARP"
        width={40}
        height={40}
        className="rounded-xl"
        priority
      />
      <span className="leading-tight">
        <span className="block font-semibold text-neutral-900">ARP</span>
        <span className="block text-xs text-neutral-500">Centralizador</span>
      </span>
    </span>
  );
}
