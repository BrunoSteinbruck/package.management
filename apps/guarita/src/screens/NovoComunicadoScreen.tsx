import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Unidade } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { Botao, Chip, HeaderTela, Kicker, Tela } from "../components/ui";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "NovoComunicado">;

export function NovoComunicadoScreen({ navigation }: Props) {
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [blocos, setBlocos] = useState<string[]>([]);
  const [disponiveis, setDisponiveis] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // Os blocos vêm das unidades cadastradas, não de um campo livre: bloco
    // digitado errado viraria um comunicado que ninguém recebe.
    apiFetch<Unidade[]>("/cadastro/unidades")
      .then((us) => {
        const nomes = [...new Set(us.map((u) => u.bloco).filter(Boolean))];
        setDisponiveis(nomes as string[]);
      })
      .catch(() => {});
  }, []);

  function alternarBloco(b: string) {
    setBlocos((atual) =>
      atual.includes(b) ? atual.filter((x) => x !== b) : [...atual, b],
    );
  }

  async function publicar() {
    if (titulo.trim().length < 3 || corpo.trim().length < 1) {
      Alert.alert("Faltou preencher", "O comunicado precisa de título e texto.");
      return;
    }
    setEnviando(true);
    try {
      await apiFetch("/cadastro/comunicados", {
        method: "POST",
        body: { titulo, corpo, blocos },
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert("Não foi possível publicar", String((e as Error).message));
    } finally {
      setEnviando(false);
    }
  }

  const alvo =
    blocos.length === 0
      ? "Vai para o condomínio inteiro."
      : `Vai só para: ${blocos.join(", ")}.`;

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Novo comunicado" aoVoltar={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: 32,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Kicker>Título</Kicker>
          <TextInput
            style={styles.campo}
            placeholder="Ex.: Manutenção do elevador na terça"
            placeholderTextColor={theme.colors.textFaint}
            value={titulo}
            onChangeText={setTitulo}
            maxLength={120}
          />

          <Kicker>Texto</Kicker>
          <TextInput
            style={[styles.campo, styles.campoLongo]}
            placeholder="O que os moradores precisam saber."
            placeholderTextColor={theme.colors.textFaint}
            value={corpo}
            onChangeText={setCorpo}
            multiline
            maxLength={4000}
          />

          {disponiveis.length > 0 && (
            <>
              <Kicker>Blocos (opcional)</Kicker>
              <View style={styles.grade}>
                {disponiveis.map((b) => (
                  <Chip
                    key={b}
                    rotulo={b}
                    ativo={blocos.includes(b)}
                    onPress={() => alternarBloco(b)}
                  />
                ))}
              </View>
            </>
          )}

          <Text style={styles.alvo}>{alvo}</Text>

          <Botao
            titulo="Publicar"
            onPress={publicar}
            carregando={enviando}
            estilo={{ marginTop: 18 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Tela>
  );
}

const styles = StyleSheet.create({
  campo: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
    marginTop: 6,
    marginBottom: 14,
  },
  campoLongo: { minHeight: 140, textAlignVertical: "top" },
  grade: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  alvo: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 14,
  },
});
