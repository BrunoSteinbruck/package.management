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
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { JwtPayload } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { salvarSessao } from "../api/session";
import { Botao, BotaoCta, Rotulo } from "../components/ui";
import { theme } from "../theme";

export function LoginScreen(props: { aoEntrar: (perfil: JwtPayload) => void }) {
  const insets = useSafeAreaInsets();
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
          "Este app é para a equipe da portaria. Moradores usam o app Guarita.",
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
    <LinearGradient
      colors={theme.gradiente.marca}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.4, y: 1 }}
      style={{ flex: 1 }}
    >
      <View style={[styles.header, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.logo}>guarita</Text>
        <Text style={styles.headline}>Acesso da portaria</Text>
        <Text style={styles.sub}>Entre com o telefone cadastrado pelo condomínio.</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {fase === "telefone" ? (
          <View>
            <Rotulo>Seu celular</Rotulo>
            <View style={styles.campoTelefone}>
              <Text style={styles.prefixo}>+55</Text>
              <View style={styles.divisorVertical} />
              <TextInput
                style={styles.inputTelefone}
                keyboardType="phone-pad"
                autoFocus
                value={telefone}
                onChangeText={setTelefone}
                placeholder="41 99999 0001"
                placeholderTextColor={theme.colors.textFaint}
              />
            </View>
            <BotaoCta
              titulo="Receber código por SMS"
              altura={64}
              onPress={pedirCodigo}
              carregando={carregando}
              desabilitado={telefone.replace(/\D/g, "").length < 10}
              estilo={{ marginTop: 18 }}
            />
          </View>
        ) : (
          <View>
            <Rotulo>Código de 6 dígitos enviado para {telefone}</Rotulo>
            <TextInput
              style={styles.campoCodigo}
              keyboardType="number-pad"
              autoFocus
              maxLength={6}
              value={codigo}
              onChangeText={setCodigo}
            />
            <BotaoCta
              titulo="Entrar"
              altura={64}
              onPress={verificar}
              carregando={carregando}
              desabilitado={codigo.trim().length !== 6}
              estilo={{ marginTop: 18 }}
            />
            <Botao
              titulo="Trocar telefone"
              variante="outline"
              onPress={() => setFase("telefone")}
              estilo={{ marginTop: 10 }}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingBottom: 30 },
  logo: {
    color: theme.colors.acentoClaro,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  headline: { color: "#FFF", fontSize: 31, fontWeight: "700", marginTop: 16, lineHeight: 38 },
  sub: { color: "rgba(255,255,255,0.85)", fontSize: 15.5, marginTop: 8, lineHeight: 22 },
  sheet: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    padding: 24,
    paddingTop: 28,
  },
  campoTelefone: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    minHeight: 60,
    paddingHorizontal: 16,
    gap: 12,
  },
  prefixo: { fontSize: 18, fontWeight: "600", color: theme.colors.textSecondary },
  divisorVertical: { width: 1, height: 28, backgroundColor: theme.colors.divisor },
  inputTelefone: { flex: 1, fontSize: 19, fontWeight: "600", color: theme.colors.text },
  campoCodigo: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    minHeight: 60,
    textAlign: "center",
    letterSpacing: 10,
    fontSize: 26,
    fontWeight: "700",
    color: theme.colors.text,
  },
});
