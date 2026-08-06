import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { linkWhatsApp, type UnidadePanorama } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { carregarAppDownloadUrl } from "../api/session";
import { formatarTelefone, rotuloUnidade } from "../api/types";
import { Botao, HeaderTela, ItemLista, Nota, Selo, Tela, Vazio } from "../components/ui";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "Unidades"> & {
  condominio: string;
};

/**
 * O texto que o síndico manda ao titular. Voz da administração, não pessoal:
 * quem recebe precisa entender em uma linha que é o prédio falando, senão a
 * mensagem de número desconhecido vira spam.
 *
 * Acento pode: a restrição de GSM-7 é do SMS, não do WhatsApp.
 */
function convite(
  nome: string,
  condominio: string,
  unidade: string,
  downloadUrl: string | null,
): string {
  const primeiro = nome.trim().split(/\s+/)[0];
  const link = downloadUrl ? ` Baixe aqui: ${downloadUrl}` : "";
  return (
    `Olá, ${primeiro}! Aqui é da administração do ${condominio}. ` +
    `Agora avisamos as encomendas da portaria pelo aplicativo Convivar. ` +
    `Baixe o app e entre com este número de celular: a unidade ${unidade} ` +
    `já está cadastrada no seu nome.${link}`
  );
}

/**
 * As unidades do condomínio e quem está em cada uma.
 *
 * Espelha a tabela do painel e responde o que o percentual de adoção não
 * responde: em QUAIS apartamentos ninguém baixou o app. Por isso o convite
 * por WhatsApp mora aqui, na linha da unidade que falta.
 */
export function UnidadesScreen({ navigation, condominio }: Props) {
  const [itens, setItens] = useState<UnidadePanorama[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(
        await apiFetch<UnidadePanorama[]>("/cadastro/unidades/panorama"),
      );
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

  useEffect(() => {
    carregarAppDownloadUrl().then(setDownloadUrl);
  }, []);

  async function convidar(u: UnidadePanorama) {
    if (!u.titular) return;
    const texto = convite(
      u.titular.nome,
      condominio,
      rotuloUnidade(u),
      downloadUrl,
    );
    try {
      await Linking.openURL(linkWhatsApp(u.titular.telefone, texto));
    } catch {
      // Sem WhatsApp instalado (o simulador é o caso comum), o sistema
      // recusa o esquema. Dizer isso é melhor que o toque não fazer nada.
      Alert.alert(
        "WhatsApp não disponível",
        "Não foi possível abrir o WhatsApp neste aparelho.",
      );
    }
  }

  const comApp = itens.filter((u) => u.temApp).length;
  const pct = itens.length > 0 ? Math.round((comApp / itens.length) * 100) : 0;

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Unidades e moradores" aoVoltar={() => navigation.goBack()} />
      {itens.length > 0 && (
        <View style={styles.legenda}>
          <Text style={styles.legendaTexto}>
            {comApp} de {itens.length} unidades com app · {pct}%
          </Text>
        </View>
      )}
      <FlatList
        data={itens}
        keyExtractor={(u) => u.unidadeId}
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
              titulo="Nenhuma unidade"
              texto="Cadastre as unidades pelo painel para elas aparecerem aqui."
            />
          ) : null
        }
        ListFooterComponent={
          itens.length > 0 ? (
            <Nota
              texto="Convites por SMS contam como adoção quando aceitos. A importação do cadastro é feita pelo painel, no computador."
              estilo={{ marginTop: 14 }}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View>
            <ItemLista
              titulo={rotuloUnidade(item)}
              sub={
                item.titular
                  ? `${item.titular.nome} · ${formatarTelefone(item.titular.telefone)}`
                  : "sem titular cadastrado"
              }
              detalhe={
                item.vinculados > 0
                  ? `${item.vinculados} pessoa${item.vinculados === 1 ? "" : "s"}`
                  : undefined
              }
              media={{
                icone: "casa",
                corFundo: item.temApp ? theme.colors.okBg : theme.colors.divisor,
                corIcone: item.temApp
                  ? theme.colors.marca
                  : theme.colors.textSecondary,
              }}
              direita={
                <Selo
                  texto={item.temApp ? "no app" : "sem app"}
                  tom={item.temApp ? "ok" : "neutro"}
                />
              }
            />
            {/* Só onde há alguém para convidar: unidade sem titular não tem
                número, e quem já está no app não precisa de convite. */}
            {/* Ancorado à direita e colado no card: em largura inteira,
                com o gap da lista quase igual à margem, ele ficava boiando
                entre duas unidades e não dava para saber qual convidava. */}
            {!item.temApp && item.titular && (
              <Botao
                titulo="Convidar por WhatsApp"
                variante="outline"
                onPress={() => convidar(item)}
                estilo={{
                  alignSelf: "flex-end",
                  marginTop: 6,
                  minHeight: 40,
                  paddingHorizontal: 16,
                }}
              />
            )}
          </View>
        )}
      />
    </Tela>
  );
}

const styles = StyleSheet.create({
  legenda: { paddingHorizontal: theme.spacing.lg, paddingBottom: 12 },
  legendaTexto: {
    fontSize: 13.5,
    fontWeight: "500",
    color: theme.colors.textSecondary,
  },
});
