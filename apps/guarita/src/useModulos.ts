import { useEffect, useState } from "react";
import type { ModuloCondominio } from "@pacotes/shared";
import { assinarModulos, carregarModulos } from "./api/session";

/**
 * Módulos ligados no condomínio, lidos do cache local.
 *
 * Lê do cache e não da rede porque a home precisa desenhar antes de qualquer
 * resposta chegar. Quem preenche o cache é `sincronizarModulos()`, na abertura
 * do app e no login.
 *
 * Assina as mudanças em vez de ler uma vez só. A diferença apareceu no
 * primeiro teste real: no login, a sincronização corre em paralelo com a
 * montagem da home, então a leitura única pegava o cache ainda vazio (o
 * logout o apaga) e o menu ficava sem os módulos do condomínio para sempre,
 * mesmo com eles gravados um instante depois.
 *
 * Sem `useFocusEffect` de propósito: este hook também é usado por `App.tsx`,
 * que monta o NavigationContainer e portanto vive FORA dele, onde qualquer
 * hook de navegação estoura.
 */
export function useModulos(): readonly ModuloCondominio[] {
  const [modulos, setModulos] = useState<readonly ModuloCondominio[]>([]);

  useEffect(() => {
    let vivo = true;
    void carregarModulos().then((lidos) => {
      if (vivo) setModulos(lidos);
    });
    const cancelar = assinarModulos((novos) => {
      if (vivo) setModulos(novos);
    });
    return () => {
      vivo = false;
      cancelar();
    };
  }, []);

  return modulos;
}
