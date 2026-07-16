import React, { useCallback, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { JwtPayload } from "@pacotes/shared";
import { apiFetch, NetworkError } from "../api/client";
import { drenarFila, tamanhoFila } from "../api/offlineQueue";
import { limparSessao } from "../api/session";
import type { Pendencia } from "../api/types";
import { Botao, Card } from "../components/ui";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Home"> & {
  perfil: JwtPayload;
  aoSair: () => void;
};

export function HomeScreen({ navigation, perfil, aoSair }: Props) {
  const [online, setOnline] = useState(true);
  const [naPortaria, setNaPortaria] = useState<number | null>(null);
  const [fila, setFila] = useState(0);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    setFila(await tamanhoFila());
    try {
      const pendencias = await apiFetch<Pendencia[]>("/portaria/pendencias");
      setNaPortaria(pendencias.reduce((soma, p) => soma + p.pendentes, 0));
      setOnline(true);
      const resultado = await drenarFila();
      if (resultado.enviadas > 0) {
        setFila(resultado.restantes);
        Alert.alert(
          "Sincronizado",
          `${resultado.enviadas} registro(s) offline enviados.`,
        );
      }
    } catch (e) {
      if (e instanceof NetworkError) setOnline(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  async function sair() {
    await limparSessao();
    aoSair();
  }

  return (
    <ScrollView
      style={styles.tela}
      contentContainerStyle={{ padding: theme.spacing.md }}
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={async () => {
            setAtualizando(true);
            await carregar();
            setAtualizando(false);
          }}
        />
      }
    >
      <View style={styles.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={styles.nomeCondominio}>Portaria</Text>
          <Text style={styles.operador}>
            {perfil.nome} · {perfil.papel?.toLowerCase()}
          </Text>
        </View>
        <View
          style={[
            styles.selo,
            { backgroundColor: online ? theme.colors.successBg : theme.colors.warningBg },
          ]}
        >
          <Text
            style={{
              fontSize: theme.font.sm,
              color: online ? theme.colors.success : theme.colors.warning,
            }}
          >
            {online ? "online" : "offline"}
          </Text>
        </View>
      </View>

      {fila > 0 && (
        <Card
          estilo={{
            backgroundColor: theme.colors.warningBg,
            borderColor: theme.colors.warningBg,
            marginBottom: theme.spacing.md,
          }}
        >
          <Text style={{ color: theme.colors.warning, fontSize: theme.font.sm }}>
            {fila} registro(s) aguardando sincronização — serão enviados quando a
            conexão voltar.
          </Text>
        </Card>
      )}

      <Botao
        titulo="Nova entrada"
        variante="destaque"
        onPress={() => navigation.navigate("EntradaCamera")}
        estilo={{ minHeight: 84, marginBottom: theme.spacing.sm }}
      />
      <Botao
        titulo="Retirada"
        variante="secundario"
        onPress={() => navigation.navigate("Retirada")}
        estilo={{ minHeight: 84, marginBottom: theme.spacing.md }}
      />

      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        <Card estilo={styles.metrica}>
          <Text style={styles.metricaValor}>{naPortaria ?? "—"}</Text>
          <Text style={styles.metricaRotulo}>na portaria</Text>
        </Card>
        <Card estilo={styles.metrica}>
          <Text style={styles.metricaValor}>{fila}</Text>
          <Text style={styles.metricaRotulo}>na fila offline</Text>
        </Card>
      </View>

      <Botao
        titulo="Sair"
        variante="secundario"
        onPress={sair}
        estilo={{ marginTop: theme.spacing.xl }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  nomeCondominio: {
    fontSize: theme.font.lg,
    fontWeight: "600",
    color: theme.colors.text,
  },
  operador: { fontSize: theme.font.sm, color: theme.colors.textSecondary },
  selo: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  metrica: { flex: 1, alignItems: "center" },
  metricaValor: { fontSize: 28, fontWeight: "600", color: theme.colors.text },
  metricaRotulo: { fontSize: theme.font.sm, color: theme.colors.textSecondary },
});
