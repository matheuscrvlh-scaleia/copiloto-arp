"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import type { EstadoAcao } from "@/components/form-acao";
import {
  erroDoArquivo,
  fotoRedutivel,
  LIMITES_PORTAL,
  medidasReduzidas,
} from "@/lib/os/portal";

// Envio dos formulários do portal: reduz as fotos no navegador (celular
// tira foto de 5 MB; a Vercel aceita 4,5 MB por requisição), confere
// tamanho e tipo antes de subir e lembra nome e telefone de quem pede
// neste aparelho, para não pedir de novo a cada pedido.

const CHAVE = "arp-portal-solicitante";

export interface QuemPede {
  nome: string;
  telefone: string;
}

export function lerQuemPede(): QuemPede | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
    return typeof v?.nome === "string" && typeof v?.telefone === "string"
      ? { nome: v.nome, telefone: v.telefone }
      : null;
  } catch {
    return null;
  }
}

function lembrar(dados: FormData) {
  const nome = String(dados.get("nome") ?? "").trim();
  const telefone = String(dados.get("telefone") ?? "").trim();
  if (!nome || !telefone) return;
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ nome, telefone }));
  } catch {
    // Navegador sem armazenamento (aba anônima): pede de novo na próxima.
  }
}

async function reduzirFoto(f: File): Promise<File> {
  if (!fotoRedutivel(f.type)) return f;
  try {
    const imagem = await createImageBitmap(f);
    const { largura, altura } = medidasReduzidas(imagem.width, imagem.height);
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    canvas.getContext("2d")?.drawImage(imagem, 0, 0, largura, altura);
    imagem.close();
    const blob = await new Promise<Blob | null>((ok) =>
      canvas.toBlob(ok, "image/jpeg", 0.82),
    );
    if (!blob || blob.size >= f.size) return f;
    return new File([blob], `${f.name.replace(/\.[^.]+$/, "")}.jpg`, {
      type: "image/jpeg",
    });
  } catch {
    // Formato que o navegador não abre: vai como veio.
    return f;
  }
}

/** Dados do formulário com as fotos reduzidas, ou o erro de tamanho/tipo. */
async function prepararEnvio(
  form: HTMLFormElement,
): Promise<{ dados: FormData } | { erro: string }> {
  const saida = new FormData();
  let total = 0;
  let quantos = 0;
  for (const [chave, valor] of new FormData(form).entries()) {
    if (!(valor instanceof File)) {
      saida.append(chave, valor);
      continue;
    }
    if (valor.size === 0) continue;
    const arquivo = await reduzirFoto(valor);
    const erro = erroDoArquivo(arquivo.name, arquivo.size);
    if (erro) return { erro };
    total += arquivo.size;
    quantos++;
    saida.append(chave, arquivo);
  }
  if (quantos > LIMITES_PORTAL.arquivosPorEnvio)
    return {
      erro: `Envie no máximo ${LIMITES_PORTAL.arquivosPorEnvio} arquivos por vez.`,
    };
  if (total > LIMITES_PORTAL.tamanhoEnvio)
    return {
      erro: "Os arquivos passam do tamanho permitido. Envie menos de cada vez.",
    };
  return { dados: saida };
}

/**
 * Estado de uma ação do portal. `versao` muda a cada sucesso: use como key
 * dos campos para limpá-los depois de enviar.
 */
export interface EstadoPortal extends EstadoAcao {
  // Pedido criado: o número aparece na tela.
  id?: string;
  numero?: number;
  aviso?: string;
}

export function useEnvioDoPortal(
  acao: (anterior: EstadoPortal, form: FormData) => Promise<EstadoPortal>,
) {
  const [estado, executar, enviando] = useActionState<EstadoPortal, FormData>(
    acao,
    {},
  );
  const [erroLocal, setErroLocal] = useState<string>();
  const [preparando, setPreparando] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (estado.ok) setVersao((v) => v + 1);
  }, [estado]);

  async function aoEnviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroLocal(undefined);
    setPreparando(true);
    const r = await prepararEnvio(e.currentTarget);
    setPreparando(false);
    if ("erro" in r) {
      setErroLocal(r.erro);
      return;
    }
    lembrar(r.dados);
    startTransition(() => executar(r.dados));
  }

  return {
    estado,
    erro: erroLocal ?? (enviando ? undefined : estado.erro),
    enviando: enviando || preparando,
    versao,
    aoEnviar,
  };
}
