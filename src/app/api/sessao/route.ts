// Aviso de uso da tela (components/shell/fim-por-inatividade.tsx): quem
// renova o prazo da sessão é o proxy; aqui só responde.
export function POST() {
  return new Response(null, { status: 204 });
}
