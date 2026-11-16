import { INICIO } from "@/config/navigation";
import { Link, useTitulo } from "@/lib/navegacao";
import { Cartao } from "./page-header";

/** Endereço que não existe (ou registro que não existe mais). */
export function NaoEncontrada() {
  useTitulo("Página não encontrada");
  return (
    <Cartao>
      <div className="flex flex-col items-start gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            Página não encontrada
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            O endereço não existe ou o registro foi removido.
          </p>
        </div>
        <Link
          href={INICIO}
          className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Ir para o início
        </Link>
      </div>
    </Cartao>
  );
}
