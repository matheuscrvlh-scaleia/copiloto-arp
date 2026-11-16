export function Marca() {
  return (
    <span className="flex items-center gap-3">
      <img
        src="/brand/logo.png"
        alt="ARP"
        width={40}
        height={40}
        decoding="async"
        className="rounded-xl"
      />
      <span className="leading-tight">
        <span className="block font-semibold text-neutral-900">ARP</span>
        <span className="block text-xs text-neutral-500">Centralizador</span>
      </span>
    </span>
  );
}
