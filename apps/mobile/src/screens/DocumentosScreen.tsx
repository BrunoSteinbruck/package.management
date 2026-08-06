import React, { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  CATEGORIAS_DOCUMENTO,
  type CategoriaDocumento,
  type DocumentoLinha,
} from "@pacotes/shared";
import { apiFetch, urlFoto } from "../api/client";
import { dataCurta } from "../api/types";
import { Botao, Chip, HeaderTela, ItemLista, Nota, Tela, Vazio } from "../components/ui";
import { theme } from "../theme";

const ROTULO_CATEGORIA: Record<CategoriaDocumento, string> = {
  ATA: "Ata",
  REGIMENTO: "Regimento interno",
  CONVENCAO: "Convenção",
  OUTRO: "Documento",
};

/** Plural na prateleira, singular na linha: "Atas" filtra, "Ata" é. */
const ROTULO_FILTRO: Record<CategoriaDocumento, string> = {
  ATA: "Atas",
  REGIMENTO: "Regimento",
  CONVENCAO: "Convenção",
  OUTRO: "Outros",
};

function tamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }
  // Abaixo de 1 KB mostra os bytes: arredondar daria "0 KB", que lê como
  // arquivo vazio quando na verdade é só um PDF pequeno.
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

type Filtro = CategoriaDocumento | "TODOS";

/**
 * Documentos do condomínio.
 *
 * Uma tela para morador e síndico, como `ArmazenadosScreen`: os dois leem a
 * mesma lista pelo endpoint do seu perfil. Subir arquivo fica só no painel,
 * onde quem tem o PDF já está sentado.
 */
export function DocumentosScreen({
  navigation,
  gestor,
}: {
  navigation: { goBack: () => void };
  gestor?: boolean;
}) {
  const [itens, setItens] = useState<DocumentoLinha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("TODOS");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(
        await apiFetch<DocumentoLinha[]>(
          gestor ? "/cadastro/documentos" : "/morador/documentos",
        ),
      );
    } catch {
      // offline: mantém o que está na tela
    } finally {
      setCarregando(false);
    }
  }, [gestor]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  // As prateleiras vazias não aparecem: um condomínio que só publicou atas não
  // ganha três chips que devolvem lista vazia.
  const prateleiras = useMemo(() => {
    const presentes = new Set(itens.map((d) => d.categoria));
    return CATEGORIAS_DOCUMENTO.filter((c) => presentes.has(c));
  }, [itens]);

  const visiveis =
    filtro === "TODOS" ? itens : itens.filter((d) => d.categoria === filtro);

  /**
   * Remover tira o documento do app de todos os moradores. Confirmação
   * nominal, e não "tem certeza?": o síndico precisa ler QUAL arquivo some.
   */
  function remover(doc: DocumentoLinha) {
    Alert.alert(
      "Remover documento",
      `Tirar "${doc.titulo}" do app dos moradores?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/cadastro/documentos/${doc.id}`, {
                method: "DELETE",
              });
              await carregar();
            } catch (e) {
              Alert.alert(
                "Não foi possível remover",
                String((e as Error).message),
              );
            }
          },
        },
      ],
    );
  }

  async function abrir(doc: DocumentoLinha) {
    try {
      // `Linking` e não um navegador embutido: é o que o app já usa para o
      // export de consumos e para os links legais, e evita dependência nativa
      // nova (que custaria um build) para abrir um PDF. O link vai assinado e
      // vale 1h; a API serve o PDF com Content-Disposition inline, então o
      // visualizador do sistema abre em vez de baixar.
      await Linking.openURL(urlFoto(doc.arquivo));
    } catch (e) {
      Alert.alert("Não foi possível abrir", String((e as Error).message));
    }
  }

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Documentos" aoVoltar={() => navigation.goBack()} />
      {prateleiras.length > 1 && (
        <View style={styles.filtros}>
          <Chip
            rotulo="Todos"
            ativo={filtro === "TODOS"}
            onPress={() => setFiltro("TODOS")}
          />
          {prateleiras.map((c) => (
            <Chip
              key={c}
              rotulo={ROTULO_FILTRO[c]}
              ativo={filtro === c}
              onPress={() => setFiltro(c)}
            />
          ))}
        </View>
      )}
      <FlatList
        data={visiveis}
        keyExtractor={(d) => d.id}
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
              icone="lista"
              titulo="Nenhum documento"
              texto="Atas, regimento e convenção publicados pela administração aparecem aqui."
            />
          ) : null
        }
        ListFooterComponent={
          gestor && itens.length > 0 ? (
            <Nota
              texto="Enviar documento é feito pelo painel, no computador, onde o PDF já está."
              estilo={{ marginTop: 14 }}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View>
            <ItemLista
              titulo={item.titulo}
              sub={`${ROTULO_CATEGORIA[item.categoria]} · ${dataCurta(item.criadoEm)} · PDF, ${tamanho(item.tamanhoBytes)}`}
              media={{
                // "lista" e não "pacote": a caixa é o ícone da encomenda, e
                // repetido aqui as duas linhas do menu viravam o mesmo desenho.
                icone: "lista",
                corFundo: theme.colors.okBg,
                corIcone: theme.colors.marca,
              }}
              chevron
              onPress={() => abrir(item)}
            />
            {gestor && (
              <Botao
                titulo="Remover"
                variante="outline"
                onPress={() => remover(item)}
                estilo={{
                  alignSelf: "flex-end",
                  marginTop: 6,
                  minHeight: 38,
                  paddingHorizontal: 16,
                }}
                corTexto={theme.colors.notif}
              />
            )}
          </View>
        )}
      />
    </Tela>
  );
}

const styles = StyleSheet.create({
  filtros: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 12,
  },
});
