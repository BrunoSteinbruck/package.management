import { mensagemDeErro, type JwtPayload } from "@pacotes/shared";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

const TOKEN_KEY = "painel/token";
const PERFIL_KEY = "painel/perfil";

export function salvarSessao(token: string, perfil: JwtPayload) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil));
}

export function carregarPerfil(): JwtPayload | null {
  try {
    const raw = localStorage.getItem(PERFIL_KEY);
    return raw ? (JSON.parse(raw) as JwtPayload) : null;
  } catch {
    return null;
  }
}

export function limparSessao() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PERFIL_KEY);
}

/**
 * Quem quer saber que a sessão caiu.
 *
 * Sem isto o painel virava um beco: com o token expirado, cada visão pintava
 * "Token inválido ou expirado" e ficava ali. O síndico clicava em Pacotes,
 * Relatórios, Ocorrências, e as três diziam a mesma coisa sem oferecer saída;
 * a única forma de voltar era adivinhar que "Sair" resolvia. Agora o primeiro
 * 401 derruba a sessão e devolve a tela de login.
 */
const ouvintesDeSessao = new Set<() => void>();

export function assinarSessaoExpirada(fn: () => void): () => void {
  ouvintesDeSessao.add(fn);
  return () => ouvintesDeSessao.delete(fn);
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  // `token` explícito serve a fluxos que NÃO são a sessão do painel: hoje a
  // página pública de exclusão de conta, que não pode gravar (nem derrubar) a
  // sessão do síndico no localStorage.
  const token = options.token ?? localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Só a sessão do painel: um 401 do fluxo público de exclusão de conta não
    // pode derrubar a sessão de quem está com o painel aberto ao lado.
    if (res.status === 401 && !options.token) {
      limparSessao();
      for (const fn of ouvintesDeSessao) fn();
    }
    const msg = mensagemDeErro(data, res.status);
    throw new Error(msg);
  }
  return data as T;
}
