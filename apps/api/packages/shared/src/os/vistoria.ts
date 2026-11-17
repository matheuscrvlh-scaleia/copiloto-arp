import type { TipoVistoria } from "./rotulos";
import { paraBrasilia } from "./tempo";

// Laudo de vistoria (spec 4.16 B). Ambientes e textos são o padrão do laudo
// atual; a tela de parâmetros permite editar e estes valores alimentam o seed.

export const AMBIENTES_PADRAO = [
  "Paredes",
  "Teto",
  "Piso",
  "Fachada e Acesso",
  "Infraestrutura elétrica",
  "Tipo de ligação",
  "Tipo de autorização do medidor",
  "Infraestrutura hidrossanitária",
  "Consumo de água no imóvel",
  "Tem banheiro (se sim, descrever abaixo)",
  "Banheiro",
  "Ventilação, Janelas, Climatização",
];

export const LOCADOR_PADRAO = "ARP EMPREENDIMENTOS IMOBILIÁRIOS";
export const LOCAL_PADRAO = "Nova Friburgo - RJ";

const OBSERVACAO_BASE =
  "TODAS AS CONDIÇÕES AQUI DESCRITAS ESTÃO BASEADAS NA SITUAÇÃO ATUAL DO IMÓVEL, NA DATA DA VISTORIA REALIZADA NO LOCAL, ACIMA MENCIONADA.";

/** Observação (sai em maiúsculas no laudo) e termo de responsabilidade. */
export const TEXTOS_PADRAO: Record<
  TipoVistoria,
  { observacao: string; termo: string }
> = {
  entrada: {
    observacao: `${OBSERVACAO_BASE} PARA QUAISQUER ADAPTAÇÕES OU MODIFICAÇÕES NO IMÓVEL, SERÁ NECESSÁRIO A APRESENTAÇÃO DOS PROJETOS ARQUITETÔNICOS E COMPLEMENTARES (LAYOUT, ELÉTRICO, HIDRÁULICOS, ETC.), ELABORADOS POR PROFISSIONAIS HABILITADOS, MEDIANTE APRESENTAÇÃO DE ART E RRT, CONFORME A NC004 - ORIENTAÇÕES TÉCNICAS SOBRE PROCESSO DE OBRAS E REFORMAS NOS PRÉDIOS E UNIDADES DA ARP.`,
    termo:
      "O(a) LOCATÁRIO(a) está ciente de que, ao final da locação, deverá restituir o imóvel conforme o pactuado no contrato, observando o estado ora registrado. Caso identifique qualquer divergência em relação ao laudo, o(a) LOCATÁRIO(a) deverá comunicá-la à LOCADORA no prazo máximo de 24 (vinte e quatro) horas, contadas da assinatura deste documento. A ausência de manifestação dentro desse prazo, bem como o início de obras ou intervenções sem comunicação prévia, implicará plena concordância com o estado descrito, não cabendo posteriores reclamações ou cobranças à LOCADORA. E, por estarem de acordo, assinam o presente documento.",
  },
  saida: {
    observacao: OBSERVACAO_BASE,
    termo:
      "Neste ato, as partes declaram estar de acordo com o estado do imóvel verificado na presente vistoria de saída, reconhecendo que a entrega das chaves ocorre nas condições ora registradas. A presente declaração restringe-se exclusivamente à condição física do imóvel, não implicando quitação de obrigações contratuais, financeiras ou legais decorrentes do contrato de locação, as quais serão apuradas e regularizadas em procedimento próprio de rescisão contratual. E, por estarem de acordo, assinam o presente documento.",
  },
  preventiva: {
    observacao: OBSERVACAO_BASE,
    termo:
      "Laudo de vistoria preventiva realizado para acompanhamento periódico do estado de conservação do imóvel e de suas instalações.",
  },
  extraordinaria: {
    observacao: OBSERVACAO_BASE,
    termo:
      "Laudo de vistoria extraordinária realizado para constatação pontual de ocorrências, manutenções ou alterações no imóvel.",
  },
};

const CODIGO = /^ARP(\d+)$/i;

/** Próximo código: maior número + 1, com 2 dígitos no mínimo (ARP01, ARP10…). */
export function proximoCodigo(codigos: string[]): string {
  const maior = codigos.reduce((m, c) => {
    const n = CODIGO.exec(c.trim())?.[1];
    return n === undefined ? m : Math.max(m, Number(n));
  }, 0);
  return `ARP${String(maior + 1).padStart(2, "0")}`;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "Nova Friburgo - RJ, 22 de outubro de 2026" (data ou timestamp ISO). */
export function localEData(local: string, dataIso: string): string {
  const data = /^\d{4}-\d{2}-\d{2}$/.test(dataIso)
    ? dataIso
    : paraBrasilia(new Date(dataIso)).data;
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  return `${local}, ${d} de ${MESES[m - 1]} de ${a}`;
}

/** "Café Serra" → "cafe-serra". */
function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * "vistoria-27-bloco-b-loja-118-cafe-serra.pdf". Bloco só com a letra ganha
 * "bloco-" na frente; a unidade vai como veio ("Loja 118", "Sala 3").
 */
export function nomeDoArquivo(v: {
  codigo: string;
  bloco: string | null;
  unidade: string | null;
  locatario: string | null;
}): string {
  const numero = CODIGO.exec(v.codigo.trim())?.[1];
  const bloco = v.bloco ? slug(v.bloco) : "";
  const partes = [
    "vistoria",
    numero === undefined ? slug(v.codigo) : String(Number(numero)),
    bloco && !bloco.startsWith("bloco") ? `bloco-${bloco}` : bloco,
    v.unidade ? slug(v.unidade) : "",
    v.locatario ? slug(v.locatario) : "",
  ];
  return `${partes.filter(Boolean).join("-").replace(/-+/g, "-")}.pdf`;
}

/** Na saída a data que importa é a da devolução das chaves. */
export function rotuloDaData(tipo: TipoVistoria): string {
  return tipo === "saida" ? "Data da devolução das chaves" : "Data da vistoria";
}

/** Pergunta extra do tipo (sim/não no laudo); null se o tipo não tem. */
export function rotuloCampoDoTipo(tipo: TipoVistoria): string | null {
  if (tipo === "entrada") return "Autorizado início da obra (Projeto)";
  if (tipo === "saida") return "Teve vistoria de constatação?";
  return null;
}
