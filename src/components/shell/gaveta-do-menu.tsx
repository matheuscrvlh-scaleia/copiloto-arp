"use client";

import { Menu as IconeMenu } from "lucide-react";
import { useId, useState } from "react";

/**
 * Uma cópia só do menu para as duas telas: no computador ele fica sempre
 * aberto (md:flex); no celular abre e fecha pelo botão com a marca.
 */
export function GavetaDoMenu({
  marca,
  children,
}: {
  marca: React.ReactNode;
  children: React.ReactNode;
}) {
  const [aberta, setAberta] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => setAberta((a) => !a)}
        aria-expanded={aberta}
        aria-controls={id}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left md:hidden"
      >
        {marca}
        <span className="grid size-10 place-items-center rounded-full bg-neutral-900 text-white">
          <IconeMenu className="size-4" aria-hidden />
          <span className="sr-only">Menu</span>
        </span>
      </button>
      <div
        id={id}
        className={`${aberta ? "flex" : "hidden"} max-h-[75dvh] flex-col px-4 pb-4 md:flex md:max-h-none md:min-h-0 md:flex-1 md:p-0`}
      >
        {children}
      </div>
    </>
  );
}
