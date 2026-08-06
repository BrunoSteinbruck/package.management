import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { VinculoPendente } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { formatarTelefone, iniciais, rotuloUnidade } from "../api/types";
import { Botao, HeaderTela, ItemLista, Tela, Vazio } from "../components/ui";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "Aprovacoes">;

export function AprovacoesScreen({ navigation }: Props) {
  const [itens, setItens] = useState<VinculoPendente[]>([]);
  const [carregando, setCarregando] = useState(false);
  // Trava as DUAS ações: sem isso, dois toques rápidos mandavam dois POST e
  // o segundo voltava recusado ("já tratado"), pintando erro para uma
  // aprovação que na verdade deu certo.
  const [emVoo, setEmVoo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(await apiFetch<VinculoPendente[]>("/cadastro/vinculos/pendentes"));
    } catch {
      // offline: mantém o que está na tela
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  /**
   * Aprovar dá a uma pessoa acesso aos dados da unidade: encomendas,
   * cobranças, documentos. Não há como revogar depois pelo app, então a
   * confirmação NOMEIA quem e qual unidade, em vez de perguntar "tem
   * certeza?". Mesmo texto do painel.
   */
  function aprovar(v: VinculoPendente) {
    if (emVoo) return;
    Alert.alert(
      "Aprovar morador",
      `Dar a ${v.morador.nome} (${formatarTelefone(v.morador.telefone)}) acesso à unidade ${rotuloUnidade(v.unidade)}?\n\n` +
        "A pessoa passa a ver encomendas, cobranças e documentos desta unidade.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Aprovar", onPress: () => enviar(v, "aprovar") },
      ],
    );
  }

  /** Recusar não é banir: a pessoa pode pedir de novo, e o vínculo fica
   *  como REMOVIDO em vez de sumir do banco. */
  function recusar(v: VinculoPendente) {
    if (emVoo) return;
    Alert.alert(
      "Recusar pedido",
      `Recusar o pedido de ${v.morador.nome} (${formatarTelefone(v.morador.telefone)}) para a unidade ${rotuloUnidade(v.unidade)}?\n\n` +
        "A pessoa não passa a ver os dados da unidade. Ela pode pedir de novo depois.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Recusar",
          style: "destructive",
          onPress: () => enviar(v, "recusar"),
        },
      ],
    );
  }

  async function enviar(v: VinculoPendente, acao: "aprovar" | "recusar") {
    setEmVoo(v.id);
    try {
      await apiFetch(`/cadastro/vinculos/${v.id}/${acao}`, { method: "POST" });
      await carregar();
    } catch (e) {
      Alert.alert(
        acao === "aprovar" ? "Não foi possível aprovar" : "Não foi possível recusar",
        String((e as Error).message),
      );
    } finally {
      setEmVoo(null);
    }
  }

  return (
    <Tela comInsetTop>
      <HeaderTela
        titulo="Aprovar moradores"
        aoVoltar={() => navigation.goBack()}
      />
      {itens.length > 0 && (
        <View style={styles.legenda}>
          <Text style={styles.legendaTexto}>
            {itens.length} pedido{itens.length === 1 ? "" : "s"} aguardando ·
            confirme com a unidade antes de aprovar
          </Text>
        </View>
      )}
      <FlatList
        data={itens}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 24,
          gap: 10,
        }}
        refreshControl={
          <RefreshControl refreshing={carregando} onRefresh={carregar} />
        }
        ListEmptyComponent={
          !carregando ? (
            <Vazio
              variante="hero"
              icone="casa"
              titulo="Nada para aprovar"
              texto="Quando um morador pedir vínculo com uma unidade, o pedido aparece aqui."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View>
            <ItemLista
              titulo={item.morador.nome}
              sub={`${formatarTelefone(item.morador.telefone)} · pediu vínculo a ${rotuloUnidade(item.unidade)}`}
              media={{ iniciais: iniciais(item.morador.nome) }}
            />
            {/* Fora do `direita` do ItemLista: dois botões lado a lado ali
                espremiam o nome da pessoa, que é o que se lê para decidir. */}
            <View style={styles.acoes}>
              <Botao
                titulo="Aprovar"
                carregando={emVoo === item.id}
                desabilitado={emVoo !== null}
                onPress={() => aprovar(item)}
                estilo={{ flex: 1, minHeight: 44 }}
              />
              <Botao
                titulo="Recusar"
                variante="outline"
                desabilitado={emVoo !== null}
                onPress={() => recusar(item)}
                estilo={{ flex: 1, minHeight: 44 }}
              />
            </View>
          </View>
        )}
      />
    </Tela>
  );
}

const styles = StyleSheet.create({
  acoes: { flexDirection: "row", gap: 10, marginTop: 8 },
  legenda: { paddingHorizontal: theme.spacing.lg, paddingBottom: 12 },
  legendaTexto: {
    fontSize: 13.5,
    fontWeight: "500",
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },
});
