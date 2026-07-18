import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../api/client";
import { dataCurta } from "../api/types";
import { HeaderTela } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { MoradorStackParamList } from "../navigation";

interface Aviso {
  id: string;
  tipo: "ENTRADA" | "RETIRADA" | "CONVITE";
  criadoEm: string;
  transportadora: string | null;
  pacoteId: string | null;
}

type Props = NativeStackScreenProps<MoradorStackParamList, "Avisos">;

export function AvisosScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setAvisos(await apiFetch<Aviso[]>("/morador/notificacoes"));
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

  return (
    <View style={[styles.tela, { paddingTop: insets.top }]}>
      <HeaderTela titulo="Avisos" aoVoltar={() => navigation.goBack()} />
      <FlatList
        data={avisos}
        keyExtractor={(a) => a.id}
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
            <Text style={styles.vazio}>
              Nenhum aviso ainda — você será notificado quando uma encomenda
              chegar na portaria.
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const entrada = item.tipo === "ENTRADA";
          return (
            <Pressable
              onPress={() =>
                item.pacoteId &&
                navigation.navigate("Detalhe", { pacoteId: item.pacoteId })
              }
              style={({ pressed }) => [
                styles.card,
                { transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <View
                style={[
                  styles.circulo,
                  { backgroundColor: entrada ? theme.colors.okBg : theme.colors.divisor },
                ]}
              >
                <Icone
                  nome={entrada ? "sino" : "check"}
                  tamanho={18}
                  cor={entrada ? theme.colors.ok : theme.colors.textSecondary}
                  traco={2.2}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.titulo}>
                  {entrada ? "Encomenda chegou" : "Encomenda retirada"}
                </Text>
                <Text style={styles.sub}>
                  {item.transportadora ?? "Encomenda"} · {dataCurta(item.criadoEm)}
                </Text>
              </View>
              {item.pacoteId && (
                <Icone nome="chevron" tamanho={20} cor={theme.colors.textFaint} />
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  vazio: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.corpo,
    marginTop: 8,
    lineHeight: 22,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 14,
  },
  circulo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { fontSize: 15.5, fontWeight: "700", color: theme.colors.text },
  sub: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: "500", marginTop: 2 },
});
