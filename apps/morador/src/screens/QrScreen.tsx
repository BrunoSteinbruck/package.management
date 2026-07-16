import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../api/client";
import { Card } from "../components/ui";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation";

const RENOVAR_MS = 60_000;

type Props = NativeStackScreenProps<RootStackParamList, "Qr">;

export function QrScreen({ route }: Props) {
  const { unidadeId, rotulo, pendentes } = route.params;
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const renovar = useCallback(async () => {
    try {
      const res = await apiFetch<{ qrToken: string }>("/morador/qr", {
        method: "POST",
        body: { unidadeId },
      });
      setQrToken(res.qrToken);
      setErro(null);
    } catch (e) {
      setErro(String((e as Error).message));
    }
  }, [unidadeId]);

  useEffect(() => {
    renovar();
    timer.current = setInterval(renovar, RENOVAR_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [renovar]);

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>Mostre na portaria</Text>
      <Text style={styles.subtitulo}>
        O porteiro escaneia e vê suas {pendentes} encomenda(s) de {rotulo}.
      </Text>

      <Card estilo={styles.cartaoQr}>
        {qrToken ? (
          <QRCode value={qrToken} size={230} />
        ) : (
          <Text style={{ color: theme.colors.textSecondary }}>
            {erro ?? "Gerando código..."}
          </Text>
        )}
      </Card>

      <Text style={styles.aviso}>
        O código renova sozinho a cada 60 segundos.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  titulo: {
    fontSize: theme.font.lg,
    fontWeight: "600",
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
  },
  subtitulo: {
    fontSize: theme.font.md,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  cartaoQr: {
    padding: theme.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 280,
    minWidth: 280,
  },
  aviso: {
    fontSize: theme.font.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
  },
});
