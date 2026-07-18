import React, { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { JwtPayload } from "@pacotes/shared";
import { apiFetch, NetworkError } from "../api/client";
import { drenarFila, tamanhoFila } from "../api/offlineQueue";
import { limparSessao } from "../api/session";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation";

interface Resumo {
  naPortaria: number;
  retiradasHoje: number;
  paradas3Dias: number;
}

type Props = NativeStackScreenProps<RootStackParamList, "Home"> & {
  perfil: JwtPayload;
  aoSair: () => void;
};

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

export function HomeScreen({ navigation, perfil, aoSair }: Props) {
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(true);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [fila, setFila] = useState(0);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    setFila(await tamanhoFila());
    try {
      setResumo(await apiFetch<Resumo>("/portaria/resumo"));
      setOnline(true);
      const drenagem = await drenarFila();
      if (drenagem.enviadas > 0) {
        setFila(drenagem.restantes);
        Alert.alert("Sincronizado", `${drenagem.enviadas} registro(s) offline enviados.`);
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

  return (
    <LinearGradient
      colors={theme.gradiente.marca}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.4, y: 1 }}
      style={{ flex: 1 }}
    >
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.linhaLogo}>
          <Text style={styles.logo}>guarita</Text>
          <View style={styles.piloOnline}>
            <View
              style={[
                styles.dot,
                { backgroundColor: online ? theme.colors.acentoClaro : theme.colors.aviso },
              ]}
            />
            <Text style={styles.piloOnlineTexto}>{online ? "Online" : "Offline"}</Text>
          </View>
        </View>
        <View style={styles.linhaCondominio}>
          <View style={{ flex: 1 }}>
            <Text style={styles.condominio} numberOfLines={1}>
              {perfil.condominioNome ?? "Condomínio"}
            </Text>
            <Text style={styles.operador}>
              {perfil.nome} · Portaria
            </Text>
          </View>
          <Pressable
            onLongPress={async () => {
              await limparSessao();
              aoSair();
            }}
            style={styles.avatar}
          >
            <Text style={styles.avatarTexto}>{iniciais(perfil.nome)}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.corpo}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}
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
        {fila > 0 && (
          <View style={styles.avisoFila}>
            <View style={[styles.dot, { backgroundColor: theme.colors.aviso }]} />
            <Text style={styles.avisoFilaTexto}>
              {fila} registro(s) offline — enviam quando a conexão voltar
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => navigation.navigate("EntradaCamera")}
          style={({ pressed }) => [
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
            theme.sombraCta,
          ]}
        >
          <LinearGradient
            colors={theme.gradiente.acao}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tileEntrada}
          >
            <Icone nome="camera" tamanho={46} traco={1.8} />
            <Text style={styles.tileEntradaTitulo}>Nova entrada</Text>
            <Text style={styles.tileEntradaSub}>Abre a câmera direto</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate("Retirada")}
          style={({ pressed }) => [
            styles.tileRetirada,
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <Icone nome="qr" tamanho={34} traco={1.8} />
          <Text style={styles.tileRetiradaTitulo}>Retirada</Text>
        </Pressable>

        <View style={styles.linhaStats}>
          <Pressable
            onPress={() => navigation.navigate("Armazenados")}
            style={({ pressed }) => [
              styles.statCard,
              { transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <Text style={styles.statNumero}>{resumo?.naPortaria ?? "—"}</Text>
            <View style={styles.statLinhaRotulo}>
              <Text style={styles.statRotulo}>na portaria agora</Text>
              <Icone nome="chevron" tamanho={16} cor={theme.colors.textFaint} />
            </View>
          </Pressable>
          <View style={styles.statCard}>
            <Text style={styles.statNumero}>{resumo?.retiradasHoje ?? "—"}</Text>
            <Text style={styles.statRotulo}>retiradas hoje</Text>
          </View>
        </View>

        {(resumo?.paradas3Dias ?? 0) > 0 && (
          <View style={styles.avisoParadas}>
            <View style={[styles.dot, { backgroundColor: theme.colors.aviso }]} />
            <Text style={styles.avisoParadasTexto}>
              {resumo!.paradas3Dias} encomendas paradas há 3+ dias
            </Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: theme.spacing.lg, paddingBottom: 22 },
  linhaLogo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  piloOnline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  piloOnlineTexto: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  linhaCondominio: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
  },
  condominio: { color: "#FFF", fontSize: theme.font.tituloGrande, fontWeight: "700" },
  operador: { color: theme.colors.acentoClaro, fontSize: 14, fontWeight: "500", marginTop: 2 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  corpo: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
  },
  avisoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.alertaBg,
    borderRadius: theme.radius.card,
    padding: 12,
    marginBottom: 14,
  },
  avisoFilaTexto: { color: theme.colors.alerta, fontSize: 13.5, fontWeight: "600", flex: 1 },
  tileEntrada: {
    minHeight: 190,
    borderRadius: theme.radius.tile + 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: theme.spacing.lg,
  },
  tileEntradaTitulo: { color: "#FFF", fontSize: 30, fontWeight: "700" },
  tileEntradaSub: { color: "rgba(255,255,255,0.85)", fontSize: 14.5, fontWeight: "500" },
  tileRetirada: {
    minHeight: 120,
    borderRadius: theme.radius.tile + 2,
    backgroundColor: theme.colors.marca,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
  },
  tileRetiradaTitulo: { color: "#FFF", fontSize: 27, fontWeight: "700" },
  linhaStats: { flexDirection: "row", gap: 12, marginTop: 14 },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  statNumero: { fontSize: theme.font.hero, fontWeight: "700", color: theme.colors.text },
  statRotulo: { fontSize: 13.5, color: theme.colors.textSecondary, fontWeight: "500", marginTop: 2 },
  statLinhaRotulo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avisoParadas: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  avisoParadasTexto: { color: theme.colors.textSecondary, fontSize: 13.5, fontWeight: "500" },
});
