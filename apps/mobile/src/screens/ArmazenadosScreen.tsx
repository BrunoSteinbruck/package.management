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
import { HeaderTela, ItemLista, Nota, Selo, Tela, Vazio } from "../components/ui";
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
        titulo="Encomendas na portaria"
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

        {/* O total sai do título e vira bloco próprio: no título ele competia
            com o nome da tela e ficava pequeno demais para ser lido de longe,
            que é como o porteiro olha o balcão. */}
        <View style={styles.contagem}>
          <Text style={styles.contagemNumero}>{total}</Text>
          <Text style={styles.contagemRotulo}>na portaria</Text>
        </View>

        <FlatList
          data={itens}
          keyExtractor={(p) => p.id}
          // `flex: 1` explícito: com a Nota como irmã embaixo, sem isto a
          // lista cresceria com o conteúdo e empurraria a dica para fora.
          style={{ flex: 1 }}
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
                media={{
                  icone: "pacote",
                  corFundo: theme.colors.placeholder,
                  corIcone: theme.colors.textMuted,
                }}
                titulo={item.transportadora ?? "Sem transportadora"}
                sub={`${rotuloUnidade(item.unidade)}${
                  item.localArmazenamento
                    ? ` · prateleira ${item.localArmazenamento}`
                    : ""
                }`}
                detalhe={item.codigoRastreio ?? undefined}
                // Só o atraso vira selo. Com "hoje" e "1 dia" marcados também,
                // a coluna inteira ficava colorida e o que precisa de ação se
                // perdia no meio do que está normal.
                direita={
                  dias >= 3 ? (
                    <Selo tom="alerta" texto={`${dias} dias`} />
                  ) : undefined
                }
                chevron={!!aoTocarPacote}
                onPress={
                  aoTocarPacote ? () => aoTocarPacote(item.unidade) : undefined
                }
              />
            );
          }}
        />

        {/* Fora da FlatList: a dica precisa estar visível já na primeira tela,
            e como rodapé da lista só apareceria depois de rolar as 38. */}
        {aoTocarPacote && (
          <Nota
            icone="alerta"
            texto="Toque em uma encomenda para abrir a retirada da unidade"
            estilo={{ marginBottom: 14 }}
          />
        )}
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
  contagem: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginTop: 12,
  },
  contagemNumero: { fontSize: 28, fontWeight: "700", color: theme.colors.text },
  contagemRotulo: {
    fontSize: 14.5,
    fontWeight: "500",
    color: theme.colors.textSecondary,
  },
});
