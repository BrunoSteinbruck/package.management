import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiFetch } from "../api/client";
import {
  diasNaPortaria,
  rotuloUnidade,
  type ListaPacotes,
  type PacoteArmazenado,
  type Unidade,
} from "../api/types";
import { HeaderTela, ItemLista, Selo, Tela, Vazio } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";

/**
 * A tela recebe as ações em vez de navegar sozinha, então não precisa saber
 * em que pilha está nem o que é um perfil. Sem `aoTocarPacote` e `aoBiparQr`
 * ela vira somente leitura, que é como o síndico a usa: ele acompanha o que
 * está na portaria, mas não movimenta encomenda.
 */
interface Props {
  navigation: { goBack: () => void };
  aoTocarPacote?: (unidade: Unidade) => void;
  aoBiparQr?: () => void;
}

export function ArmazenadosScreen({
  navigation,
  aoTocarPacote,
  aoBiparQr,
}: Props) {
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<PacoteArmazenado[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const pagina = useRef(1);

  const carregar = useCallback(
    async (novaBusca: string, novaPagina: number) => {
      setCarregando(true);
      try {
        const params = new URLSearchParams({
          status: "ARMAZENADO",
          pagina: String(novaPagina),
        });
        if (novaBusca.trim()) params.set("busca", novaBusca.trim());
        const lista = await apiFetch<ListaPacotes>(`/portaria/pacotes?${params}`);
        pagina.current = novaPagina;
        setTotal(lista.total);
        setItens((atual) =>
          novaPagina === 1 ? lista.itens : [...atual, ...lista.itens],
        );
      } catch {
        // offline: mantém o que está na tela
      } finally {
        setCarregando(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => carregar(busca, 1), busca ? 300 : 0);
    return () => clearTimeout(timer);
  }, [busca, carregar]);

  return (
    <Tela comInsetTop>
      <HeaderTela
        titulo={`Na portaria (${total})`}
        aoVoltar={() => navigation.goBack()}
      />
      <View style={{ paddingHorizontal: theme.spacing.lg, flex: 1 }}>
        <View style={styles.linhaBusca}>
          <View style={styles.campoBusca}>
            <Icone nome="busca" tamanho={20} cor={theme.colors.textMuted} />
            <TextInput
              style={styles.inputBusca}
              placeholder="Unidade, transportadora…"
              maxLength={60}
              placeholderTextColor={theme.colors.textFaint}
              value={busca}
              onChangeText={setBusca}
            />
          </View>
          {aoBiparQr && (
            <Pressable style={styles.botaoQr} onPress={aoBiparQr}>
              <Icone nome="qr" tamanho={20} traco={2} />
              <Text style={styles.botaoQrTexto}>Bipar QR</Text>
            </Pressable>
          )}
        </View>

        <FlatList
          data={itens}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ gap: 10, paddingVertical: 14 }}
          refreshControl={
            <RefreshControl
              refreshing={carregando && pagina.current === 1}
              onRefresh={() => carregar(busca, 1)}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!carregando && itens.length < total) {
              carregar(busca, pagina.current + 1);
            }
          }}
          ListEmptyComponent={
            !carregando ? (
              <Vazio
                titulo={
                  busca
                    ? "Nada encontrado com essa busca."
                    : "Nenhuma encomenda na portaria."
                }
              />
            ) : null
          }
          renderItem={({ item }) => {
            const dias = diasNaPortaria(item.recebidoEm);
            return (
              <ItemLista
                titulo={rotuloUnidade(item.unidade)}
                sub={`${item.transportadora ?? "Sem transportadora"}${
                  item.localArmazenamento
                    ? ` · Prateleira ${item.localArmazenamento}`
                    : ""
                }`}
                detalhe={item.codigoRastreio ?? undefined}
                direita={
                  <Selo
                    tom={dias >= 3 ? "alerta" : "ok"}
                    texto={dias === 0 ? "hoje" : `${dias} dia${dias > 1 ? "s" : ""}`}
                  />
                }
                chevron={!!aoTocarPacote}
                onPress={
                  aoTocarPacote ? () => aoTocarPacote(item.unidade) : undefined
                }
              />
            );
          }}
        />
      </View>
    </Tela>
  );
}

const styles = StyleSheet.create({
  linhaBusca: { flexDirection: "row", gap: 10 },
  campoBusca: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    minHeight: 50,
  },
  botaoQr: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: theme.colors.marca,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    minHeight: 50,
  },
  botaoQrTexto: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  inputBusca: { flex: 1, fontSize: 16, color: theme.colors.text },
});
