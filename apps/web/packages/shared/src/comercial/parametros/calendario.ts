import { z } from "zod";
import { texto } from "./campo";

// Bloco "calendario": feriados de Nova Friburgo (os.feriados).

export const feriado = z.object({
  data: z.iso.date({ message: "data inválida" }),
  nome: texto(80, "informe o nome"),
});
