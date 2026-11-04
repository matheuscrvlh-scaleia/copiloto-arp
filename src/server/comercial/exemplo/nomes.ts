import { digitosCnpj, digitosCpf } from "@/lib/documentos";
import type { Sorteio } from "@/lib/sorteio";

// Nomes, documentos e contatos fictícios dos dados de exemplo. Nada aqui
// vem de cliente ou funcionário real: nomes sorteados de listas comuns,
// e-mail no domínio de exemplo e telefone com prefixo 90000.

const NOMES = [
  "Ana",
  "Bruno",
  "Carla",
  "Diego",
  "Elisa",
  "Fábio",
  "Gabriela",
  "Heitor",
  "Isabela",
  "João",
  "Larissa",
  "Marcelo",
  "Natália",
  "Otávio",
  "Paula",
  "Renato",
  "Sabrina",
  "Tiago",
  "Vanessa",
  "Wagner",
  "Yasmin",
  "Caio",
  "Lívia",
  "Igor",
];
const SOBRENOMES = [
  "Almeida",
  "Barros",
  "Cardoso",
  "Duarte",
  "Esteves",
  "Ferraz",
  "Gouveia",
  "Lacerda",
  "Moreira",
  "Nogueira",
  "Pacheco",
  "Queiroz",
  "Rezende",
  "Siqueira",
  "Teixeira",
  "Valente",
  "Xavier",
  "Monteiro",
];
const EMPRESA_1 = [
  "Ateliê",
  "Café",
  "Clínica",
  "Estúdio",
  "Empório",
  "Oficina",
  "Espaço",
  "Casa",
  "Loja",
  "Instituto",
  "Laboratório",
  "Studio",
  "Doceria",
  "Barbearia",
  "Ótica",
];
const EMPRESA_2 = [
  "Serra Azul",
  "Vale Verde",
  "Boa Vista",
  "Aurora",
  "Mirante",
  "Horizonte",
  "Jardim",
  "Primavera",
  "Cascata",
  "Alecrim",
  "Pinhal",
  "Rosa dos Ventos",
  "Lumière",
  "Três Picos",
  "Girassol",
];

export const pessoa = (s: Sorteio) =>
  `${s.escolha(NOMES)} ${s.escolha(SOBRENOMES)} ${s.escolha(SOBRENOMES)}`;

export const empresa = (s: Sorteio) =>
  `${s.escolha(EMPRESA_1)} ${s.escolha(EMPRESA_2)}`;

const digitos = (s: Sorteio, n: number) =>
  Array.from({ length: n }, () => s.int(0, 9)).join("");

export function cpf(s: Sorteio): string {
  const base = digitos(s, 9);
  return base + digitosCpf(base);
}

export function cnpj(s: Sorteio): string {
  const base = `${digitos(s, 8)}0001`;
  return base + digitosCnpj(base);
}

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "ana.barros.123@exemplo.com.br" (o número evita repetir). */
export function email(nome: string, n: number): string {
  const [primeiro, ultimo] = [nome.split(" ")[0], nome.split(" ").at(-1)];
  return `${semAcento(`${primeiro}.${ultimo}`)}.${n}@exemplo.com.br`;
}

export const telefone = (s: Sorteio) =>
  `(22) 90000-${String(s.int(0, 9999)).padStart(4, "0")}`;

/** "aaaa-mm-dd" de nascimento entre os anos dados. */
export function nascimento(s: Sorteio, de: number, ate: number): string {
  const m = String(s.int(1, 12)).padStart(2, "0");
  const d = String(s.int(1, 28)).padStart(2, "0");
  return `${s.int(de, ate)}-${m}-${d}`;
}
