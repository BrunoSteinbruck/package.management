import type { EstadoLeituras, TipoMedidor } from "@pacotes/shared";
import { apiFetch } from "./client";

/**
 * Estado do mês (progresso + leitura anterior por unidade) com cache de
 * módulo, no padrão do `cacheUnidades`: carregado na tela de leituras, a
 * confirmação consulta o "anterior" mesmo offline no subsolo.
 */
export const cacheEstado: Partial<Record<TipoMedidor, EstadoLeituras>> = {};

/** Competência corrente NO FUSO DO APARELHO (nunca UTC: viraria o mês errado à noite). */
export function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function carregarEstado(tipo: TipoMedidor): Promise<EstadoLeituras> {
  const estado = await apiFetch<EstadoLeituras>(
    `/leituras/estado?tipo=${tipo}&competencia=${competenciaAtual()}`,
  );
  cacheEstado[tipo] = estado;
  return estado;
}

/** Descarta o progresso guardado: chamado ao sair da sessão. */
export function limparEstado(): void {
  for (const k of Object.keys(cacheEstado)) delete cacheEstado[k as TipoMedidor];
}

/** Marca a unidade como lida no cache local: o progresso anda mesmo offline. */
export function registrarNoCache(
  tipo: TipoMedidor,
  unidadeId: string,
  valor: number,
): void {
  const estado = cacheEstado[tipo];
  if (!estado) return;
  const unidade = estado.unidades.find((u) => u.unidadeId === unidadeId);
  if (!unidade) return;
  if (unidade.atual === null) estado.lidas += 1;
  unidade.atual = valor;
}
