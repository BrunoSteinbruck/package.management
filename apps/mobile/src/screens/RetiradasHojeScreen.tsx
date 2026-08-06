import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../api/client";
import {
  diaPorExtenso,
  rotuloUnidade,
  type ListaPacotes,
  type PacoteArmazenado,
} from "../api/types";
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
        titulo="Retiradas de hoje"
        aoVoltar={() => navigation.goBack()}
      />
      {/* A contagem sai do título e vira legenda com a data: o porteiro que
          abre a tela às 19h precisa saber de que dia é o que está vendo. */}
      <View style={styles.legenda}>
        <Text style={styles.legendaTexto}>
          {diaPorExtenso()} · {total} entrega{total === 1 ? "" : "s"}
        </Text>
      </View>
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
            titulo={`${rotuloUnidade(item.unidade)} · ${item.transportadora ?? "sem transportadora"}`}
            // Quem levou o pacote é a informação que a portaria procura aqui:
            // o rastreio, que ocupava esta linha, só serve na busca.
            sub={
              item.retirada?.retiradoPorNome
                ? `recebeu ${item.retirada.retiradoPorNome}`
                : "sem registro de quem recebeu"
            }
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
  legenda: { paddingHorizontal: theme.spacing.lg, paddingBottom: 12 },
  legendaTexto: {
    fontSize: 13.5,
    fontWeight: "500",
    color: theme.colors.textSecondary,
  },
});
