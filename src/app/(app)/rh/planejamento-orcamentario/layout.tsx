import { PageHeader } from "@/components/page-header";

export default function Layout({
  children,
}: LayoutProps<"/rh/planejamento-orcamentario">) {
  return (
    <>
      <PageHeader
        title="Planejamento orçamentário"
        description="Orçamento do ano do RH, que vem do ERP, e os gastos lançados que abatem dele: quanto já foi usado e quanto sobra."
      />
      {children}
    </>
  );
}
