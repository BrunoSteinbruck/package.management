import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { VinculoPendente } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { iniciais, rotuloUnidade } from "../api/types";
import { Botao, HeaderTela, ItemLista, Tela, Vazio } from "../components/ui";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "Aprovacoes">;

export function AprovacoesScreen({ navigation }: Props) {
  const [itens, setItens] = useState<VinculoPendente[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aprovando, setAprovando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(await apiFetch<VinculoPendente[]>("/cadastro/vinculos/pendentes"));
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

  async function aprovar(v: VinculoPendente) {
    setAprovando(v.id);
    try {
      await apiFetch(`/cadastro/vinculos/${v.id}/aprovar`, { method: "POST" });
      await carregar();
    } catch (e) {
      Alert.alert("Não foi possível aprovar", String((e as Error).message));
    } finally {
      setAprovando(null);
    }
  }

  return (
    <Tela comInsetTop>
      <HeaderTela
        titulo="Aprovar moradores"
        aoVoltar={() => navigation.goBack()}
      />
      {itens.length > 0 && (
        <View style={styles.legenda}>
          <Text style={styles.legendaTexto}>
            {itens.length} pedido{itens.length === 1 ? "" : "s"} aguardando ·
            confirme com a unidade antes de aprovar
          </Text>
        </View>
      )}
      <FlatList
        data={itens}
        keyExtractor={(v) => v.id}
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
              icone="casa"
              titulo="Nada para aprovar"
              texto="Quando um morador pedir vínculo com uma unidade, o pedido aparece aqui."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ItemLista
            titulo={item.morador.nome}
            sub={`${item.morador.telefone} · pediu vínculo a ${rotuloUnidade(item.unidade)}`}
            media={{ iniciais: iniciais(item.morador.nome) }}
            direita={
              <Botao
                titulo="Aprovar"
                carregando={aprovando === item.id}
                desabilitado={aprovando !== null}
                onPress={() => aprovar(item)}
                estilo={{ minHeight: 40, paddingHorizontal: 14 }}
              />
            }
          />
        )}
      />
    </Tela>
  );
}

const styles = StyleSheet.create({
  legenda: { paddingHorizontal: theme.spacing.lg, paddingBottom: 12 },
  legendaTexto: {
    fontSize: 13.5,
    fontWeight: "500",
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },
});
