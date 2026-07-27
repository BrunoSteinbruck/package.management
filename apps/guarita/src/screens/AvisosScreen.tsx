import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { VERSAO_FEED, type ItemFeed } from "@pacotes/shared";
import { apiFetch, urlFoto } from "../api/client";
import { apresentar } from "../feed";
import { HeaderTela, ItemLista, Selo, Tela, Vazio } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { MoradorStackParamList } from "../navigation";

type Props = NativeStackScreenProps<MoradorStackParamList, "Avisos">;

export function AvisosScreen({ navigation }: Props) {
  const [itens, setItens] = useState<ItemFeed[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      // A versão declara o que ESTE binário sabe renderizar: a API omite
      // tipo mais novo em vez de mandar algo que `apresentar()` não conhece.
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

  async function resolver(avisoId: string) {
    try {
      await apiFetch(`/morador/avisos/${avisoId}/resolver`, { method: "POST" });
      carregar();
    } catch (e) {
      Alert.alert("Não foi possível", String((e as Error).message));
    }
  }

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Avisos" aoVoltar={() => navigation.goBack()} />
      <FlatList
        data={itens}
        keyExtractor={(i) => i.id}
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
              icone="sino"
              titulo="Nada por aqui"
              texto="Você verá avisos da portaria, o status dos seus relatos e o que acontecer com as suas encomendas."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const a = apresentar(item);
          const foto = "foto" in item ? item.foto : null;
          const pacoteId = a.pacoteId;
          return (
            <View>
              <ItemLista
                titulo={a.titulo}
                sub={a.sub}
                media={
                  foto
                    ? { fotoUri: urlFoto(foto) }
                    : {
                        icone: a.icone,
                        corFundo: a.corFundo,
                        corIcone: a.corIcone,
                      }
                }
                direita={a.selo ? <Selo {...a.selo} /> : undefined}
                chevron={!!pacoteId}
                onPress={
                  pacoteId
                    ? () => navigation.navigate("Detalhe", { pacoteId })
                    : undefined
                }
              />
              {item.tipo === "AVISO" && item.podeResolver && (
                <Pressable
                  style={styles.botaoResolver}
                  onPress={() => resolver(item.avisoId)}
                >
                  <Icone
                    nome="check"
                    tamanho={16}
                    cor={theme.colors.marca}
                    traco={2.6}
                  />
                  <Text style={styles.botaoResolverTexto}>OK, resolvido</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </Tela>
  );
}

const styles = StyleSheet.create({
  botaoResolver: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    minHeight: 44,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.marca,
  },
  botaoResolverTexto: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.marca,
  },
});
