import React, { useCallback, useState } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  STATUS_AVISO,
  type OcorrenciaGestor,
  type StatusAviso,
} from "@pacotes/shared";
import { apiFetch, urlFoto } from "../api/client";
import { dataCurta, rotuloStatusAviso, rotuloUnidade } from "../api/types";
import {
  Botao,
  Card,
  HeaderTela,
  Kicker,
  Selo,
  Tela,
  tomDoStatus,
} from "../components/ui";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "OcorrenciaDetalhe">;

export function OcorrenciaDetalheScreen({ navigation, route }: Props) {
  const { avisoId } = route.params;
  const [item, setItem] = useState<OcorrenciaGestor | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState<StatusAviso | null>(null);

  // Não há endpoint de detalhe: a lista do gestor já traz tudo que a tela
  // mostra, então busca a lista e escolhe. Um GET dedicado só se paga quando
  // a fila crescer a ponto de o filtro em memória pesar.
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const todos = await apiFetch<OcorrenciaGestor[]>("/cadastro/ocorrencias");
      setItem(todos.find((o) => o.id === avisoId) ?? null);
    } catch {
      // offline: mantém o que está na tela
    } finally {
      setCarregando(false);
    }
  }, [avisoId]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  async function mudarStatus(status: StatusAviso) {
    setSalvando(status);
    try {
      await apiFetch(`/cadastro/ocorrencias/${avisoId}/status`, {
        method: "POST",
        body: { status },
      });
      await carregar();
    } catch (e) {
      Alert.alert("Não foi possível atualizar", String((e as Error).message));
    } finally {
      setSalvando(null);
    }
  }

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Relato" aoVoltar={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 6, gap: 16 }}
        refreshControl={
          <RefreshControl refreshing={carregando} onRefresh={carregar} />
        }
      >
        {!item ? (
          <Text style={styles.sub}>
            {carregando ? "Carregando…" : "Relato não encontrado."}
          </Text>
        ) : (
          <>
            <View style={styles.linhaTitulo}>
              <Text style={styles.titulo}>{item.categoria}</Text>
              <Selo
                texto={rotuloStatusAviso(item.status)}
                tom={tomDoStatus(item.status)}
              />
            </View>
            <Text style={styles.sub}>
              {rotuloUnidade(item.unidade)} · {item.autor} ·{" "}
              {dataCurta(item.criadoEm)}
            </Text>

            {item.descricao ? (
              <Card>
                <Text style={styles.descricao}>{item.descricao}</Text>
              </Card>
            ) : null}

            {item.foto && (
              <Image source={{ uri: urlFoto(item.foto) }} style={styles.foto} />
            )}

            {/* Com dois estados, sobra sempre uma ação: a oposta à atual. */}
            <View>
              <Botao
                titulo={
                  item.status === "ABERTO"
                    ? "Marcar como resolvido"
                    : "Reabrir relato"
                }
                icone={item.status === "ABERTO" ? "check" : undefined}
                variante={item.status === "ABERTO" ? "marca" : "outline"}
                carregando={salvando !== null}
                desabilitado={salvando !== null}
                onPress={() =>
                  mudarStatus(item.status === "ABERTO" ? "RESOLVIDO" : "ABERTO")
                }
              />
              <Text style={styles.nota}>
                O morador que abriu recebe a mudança no aparelho dele.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </Tela>
  );
}

const styles = StyleSheet.create({
  linhaTitulo: { flexDirection: "row", alignItems: "center", gap: 12 },
  titulo: {
    flex: 1,
    fontSize: theme.font.tituloGrande,
    fontWeight: "700",
    color: theme.colors.text,
  },
  sub: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: "500" },
  descricao: { fontSize: theme.font.corpo, color: theme.colors.text, lineHeight: 23 },
  foto: { width: "100%", height: 220, borderRadius: theme.radius.card },
  nota: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 10,
    textAlign: "center",
  },
});
