import React, { useCallback, useState } from "react";
import {
  Alert,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { VisitaMorador } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { iniciais } from "../api/types";
import { Botao, HeaderTela, ItemLista, Selo, Tela, Vazio } from "../components/ui";
import { theme } from "../theme";
import type { MoradorStackParamList } from "../navigation";

type Props = NativeStackScreenProps<MoradorStackParamList, "Visitas">;

const ROTULO_STATUS = {
  AUTORIZADA: { texto: "autorizada", tom: "neutro" },
  CHEGOU: { texto: "chegou", tom: "ok" },
  CANCELADA: { texto: "cancelada", tom: "alerta" },
} as const;

/** Data local em ISO, sem passar por UTC (que deslocaria o dia). */
function diaLocal(offsetDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** "2026-07-28" vira "hoje", "amanhã" ou "28/07". */
function quandoDia(iso: string): string {
  if (iso === diaLocal(0)) return "hoje";
  if (iso === diaLocal(1)) return "amanhã";
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function janela(v: VisitaMorador): string {
  const dia = quandoDia(v.dataPrevista);
  if (!v.janelaInicio) return dia;
  return v.janelaFim
    ? `${dia} · ${v.janelaInicio} às ${v.janelaFim}`
    : `${dia} · a partir de ${v.janelaInicio}`;
}

export function VisitasScreen({ navigation }: Props) {
  const [itens, setItens] = useState<VisitaMorador[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(await apiFetch<VisitaMorador[]>("/morador/visitas"));
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

  async function cancelar(v: VisitaMorador) {
    Alert.alert("Cancelar visita", `Cancelar a visita de ${v.nomeVisitante}?`, [
      { text: "Não", style: "cancel" },
      {
        text: "Cancelar visita",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/morador/visitas/${v.id}/cancelar`, {
              method: "POST",
            });
            await carregar();
          } catch (e) {
            Alert.alert("Não foi possível", String((e as Error).message));
          }
        },
      },
    ]);
  }

  // O que ainda vai acontecer separado do que já passou. Visita autorizada
  // para ontem que ninguém deu baixa também é passado: deixá-la no topo dava
  // a impressão de que a portaria ainda espera alguém.
  const hoje = diaLocal(0);
  const proxima = (v: VisitaMorador) =>
    v.status === "AUTORIZADA" && v.dataPrevista >= hoje;
  const secoes = [
    { titulo: "Autorizadas", dados: itens.filter(proxima) },
    { titulo: "Anteriores", dados: itens.filter((v) => !proxima(v)) },
  ].filter((s) => s.dados.length > 0);

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Minhas visitas" aoVoltar={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: 12 }}>
        <Botao
          titulo="Autorizar visita"
          icone="pessoa"
          onPress={() => navigation.navigate("NovaVisita")}
        />
      </View>
      <SectionList
        sections={secoes.map((s) => ({ title: s.titulo, data: s.dados }))}
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
              icone="pessoa"
              titulo="Nenhuma visita"
              texto="Avise a portaria antes de alguém chegar e a entrada fica mais rápida."
            />
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.secao}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const status = ROTULO_STATUS[item.status];
          return (
            <>
              <ItemLista
                titulo={item.nomeVisitante}
                sub={janela(item)}
                // O código é o que o morador manda para quem vem. Em
                // monoespaçada como o rastreio: é para ser lido em voz alta.
                detalhe={item.codigo ?? undefined}
                media={{ iniciais: iniciais(item.nomeVisitante) }}
                direita={<Selo texto={status.texto} tom={status.tom} />}
              />
              {item.status === "AUTORIZADA" && (
                <Botao
                  titulo="Cancelar"
                  variante="outline"
                  onPress={() => cancelar(item)}
                />
              )}
            </>
          );
        }}
      />
    </Tela>
  );
}

const styles = StyleSheet.create({
  secao: {
    fontSize: 16.5,
    fontWeight: "700",
    color: theme.colors.text,
    backgroundColor: theme.colors.bg,
    paddingTop: 8,
    paddingBottom: 2,
  },
});
