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
 *
 * Noventa dias no app porque o refresh silencioso renova a cada abertura:
 * este prazo só é sentido por quem ABANDONOU o app, e cada relogin custa um
 * SMS de OTP. Não vira porta aberta para conta encerrada: o guard confere
 * `ativo`/existência a cada request, então porteiro desligado e conta
 * excluída caem na hora, com qualquer validade.
 */
export function validadeDaSessao(
  sessao?: JwtPayload["sessao"],
): "24h" | "90d" {
  return sessao === "painel" ? "24h" : "90d";
}
