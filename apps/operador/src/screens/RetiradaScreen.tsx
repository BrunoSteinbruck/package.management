import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../api/client";
import {
  diasAtras,
  rotuloUnidade,
  type Pacote,
  type Unidade,
} from "../api/types";
import { Botao, Chip } from "../components/ui";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation";

let cacheUnidades: Unidade[] | null = null;

type Props = NativeStackScreenProps<RootStackParamList, "Retirada">;

export function RetiradaScreen({ navigation, route }: Props) {
  const [unidades, setUnidades] = useState<Unidade[]>(cacheUnidades ?? []);
  const [busca, setBusca] = useState("");
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [pendentes, setPendentes] = useState<Pacote[] | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  useEffect(() => {
    const inicial = route.params?.unidadeInicial;
    if (inicial) abrirUnidade(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.unidadeInicial]);

  useEffect(() => {
    if (!cacheUnidades) {
      apiFetch<Unidade[]>("/cadastro/unidades")
        .then((lista) => {
          cacheUnidades = lista;
          setUnidades(lista);
        })
        .catch(() =>
          Alert.alert("Offline", "A retirada exige conexão para listar os pendentes."),
        );
    }
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    return unidades
      .filter((u) => `${u.bloco ?? ""} ${u.identificacao}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [busca, unidades]);

  async function abrirUnidade(u: Unidade) {
    setUnidade(u);
    setPendentes(null);
    setSelecionados(new Set());
    try {
      const lista = await apiFetch<Pacote[]>(`/portaria/unidades/${u.id}/pendentes`);
      setPendentes(lista);
      setSelecionados(new Set(lista.map((p) => p.id)));
    } catch (e) {
      Alert.alert("Não foi possível listar", String((e as Error).message));
      setUnidade(null);
    }
  }

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const restantes = (pendentes?.length ?? 0) - selecionados.size;

  return (
    <View style={styles.tela}>
      <View style={{ padding: theme.spacing.md, flex: 1 }}>
        {!unidade && (
          <>
            <TextInput
              style={styles.campo}
              placeholder="Digite a unidade (ex.: 302)"
              placeholderTextColor={theme.colors.textMuted}
              value={busca}
              onChangeText={setBusca}
              autoFocus
            />
            <View style={styles.linhaChips}>
              {filtradas.map((u) => (
                <Chip key={u.id} rotulo={rotuloUnidade(u)} onPress={() => abrirUnidade(u)} />
              ))}
            </View>
            <Botao
              titulo="Bipar QR do morador"
              variante="destaque"
              onPress={() => navigation.navigate("QrScan")}
              estilo={{ marginTop: theme.spacing.md }}
            />
          </>
        )}

        {unidade && (
          <>
            <View style={styles.cabecalhoUnidade}>
              <Text style={styles.tituloUnidade}>
                {rotuloUnidade(unidade)} — {pendentes ? `${pendentes.length} pendente(s)` : "..."}
              </Text>
              <Botao
                titulo="Trocar"
                variante="secundario"
                onPress={() => setUnidade(null)}
              />
            </View>
            <FlatList
              data={pendentes ?? []}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ gap: theme.spacing.sm }}
              ListEmptyComponent={
                pendentes ? (
                  <Text style={styles.vazio}>Nenhum pacote pendente nesta unidade.</Text>
                ) : null
              }
              renderItem={({ item }) => {
                const marcado = selecionados.has(item.id);
                return (
                  <Pressable
                    onPress={() => alternar(item.id)}
                    style={[
                      styles.itemPacote,
                      marcado && {
                        borderColor: theme.colors.accent,
                        backgroundColor: theme.colors.accentBg,
                      },
                    ]}
                  >
                    <Text style={styles.check}>{marcado ? "☑" : "☐"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitulo}>
                        {item.transportadora ?? "Sem transportadora"}
                        {item.localArmazenamento ? ` · ${item.localArmazenamento}` : ""}
                      </Text>
                      <Text style={styles.itemSub}>
                        chegou {diasAtras(item.recebidoEm)}
                        {item.codigoRastreio ? ` · ${item.codigoRastreio}` : ""}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          </>
        )}
      </View>

      {unidade && pendentes && pendentes.length > 0 && (
        <View style={styles.rodape}>
          {restantes > 0 && (
            <Text style={styles.avisoRestantes}>
              {restantes} pacote(s) permanecem na portaria — o morador será avisado.
            </Text>
          )}
          <Botao
            titulo={`Foto e entregar (${selecionados.size})`}
            desabilitado={selecionados.size === 0}
            onPress={() =>
              navigation.navigate("SaidaCamera", {
                pacoteIds: [...selecionados],
                unidadeLabel: rotuloUnidade(unidade),
              })
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
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
  linhaChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  cabecalhoUnidade: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  tituloUnidade: {
    flex: 1,
    fontSize: theme.font.lg,
    fontWeight: "600",
    color: theme.colors.text,
  },
  vazio: { color: theme.colors.textSecondary, fontSize: theme.font.md },
  itemPacote: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    minHeight: theme.touch.min + 12,
  },
  check: { fontSize: 22, color: theme.colors.accent },
  itemTitulo: { fontSize: theme.font.md, fontWeight: "600", color: theme.colors.text },
  itemSub: { fontSize: theme.font.sm, color: theme.colors.textSecondary },
  rodape: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  avisoRestantes: {
    fontSize: theme.font.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textAlign: "center",
  },
});
