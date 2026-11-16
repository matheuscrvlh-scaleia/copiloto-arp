import { PageHeader } from "@/components/page-header";
import { Filhas } from "@/lib/navegacao";

export default function Layout() {
  return (
    <>
      <PageHeader
        title="Planejamento orçamentário"
        description="Orçamento do ano do RH, que vem do ERP, e os gastos lançados que abatem dele: quanto já foi usado e quanto sobra."
      />
      <Filhas />
    </>
  );
}
