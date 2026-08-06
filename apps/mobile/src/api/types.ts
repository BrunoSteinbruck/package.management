// O contrato com a API mora em @pacotes/shared, junto com o painel e a própria
// API. Aqui ficam só os nomes que as telas usam e os formatadores de
// apresentação, que são decisão de UI e não de contrato.

// Só o que alguma tela realmente importa daqui. Tipo que nenhuma tela usa
// sai da lista, e não do shared: quem consome o contrato inteiro é a API e o
// painel, e re-exportar o que ninguém pede só faz parecer que há mais
// superfície do que existe.
export type {
  AlvoIdentificado,
  DetalhePacote,
  ListaPacotes,
  MinhaUnidade,
  Pacote,
  RespostaOcr,
  ResultadoRetirada,
  Unidade,
  Veiculo,
  Vinculado,
} from "@pacotes/shared";

export {
  CATEGORIAS_OCORRENCIA,
  MOTIVOS_AVISO,
  // O rótulo da unidade é contrato de leitura, não decisão de UI do app: a
  // mesma unidade aparece no painel, no CSV e na conciliação bancária.
  rotuloUnidade,
  // Idem o mês de referência: o mesmo julho é escrito no app, no painel e na
  // conciliação, e o formato mora em competencia.ts.
  mesPorExtenso,
  // Telefone é gravado só com dígitos; quem lê na tela precisa dos
  // parênteses e do traço, no app e no painel igual.
  formatarTelefone,
} from "@pacotes/shared";

import type { PacoteLinha, StatusAviso } from "@pacotes/shared";

/** Como a portaria chama a linha de `/portaria/pacotes`. */
export type PacoteArmazenado = PacoteLinha;

// ----- Apresentação -----

export function diasAtras(iso: string | null): string {
  if (!iso) return "";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

export function diasNaPortaria(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/** "14h32", ou "14h" na hora cheia. Como se fala, não como o relógio escreve. */
export function horaCurta(iso: string): string {
  const d = new Date(iso);
  const min = d.getMinutes();
  return `${d.getHours()}h${min === 0 ? "" : String(min).padStart(2, "0")}`;
}

/**
 * Quando a encomenda saiu, na régua de quem lembra do fato: "sábado, 14h" na
 * semana corrente, "08 jul, 19h" antes disso. Data cheia só o detalhe mostra.
 */
export function quandoCurto(iso: string): string {
  const d = new Date(iso);
  const dias = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const quando =
    dias < 7
      ? d.toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "")
      : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  return `${quando}, ${horaCurta(iso)}`;
}

export function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function rotuloStatusAviso(s: StatusAviso | string): string {
  return s === "ABERTO" ? "Aberto" : "Resolvido";
}

/** "Marina Souza" vira "MS". Uma letra quando o nome é só um. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

/**
 * "terça, 30 de julho". O "-feira" sai porque ninguém fala assim, e porque
 * "terça-feira, 30 de julho · 112 entregas" não cabe na linha do celular.
 */
export function diaPorExtenso(d: Date = new Date()): string {
  return d
    .toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .replace("-feira", "");
}

