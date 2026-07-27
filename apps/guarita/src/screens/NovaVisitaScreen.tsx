import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MinhaUnidade } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { rotuloUnidade } from "../api/types";
import { Botao, Chip, HeaderTela, Kicker, Tela } from "../components/ui";
import { theme } from "../theme";
import type { MoradorStackParamList } from "../navigation";

type Props = NativeStackScreenProps<MoradorStackParamList, "NovaVisita">;

/** Data local no formato que a API espera, sem passar por UTC. */
function diaISO(offsetDias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function rotuloDia(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export function NovaVisitaScreen({ navigation }: Props) {
  const [unidades, setUnidades] = useState<MinhaUnidade[]>([]);
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [data, setData] = useState(diaISO(0));
  const [hora, setHora] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    apiFetch<MinhaUnidade[]>("/morador/pacotes")
      .then((us) => {
        setUnidades(us);
        if (us.length === 1) setUnidadeId(us[0].unidade.id);
      })
      .catch(() => {});
  }, []);

  async function autorizar() {
    const alvo = unidadeId ?? unidades[0]?.unidade.id;
    if (!alvo || nome.trim().length < 2) {
      Alert.alert("Faltou preencher", "Informe o nome de quem vai visitar.");
      return;
    }
    if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
      Alert.alert("Hora inválida", "Use o formato HH:MM, por exemplo 14:30.");
      return;
    }
    setEnviando(true);
    try {
      await apiFetch("/morador/visitas", {
        method: "POST",
        body: {
          unidadeId: alvo,
          nomeVisitante: nome,
          documento: documento.trim() || undefined,
          dataPrevista: data,
          janelaInicio: hora || undefined,
        },
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert("Não foi possível autorizar", String((e as Error).message));
    } finally {
      setEnviando(false);
    }
  }

  // Três dias bastam: visita combinada para semana que vem se autoriza na
  // véspera, e um seletor de calendário completo custaria uma dependência.
  const dias = [diaISO(0), diaISO(1), diaISO(2)];

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Autorizar visita" aoVoltar={() => navigation.goBack()} />
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
          {unidades.length > 1 && (
            <>
              <Kicker>Unidade</Kicker>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {unidades.map((u) => (
                  <Chip
                    key={u.unidade.id}
                    rotulo={rotuloUnidade(u.unidade)}
                    ativo={unidadeId === u.unidade.id}
                    onPress={() => setUnidadeId(u.unidade.id)}
                  />
                ))}
              </ScrollView>
            </>
          )}

          <Kicker>Quem vai visitar</Kicker>
          <TextInput
            style={styles.campo}
            placeholder="Nome completo"
            placeholderTextColor={theme.colors.textFaint}
            value={nome}
            onChangeText={setNome}
            maxLength={120}
          />

          <Kicker>Quando</Kicker>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {dias.map((d, i) => (
              <Chip
                key={d}
                rotulo={i === 0 ? "Hoje" : i === 1 ? "Amanhã" : rotuloDia(d)}
                ativo={data === d}
                onPress={() => setData(d)}
              />
            ))}
          </ScrollView>

          <Kicker>A partir de que horas (opcional)</Kicker>
          <TextInput
            style={styles.campo}
            placeholder="14:30"
            placeholderTextColor={theme.colors.textFaint}
            value={hora}
            onChangeText={setHora}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />

          <Kicker>Documento (opcional)</Kicker>
          <TextInput
            style={styles.campo}
            placeholder="RG ou CPF, se quiser agilizar a conferência"
            placeholderTextColor={theme.colors.textFaint}
            value={documento}
            onChangeText={setDocumento}
            maxLength={40}
          />
          <Text style={styles.nota}>
            O documento fica visível só para a portaria e é apagado depois de
            90 dias.
          </Text>

          <Botao
            titulo="Autorizar"
            onPress={autorizar}
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
  nota: {
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    marginTop: -6,
  },
});
