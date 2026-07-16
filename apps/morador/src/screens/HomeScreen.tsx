import React, { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { JwtPayload } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { limparSessao } from "../api/session";
import { registrarPush } from "../api/push";
import {
  dataCurta,
  diasNaPortaria,
  rotuloUnidade,
  type MinhaUnidade,
} from "../api/types";
import { Botao, Card } from "../components/ui";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Home"> & {
  perfil: JwtPayload;
  aoSair: () => void;
};

export function HomeScreen({ navigation, perfil, aoSair }: Props) {
  const [unidades, setUnidades] = useState<MinhaUnidade[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setUnidades(await apiFetch<MinhaUnidade[]>("/morador/pacotes"));
      setErro(null);
    } catch (e) {
      setErro(String((e as Error).message));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
      registrarPush();
    }, [carregar]),
  );

  return (
    <ScrollView
      style={styles.tela}
      contentContainerStyle={{ padding: theme.spacing.md }}
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={async () => {
            setAtualizando(true);
            await carregar();
            setAtualizando(false);
          }}
        />
      }
    >
      <Text style={styles.ola}>Olá, {perfil.nome.split(" ")[0]}</Text>

      {erro && (
        <Card estilo={{ backgroundColor: theme.colors.dangerBg, borderColor: theme.colors.dangerBg }}>
          <Text style={{ color: theme.colors.danger }}>{erro}</Text>
        </Card>
      )}

      {unidades?.length === 0 && (
        <Card>
          <Text style={styles.vazioTitulo}>Nenhuma unidade vinculada</Text>
          <Text style={styles.vazioTexto}>
            Peça um convite ao seu condomínio ou aguarde a aprovação do síndico.
          </Text>
        </Card>
      )}

      {unidades?.map((minha) => (
        <View key={minha.unidade.id} style={{ marginBottom: theme.spacing.lg }}>
          <Text style={styles.unidadeTitulo}>
            {rotuloUnidade(minha.unidade)}
          </Text>
          <Text style={styles.unidadeSub}>{minha.unidade.condominio}</Text>

          {minha.pendentes.length === 0 ? (
            <Card estilo={{ marginTop: theme.spacing.sm }}>
              <Text style={styles.vazioTexto}>
                Nenhuma encomenda na portaria agora.
              </Text>
            </Card>
          ) : (
            <>
              {minha.pendentes.map((p) => {
                const dias = diasNaPortaria(p.recebidoEm);
                return (
                  <Card key={p.id} estilo={styles.pacote}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pacoteTitulo}>
                        {p.transportadora ?? "Encomenda"}
                      </Text>
                      <Text style={styles.pacoteSub}>
                        chegou {dataCurta(p.recebidoEm)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.selo,
                        {
                          backgroundColor:
                            dias >= 3 ? theme.colors.warningBg : theme.colors.accentBg,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: theme.font.sm,
                          color: dias >= 3 ? theme.colors.warning : theme.colors.accent,
                        }}
                      >
                        {dias === 0 ? "hoje" : `${dias} dia${dias > 1 ? "s" : ""}`}
                      </Text>
                    </View>
                  </Card>
                );
              })}
              <Botao
                titulo={`Retirar na portaria (${minha.pendentes.length})`}
                onPress={() =>
                  navigation.navigate("Qr", {
                    unidadeId: minha.unidade.id,
                    rotulo: rotuloUnidade(minha.unidade),
                    pendentes: minha.pendentes.length,
                  })
                }
                estilo={{ marginTop: theme.spacing.sm }}
              />
            </>
          )}

          {minha.historico.length > 0 && (
            <View style={{ marginTop: theme.spacing.md }}>
              <Text style={styles.historicoTitulo}>Entregues</Text>
              {minha.historico.slice(0, 5).map((p) => (
                <View key={p.id} style={styles.historicoItem}>
                  <Text style={styles.historicoTexto}>
                    {p.transportadora ?? "Encomenda"}
                  </Text>
                  <Text style={styles.historicoData}>
                    {p.retirada ? dataCurta(p.retirada.retiradoEm) : "—"}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}

      <Botao
        titulo="Sair"
        variante="secundario"
        onPress={async () => {
          await limparSessao();
          aoSair();
        }}
        estilo={{ marginTop: theme.spacing.md }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  ola: {
    fontSize: theme.font.xl,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  unidadeTitulo: { fontSize: theme.font.lg, fontWeight: "600", color: theme.colors.text },
  unidadeSub: { fontSize: theme.font.sm, color: theme.colors.textSecondary },
  pacote: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  pacoteTitulo: { fontSize: theme.font.md, fontWeight: "600", color: theme.colors.text },
  pacoteSub: { fontSize: theme.font.sm, color: theme.colors.textSecondary },
  selo: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  vazioTitulo: { fontSize: theme.font.md, fontWeight: "600", color: theme.colors.text },
  vazioTexto: { fontSize: theme.font.sm, color: theme.colors.textSecondary },
  historicoTitulo: {
    fontSize: theme.font.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  historicoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.xs,
  },
  historicoTexto: { fontSize: theme.font.sm, color: theme.colors.textSecondary },
  historicoData: { fontSize: theme.font.sm, color: theme.colors.textMuted },
});
