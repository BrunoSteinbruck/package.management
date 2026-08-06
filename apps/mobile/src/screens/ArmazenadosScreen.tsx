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
import { Chip, HeaderTela, ItemLista, Nota, Selo, Tela, Vazio } from "../components/ui";
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
  /**
   * Filtros de status e período, como no painel.
   *
   * Só o síndico recebe. A tela do porteiro é ferramenta de balcão, com uma
   * pergunta só ("o que está aqui agora?"): oferecer quatro filtros ali
   * atrapalharia justamente quem tem a mão ocupada com o pacote.
   */
  comFiltros?: boolean;
}

/** Os mesmos recortes do painel, na mesma ordem. */
const FILTROS = [
  { valor: "ARMAZENADO", rotulo: "Na portaria", contagem: "na portaria" },
  { valor: "", rotulo: "Todos", contagem: "no total" },
  { valor: "ENTREGUE", rotulo: "Entregues", contagem: "entregues" },
  { valor: "EXTRAVIADO", rotulo: "Extraviados", contagem: "extraviadas" },
] as const;

export function ArmazenadosScreen({
  navigation,
  aoTocarPacote,
  aoBiparQr,
  comFiltros,
}: Props) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<string>("ARMAZENADO");
  const [ultimos30, setUltimos30] = useState(false);
  const [itens, setItens] = useState<PacoteArmazenado[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const pagina = useRef(1);

  const carregar = useCallback(
    async (novaBusca: string, novaPagina: number) => {
      setCarregando(true);
      try {
        const params = new URLSearchParams({ pagina: String(novaPagina) });
        // Status vazio é "Todos": o parâmetro some da query em vez de ir
        // vazio, que o zod recusaria.
        if (status) params.set("status", status);
        if (ultimos30) params.set("dias", "30");
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
    [status, ultimos30],
  );

  // `carregar` muda quando o filtro muda, então trocar de chip já recarrega
  // da página 1 sem um efeito a mais.
  useEffect(() => {
    const timer = setTimeout(() => carregar(busca, 1), busca ? 300 : 0);
    return () => clearTimeout(timer);
  }, [busca, carregar]);

  // O rótulo acompanha o filtro: "38 na portaria" com o chip Entregues
  // marcado seria mentira.
  const rotuloContagem =
    FILTROS.find((f) => f.valor === status)?.contagem ?? "no total";

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

        {comFiltros && (
          <View style={styles.filtros}>
            {FILTROS.map((f) => (
              <Chip
                key={f.valor || "todos"}
                rotulo={f.rotulo}
                ativo={status === f.valor}
                onPress={() => setStatus(f.valor)}
              />
            ))}
            <Chip
              rotulo="Últimos 30 dias"
              ativo={ultimos30}
              onPress={() => setUltimos30((v) => !v)}
            />
          </View>
        )}

        {/* O total sai do título e vira bloco próprio: no título ele competia
            com o nome da tela e ficava pequeno demais para ser lido de longe,
            que é como o porteiro olha o balcão. */}
        <View style={styles.contagem}>
          <Text style={styles.contagemNumero}>{total}</Text>
          <Text style={styles.contagemRotulo}>{rotuloContagem}</Text>
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
                    : `Nenhuma encomenda ${rotuloContagem}.`
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
                // Filtrando por "Na portaria", só o atraso vira selo: com
                // "hoje" e "1 dia" marcados também, a coluna inteira ficava
                // colorida e o que precisa de ação sumia no meio. Nos outros
                // filtros o que importa é em que estado o pacote está.
                direita={
                  status !== "ARMAZENADO" ? (
                    <Selo
                      tom={item.status === "ARMAZENADO" ? "neutro" : "ok"}
                      texto={
                        item.status === "ARMAZENADO"
                          ? "na portaria"
                          : item.status === "ENTREGUE"
                            ? "entregue"
                            : "extraviado"
                      }
                    />
                  ) : dias >= 3 ? (
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
  filtros: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
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
