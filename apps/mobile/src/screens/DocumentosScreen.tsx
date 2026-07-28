import React, { useCallback, useState } from "react";
import { Alert, FlatList, Linking, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { CategoriaDocumento, DocumentoLinha } from "@pacotes/shared";
import { apiFetch, urlFoto } from "../api/client";
import { dataCurta } from "../api/types";
import { HeaderTela, ItemLista, Tela, Vazio } from "../components/ui";
import { theme } from "../theme";

const ROTULO_CATEGORIA: Record<CategoriaDocumento, string> = {
  ATA: "Ata",
  REGIMENTO: "Regimento interno",
  CONVENCAO: "Convenção",
  OUTRO: "Documento",
};

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
      <FlatList
        data={itens}
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
              icone="pacote"
              titulo="Nenhum documento"
              texto="Atas, regimento e convenção publicados pela administração aparecem aqui."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ItemLista
            titulo={item.titulo}
            sub={`${ROTULO_CATEGORIA[item.categoria]} · ${dataCurta(item.criadoEm)}`}
            media={{
              icone: "pacote",
              corFundo: theme.colors.okBg,
              corIcone: theme.colors.marca,
            }}
            chevron
            onPress={() => abrir(item)}
          />
        )}
      />
    </Tela>
  );
}
