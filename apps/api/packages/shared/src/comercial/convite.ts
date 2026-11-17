// Texto que acompanha o link de um formulário enviado pelo WhatsApp
// (parâmetro formulario_texto_convite): {formulario} vira o nome do
// formulário e o link vai numa linha própria, logo abaixo.

export const MARCA_FORMULARIO = "{formulario}";

export function mensagemDoConvite(
  modelo: string,
  formulario: string,
  link: string,
): string {
  const texto = modelo.split(MARCA_FORMULARIO).join(formulario).trim();
  return texto ? `${texto}\n\n${link}` : link;
}
