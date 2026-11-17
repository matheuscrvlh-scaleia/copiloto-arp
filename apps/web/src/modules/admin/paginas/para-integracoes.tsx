import { TELA_DAS_INTEGRACOES } from "@arp/shared/integracoes";
import { Redirecionar, useCaminho } from "@/lib/navegacao";

// Endereços antigos (Administração › Configurações › Integrações e as abas de Integrações do
// Marketing e da Sustentabilidade): tudo agora fica em Configurações ›
// Integrações. Mantém a busca e a âncora de quem chega por link salvo.
const ANCORA: [string, string][] = [
  ["/marketing/", "#grupo-marketing"],
  ["/sustentabilidade/", "#sus_growatt"],
];

export default function ParaIntegracoes() {
  const caminho = useCaminho();
  const { search, hash } = window.location;
  const ancora =
    hash || ANCORA.find(([prefixo]) => caminho.startsWith(prefixo))?.[1] || "";
  return <Redirecionar para={`${TELA_DAS_INTEGRACOES}${search}${ancora}`} />;
}
