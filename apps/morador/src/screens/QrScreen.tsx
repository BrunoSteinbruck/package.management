import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../api/client";
import { HeaderTela } from "../components/ui";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation";

const RENOVAR_MS = 60_000;

type Props = NativeStackScreenProps<RootStackParamList, "Qr">;

export function QrScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { unidadeId, pendentes } = route.params;
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const progresso = useRef(new Animated.Value(1)).current;

  const renovar = useCallback(async () => {
    try {
      const res = await apiFetch<{ qrToken: string }>("/morador/qr", {
        method: "POST",
        body: { unidadeId },
      });
      setQrToken(res.qrToken);
      setErro(null);
      progresso.setValue(1);
      Animated.timing(progresso, {
        toValue: 0,
        duration: RENOVAR_MS,
        useNativeDriver: false,
      }).start();
    } catch (e) {
      setErro(String((e as Error).message));
    }
  }, [unidadeId, progresso]);

  useEffect(() => {
    renovar();
    timer.current = setInterval(renovar, RENOVAR_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [renovar]);

  return (
    <LinearGradient
      colors={theme.gradiente.marca}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.4, y: 1 }}
      style={{ flex: 1, paddingTop: insets.top }}
    >
      <HeaderTela
        titulo="Retirar na portaria"
        aoVoltar={() => navigation.goBack()}
        escuro
      />

      <View style={styles.centro}>
        <View style={styles.cartao}>
          {qrToken ? (
            <QRCode value={qrToken} size={216} />
          ) : (
            <View style={{ width: 216, height: 216, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: theme.colors.textSecondary }}>
                {erro ?? "Gerando código..."}
              </Text>
            </View>
          )}
          <View style={styles.trilhaProgresso}>
            <Animated.View
              style={[
                styles.barraProgresso,
                {
                  width: progresso.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.renovacao}>O código renova a cada 60 s</Text>
        </View>

        <View style={styles.piloPendentes}>
          <Text style={styles.piloPendentesTexto}>
            {pendentes} encomenda{pendentes !== 1 ? "s" : ""} para retirar
          </Text>
        </View>

        <Text style={styles.hint}>
          Mostre este código ao porteiro.{"\n"}Ele confere e registra a entrega com foto.
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 20 },
  cartao: {
    backgroundColor: "#FFF",
    borderRadius: theme.radius.sheet,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 20 },
    elevation: 16,
  },
  trilhaProgresso: {
    width: 216,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.divisor,
    marginTop: 20,
    overflow: "hidden",
  },
  barraProgresso: { height: 6, borderRadius: 3, backgroundColor: theme.colors.acao },
  renovacao: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: "500", marginTop: 10 },
  piloPendentes: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  piloPendentesTexto: { color: "#FFF", fontSize: 14.5, fontWeight: "600" },
  hint: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "500",
  },
});
