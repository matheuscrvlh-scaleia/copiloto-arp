// PENDENTE (área de Ordens de serviço): este arquivo é só o encaixe do
// detalhe do chamado. O bloco da OS (execução, terceirizado, tempo,
// materiais, custos, fotos e assinatura) e o cronômetro do antigo
// `components/os/ordem/bloco-os.tsx` ainda não foram portados: quem portar a
// área substitui este arquivo pelo de verdade, com os mesmos nomes e props.
// Até lá o detalhe de uma OS abre sem o bloco e sem o cronômetro.

export function BlocoOS(_: { ordemId: string; compacto?: boolean }) {
  return null;
}

export function CronometroDaOS(_: { ordemId: string; className?: string }) {
  return null;
}
