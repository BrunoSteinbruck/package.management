import type { PapelUsuario } from "./enums";

export interface JwtPayload {
  sub: string;
  tipo: "usuario" | "morador";
  nome: string;
  condominioId?: string;
  condominioNome?: string;
  papel?: PapelUsuario;
  /**
   * Por qual porta a sessão entrou, e não em qual cliente ela está sendo
   * usada. Existe para o refresh saber a INTENÇÃO original: olhar só o `exp`
   * seria ambíguo, porque um token de app perto do vencimento pareceria um
   * token de painel. Opcional para o app antigo, que ignora campos extras,
   * continuar valendo.
   */
  sessao?: "painel";
}

/**
 * O perfil que decide qual experiência o cliente monta. Não confundir com
 * `tipo` (em qual tabela a identidade vive) nem com `papel` (o enum do banco):
 * é a projeção dos dois no vocabulário do produto. APOIO não se distingue de
 * PORTEIRO em lugar nenhum do backend, então também não se distingue aqui.
 */
export type Perfil = "porteiro" | "morador" | "sindico";

export function perfilDe(p: JwtPayload): Perfil {
  if (p.tipo === "morador") return "morador";
  return p.papel === "SINDICO" || p.papel === "ADMIN" ? "sindico" : "porteiro";
}
