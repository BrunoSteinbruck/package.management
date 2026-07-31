import { mensagemDeErro, type JwtPayload } from "@pacotes/shared";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

// O ".v2" invalida as sessões de 30 dias emitidas antes da senha existir.
// Sem o bump, um síndico que estivesse logado continuaria com um token longo
// e nunca passaria pela cerimônia nova. Custa um relogin, uma vez.
const TOKEN_KEY = "painel/token.v2";
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

/**
 * Renovação silenciosa da sessão do painel, chamada ao abrir.
 *
 * A sessão do painel dura 24 horas, e sem isto quem trabalha nele o dia
 * inteiro seria derrubado no meio do expediente do dia seguinte. Com a
 * renovação, quem entra todo dia nunca vê a tela de login, e quem some por
 * mais de um dia entra de novo com a senha, que é digitar e não esperar SMS.
 *
 * Falha em silêncio de propósito: sem rede, o painel abre com o token que já
 * tem. Se o token estiver morto, o primeiro 401 de qualquer tela derruba a
 * sessão pela via de `assinarSessaoExpirada`.
 */
export async function renovarSessao(): Promise<void> {
  try {
    const r = await apiFetch<{ token: string; perfil: JwtPayload }>(
      "/auth/refresh",
      { method: "POST" },
    );
    salvarSessao(r.token, r.perfil);
  } catch {
    // Silêncio proposital: ver acima.
  }
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
