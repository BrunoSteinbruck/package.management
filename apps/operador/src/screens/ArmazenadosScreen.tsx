import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../api/client";
import type { ListaPacotes, PacoteArmazenado } from "../api/types";
import { HeaderTela } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation";

function diasArmazenado(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

type Props = NativeStackScreenProps<RootStackParamList, "Armazenados">;

export function ArmazenadosScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<PacoteArmazenado[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const pagina = useRef(1);

  const carregar = useCallback(
    async (novaBusca: string, novaPagina: number) => {
      setCarregando(true);
      try {
        const params = new URLSearchParams({
          status: "ARMAZENADO",
          pagina: String(novaPagina),
        });
        if (novaBusca.trim()) params.set("busca", novaBusca.trim());
        const lista = await apiFetch<ListaPacotes>(`/portaria/pacotes?${params}`);
        pagina.current = novaPagina;
        setTotal(lista.total);
        setItens((atual) =>
          novaPagina === 1 ? lista.itens : [...atual, ...lista.itens],
        );
      } catch {
        // offline: mantém o que está na tela
      } finally {
        setCarregando(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => carregar(busca, 1), busca ? 300 : 0);
    return () => clearTimeout(timer);
  }, [busca, carregar]);

  return (
    <View style={[styles.tela, { paddingTop: insets.top }]}>
      <HeaderTela
        titulo={`Na portaria (${total})`}
        aoVoltar={() => navigation.goBack()}
      />
      <View style={{ paddingHorizontal: theme.spacing.lg, flex: 1 }}>
        <View style={styles.campoBusca}>
          <Icone nome="busca" tamanho={20} cor={theme.colors.textMuted} />
          <TextInput
            style={styles.inputBusca}
            placeholder="Unidade, transportadora, rastreio…"
            placeholderTextColor={theme.colors.textFaint}
            value={busca}
            onChangeText={setBusca}
          />
        </View>

        <FlatList
          data={itens}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ gap: 10, paddingVertical: 14 }}
          refreshControl={
            <RefreshControl
              refreshing={carregando && pagina.current === 1}
              onRefresh={() => carregar(busca, 1)}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!carregando && itens.length < total) {
              carregar(busca, pagina.current + 1);
            }
          }}
          ListEmptyComponent={
            !carregando ? (
              <Text style={styles.vazio}>
                {busca
                  ? "Nada encontrado com essa busca."
                  : "Nenhuma encomenda na portaria."}
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const dias = diasArmazenado(item.recebidoEm);
            return (
              <Pressable
                onPress={() =>
                  navigation.navigate("Retirada", { unidadeInicial: item.unidade })
                }
                style={({ pressed }) => [
                  styles.card,
                  { transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.unidade}>
                    {item.unidade.bloco
                      ? `${item.unidade.identificacao} · Bloco ${item.unidade.bloco}`
                      : item.unidade.identificacao}
                  </Text>
                  <Text style={styles.sub}>
                    {item.transportadora ?? "Sem transportadora"}
                    {item.localArmazenamento ? ` · Prateleira ${item.localArmazenamento}` : ""}
                  </Text>
                  {item.codigoRastreio && (
                    <Text style={styles.rastreio} numberOfLines={1}>
                      {item.codigoRastreio}
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    styles.selo,
                    { backgroundColor: dias >= 3 ? theme.colors.alertaBg : theme.colors.okBg },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: "600",
                      color: dias >= 3 ? theme.colors.alerta : theme.colors.ok,
                    }}
                  >
                    {dias === 0 ? "hoje" : `${dias} dia${dias > 1 ? "s" : ""}`}
                  </Text>
                </View>
                <Icone nome="chevron" tamanho={20} cor={theme.colors.textFaint} />
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  campoBusca: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    minHeight: 50,
  },
  inputBusca: { flex: 1, fontSize: 16, color: theme.colors.text },
  vazio: { color: theme.colors.textSecondary, fontSize: theme.font.corpo, marginTop: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 14,
  },
  unidade: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
  sub: { fontSize: 13.5, color: theme.colors.textSecondary, fontWeight: "500", marginTop: 2 },
  rastreio: {
    fontFamily: "monospace",
    fontSize: 11.5,
    color: theme.colors.textMuted,
    marginTop: 3,
  },
  selo: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
