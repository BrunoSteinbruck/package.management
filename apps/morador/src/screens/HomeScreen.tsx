import React, { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { Botao, BotaoCta, Card } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Home"> & {
  perfil: JwtPayload;
  aoSair: () => void;
};

export function HomeScreen({ navigation, perfil, aoSair }: Props) {
  const insets = useSafeAreaInsets();
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

  const primeira = unidades?.[0];
  const temPendentes = (unidades ?? []).some((u) => u.pendentes.length > 0);

  return (
    <ScrollView
      style={styles.tela}
      contentContainerStyle={{
        paddingTop: insets.top + 18,
        padding: theme.spacing.lg,
        paddingBottom: 48,
      }}
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
      <View style={styles.cabecalho}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() =>
            primeira &&
            navigation.navigate("MinhaUnidade", {
              unidadeId: primeira.unidade.id,
              rotulo: rotuloUnidade(primeira.unidade),
              condominio: primeira.unidade.condominio,
            })
          }
        >
          <Text style={styles.ola}>Oi, {perfil.nome.split(" ")[0]}</Text>
          {primeira && (
            <Text style={styles.subCabecalho} numberOfLines={1}>
              {primeira.unidade.condominio} ·{" "}
              {primeira.unidade.bloco
                ? `${primeira.unidade.bloco} ${primeira.unidade.identificacao}`
                : primeira.unidade.identificacao}{" "}
              ›
            </Text>
          )}
        </Pressable>
        <View style={styles.sino}>
          <Icone nome="sino" tamanho={22} cor={theme.colors.text} />
          {temPendentes && <View style={styles.sinoDot} />}
        </View>
      </View>

      {erro && (
        <Card estilo={{ backgroundColor: theme.colors.alertaBg, borderColor: theme.colors.alertaBg }}>
          <Text style={{ color: theme.colors.alerta, fontWeight: "600" }}>{erro}</Text>
        </Card>
      )}

      {unidades?.length === 0 && (
        <Card>
          <Text style={styles.vazioTitulo}>Nenhuma unidade vinculada</Text>
          <Text style={styles.vazioTexto}>
            Peça um convite ao seu condomínio ou aguarde a aprovação da administração.
          </Text>
        </Card>
      )}

      {unidades?.map((minha) => (
        <View key={minha.unidade.id} style={{ marginBottom: 26 }}>
          {unidades.length > 1 && (
            <Text style={styles.tituloUnidadeMulti}>{rotuloUnidade(minha.unidade)}</Text>
          )}

          <View style={styles.linhaSecao}>
            <Text style={styles.tituloSecao}>Na portaria</Text>
            {minha.pendentes.length > 0 && (
              <View style={styles.badgeContador}>
                <Text style={styles.badgeContadorTexto}>{minha.pendentes.length}</Text>
              </View>
            )}
          </View>

          {minha.pendentes.length === 0 ? (
            <Card estilo={{ marginTop: 10 }}>
              <Text style={styles.vazioTexto}>Nenhuma encomenda na portaria.</Text>
            </Card>
          ) : (
            <>
              {minha.pendentes.map((p) => {
                const dias = diasNaPortaria(p.recebidoEm);
                const atrasada = dias >= 3;
                return (
                  <Pressable
                    key={p.id}
                    style={({ pressed }) => [
                      styles.cardPacote,
                      { transform: [{ scale: pressed ? 0.98 : 1 }] },
                    ]}
                    onPress={() => navigation.navigate("Detalhe", { pacoteId: p.id })}
                  >
                    <View style={styles.thumb} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pacoteTitulo}>
                        {p.transportadora ?? "Encomenda"}
                      </Text>
                      {atrasada ? (
                        <View style={styles.linhaAtraso}>
                          <Text style={styles.pacoteSub}>Há {dias} dias</Text>
                          <View style={styles.badgeAtraso}>
                            <Text style={styles.badgeAtrasoTexto}>retire logo</Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.pacoteSub}>
                          Chegou {dataCurta(p.recebidoEm)}
                        </Text>
                      )}
                    </View>
                    <Icone nome="chevron" tamanho={22} cor={theme.colors.textFaint} />
                  </Pressable>
                );
              })}
              <BotaoCta
                titulo="Retirar na portaria"
                icone="qr"
                altura={66}
                onPress={() =>
                  navigation.navigate("Qr", {
                    unidadeId: minha.unidade.id,
                    rotulo: rotuloUnidade(minha.unidade),
                    pendentes: minha.pendentes.length,
                  })
                }
                estilo={{ marginTop: 12 }}
              />
            </>
          )}

          {minha.historico.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <Text style={styles.tituloSecao}>Histórico</Text>
              <Card estilo={{ marginTop: 10, padding: 6 }}>
                {minha.historico.slice(0, 5).map((p, i) => (
                  <Pressable
                    key={p.id}
                    style={[
                      styles.itemHistorico,
                      i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.divisor },
                    ]}
                    onPress={() => navigation.navigate("Detalhe", { pacoteId: p.id })}
                  >
                    <View style={styles.checkCirculo}>
                      <Icone nome="check" tamanho={15} cor={theme.colors.ok} traco={2.6} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historicoTitulo}>
                        {p.transportadora ?? "Encomenda"}
                      </Text>
                      <Text style={styles.historicoSub}>
                        Entregue{p.retirada ? ` · ${dataCurta(p.retirada.retiradoEm)}` : ""}
                      </Text>
                    </View>
                    <Icone nome="chevron" tamanho={20} cor={theme.colors.textFaint} />
                  </Pressable>
                ))}
              </Card>
            </View>
          )}
        </View>
      ))}

      <Botao
        titulo="Sair"
        variante="outline"
        onPress={async () => {
          await limparSessao();
          aoSair();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  cabecalho: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  ola: { fontSize: 24, fontWeight: "700", color: theme.colors.text },
  subCabecalho: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: "500", marginTop: 2 },
  sino: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sinoDot: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.notif,
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
  },
  tituloUnidadeMulti: { fontSize: 15, fontWeight: "700", color: theme.colors.textSecondary, marginBottom: 8 },
  linhaSecao: { flexDirection: "row", alignItems: "center", gap: 8 },
  tituloSecao: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
  badgeContador: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.acao,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  badgeContadorTexto: { color: "#FFF", fontSize: 13.5, fontWeight: "700" },
  cardPacote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginTop: 10,
  },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: theme.colors.placeholder,
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
    borderStyle: "dashed",
  },
  pacoteTitulo: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
  pacoteSub: { fontSize: 13.5, color: theme.colors.textSecondary, fontWeight: "500", marginTop: 2 },
  linhaAtraso: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  badgeAtraso: {
    backgroundColor: theme.colors.alertaBg,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  badgeAtrasoTexto: { fontSize: 12, fontWeight: "600", color: theme.colors.alerta },
  vazioTitulo: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  vazioTexto: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 2 },
  itemHistorico: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  checkCirculo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.okBg,
    alignItems: "center",
    justifyContent: "center",
  },
  historicoTitulo: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
  historicoSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 1 },
});
