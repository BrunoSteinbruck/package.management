import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { VERSAO_FEED, type ItemFeed } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { dataCurta } from "../api/types";
import { HeaderTela, ItemLista, Selo, Tela, Vazio } from "../components/ui";
import { theme } from "../theme";
import type { MoradorStackParamList } from "../navigation";

type Props = NativeStackScreenProps<MoradorStackParamList, "Comunicados">;

/**
 * Os comunicados da administração, só eles.
 *
 * Sai do mesmo `/morador/feed` que o sino: o feed unificado continua sendo a
 * caixa de entrada, e esta tela é a prateleira de quem entrou procurando "o
 * que a administração publicou" e não "o que aconteceu comigo". Não há
 * endpoint novo nem tipo novo no feed, então nada de versão a subir.
 */
export function ComunicadosMoradorScreen({ navigation }: Props) {
  const [itens, setItens] = useState<ItemFeed[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(await apiFetch<ItemFeed[]>(`/morador/feed?v=${VERSAO_FEED}`));
    } catch {
      // offline: mantém o que está na tela
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const comunicados = itens.filter((i) => i.tipo === "COMUNICADO");

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Comunicados" aoVoltar={() => navigation.goBack()} />
      <FlatList
        data={comunicados}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 24,
          gap: 10,
        }}
        refreshControl={
          <RefreshControl refreshing={carregando} onRefresh={carregar} />
        }
        ListEmptyComponent={
          !carregando ? (
            <Vazio
              variante="hero"
              icone="megafone"
              titulo="Nenhum comunicado"
              texto="Avisos da administração para todo o condomínio aparecem aqui."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ItemLista
            titulo={item.titulo}
            sub={item.resumo}
            detalhe={dataCurta(item.em)}
            media={{
              icone: "megafone",
              corFundo: theme.colors.okBg,
              corIcone: theme.colors.marca,
            }}
            direita={
              item.lido ? undefined : <Selo texto="novo" tom="marca" />
            }
            chevron
            onPress={() =>
              navigation.navigate("Comunicado", {
                comunicadoId: item.comunicadoId,
              })
            }
          />
        )}
      />
    </Tela>
  );
}
