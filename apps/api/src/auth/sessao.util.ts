import type { JwtPayload } from "@pacotes/shared";

/**
 * Quanto vale o token, pela porta por onde a pessoa entrou.
 *
 * O painel dá acesso a extrato bancário, CPF de responsáveis e à emissão de
 * cobrança; ele vive num navegador, com o token em localStorage, onde um XSS
 * o alcança. O app vive no aparelho da pessoa e é usado no corredor, sem
 * tempo para relogar. Trinta dias iguais para os dois tratavam riscos
 * diferentes como se fossem o mesmo.
 *
 * Vinte e quatro horas no painel não custa nada ao gestor, porque com senha
 * relogar é digitar, não esperar um SMS. E o painel renova ao abrir, então
 * quem entra todo dia nunca vê a tela de login; quem some por um dia, sim.
 */
export function validadeDaSessao(
  sessao?: JwtPayload["sessao"],
): "24h" | "30d" {
  return sessao === "painel" ? "24h" : "30d";
}
