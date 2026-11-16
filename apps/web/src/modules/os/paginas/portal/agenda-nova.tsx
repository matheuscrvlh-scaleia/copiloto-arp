import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link } from "@/lib/navegacao";
import { FormAgenda } from "@/modules/os/components/portal/form-agenda";

export default function Pagina() {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/os/portal/agendas"
        className="w-fit text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Agendas
      </Link>
      <Protegido permissao="os.portal_agenda">
        <Cartao>
          <h2 className="mb-6 text-lg font-semibold">Nova agenda</h2>
          <FormAgenda />
        </Cartao>
      </Protegido>
    </div>
  );
}
