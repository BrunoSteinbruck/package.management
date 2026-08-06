import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ComunicadoGestor } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { dataCurta } from "../api/types";
import { Botao, HeaderTela, ItemLista, Selo, Tela, Vazio } from "../components/ui";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "Comunicados">;

/** O que o síndico quer saber depois de publicar: quantos leram. */
function alcanceLido(c: ComunicadoGestor): string {
  if (c.alcance === 0) return "ninguém alcançado ainda";
  const pct = Math.round((c.leituras / c.alcance) * 100);
  return `${c.leituras} de ${c.alcance} leram · ${pct}%`;
}

export function ComunicadosScreen({ navigation }: Props) {
  const [itens, setItens] = useState<ComunicadoGestor[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(await apiFetch<ComunicadoGestor[]>("/cadastro/comunicados"));
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
        titulo="Comunicados"
        aoVoltar={() => navigation.goBack()}
        // No cabeçalho e não em cima da lista: publicar é ocasional, ler o
        // alcance do que já saiu é o que o síndico faz toda vez que entra.
        direita={
          <Botao
            titulo="Novo"
            icone="mais"
            onPress={() => navigation.navigate("NovoComunicado")}
            estilo={{ minHeight: 40, paddingHorizontal: 14 }}
          />
        }
      />
      <FlatList
        data={itens}
        keyExtractor={(c) => c.id}
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
              icone="megafone"
              titulo="Nenhum comunicado"
              texto="Publique um aviso e ele chega no app de todo mundo do condomínio."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ItemLista
            titulo={item.titulo}
            sub={`${dataCurta(item.criadoEm)} · ${alcanceLido(item)}`}
            media={{
              icone: "megafone",
              corFundo: theme.colors.okBg,
              corIcone: theme.colors.marca,
            }}
            direita={
              item.blocos.length > 0 ? (
                <Selo texto={item.blocos.join(", ")} tom="neutro" />
              ) : undefined
            }
          />
        )}
      />
    </Tela>
  );
}
