import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { STATUS_AVISO, type OcorrenciaGestor, type StatusAviso } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { dataCurta, rotuloStatusAviso, rotuloUnidade } from "../api/types";
import {
  Chip,
  HeaderTela,
  ItemLista,
  Selo,
  Tela,
  Vazio,
  tomDoStatus,
} from "../components/ui";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "Ocorrencias">;

type Filtro = StatusAviso | "TODOS";
const FILTROS: readonly Filtro[] = ["TODOS", ...STATUS_AVISO];

function rotuloFiltro(f: Filtro): string {
  return f === "TODOS" ? "Todos" : rotuloStatusAviso(f);
}

export function OcorrenciasScreen({ navigation }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("ABERTO");
  const [itens, setItens] = useState<OcorrenciaGestor[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async (f: Filtro) => {
    setCarregando(true);
    try {
      const query = f === "TODOS" ? "" : `?status=${f}`;
      setItens(await apiFetch<OcorrenciaGestor[]>(`/cadastro/ocorrencias${query}`));
    } catch {
      // offline: mantém o que está na tela
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar(filtro);
    }, [carregar, filtro]),
  );

  return (
    <Tela comInsetTop>
      <HeaderTela
        titulo={`Relatos (${itens.length})`}
        aoVoltar={() => navigation.goBack()}
      />
      <View style={styles.filtros}>
        {FILTROS.map((f) => (
          <Chip
            key={f}
            rotulo={rotuloFiltro(f)}
            ativo={filtro === f}
            onPress={() => setFiltro(f)}
          />
        ))}
      </View>
      <FlatList
        data={itens}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 24,
          gap: 10,
        }}
        refreshControl={
          <RefreshControl
            refreshing={carregando}
            onRefresh={() => carregar(filtro)}
          />
        }
        ListEmptyComponent={
          !carregando ? (
            <Vazio
              variante="hero"
              icone="escudo"
              titulo="Nenhum relato"
              texto={
                filtro === "ABERTO"
                  ? "Nada aberto no momento. Os moradores avisam por aqui quando algo precisa de atenção."
                  : "Nenhum relato com esse filtro."
              }
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ItemLista
            titulo={item.categoria}
            sub={`${rotuloUnidade(item.unidade)} · ${item.autor}`}
            detalhe={dataCurta(item.criadoEm)}
            media={{
              icone: "escudo",
              corFundo: theme.colors.divisor,
              corIcone: theme.colors.textSecondary,
            }}
            direita={
              <Selo
                texto={rotuloStatusAviso(item.status)}
                tom={tomDoStatus(item.status)}
              />
            }
            chevron
            onPress={() =>
              navigation.navigate("OcorrenciaDetalhe", { avisoId: item.id })
            }
          />
        )}
      />
    </Tela>
  );
}

const styles = StyleSheet.create({
  filtros: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 12,
  },
});
