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
import { registrarPush } from "../api/push";
import { rotuloUnidade, type MinhaUnidade } from "../api/types";
import { BotaoModulo, Card } from "../components/ui";
import { Icone } from "../components/icones";
import { MODULOS_MORADOR, modulosDe } from "../modulos";
import { useModulos } from "../useModulos";
import { theme } from "../theme";
import type { MoradorStackParamList } from "../navigation";

type Props = NativeStackScreenProps<MoradorStackParamList, "Home"> & {
  perfil: JwtPayload;
};

export function MoradorHomeScreen({ navigation, perfil }: Props) {
  const insets = useSafeAreaInsets();
  const ligados = useModulos();
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
  const totalPendentes = (unidades ?? []).reduce(
    (soma, u) => soma + u.pendentes.length,
    0,
  );

  const totalHistorico = (unidades ?? []).reduce(
    (soma, u) => soma + u.historico.length,
    0,
  );

  return (
    <View style={styles.tela}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          padding: theme.spacing.lg,
          paddingBottom: 24,
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
          <View style={{ flex: 1 }}>
            <Text style={styles.ola}>Oi, {perfil.nome.split(" ")[0]}</Text>
            {primeira && (
              <Text style={styles.subCabecalho} numberOfLines={1}>
                {primeira.unidade.condominio} · {rotuloUnidade(primeira.unidade)}
              </Text>
            )}
          </View>
          {primeira && (
            <Pressable
              onPress={() =>
                navigation.navigate("MinhaUnidade", {
                  unidadeId: primeira.unidade.id,
                  rotulo: rotuloUnidade(primeira.unidade),
                  condominio: primeira.unidade.condominio,
                })
              }
              style={({ pressed }) => [
                styles.botaoCasa,
                { transform: [{ scale: pressed ? 0.92 : 1 }] },
              ]}
            >
              <Icone nome="casa" tamanho={22} cor={theme.colors.marca} />
            </Pressable>
          )}
          <Pressable
            onPress={() => navigation.navigate("Avisos")}
            style={({ pressed }) => [
              styles.sino,
              { transform: [{ scale: pressed ? 0.92 : 1 }] },
            ]}
          >
            <Icone nome="sino" tamanho={22} cor={theme.colors.text} />
            {totalPendentes > 0 && <View style={styles.sinoDot} />}
          </Pressable>
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

        {/* A home é lançador, não lista. Antes ela abria com as encomendas
            inline e o resto do app ficava abaixo delas: quem tinha seis
            pacotes rolava a tela inteira para achar Boletos. As encomendas
            agora têm tela própria e aqui fica só a porta, com a contagem. */}
        {unidades && unidades.length > 0 && (
          <BotaoModulo
            titulo="Encomendas"
            icone="pacote"
            onPress={() => navigation.navigate("Encomendas")}
            badge={
              totalPendentes > 0
                ? { texto: `${totalPendentes} na portaria`, destaque: true }
                : undefined
            }
            estilo={{ marginTop: 2 }}
          />
        )}

        {unidades &&
          unidades.length > 0 &&
          modulosDe(MODULOS_MORADOR, "morador", "secundario", ligados).map((m) => (
            <BotaoModulo
              key={m.id}
              titulo={m.titulo}
              icone={m.icone}
              onPress={() => navigation.navigate(m.id)}
              estilo={{ marginTop: 12 }}
            />
          ))}
      </ScrollView>

      {primeira && (
        <View style={[styles.rodape, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.linhaRodape}>
            {/* Os módulos do rodapé vêm do manifesto; navegar fica aqui porque
                só a home conhece a unidade carregada. */}
            {modulosDe(MODULOS_MORADOR, "morador", "rodape", ligados).map((m) => (
              <BotaoModulo
                key={m.id}
                variante="pill"
                titulo={m.titulo}
                icone={m.icone}
                onPress={() => navigation.navigate(m.id)}
              />
            ))}
            {totalHistorico > 0 && (
              // Leva para a mesma tela de Encomendas, onde o histórico é a
              // segunda seção. Era um bottom-sheet com a lista duplicada.
              <BotaoModulo
                variante="pill"
                titulo="Histórico"
                icone="lista"
                badge={{ texto: String(totalHistorico) }}
                onPress={() => navigation.navigate("Encomendas")}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  cabecalho: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  ola: { fontSize: 24, fontWeight: "700", color: theme.colors.text },
  subCabecalho: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: "500", marginTop: 2 },
  botaoCasa: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.okBg,
    borderWidth: 1.5,
    borderColor: theme.colors.acao,
    alignItems: "center",
    justifyContent: "center",
  },
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
  vazioTitulo: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  vazioTexto: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 2 },
  rodape: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    backgroundColor: theme.colors.bg,
  },
  linhaRodape: { flexDirection: "row", gap: 10 },
});
