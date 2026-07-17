import React, { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch, urlFoto } from "../api/client";
import { dataCurta, type DetalhePacote } from "../api/types";
import { Card, HeaderTela } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Detalhe">;

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DetalheScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [detalhe, setDetalhe] = useState<DetalhePacote | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DetalhePacote>(`/morador/pacotes/${route.params.pacoteId}`)
      .then(setDetalhe)
      .catch((e) => setErro(String((e as Error).message)));
  }, [route.params.pacoteId]);

  const fotos = {
    entrada: detalhe?.fotoEntrada ? urlFoto(detalhe.fotoEntrada) : null,
    saida: detalhe?.fotoSaida ? urlFoto(detalhe.fotoSaida) : null,
  };

  const entregue = detalhe?.status === "ENTREGUE";

  return (
    <View style={[styles.tela, { paddingTop: insets.top }]}>
      <HeaderTela
        titulo="Encomenda"
        aoVoltar={() => navigation.goBack()}
        direita={
          detalhe ? (
            <View style={[styles.badge, entregue ? styles.badgeOk : styles.badgeInfo]}>
              <Text style={[styles.badgeTexto, { color: entregue ? theme.colors.ok : theme.colors.marca }]}>
                {entregue ? "Entregue" : "Na portaria"}
              </Text>
            </View>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 6, paddingBottom: 40 }}>
        {erro && (
          <Card estilo={{ backgroundColor: theme.colors.alertaBg, borderColor: theme.colors.alertaBg }}>
            <Text style={{ color: theme.colors.alerta, fontWeight: "600" }}>{erro}</Text>
          </Card>
        )}

        {detalhe && (
          <>
            <Card>
              <View style={styles.linhaTitulo}>
                <Text style={styles.transportadora}>
                  {detalhe.transportadora ?? "Encomenda"}
                </Text>
                {detalhe.codigoRastreio && (
                  <Text style={styles.rastreio}>{detalhe.codigoRastreio}</Text>
                )}
              </View>
              <View style={styles.linhaFotos}>
                <View style={{ flex: 1 }}>
                  {fotos.entrada ? (
                    <Image source={{ uri: fotos.entrada }} style={styles.foto} />
                  ) : (
                    <View style={[styles.foto, styles.fotoVazia]}>
                      <Icone nome="camera" tamanho={20} cor={theme.colors.textFaint} />
                    </View>
                  )}
                  <Text style={styles.legendaFoto}>foto da entrada</Text>
                </View>
                <View style={{ flex: 1 }}>
                  {fotos.saida ? (
                    <Image source={{ uri: fotos.saida }} style={styles.foto} />
                  ) : (
                    <View style={[styles.foto, styles.fotoVazia]}>
                      <Icone nome="camera" tamanho={20} cor={theme.colors.textFaint} />
                    </View>
                  )}
                  <Text style={styles.legendaFoto}>foto da entrega</Text>
                </View>
              </View>
            </Card>

            <Card estilo={{ marginTop: 14 }}>
              <View style={styles.evento}>
                <View style={styles.colunaDot}>
                  <View style={[styles.dot, { backgroundColor: theme.colors.acao }]} />
                  {entregue && <View style={styles.linhaVertical} />}
                </View>
                <View style={{ flex: 1, paddingBottom: entregue ? 18 : 0 }}>
                  <Text style={styles.eventoTitulo}>Recebida na portaria</Text>
                  <Text style={styles.eventoSub}>
                    {dataCurta(detalhe.recebidoEm)} · por {detalhe.recebidoPorNome} (portaria)
                  </Text>
                  <Text style={styles.eventoSub}>
                    {detalhe.localArmazenamento
                      ? `Prateleira ${detalhe.localArmazenamento} · `
                      : ""}
                    {detalhe.notificadoEm
                      ? `morador avisado às ${hora(detalhe.notificadoEm)}`
                      : "aviso na fila"}
                  </Text>
                </View>
              </View>

              {entregue && detalhe.retiradoEm && (
                <View style={styles.evento}>
                  <View style={styles.colunaDot}>
                    <View style={[styles.dot, { backgroundColor: theme.colors.marca }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventoTitulo}>Entregue</Text>
                    <Text style={styles.eventoSub}>
                      {dataCurta(detalhe.retiradoEm)}
                      {detalhe.entreguePorNome ? ` · por ${detalhe.entreguePorNome}` : ""}
                    </Text>
                  </View>
                </View>
              )}
            </Card>

            <View style={styles.nota}>
              <Icone nome="escudo" tamanho={20} cor={theme.colors.ok} />
              <Text style={styles.notaTexto}>
                Este registro com fotos e horários vale como comprovante de entrega.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  badge: { borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  badgeOk: { backgroundColor: theme.colors.okBg },
  badgeInfo: { backgroundColor: theme.colors.okBg },
  badgeTexto: { fontSize: 12.5, fontWeight: "600" },
  linhaTitulo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  transportadora: { fontSize: 21, fontWeight: "700", color: theme.colors.text },
  rastreio: {
    fontFamily: "monospace",
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    flexShrink: 1,
  },
  linhaFotos: { flexDirection: "row", gap: 12, marginTop: 14 },
  foto: { width: "100%", height: 120, borderRadius: 14 },
  fotoVazia: {
    backgroundColor: theme.colors.placeholder,
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  legendaFoto: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 6,
    textAlign: "center",
  },
  evento: { flexDirection: "row", gap: 14 },
  colunaDot: { alignItems: "center", width: 18 },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 3 },
  linhaVertical: { flex: 1, width: 2.5, backgroundColor: theme.colors.toggleOff, marginTop: 4 },
  eventoTitulo: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  eventoSub: { fontSize: 13.5, color: theme.colors.textSecondary, marginTop: 2 },
  nota: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.notaBg,
    borderRadius: theme.radius.card,
    padding: 14,
    marginTop: 14,
  },
  notaTexto: { flex: 1, fontSize: 13.5, color: theme.colors.textSecondary, fontWeight: "500" },
});
