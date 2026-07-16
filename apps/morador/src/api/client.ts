import type { JwtPayload } from "@pacotes/shared";
import { carregarSessao, salvarSessao } from "./session";

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

/** Erro de rede (sem resposta do servidor) — candidato à fila offline. */
export class NetworkError extends Error {}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
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
    const msg =
      typeof data?.message === "string"
        ? data.message
        : Array.isArray(data?.message)
          ? data.message.join(", ")
          : `Erro ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

/**
 * Renova a sessão silenciosamente (token novo com validade cheia).
 * Chamado ao abrir o app; falha é ignorada — o token atual segue valendo.
 */
export async function renovarSessao(): Promise<void> {
  try {
    const res = await apiFetch<{ token: string; perfil: JwtPayload }>(
      "/auth/refresh",
      { method: "POST" },
    );
    await salvarSessao(res);
  } catch {
    // offline ou token expirado — o fluxo normal de login cuida disso
  }
}

/** URL de exibição de foto (token vai por query — <Image> não envia headers). */
export async function urlFoto(key: string): Promise<string | null> {
  const token = (await carregarSessao())?.token;
  if (!token) return null;
  return `${API_URL}/uploads/${key}?t=${encodeURIComponent(token)}`;
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
