import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { ModuloCondominio } from "@pacotes/shared";
import { carregarModulos } from "./api/session";

/**
 * Módulos ligados no condomínio, lidos do cache local.
 *
 * Lê do cache e não da rede porque a home precisa desenhar antes de qualquer
 * resposta chegar. Quem preenche o cache é `sincronizarModulos()`, na abertura
 * do app e no login.
 *
 * RELÊ A CADA FOCO, e não uma vez na montagem. A diferença apareceu no
 * primeiro teste real: no login, `sincronizarModulos()` corre em paralelo com
 * a montagem da home, então a leitura única pegava o cache ainda vazio (o
 * logout o apaga) e o menu ficava só com os módulos base para sempre, mesmo
 * com os módulos gravados no cache um instante depois. Reler no foco conserta
 * esse caso e também o do síndico que liga um módulo com o app aberto.
 */
export function useModulos(): readonly ModuloCondominio[] {
  const [modulos, setModulos] = useState<readonly ModuloCondominio[]>([]);

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      void carregarModulos().then((lidos) => {
        if (vivo) setModulos(lidos);
      });
      return () => {
        vivo = false;
      };
    }, []),
  );

  return modulos;
}
