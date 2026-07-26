import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../api/client";
import { rotuloUnidade, type ListaPacotes, type PacoteArmazenado } from "../api/types";
import { HeaderTela, ItemLista, Tela, Vazio } from "../components/ui";
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
    <Tela comInsetTop>
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
            <Vazio titulo="Nenhuma saída registrada hoje." />
          ) : null
        }
        renderItem={({ item }) => (
          <ItemLista
            titulo={rotuloUnidade(item.unidade)}
            sub={`${item.transportadora ?? "Sem transportadora"}${
              item.codigoRastreio ? ` · ${item.codigoRastreio}` : ""
            }`}
            media={{
              icone: "check",
              corFundo: theme.colors.okBg,
              corIcone: theme.colors.ok,
            }}
            direita={
              <Text style={styles.hora}>
                {item.retirada ? hora(item.retirada.retiradoEm) : "-"}
              </Text>
            }
          />
        )}
      />
    </Tela>
  );
}

const styles = StyleSheet.create({
  hora: { fontSize: 14, fontWeight: "600", color: theme.colors.textSecondary },
});
