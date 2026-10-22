import type { Cargo } from "@/server/admin/dados";

// Confirmações de inativar e excluir cargo (lista e edição).

export function confirmarInativacao(c: Cargo): string {
  const quem =
    c.usuarios === 1
      ? "O usuário dele perde"
      : `Os ${c.usuarios} usuários dele perdem`;
  return c.usuarios > 0
    ? `Inativar o cargo “${c.nome}”? ${quem} as permissões do cargo até você reativar.`
    : `Inativar o cargo “${c.nome}”? Ele some da escolha até você reativar.`;
}

export function confirmarExclusao(c: Cargo): string {
  const quem =
    c.usuarios === 1
      ? "O usuário dele fica"
      : `Os ${c.usuarios} usuários dele ficam`;
  return c.usuarios > 0
    ? `Excluir o cargo “${c.nome}” de vez? ${quem} sem cargo. Para só suspender, use Inativar.`
    : `Excluir o cargo “${c.nome}” de vez?`;
}
