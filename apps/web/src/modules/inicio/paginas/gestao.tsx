import { EmConstrucao, PageHeader } from "@/components/page-header";

/** Marcador da primeira tela enquanto o módulo Gestão não é portado. */
export default function Gestao() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <EmConstrucao motivo="Esta tela está em construção na nova versão do sistema." />
    </>
  );
}
