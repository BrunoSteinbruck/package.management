/**
 * Sentry: precisa ser importado ANTES de qualquer outro módulo (é o que
 * permite instrumentar as bibliotecas na carga). Ver o import no topo do
 * main.ts.
 *
 * Sem SENTRY_DSN nada é inicializado: em dev e em qualquer deploy sem a
 * variável, o arquivo é inerte. Não confiamos no "init sem dsn é no-op"
 * porque isso não está documentado: melhor não chamar.
 */
import * as Sentry from "@sentry/nestjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    // Amostragem baixa por padrão: o plano free do Sentry queima rápido com
    // tracing em 100%, e o que interessa aqui é ERRO, não performance.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.05),
    // Não mandar corpo de request nem headers: por aqui trafegam telefone,
    // código OTP e token de sessão.
    sendDefaultPii: false,
    // Lambdas: o 2º parâmetro do callback do Sentry é o `hint`, não a
    // profundidade da varredura.
    beforeSend: (evento) => limparDadosSensiveis(evento),
    // Breadcrumb de HTTP guarda URL: passa pelo mesmo filtro.
    beforeBreadcrumb: (breadcrumb) => limparDadosSensiveis(breadcrumb),
  });
}

/**
 * A URL de foto carrega o foto-token na query (`/uploads/<key>?t=<jwt>`).
 * Ele é curto e preso à key, mas ainda é credencial: não pode ficar
 * registrado num painel de erros.
 *
 * A varredura é recursiva de propósito: a mesma URL aparece em `request.url`,
 * em `contexts.request`, nos breadcrumbs de HTTP e em mensagens de erro.
 * Filtrar só o campo "oficial" deixa passar os outros: foi o que um teste
 * contra um ingest falso mostrou: `request` saía limpo e `contexts.request`
 * ia com o token inteiro.
 */
// O `^` importa: o campo `query_string` do Sentry vem sem o "?" na frente,
// então o token pode ser o primeiro parâmetro da string.
const TOKEN_NA_QUERY = /(^|[?&])(t=)[^&"\s]+/g;
const PROFUNDIDADE_MAX = 8;

function limparDadosSensiveis<T>(valor: T, profundidade = 0): T {
  if (typeof valor === "string") {
    return valor.replace(TOKEN_NA_QUERY, "$1$2[removido]") as T;
  }
  // Guarda contra evento com ciclo ou aninhamento absurdo.
  if (!valor || typeof valor !== "object" || profundidade >= PROFUNDIDADE_MAX) {
    return valor;
  }
  if (Array.isArray(valor)) {
    return valor.map((item) => limparDadosSensiveis(item, profundidade + 1)) as T;
  }
  for (const [chave, item] of Object.entries(valor)) {
    (valor as Record<string, unknown>)[chave] = limparDadosSensiveis(
      item,
      profundidade + 1,
    );
  }
  return valor;
}
