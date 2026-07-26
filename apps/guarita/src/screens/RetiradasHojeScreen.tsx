import React, { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../api/client";
import { rotuloUnidade, type ListaPacotes, type PacoteArmazenado } from "../api/types";
import { HeaderTela } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { PortariaStackParamList } from "../navigation";

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = NativeStackScreenProps<PortariaStackParamList, "RetiradasHoje">;

export function RetiradasHojeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [itens, setItens] = useState<PacoteArmazenado[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await apiFetch<ListaPacotes>(
        "/portaria/pacotes?status=ENTREGUE&retiradasHoje=1&pagina=1",
      );
      setItens(lista.itens);
      setTotal(lista.total);
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
      <HeaderTela
        titulo={`Retiradas hoje (${total})`}
        aoVoltar={() => navigation.goBack()}
      />
      <FlatList
        data={itens}
        keyExtractor={(p) => p.id}
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
            <Text style={styles.vazio}>Nenhuma saída registrada hoje.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.checkCirculo}>
              <Icone nome="check" tamanho={16} cor={theme.colors.ok} traco={2.6} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.unidade}>{rotuloUnidade(item.unidade)}</Text>
              <Text style={styles.sub}>
                {item.transportadora ?? "Sem transportadora"}
                {item.codigoRastreio ? ` · ${item.codigoRastreio}` : ""}
              </Text>
            </View>
            <Text style={styles.hora}>
              {item.retirada ? hora(item.retirada.retiradoEm) : "-"}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  vazio: { color: theme.colors.textSecondary, fontSize: theme.font.corpo, marginTop: 8 },
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
  checkCirculo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.okBg,
    alignItems: "center",
    justifyContent: "center",
  },
  unidade: { fontSize: 16.5, fontWeight: "700", color: theme.colors.text },
  sub: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: "500", marginTop: 2 },
  hora: { fontSize: 14, fontWeight: "600", color: theme.colors.textSecondary },
});
