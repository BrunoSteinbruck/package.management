import React, { useCallback, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { VisitaPortaria } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { diaPorExtenso, iniciais, rotuloUnidade } from "../api/types";
import { Botao, HeaderTela, ItemLista, Selo, Tela, Vazio } from "../components/ui";
import { theme } from "../theme";

/** A janela combinada, quando o morador informou. */
function janela(v: VisitaPortaria): string {
  if (!v.janelaInicio) return "sem hora combinada";
  return v.janelaFim ? `${v.janelaInicio} às ${v.janelaFim}` : `a partir de ${v.janelaInicio}`;
}

/**
 * Quem é esperado hoje, na tela do porteiro.
 *
 * O síndico abre a mesma tela em modo leitura (sem `podeDarBaixa`), no
 * padrão de `ArmazenadosScreen`: ele acompanha, não opera o portão.
 */
export function VisitasHojeScreen({
  navigation,
  podeDarBaixa,
}: {
  navigation: { goBack: () => void };
  podeDarBaixa?: boolean;
}) {
  const [itens, setItens] = useState<VisitaPortaria[]>([]);
  const [carregando, setCarregando] = useState(false);
  // Canceladas não entram na conta: a legenda responde quantas pessoas a
  // portaria ainda pode receber hoje.
  const autorizadas = itens.filter((v) => v.status !== "CANCELADA").length;

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(await apiFetch<VisitaPortaria[]>("/portaria/visitas-hoje"));
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

  async function darBaixa(v: VisitaPortaria) {
    try {
      await apiFetch(`/portaria/visitas/${v.id}/chegada`, { method: "POST" });
      await carregar();
    } catch (e) {
      Alert.alert("Não foi possível registrar", String((e as Error).message));
    }
  }

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Visitas de hoje" aoVoltar={() => navigation.goBack()} />
      <View style={styles.legenda}>
        <Text style={styles.legendaTexto}>
          {diaPorExtenso()} · {autorizadas} autorizada
          {autorizadas === 1 ? "" : "s"}
        </Text>
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
              titulo="Ninguém esperado hoje"
              texto="Quando um morador autorizar uma visita pelo app, ela aparece aqui."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const chegou = item.status === "CHEGOU";
          return (
            <>
              <ItemLista
                titulo={item.nomeVisitante}
                sub={`visita a ${rotuloUnidade(item.unidade)} · ${janela(item)}`}
                // Código antes do documento: é o que o visitante diz na
                // portaria, e o documento nem sempre foi informado.
                detalhe={
                  [item.codigo, item.documento].filter(Boolean).join(" · ") ||
                  undefined
                }
                media={{ iniciais: iniciais(item.nomeVisitante) }}
                direita={
                  <Selo
                    texto={chegou ? "chegou" : "autorizada"}
                    tom={chegou ? "ok" : "neutro"}
                  />
                }
              />
              {podeDarBaixa && !chegou && (
                <Botao
                  titulo="Registrar chegada"
                  icone="check"
                  variante="outline"
                  onPress={() => darBaixa(item)}
                />
              )}
            </>
          );
        }}
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
  },
});
