import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
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
import {
  dataCurta,
  diasNaPortaria,
  rotuloUnidade,
  type MinhaUnidade,
} from "../api/types";
import { BotaoCta, BotaoModulo, Card } from "../components/ui";
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
  const [historicoAberto, setHistoricoAberto] = useState(false);

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

  const historico = useMemo(
    () =>
      (unidades ?? [])
        .flatMap((u) =>
          u.historico.map((p) => ({ ...p, unidadeRotulo: rotuloUnidade(u.unidade) })),
        )
        .sort(
          (a, b) =>
            new Date(b.retirada?.retiradoEm ?? b.recebidoEm).getTime() -
            new Date(a.retirada?.retiradoEm ?? a.recebidoEm).getTime(),
        ),
    [unidades],
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
                {primeira.unidade.condominio} ·{" "}
                {primeira.unidade.bloco
                  ? `${primeira.unidade.bloco} ${primeira.unidade.identificacao}`
                  : primeira.unidade.identificacao}
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

        {unidades && unidades.length > 0 && totalPendentes === 0 && (
          <View style={styles.heroVazio}>
            <View style={styles.heroCirculo}>
              <Icone nome="check" tamanho={38} cor={theme.colors.ok} traco={2.4} />
            </View>
            <Text style={styles.heroTitulo}>Nada na portaria</Text>
            <Text style={styles.heroTexto}>
              Avisaremos assim que uma encomenda chegar.
            </Text>
          </View>
        )}

        {unidades?.map(
          (minha) =>
            minha.pendentes.length > 0 && (
              <View key={minha.unidade.id} style={{ marginBottom: 22 }}>
                {unidades.length > 1 && (
                  <Text style={styles.tituloUnidadeMulti}>
                    {rotuloUnidade(minha.unidade)}
                  </Text>
                )}
                <View style={styles.linhaSecao}>
                  <Text style={styles.tituloSecao}>Na portaria</Text>
                  <View style={styles.badgeContador}>
                    <Text style={styles.badgeContadorTexto}>
                      {minha.pendentes.length}
                    </Text>
                  </View>
                </View>

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
                          <Text style={[styles.pacoteSub, styles.pacoteSubAtraso]}>
                            Há {dias} dias
                          </Text>
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
                {/* O QR é conferência opcional do condomínio. Desligado, o
                    morador simplesmente vai à portaria e diz a unidade, que
                    é o que ele já fazia: sem o botão, a tela não promete um
                    ritual que a portaria não vai pedir. */}
                {ligados.includes("qr_retirada") && (
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
                )}
              </View>
            ),
        )}

        {/* Prateleira dos módulos do condomínio, no corpo e não no rodapé:
            o rodapé é uma linha só de pílulas, desenhada para uma ou duas
            ações rápidas, e com quatro o texto quebrava dentro da pílula. */}
        {modulosDe(MODULOS_MORADOR, "morador", "secundario", ligados).map((m) => (
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
            {historico.length > 0 && (
              <BotaoModulo
                variante="pill"
                titulo="Histórico"
                icone="lista"
                contagem={historico.length}
                onPress={() => setHistoricoAberto(true)}
              />
            )}
          </View>
        </View>
      )}

      <Modal
        visible={historicoAberto}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoricoAberto(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setHistoricoAberto(false)}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.alca} />
          <Text style={styles.sheetTitulo}>Histórico</Text>
          <FlatList
            data={historico}
            keyExtractor={(p) => p.id}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 8, paddingTop: 8 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setHistoricoAberto(false);
                  navigation.navigate("Detalhe", { pacoteId: item.id });
                }}
                style={({ pressed }) => [
                  styles.itemHistorico,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View style={styles.checkCirculo}>
                  <Icone nome="check" tamanho={15} cor={theme.colors.ok} traco={2.6} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historicoTitulo}>
                    {item.transportadora ?? "Encomenda"}
                  </Text>
                  <Text style={styles.historicoSub}>
                    Entregue{item.retirada ? ` · ${dataCurta(item.retirada.retiradoEm)}` : ""}
                  </Text>
                </View>
                <Icone nome="chevron" tamanho={20} cor={theme.colors.textFaint} />
              </Pressable>
            )}
          />
        </View>
      </Modal>
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
  heroVazio: { alignItems: "center", paddingVertical: 56, gap: 8 },
  heroCirculo: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: theme.colors.okBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  heroTitulo: { fontSize: 21, fontWeight: "700", color: theme.colors.text },
  heroTexto: { fontSize: 14.5, color: theme.colors.textSecondary, fontWeight: "500" },
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
  // A partir de 3 dias a própria data fica âmbar. Sem selo e sem texto de
  // cobrança: a cor já sinaliza, sem soar agressiva.
  pacoteSubAtraso: { color: theme.colors.alerta, fontWeight: "600" },
  vazioTitulo: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  vazioTexto: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 2 },
  rodape: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    backgroundColor: theme.colors.bg,
  },
  linhaRodape: { flexDirection: "row", gap: 10 },
  botaoRodape: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 54,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.chipBorder,
    backgroundColor: theme.colors.surface,
  },
  botaoHistoricoTexto: { fontSize: 16, fontWeight: "600", color: theme.colors.text },
  botaoHistoricoContagem: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.ok,
    backgroundColor: theme.colors.okBg,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 2,
    overflow: "hidden",
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    maxHeight: "70%",
  },
  alca: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.toggleOff,
    marginBottom: 12,
  },
  sheetTitulo: { fontSize: 19, fontWeight: "700", color: theme.colors.text },
  itemHistorico: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    paddingHorizontal: 12,
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
