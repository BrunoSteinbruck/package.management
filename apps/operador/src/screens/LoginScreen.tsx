import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { JwtPayload } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { salvarSessao } from "../api/session";
import { Botao, Rotulo } from "../components/ui";
import { theme } from "../theme";

export function LoginScreen(props: { aoEntrar: (perfil: JwtPayload) => void }) {
  const [fase, setFase] = useState<"telefone" | "codigo">("telefone");
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function pedirCodigo() {
    setCarregando(true);
    try {
      const res = await apiFetch<{ enviado: boolean; devCodigo?: string }>(
        "/auth/otp/request",
        { method: "POST", body: { telefone: telefone.replace(/\D/g, "") } },
      );
      if (__DEV__ && res.devCodigo) setCodigo(res.devCodigo);
      setFase("codigo");
    } catch (e) {
      Alert.alert("Não foi possível enviar o código", String((e as Error).message));
    } finally {
      setCarregando(false);
    }
  }

  async function verificar() {
    setCarregando(true);
    try {
      const res = await apiFetch<{ token: string; perfil: JwtPayload }>(
        "/auth/otp/verify",
        {
          method: "POST",
          body: { telefone: telefone.replace(/\D/g, ""), codigo: codigo.trim() },
        },
      );
      if (res.perfil.tipo !== "usuario") {
        Alert.alert(
          "Acesso restrito",
          "Este app é para a equipe da portaria. Moradores usam o app do morador.",
        );
        return;
      }
      await salvarSessao(res);
      props.aoEntrar(res.perfil);
    } catch (e) {
      Alert.alert("Código não aceito", String((e as Error).message));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.tela}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.titulo}>Portaria</Text>
      <Text style={styles.subtitulo}>
        {fase === "telefone"
          ? "Entre com o telefone cadastrado pelo condomínio."
          : `Código enviado por SMS para ${telefone}.`}
      </Text>

      {fase === "telefone" ? (
        <View>
          <Rotulo>Celular (DDD + número)</Rotulo>
          <TextInput
            style={styles.campo}
            keyboardType="phone-pad"
            autoFocus
            value={telefone}
            onChangeText={setTelefone}
            placeholder="41 99999 0001"
            placeholderTextColor={theme.colors.textMuted}
          />
          <Botao
            titulo="Receber código"
            onPress={pedirCodigo}
            carregando={carregando}
            desabilitado={telefone.replace(/\D/g, "").length < 10}
            estilo={{ marginTop: theme.spacing.md }}
          />
        </View>
      ) : (
        <View>
          <Rotulo>Código de 6 dígitos</Rotulo>
          <TextInput
            style={[styles.campo, styles.campoCodigo]}
            keyboardType="number-pad"
            autoFocus
            maxLength={6}
            value={codigo}
            onChangeText={setCodigo}
          />
          <Botao
            titulo="Entrar"
            onPress={verificar}
            carregando={carregando}
            desabilitado={codigo.trim().length !== 6}
            estilo={{ marginTop: theme.spacing.md }}
          />
          <Botao
            titulo="Trocar telefone"
            variante="secundario"
            onPress={() => setFase("telefone")}
            estilo={{ marginTop: theme.spacing.sm }}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    padding: theme.spacing.lg,
    justifyContent: "center",
  },
  titulo: {
    fontSize: theme.font.xl,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitulo: {
    fontSize: theme.font.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  campo: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    minHeight: theme.touch.min,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.font.lg,
    color: theme.colors.text,
  },
  campoCodigo: { textAlign: "center", letterSpacing: 8, fontSize: 24 },
});
