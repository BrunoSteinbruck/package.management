import type { ModuloCondominio, Perfil } from "@pacotes/shared";
import type { NomeIcone } from "./components/icones";
import type {
  MoradorStackParamList,
  PortariaStackParamList,
  SindicoStackParamList,
} from "./navigation";

/**
 * Onde o módulo aparece na home.
 *
 * `primario` é a razão de existir da tela e tem layout próprio, escrito à mão
 * em cada home: o tile de 190px do porteiro não é o mesmo objeto visual que o
 * card do morador, e achatar os dois numa grade uniforme quebraria o "uma ação
 * principal por tela" do design brief. O manifesto não renderiza esse slot.
 *
 * `secundario` e `rodape` são as prateleiras onde funcionalidade nova entra.
 * São eles que o manifesto alimenta.
 */
export type Slot = "primario" | "secundario" | "rodape";

/**
 * O manifesto responde uma pergunta só: quais módulos existem, quem os vê e em
 * que prateleira eles aparecem. Ele não navega e não descreve conteúdo de tela.
 *
 * Navegar continua com a home, porque só ela conhece o dado carregado: a rota
 * `Reportar` exige a unidade do morador, e um manifesto estático não tem como
 * supri-la. Tentar resolver isso aqui viraria uma linguagem de configuração
 * mais difícil de mudar do que o código que ela substituiria.
 */
/**
 * Só rota sem parâmetro vira ponto de entrada.
 *
 * Não é limitação, é a regra que mantém o manifesto honesto: parâmetro vem de
 * dado carregado, e uma lista estática não tem como supri-lo. Quem precisa de
 * contexto carrega o seu, o que de quebra torna a tela reusável entre perfis.
 */
export type RotaDeEntrada<P> = {
  [K in keyof P]: P[K] extends undefined ? K : never;
}[keyof P];

export interface Modulo<Rota extends string> {
  /** Tipado contra o ParamList: rota inexistente ou com params não compila. */
  id: Rota;
  titulo: string;
  sub?: string;
  icone: NomeIcone;
  perfis: readonly Perfil[];
  slot: Slot;
  /**
   * Módulo opcional: só aparece se o condomínio tiver ligado. Ausente
   * significa base do produto, que todo condomínio tem.
   *
   * A rota continua existindo na pilha mesmo com a flag desligada. É de
   * propósito: o que a flag governa é a porta de entrada, e é isso que deixa
   * um binário já publicado nas lojas conviver com condomínios que
   * contrataram coisas diferentes.
   */
  flag?: ModuloCondominio;
}

export const MODULOS_PORTARIA: readonly Modulo<
  RotaDeEntrada<PortariaStackParamList>
>[] = [
  {
    id: "Avisar",
    titulo: "Avisar morador",
    icone: "sino",
    perfis: ["porteiro", "sindico"],
    slot: "secundario",
  },
  {
    id: "Leituras",
    titulo: "Leituras de água e gás",
    icone: "medidor",
    perfis: ["porteiro"],
    slot: "secundario",
  },
  {
    id: "VisitasHoje",
    titulo: "Visitas de hoje",
    icone: "pessoa",
    perfis: ["porteiro", "sindico"],
    slot: "secundario",
    flag: "visitantes",
  },
];

export const MODULOS_SINDICO: readonly Modulo<
  RotaDeEntrada<SindicoStackParamList>
>[] = [
  // O ícone acompanha o destino, não a ação: os stat cards da home levam a
  // estas mesmas telas e precisam falar a mesma língua.
  {
    id: "Aprovacoes",
    titulo: "Aprovar moradores",
    icone: "pessoa",
    perfis: ["sindico"],
    slot: "secundario",
  },
  {
    id: "Armazenados",
    titulo: "Encomendas na portaria",
    icone: "pacote",
    perfis: ["sindico"],
    slot: "secundario",
  },
  {
    id: "Avisar",
    titulo: "Avisar morador",
    icone: "sino",
    perfis: ["sindico"],
    slot: "secundario",
  },
  {
    id: "Consumos",
    titulo: "Consumos de água e gás",
    icone: "medidor",
    perfis: ["sindico"],
    slot: "secundario",
  },
  {
    id: "Comunicados",
    titulo: "Comunicados",
    icone: "sino",
    perfis: ["sindico"],
    slot: "secundario",
    flag: "comunicados",
  },
  {
    id: "Documentos",
    titulo: "Documentos",
    icone: "pacote",
    perfis: ["sindico"],
    slot: "secundario",
    flag: "documentos",
  },
  {
    id: "VisitasHoje",
    titulo: "Visitas de hoje",
    icone: "pessoa",
    perfis: ["sindico"],
    slot: "secundario",
    flag: "visitantes",
  },
];

export const MODULOS_MORADOR: readonly Modulo<
  RotaDeEntrada<MoradorStackParamList>
>[] = [
  {
    id: "Reportar",
    titulo: "Relatar desvio",
    icone: "camera",
    perfis: ["morador"],
    slot: "rodape",
  },
  {
    id: "Documentos",
    titulo: "Documentos",
    icone: "pacote",
    perfis: ["morador"],
    slot: "rodape",
    flag: "documentos",
  },
  {
    id: "Visitas",
    titulo: "Visitas",
    icone: "pessoa",
    perfis: ["morador"],
    slot: "rodape",
    flag: "visitantes",
  },
  {
    id: "Cobrancas",
    titulo: "Boletos",
    icone: "pacote",
    perfis: ["morador"],
    slot: "rodape",
    flag: "financeiro",
  },
];

export function modulosDe<Rota extends string>(
  modulos: readonly Modulo<Rota>[],
  perfil: Perfil,
  slot: Slot,
  ligados: readonly ModuloCondominio[] = [],
): readonly Modulo<Rota>[] {
  return modulos.filter(
    (m) =>
      m.perfis.includes(perfil) &&
      m.slot === slot &&
      (!m.flag || ligados.includes(m.flag)),
  );
}
