import React, { useCallback, useState } from "react";
import { Alert, FlatList, RefreshControl, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { VisitaMorador } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { Botao, HeaderTela, ItemLista, Selo, Tela, Vazio } from "../components/ui";
import { theme } from "../theme";
import type { MoradorStackParamList } from "../navigation";

type Props = NativeStackScreenProps<MoradorStackParamList, "Visitas">;

const ROTULO_STATUS = {
  AUTORIZADA: { texto: "autorizada", tom: "neutro" },
  CHEGOU: { texto: "entrou", tom: "ok" },
  CANCELADA: { texto: "cancelada", tom: "alerta" },
} as const;

/** "2026-07-28" vira "28/07" sem passar por Date (que deslocaria o dia). */
function diaCurto(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export function VisitasScreen({ navigation }: Props) {
  const [itens, setItens] = useState<VisitaMorador[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(await apiFetch<VisitaMorador[]>("/morador/visitas"));
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

  async function cancelar(v: VisitaMorador) {
    Alert.alert("Cancelar visita", `Cancelar a visita de ${v.nomeVisitante}?`, [
      { text: "Não", style: "cancel" },
      {
        text: "Cancelar visita",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/morador/visitas/${v.id}/cancelar`, {
              method: "POST",
            });
            await carregar();
          } catch (e) {
            Alert.alert("Não foi possível", String((e as Error).message));
          }
        },
      },
    ]);
  }

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Visitas" aoVoltar={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: 12 }}>
        <Botao
          titulo="Autorizar visita"
          icone="pessoa"
          onPress={() => navigation.navigate("NovaVisita")}
        />
      </View>
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
              icone="pessoa"
              titulo="Nenhuma visita"
              texto="Avise a portaria antes de alguém chegar e a entrada fica mais rápida."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const status = ROTULO_STATUS[item.status];
          return (
            <>
              <ItemLista
                titulo={item.nomeVisitante}
                sub={
                  item.janelaInicio
                    ? `${diaCurto(item.dataPrevista)} · a partir de ${item.janelaInicio}`
                    : diaCurto(item.dataPrevista)
                }
                media={{
                  icone: "pessoa",
                  corFundo: theme.colors.okBg,
                  corIcone: theme.colors.marca,
                }}
                direita={<Selo texto={status.texto} tom={status.tom} />}
              />
              {item.status === "AUTORIZADA" && (
                <Botao
                  titulo="Cancelar"
                  variante="outline"
                  onPress={() => cancelar(item)}
                />
              )}
            </>
          );
        }}
      />
    </Tela>
  );
}
