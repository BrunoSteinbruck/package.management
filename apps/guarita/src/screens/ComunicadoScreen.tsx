import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ComunicadoMorador } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { dataCurta } from "../api/types";
import { Card, HeaderTela, Kicker, Tela } from "../components/ui";
import { theme } from "../theme";
import type { MoradorStackParamList } from "../navigation";

type Props = NativeStackScreenProps<MoradorStackParamList, "Comunicado">;

/**
 * Comunicado aberto pelo morador.
 *
 * Abrir esta tela É marcar como lido: o recibo é gravado pelo próprio GET no
 * servidor, então não há botão de "marcar como lida" nem chance de a
 * contagem do síndico divergir do que o morador de fato viu.
 */
export function ComunicadoScreen({ navigation, route }: Props) {
  const { comunicadoId } = route.params;
  const [item, setItem] = useState<ComunicadoMorador | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItem(
        await apiFetch<ComunicadoMorador>(`/morador/comunicados/${comunicadoId}`),
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
      <HeaderTela titulo="Comunicado" aoVoltar={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 32,
        }}
        refreshControl={
          <RefreshControl refreshing={carregando} onRefresh={carregar} />
        }
      >
        {item && (
          <Card>
            <Kicker>
              {dataCurta(item.criadoEm)} · {item.autor}
            </Kicker>
            <Text style={styles.titulo}>{item.titulo}</Text>
            <Text style={styles.corpo}>{item.corpo}</Text>
          </Card>
        )}
      </ScrollView>
    </Tela>
  );
}

const styles = StyleSheet.create({
  titulo: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 6,
  },
  corpo: {
    fontSize: 15,
    lineHeight: 23,
    color: theme.colors.text,
    marginTop: 12,
  },
});
