import { useEffect, useState } from "react";
import type { ModuloCondominio } from "@pacotes/shared";
import { carregarModulos } from "./api/session";

/**
 * Módulos ligados no condomínio, lidos do cache local.
 *
 * Lê do cache e não da rede porque a home precisa desenhar antes de qualquer
 * resposta chegar. Quem atualiza o cache é `sincronizarModulos()`, na abertura
 * do app: um módulo ligado agora pelo síndico aparece na próxima abertura, e
 * enquanto isso a tela não fica esperando nada.
 *
 * Começa vazio, então na primeira renderização só aparecem os módulos base.
 * É a escolha certa nos dois sentidos: o menu cresce quando o cache chega, em
 * vez de piscar itens que somem.
 */
export function useModulos(): readonly ModuloCondominio[] {
  const [modulos, setModulos] = useState<readonly ModuloCondominio[]>([]);
  useEffect(() => {
    let vivo = true;
    void carregarModulos().then((lidos) => {
      if (vivo) setModulos(lidos);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return modulos;
}
