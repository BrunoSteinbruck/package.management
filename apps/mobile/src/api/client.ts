import { mensagemDeErro, type Capacidades, type JwtPayload } from "@pacotes/shared";
import { carregarSessao, salvarModulos, salvarSessao } from "./session";

// Em dispositivo físico, defina EXPO_PUBLIC_API_URL no .env com o IP da sua
// máquina na rede local (ex.: http://192.168.0.10:3001/v1).
// Emulador Android: http://10.0.2.2:3001/v1
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Erro de rede (sem resposta do servidor): candidato à fila offline. */
export class NetworkError extends Error {}

/**
 * Quem quer saber que a sessão caiu no meio do uso.
 *
 * A validade era conferida SÓ na abertura do app. Na portaria, onde o
 * aparelho fica ligado o turno inteiro sem nunca ser fechado, o token vencia
 * com o app aberto e a partir dali toda tela respondia "Token inválido ou
 * expirado" sem oferecer nada: nem o login, nem uma explicação. Agora o
 * primeiro 401 de uma requisição autenticada devolve a tela de entrada.
 */
const ouvintesDeSessao = new Set<() => void>();

export function assinarSessaoExpirada(fn: () => void): () => void {
  ouvintesDeSessao.add(fn);
  return () => ouvintesDeSessao.delete(fn);
}

export async function apiFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    /**
     * Marca as chamadas em que 401 é resposta esperada, e não fim de sessão:
     * o login manda um código que pode estar errado, e a renovação testa
     * justamente se o token ainda vale. Derrubar a sessão nesses casos
     * jogaria fora um login em andamento.
     */
    ignorar401?: boolean;
  } = {},
): Promise<T> {
  const token = options.token ?? (await carregarSessao())?.token;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new NetworkError("Sem conexão com o servidor");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && !options.ignorar401) {
      for (const fn of ouvintesDeSessao) fn();
    }
    const msg = mensagemDeErro(data, res.status);
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

/**
 * Renova a sessão silenciosamente (token novo com validade cheia).
 * Chamado ao abrir o app.
 *
 * Retorna `false` quando o servidor recusa a sessão (conta excluída em outro
 * aparelho, ou membro de equipe desativado pelo síndico): aí o app volta
 * para o login em vez de ficar preso numa sessão fantasma. Falha de REDE não
 * desloga ninguém: o token atual segue valendo offline.
 */
export async function renovarSessao(): Promise<boolean> {
  try {
    const res = await apiFetch<{ token: string; perfil: JwtPayload }>(
      "/auth/refresh",
      // Um 401 aqui é a própria resposta que a função procura, e quem chama
      // já cuida de derrubar a sessão: avisar os ouvintes seria em dobro.
      { method: "POST", ignorar401: true },
    );
    await salvarSessao(res);
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return false;
    return true;
  }
}

/**
 * Atualiza o cache de módulos ligados no condomínio. Chamado ao abrir o app,
 * junto da renovação de sessão.
 *
 * Falha em silêncio de propósito: sem rede, a home segue com o último valor
 * conhecido em vez de perder pontos de entrada que o condomínio tem.
 */
export async function sincronizarModulos(): Promise<void> {
  try {
    const { modulos } = await apiFetch<Capacidades>("/conta/capacidades");
    await salvarModulos(modulos);
  } catch {
    // mantém o cache anterior
  }
}

/**
 * URL de exibição de foto usando o FOTO-TOKEN dedicado emitido pela API
 * (curto e preso à key). O JWT de sessão nunca vai em URL.
 */
export function urlFoto(foto: { key: string; token: string }): string {
  return `${API_URL}/uploads/${foto.key}?t=${encodeURIComponent(foto.token)}`;
}

/** Sobe uma foto (multipart) e retorna a key de armazenamento. */
export async function uploadFoto(uri: string): Promise<string> {
  const token = (await carregarSessao())?.token;
  const form = new FormData();
  form.append("file", {
    uri,
    name: "foto.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/uploads`, {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  } catch {
    throw new NetworkError("Sem conexão com o servidor");
  }
  if (!res.ok) throw new ApiError(res.status, "Falha ao enviar a foto");
  const data = (await res.json()) as { key: string };
  return data.key;
}

/** Envia a foto da etiqueta para análise (OCR + sugestão de unidade). */
export async function analisarEtiqueta<T>(uri: string): Promise<T> {
  const token = (await carregarSessao())?.token;
  const form = new FormData();
  form.append("file", {
    uri,
    name: "etiqueta.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/portaria/ocr`, {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  } catch {
    throw new NetworkError("Sem conexão com o servidor");
  }
  if (!res.ok) throw new ApiError(res.status, "Falha na análise da etiqueta");
  return (await res.json()) as T;
}
