import React, { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { rotuloUnidade, type VisitaPortaria } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { diaPorExtenso, iniciais } from "../api/types";
import { HeaderTela, ItemLista, Selo, Tela, Vazio } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "Visitantes">;

const STATUS = {
  AUTORIZADA: { texto: "autorizada", tom: "neutro" },
  CHEGOU: { texto: "chegou", tom: "ok" },
  CANCELADA: { texto: "cancelada", tom: "alerta" },
} as const;

/** "2026-07-28" vira "28/07/26" sem passar por Date (que deslocaria o dia). */
function diaCurto(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

function hora(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Quem entrou no prédio, na tela do síndico.
 *
 * Espelha a visão do painel: as esperadas de hoje em cima, o histórico
 * inteiro embaixo com busca. Sem dar baixa na chegada, que é da portaria e
 * nem existe nesta pilha.
 */
export function VisitantesScreen({ navigation }: Props) {
  const [hoje, setHoje] = useState<VisitaPortaria[]>([]);
  const [historico, setHistorico] = useState<VisitaPortaria[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [h, todas] = await Promise.allSettled([
        apiFetch<VisitaPortaria[]>("/portaria/visitas-hoje"),
        apiFetch<VisitaPortaria[]>("/cadastro/visitas"),
      ]);
      if (h.status === "fulfilled") setHoje(h.value);
      if (todas.status === "fulfilled") setHistorico(todas.value);
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
   * Busca em memória, como no painel: o endpoint devolve no máximo 200 e
   * filtrar no servidor exigiria um parâmetro que ninguém mais usa.
   *
   * Sem busca, o histórico tira as de hoje: `/cadastro/visitas` devolve tudo,
   * e a mesma pessoa aparecendo nas duas seções da mesma rolagem lê como
   * duplicata. Buscando, o filtro vale sobre TUDO, que é o ponto da busca.
   */
  const filtrado = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) {
      const idsDeHoje = new Set(hoje.map((v) => v.id));
      return historico.filter((v) => !idsDeHoje.has(v.id));
    }
    return historico.filter(
      (v) =>
        v.nomeVisitante.toLowerCase().includes(termo) ||
        rotuloUnidade(v.unidade).toLowerCase().includes(termo) ||
        v.autorizadoPor.toLowerCase().includes(termo),
    );
  }, [busca, historico, hoje]);

  const buscando = busca.trim().length > 0;
  const secoes = [
    {
      title: `Esperadas hoje · ${diaPorExtenso()}`,
      data: buscando ? [] : hoje,
    },
    {
      title: buscando
        ? `Resultados (${filtrado.length})`
        : `Anteriores (${filtrado.length})`,
      data: filtrado,
    },
  ].filter((s) => s.data.length > 0);

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Visitantes" aoVoltar={() => navigation.goBack()} />
      <View style={styles.linhaBusca}>
        <View style={styles.campoBusca}>
          <Icone nome="busca" tamanho={20} cor={theme.colors.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="Visitante, unidade ou quem autorizou"
            maxLength={60}
            placeholderTextColor={theme.colors.textFaint}
            value={busca}
            onChangeText={setBusca}
          />
        </View>
      </View>
      <SectionList
        sections={secoes}
        keyExtractor={(v, i) => `${v.id}-${i}`}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 24,
          gap: 10,
        }}
        refreshControl={
          <RefreshControl refreshing={carregando} onRefresh={carregar} />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.secao}>{section.title}</Text>
        )}
        ListEmptyComponent={
          !carregando ? (
            <Vazio
              variante="hero"
              icone="pessoa"
              titulo="Nenhuma visita"
              texto="Quando um morador autorizar alguém pelo app, a visita aparece aqui."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ItemLista
            titulo={item.nomeVisitante}
            sub={`${rotuloUnidade(item.unidade)} · ${diaCurto(item.dataPrevista)}${
              item.chegadaEm ? ` · entrou ${hora(item.chegadaEm)}` : ""
            }`}
            detalhe={
              [item.codigo, `autorizou: ${item.autorizadoPor}`]
                .filter(Boolean)
                .join(" · ")
            }
            media={{ iniciais: iniciais(item.nomeVisitante) }}
            direita={
              <Selo
                texto={STATUS[item.status].texto}
                tom={STATUS[item.status].tom}
              />
            }
          />
        )}
      />
    </Tela>
  );
}

const styles = StyleSheet.create({
  linhaBusca: { paddingHorizontal: theme.spacing.lg, paddingBottom: 12 },
  campoBusca: {
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
  input: { flex: 1, fontSize: 16, color: theme.colors.text },
  secao: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
    backgroundColor: theme.colors.bg,
    paddingTop: 8,
    paddingBottom: 2,
  },
});
