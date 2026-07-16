import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { theme } from "../theme";

export function Botao(props: {
  titulo: string;
  onPress: () => void;
  variante?: "primario" | "secundario" | "destaque";
  desabilitado?: boolean;
  carregando?: boolean;
  estilo?: ViewStyle;
}) {
  const { variante = "primario" } = props;
  const bg =
    variante === "primario"
      ? theme.colors.fill
      : variante === "destaque"
        ? theme.colors.accentBg
        : theme.colors.surface;
  const fg =
    variante === "primario"
      ? theme.colors.onFill
      : variante === "destaque"
        ? theme.colors.accent
        : theme.colors.text;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.desabilitado || props.carregando}
      style={({ pressed }) => [
        styles.botao,
        { backgroundColor: bg, opacity: props.desabilitado ? 0.45 : pressed ? 0.85 : 1 },
        variante === "secundario" && { borderWidth: 1, borderColor: theme.colors.border },
        props.estilo,
      ]}
    >
      {props.carregando ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.botaoTexto, { color: fg }]}>{props.titulo}</Text>
      )}
    </Pressable>
  );
}

export function Chip(props: {
  rotulo: string;
  ativo?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[
        styles.chip,
        props.ativo
          ? { backgroundColor: theme.colors.fill }
          : { borderWidth: 1, borderColor: theme.colors.border },
      ]}
    >
      <Text
        style={{
          fontSize: theme.font.sm,
          color: props.ativo ? theme.colors.onFill : theme.colors.text,
        }}
      >
        {props.rotulo}
      </Text>
    </Pressable>
  );
}

export function Card(props: { children: React.ReactNode; estilo?: ViewStyle }) {
  return <View style={[styles.card, props.estilo]}>{props.children}</View>;
}

export function Rotulo(props: { children: React.ReactNode; estilo?: TextStyle }) {
  return <Text style={[styles.rotulo, props.estilo]}>{props.children}</Text>;
}

const styles = StyleSheet.create({
  botao: {
    minHeight: theme.touch.min,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  botaoTexto: { fontSize: theme.font.md, fontWeight: "600" },
  chip: {
    minHeight: 40,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  rotulo: {
    fontSize: theme.font.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
});
