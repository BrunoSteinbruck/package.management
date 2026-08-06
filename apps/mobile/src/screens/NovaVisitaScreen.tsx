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
import type { MinhaUnidade } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { rotuloUnidade } from "../api/types";
import { Botao, Chip, HeaderTela, Kicker, Nota, Tela } from "../components/ui";
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
  const [escolhendoData, setEscolhendoData] = useState(false);
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

  // Hoje e amanhã cobrem a visita combinada por telefone; o resto do mês fica
  // atrás de "Escolher data…". Antes eram três chips fixos e ponto: quem
  // recebia visita na semana seguinte não tinha como autorizar.
  //
  // Sem calendário nativo de propósito: `@react-native-community/datetimepicker`
  // é módulo nativo, e uma dependência nova custa um build novo nas lojas por
  // uma tela que a fita de dias resolve.
  const maisDias = Array.from({ length: 28 }, (_, i) => diaISO(i + 2));

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

          <Kicker>Nome de quem vem</Kicker>
          <TextInput
            style={styles.campo}
            placeholder="Nome completo"
            placeholderTextColor={theme.colors.textFaint}
            value={nome}
            onChangeText={setNome}
            maxLength={120}
          />

          <Kicker>Quando</Kicker>
          <View style={styles.linhaChips}>
            <Chip
              rotulo="Hoje"
              ativo={data === diaISO(0)}
              onPress={() => {
                setData(diaISO(0));
                setEscolhendoData(false);
              }}
            />
            <Chip
              rotulo="Amanhã"
              ativo={data === diaISO(1)}
              onPress={() => {
                setData(diaISO(1));
                setEscolhendoData(false);
              }}
            />
            <Chip
              rotulo={
                escolhendoData || (data !== diaISO(0) && data !== diaISO(1))
                  ? rotuloDia(data)
                  : "Escolher data…"
              }
              ativo={data !== diaISO(0) && data !== diaISO(1)}
              onPress={() => setEscolhendoData((v) => !v)}
            />
          </View>
          {escolhendoData && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.fitaDias}
            >
              {maisDias.map((d) => (
                <Chip
                  key={d}
                  rotulo={rotuloDia(d)}
                  ativo={data === d}
                  onPress={() => setData(d)}
                />
              ))}
            </ScrollView>
          )}

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
          <Text style={styles.notaDocumento}>
            O documento fica visível só para a portaria e é apagado depois de
            90 dias.
          </Text>

          <Botao
            titulo="Autorizar e gerar código"
            onPress={autorizar}
            carregando={enviando}
            estilo={{ marginTop: 18 }}
          />
          <Nota
            texto="A portaria recebe o nome e o código na lista de visitas do dia"
            estilo={{ marginTop: 12 }}
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
  notaDocumento: {
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    marginTop: -6,
  },
  linhaChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  fitaDias: { gap: 8, paddingTop: 10, paddingRight: theme.spacing.lg },
});
