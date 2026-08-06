import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { rotuloUnidade, type LeituraComunicado } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { dataCurta, iniciais } from "../api/types";
import { HeaderTela, ItemLista, Nota, Tela, Vazio } from "../components/ui";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "ComunicadoLeituras">;

/**
 * Quem leu um comunicado, nome a nome.
 *
 * A lista de comunicados já mostra o agregado ("3 de 213 leram"); esta tela
 * responde a pergunta seguinte, que é quem faltou. Rota COM parâmetro, então
 * não entra no manifesto: chega-se aqui tocando a linha do comunicado.
 */
export function ComunicadoLeiturasScreen({ navigation, route }: Props) {
  const { comunicadoId, titulo } = route.params;
  const [itens, setItens] = useState<LeituraComunicado[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(
        await apiFetch<LeituraComunicado[]>(
          `/cadastro/comunicados/${comunicadoId}/leituras`,
        ),
      );
    } catch {
      // offline: mantém o que está na tela
    } finally {
      setCarregando(false);
    }
  }, [comunicadoId]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Quem leu" aoVoltar={() => navigation.goBack()} />
      <FlatList
        data={itens}
        keyExtractor={(l, i) => `${l.nome}-${i}`}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 24,
          gap: 10,
        }}
        refreshControl={
          <RefreshControl refreshing={carregando} onRefresh={carregar} />
        }
        ListHeaderComponent={
          <Nota texto={titulo} estilo={{ marginBottom: 4 }} />
        }
        ListEmptyComponent={
          !carregando ? (
            <Vazio
              variante="hero"
              icone="megafone"
              titulo="Ninguém leu ainda"
              texto="A leitura é registrada quando o morador abre o comunicado no app."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ItemLista
            titulo={item.nome}
            sub={`${rotuloUnidade(item.unidade)} · leu em ${dataCurta(item.lidoEm)}`}
            media={{ iniciais: iniciais(item.nome) }}
          />
        )}
      />
    </Tela>
  );
}
