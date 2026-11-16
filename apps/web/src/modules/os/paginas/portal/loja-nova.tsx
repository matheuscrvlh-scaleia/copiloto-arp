import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link } from "@/lib/navegacao";
import { FormLoja } from "@/modules/os/components/portal/form-loja";

export default function Pagina() {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/os/portal/lojas"
        className="w-fit text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Lojas
      </Link>
      <Protegido permissao="os.portal">
        <Cartao>
          <h2 className="mb-6 text-lg font-semibold">Nova loja</h2>
          <FormLoja />
        </Cartao>
      </Protegido>
    </div>
  );
}
