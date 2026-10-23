// Mensagens de WhatsApp: abrimos o wa.me com o texto pronto e quem envia é a
// pessoa, no WhatsApp dela. Os modelos são editáveis em Parâmetros.

/**
 * Telefone como o wa.me quer: só dígitos, com 55. Regras do sistema atual,
 * nesta ordem: 12 dígitos começando com 0 perde o 0; 10 ou 11 dígitos ganham
 * 55 na frente. Menos de 10 dígitos não é telefone: null.
 */
export function limparTelefone(t: string): string | null {
  let n = t.replace(/\D/g, "");
  if (n.length === 12 && n.startsWith("0")) n = n.slice(1);
  if (n.length === 10 || n.length === 11) n = `55${n}`;
  return n.length < 10 ? null : n;
}

/** Link do wa.me; sem número, o WhatsApp pede para escolher o contato. */
export function linkWhatsApp(
  telefone: string | null,
  mensagem: string,
): string {
  const numero = telefone ? limparTelefone(telefone) : null;
  return `https://wa.me/${numero ?? ""}?text=${encodeURIComponent(mensagem)}`;
}

/** Troca {{chave}} pelo valor; chave sem valor some (não deixa "{{x}}"). */
export function preencher(
  modelo: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return modelo.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, chave: string) => {
    const v = vars[chave];
    return v === null || v === undefined ? "" : String(v);
  });
}

export type ChaveMensagem =
  | "os"
  | "chamado"
  | "terceirizado"
  | "portal_link"
  | "portal_pedido"
  | "cobranca_terceirizado"
  | "remarcar"
  | "laudo";

export const ROTULOS_MENSAGEM: Record<ChaveMensagem, string> = {
  os: "Ordem de Serviço",
  chamado: "Chamado",
  terceirizado: "Enviar ao terceirizado",
  portal_link: "Link do portal para o lojista",
  portal_pedido: "Avisar lojista",
  cobranca_terceirizado: "Cobrar terceirizado",
  remarcar: "Remarcar agendamento",
  laudo: "Laudo de vistoria ao locatário",
};

/**
 * Modelos sugeridos. O da O.S. é o do sistema atual (negrito com *…*) com Nº,
 * Local e o link no fim, que leva às fotos e ao resto dos detalhes.
 */
export const MENSAGENS_PADRAO: Record<ChaveMensagem, string> = {
  os: [
    "*ORDEM DE SERVIÇO*",
    "*Nº:* {{numero}}",
    "*Tipo:* {{tipo}}",
    "*Status:* {{status}}",
    "*Data:* {{data}}",
    "*Local:* {{local}}",
    "*Descrição:*",
    "{{descricao}}",
    "",
    "*Fotos e detalhes:* {{link}}",
  ].join("\n"),
  chamado: [
    "*CHAMADO {{numero}}*",
    "*Assunto:* {{titulo}}",
    "*Status:* {{status}}",
    "*Prazo:* {{prazo}}",
    "",
    "Detalhes: {{link}}",
  ].join("\n"),
  terceirizado: [
    "Olá, {{nome}}! Tudo bem?",
    "",
    "A ARP precisa de um serviço:",
    "*O.S. {{numero}}* - {{tipo}}",
    "*Local:* {{local}}",
    "*Visita:* {{visita}}",
    "*Descrição:*",
    "{{descricao}}",
    "",
    "Fotos e detalhes: {{link}}",
  ].join("\n"),
  portal_link: [
    "Olá, {{nome}}! Para abrir e acompanhar os pedidos da sua loja na ARP, use este link:",
    "{{link}}",
  ].join("\n"),
  portal_pedido: [
    "Olá, {{nome}}! Sobre o seu pedido {{numero}} ({{titulo}}):",
    "{{mensagem}}",
    "",
    "Acompanhe por aqui: {{link}}",
  ].join("\n"),
  cobranca_terceirizado: [
    "Olá, {{nome}}! Tudo bem?",
    "Como está o serviço da *O.S. {{numero}}* ({{local}})? O prazo combinado era {{prazo}}.",
  ].join("\n"),
  remarcar: [
    "Olá, {{nome}}! Precisamos remarcar o seu horário de {{data}} às {{hora}} ({{assunto}}).",
    "Escolha um novo horário por aqui: {{link}}",
  ].join("\n"),
  laudo: [
    "Olá, {{nome}}! Tudo bem?",
    "",
    "Segue o laudo da *{{tipo}}* ({{codigo}}) da {{unidade}}, feita em {{data}}:",
    "{{link}}",
    "",
    "O link vale por {{dias}} dias. Qualquer divergência, fale com a gente.",
  ].join("\n"),
};
