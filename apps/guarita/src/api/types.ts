// O contrato com a API mora em @pacotes/shared, junto com o painel e a própria
// API. Aqui ficam só os nomes que as telas usam e os formatadores de
// apresentação, que são decisão de UI e não de contrato.

export type {
  AlvoIdentificado,
  AvisoMorador,
  DetalhePacote,
  FotoRef,
  ListaPacotes,
  MinhaUnidade,
  OcorrenciaMorador,
  Pacote,
  PacoteMorador,
  Pendencia,
  RespostaOcr,
  ResultadoRetirada,
  Unidade,
  UnidadeRotulo,
  Veiculo,
  Vinculado,
} from "@pacotes/shared";

export { CATEGORIAS_OCORRENCIA, MOTIVOS_AVISO } from "@pacotes/shared";

import type { PacoteLinha, StatusAviso, UnidadeRotulo } from "@pacotes/shared";

/** Como a portaria chama a linha de `/portaria/pacotes`. */
export type PacoteArmazenado = PacoteLinha;

// ----- Apresentação -----

export function rotuloUnidade(u: UnidadeRotulo | undefined): string {
  if (!u) return "-";
  return u.bloco ? `${u.identificacao} · Bloco ${u.bloco}` : u.identificacao;
}

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
