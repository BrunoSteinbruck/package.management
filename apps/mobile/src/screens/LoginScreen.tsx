import React, { useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { JwtPayload } from "@pacotes/shared";
import { ApiError, apiFetch } from "../api/client";
import { salvarSessao } from "../api/session";
import { registrarPush } from "../api/push";
import { abrir, temLinksLegais, URL_PRIVACIDADE, URL_TERMOS } from "../legal";
import { Botao, BotaoCta, Rotulo } from "../components/ui";
import { theme } from "../theme";

const PASSOS = ["Telefone", "Código", "Unidade"] as const;

export function LoginScreen(props: {
  /** Pode ser assíncrono: o App busca os módulos antes de trocar de tela. */
  aoEntrar: (perfil: JwtPayload) => void | Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [fase, setFase] = useState<0 | 1 | 2>(0);
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [convite, setConvite] = useState("");
  const [carregando, setCarregando] = useState(false);

  // O teclado numérico do iOS não tem "concluir": quando o campo atinge o
  // tamanho esperado, baixamos o teclado sozinhos para liberar o botão.
  function aoDigitarTelefone(valor: string) {
    setTelefone(valor);
    if (valor.replace(/\D/g, "").length >= 11) Keyboard.dismiss();
  }

  function aoDigitarCodigo(valor: string) {
    setCodigo(valor);
    if (valor.trim().length >= 6) Keyboard.dismiss();
  }

  async function pedirCodigo() {
    setCarregando(true);
    try {
      const res = await apiFetch<{ enviado: boolean; devCodigo?: string }>(
        "/auth/otp/request",
        { method: "POST", body: { telefone: telefone.replace(/\D/g, "") } },
      );
      if (__DEV__ && res.devCodigo) setCodigo(res.devCodigo);
      setFase(1);
    } catch (e) {
      Alert.alert("Não foi possível enviar o código", String((e as Error).message));
    } finally {
      setCarregando(false);
    }
  }

  async function verificar(comConvite: boolean) {
    setCarregando(true);
    try {
      const res = await apiFetch<{ token: string; perfil: JwtPayload }>(
        "/auth/otp/verify",
        {
          method: "POST",
          body: {
            telefone: telefone.replace(/\D/g, ""),
            codigo: codigo.trim(),
            ...(comConvite
              ? { nome: nome.trim(), convite: convite.trim().toUpperCase() }
              : {}),
          },
        },
      );
      // App único: o perfil devolvido pelo servidor decide a experiência. Push
      // interessa aos dois lados, porque a administração também é destinatária
      // (uma ocorrência nova precisa chegar ao síndico).
      await salvarSessao(res);
      await registrarPush();
      await props.aoEntrar(res.perfil);
    } catch (e) {
      // Telefone desconhecido: passo 3, vincular por convite.
      if (!comConvite && e instanceof ApiError && e.status === 404) {
        setFase(2);
        return;
      }
      Alert.alert(
        comConvite ? "Convite não aceito" : "Código não aceito",
        String((e as Error).message),
      );
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
      <View style={[styles.header, { paddingTop: insets.top + 34 }]}>
        <Text style={styles.logo}>convivar</Text>
        <Text style={styles.headline}>Suas encomendas, sem espera na portaria</Text>
        {/* O QR foi rebaixado a conferência opcional: prometê-lo na primeira
            tela do app dizia ao morador que ele PRECISA de um QR para
            retirar, quando na prática ele diz a unidade na portaria. */}
        <Text style={styles.sub}>Avisamos quando chegar. Você retira na portaria.</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.stepper}>
          {PASSOS.map((passo, i) => (
            <View key={passo} style={{ flex: 1, gap: 6 }}>
              <View
                style={[
                  styles.barraPasso,
                  { backgroundColor: i <= fase ? theme.colors.acao : theme.colors.toggleOff },
                ]}
              />
              <Text
                style={[
                  styles.rotuloPasso,
                  { color: i <= fase ? theme.colors.ok : theme.colors.textMuted },
                ]}
              >
                {passo}
              </Text>
            </View>
          ))}
        </View>

        {fase === 0 ? (
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
                onChangeText={aoDigitarTelefone}
                placeholder="41 98888 0001"
                // O servidor aceita 10 a 14 dígitos; com espaço e parêntese
                // digitados à mão, 20 caracteres cobrem qualquer formato sem
                // deixar colar um texto inteiro no campo.
                maxLength={20}
                placeholderTextColor={theme.colors.textFaint}
              />
            </View>
            <Text style={styles.hint}>Sem senha e sem cadastro longo, só o número.</Text>
            <BotaoCta
              titulo="Receber código por SMS"
              altura={64}
              onPress={pedirCodigo}
              carregando={carregando}
              desabilitado={telefone.replace(/\D/g, "").length < 10}
              estilo={{ marginTop: 16 }}
            />
            <Text style={styles.legal}>
              Ao continuar, você concorda com os{" "}
              {temLinksLegais ? (
                <>
                  <Text style={styles.legalLink} onPress={() => abrir(URL_TERMOS)}>
                    termos de uso
                  </Text>
                  {" e a "}
                  <Text
                    style={styles.legalLink}
                    onPress={() => abrir(URL_PRIVACIDADE)}
                  >
                    política de privacidade
                  </Text>
                  .
                </>
              ) : (
                "termos de uso e a política de privacidade."
              )}
            </Text>
          </View>
        ) : fase === 1 ? (
          <View>
            <Rotulo>Código de 6 dígitos enviado para {telefone}</Rotulo>
            <TextInput
              style={styles.campoCodigo}
              keyboardType="number-pad"
              autoFocus
              maxLength={6}
              value={codigo}
              onChangeText={aoDigitarCodigo}
            />
            <BotaoCta
              titulo="Confirmar"
              altura={64}
              onPress={() => verificar(false)}
              carregando={carregando}
              desabilitado={codigo.trim().length !== 6}
              estilo={{ marginTop: 16 }}
            />
            <Botao
              titulo="Trocar telefone"
              variante="outline"
              onPress={() => setFase(0)}
              estilo={{ marginTop: 10 }}
            />
          </View>
        ) : (
          <View>
            <Text style={styles.tituloConvite}>Vincule-se à sua unidade</Text>
            <Text style={styles.subConvite}>
              Seu telefone ainda não está no cadastro. Use o código de convite
              de um morador da sua unidade: ou peça um à administração.
            </Text>
            <Rotulo>Seu nome</Rotulo>
            <TextInput
              style={styles.campo}
              autoFocus
              value={nome}
              onChangeText={setNome}
              placeholder="Nome e sobrenome"
              maxLength={120}
              placeholderTextColor={theme.colors.textFaint}
            />
            <Rotulo estilo={{ marginTop: 14 }}>Código do convite</Rotulo>
            <TextInput
              style={[styles.campoCodigo, { letterSpacing: 6, fontSize: 22 }]}
              autoCapitalize="characters"
              maxLength={8}
              value={convite}
              onChangeText={setConvite}
              placeholder="A1B2C3"
              placeholderTextColor={theme.colors.textFaint}
            />
            <BotaoCta
              titulo="Entrar com convite"
              altura={64}
              onPress={() => verificar(true)}
              carregando={carregando}
              desabilitado={nome.trim().length < 2 || convite.trim().length < 4}
              estilo={{ marginTop: 16 }}
            />
            <Botao
              titulo="Voltar"
              variante="outline"
              onPress={() => setFase(1)}
              estilo={{ marginTop: 10 }}
            />
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingBottom: 28 },
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
    paddingTop: 24,
  },
  stepper: { flexDirection: "row", gap: 8, marginBottom: 24 },
  barraPasso: { height: 5, borderRadius: 3 },
  rotuloPasso: { fontSize: 12.5, fontWeight: "600" },
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
  hint: { fontSize: 13.5, color: theme.colors.textSecondary, marginTop: 10 },
  legal: {
    fontSize: 12.5,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 18,
  },
  // O texto legal fica no sheet BRANCO, não no gradiente: verde escuro.
  legalLink: {
    color: theme.colors.ok,
    textDecorationLine: "underline",
  },
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
  campo: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    minHeight: 56,
    paddingHorizontal: 16,
    fontSize: 17,
    color: theme.colors.text,
  },
  tituloConvite: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  subConvite: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 18,
  },
});
