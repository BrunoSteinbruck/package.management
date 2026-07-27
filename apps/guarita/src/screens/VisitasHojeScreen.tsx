import React, { useCallback, useState } from "react";
import { Alert, FlatList, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { VisitaPortaria } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { rotuloUnidade } from "../api/types";
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
                sub={`${rotuloUnidade(item.unidade)} · ${janela(item)}`}
                detalhe={item.documento ?? undefined}
                media={{
                  icone: "pessoa",
                  corFundo: chegou ? theme.colors.divisor : theme.colors.okBg,
                  corIcone: chegou
                    ? theme.colors.textSecondary
                    : theme.colors.marca,
                }}
                direita={
                  <Selo
                    texto={chegou ? "entrou" : "esperada"}
                    tom={chegou ? "ok" : "neutro"}
                  />
                }
              />
              {podeDarBaixa && !chegou && (
                <Botao
                  titulo="Chegou"
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
