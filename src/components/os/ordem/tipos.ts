import type { EstadoAcao } from "@/components/form-acao";

// Estado das ações do bloco da OS: além do ok/erro de sempre, o que a tela
// faz em seguida (propor concluir, abrir o WhatsApp com o link).

export interface EstadoOS extends EstadoAcao {
  /** Depois de Finalizar: a OS pode ser concluída agora. */
  concluir?: boolean;
  /** Por que ainda não pode concluir (mostrado no lugar do botão). */
  motivo?: string | null;
  /** wa.me pronto para abrir. */
  whatsapp?: string;
}
