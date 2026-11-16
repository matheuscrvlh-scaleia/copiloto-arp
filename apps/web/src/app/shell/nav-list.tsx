import type { NavSection } from "@/config/navigation";

/** O item ativo é o de href mais longo que casa com o pathname. */
export function activeHref(sections: NavSection[], pathname: string | null) {
  if (!pathname) return null;
  let best: string | null = null;
  for (const item of sections.flatMap((s) => s.itens)) {
    const casa = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (casa && item.href.length > (best?.length ?? 0)) best = item.href;
  }
  return best;
}

export function NavSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {["w-24", "w-32", "w-28", "w-36", "w-20"].map((w) => (
        <span
          key={w}
          className={`h-8 ${w} animate-pulse rounded-full bg-neutral-100`}
        />
      ))}
    </div>
  );
}
