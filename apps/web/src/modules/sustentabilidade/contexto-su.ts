import { dadosDe } from "@arp/shared/comercial/formato";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import {
  type Permissao,
  type PermissaoDePrograma,
  permissaoDoPrograma,
} from "@arp/shared/permissions";
import { useMemo } from "react";
import { type Usuario, useSessao } from "@/lib/sessao";
import { type Busca, useFiltrosLembrados } from "@/modules/shell/api";

// O `contextoSu()` do sistema antigo, na tela: quem está logado, as
// permissões (com as "Programa – lançar"), "hoje" (Brasília) e o "Dados de
// dd/mm/aaaa às hh:mm" da leitura. E os filtros lembrados de cada tela.

export interface ContextoSu {
  usuario: Usuario;
  pode: (p: Permissao) => boolean;
  /** Tem "Programa – lançar" deste programa (ou gerencia os programas). */
  podeLancar: (programaId: string) => boolean;
  /** Programas com "Programa – lançar" da pessoa. */
  programas: PermissaoDePrograma[];
  hoje: string;
  dadosDe: string;
}

/** `lidoEm`: quando a consulta chegou (dataUpdatedAt); padrão, agora. */
export function useContextoSu(lidoEm?: number): ContextoSu {
  const sessao = useSessao();
  return useMemo(() => {
    const agora = lidoEm ? new Date(lidoEm) : new Date();
    const pode = (p: Permissao) => sessao.pode(p);
    return {
      usuario: sessao.usuario,
      pode,
      programas: sessao.usuario.programas,
      podeLancar: (id: string) =>
        pode("sustentabilidade.programas.gerenciar") ||
        sessao.pode(permissaoDoPrograma(id)),
      hoje: hojeEmBrasilia(agora),
      dadosDe: dadosDe(agora),
    };
  }, [sessao, lidoEm]);
}

export interface FiltrosSu {
  busca: Busca;
  lembrado: string | null;
  um: (chave: string) => string;
}

/** Os filtros da tela (URL ou lembrados); null enquanto a API responde. */
export function useFiltrosSu(tela: string): FiltrosSu | null {
  const { busca, lembrado, pronto } = useFiltrosLembrados(
    "sustentabilidade",
    tela,
  );
  return useMemo(() => {
    if (!pronto) return null;
    const um = (chave: string) => {
      const v = busca[chave];
      return (Array.isArray(v) ? v[0] : v) ?? "";
    };
    return { busca, lembrado, um };
  }, [busca, lembrado, pronto]);
}
