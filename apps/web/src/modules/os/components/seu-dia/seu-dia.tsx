import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { consultaDoSeuDia } from "@/modules/os/api";
import { ModalSeuDia, type ResumoDoDia } from "./modal";

// "Seu dia": só na primeira entrada do dia. A API (GET /os/visoes/seu-dia)
// lê o dia já visto em core.preferencias e, se ainda não foi hoje, conta o
// que pede atenção em toda a caixa da pessoa (sem os filtros da tela). Não
// segura a tela: aparece quando chega.

export function SeuDia() {
  const { data } = useQuery(consultaDoSeuDia);
  // O resumo fica com esta tela: ao abrir, o modal marca o dia como visto e
  // a consulta passa a devolver "nada" (nas outras telas ele não reaparece).
  const [resumo, setResumo] = useState<ResumoDoDia | null>(null);
  if (data && !resumo) setResumo(data);
  if (!resumo) return null;
  return <ModalSeuDia resumo={resumo} />;
}
