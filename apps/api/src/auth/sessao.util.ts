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

/**
 * Este token nasceu antes de a conta ter suas sessões revogadas?
 *
 * O token É a sessão: não há tabela, não há `jti`, e o servidor não sabe
 * quantas sessões cada conta tem abertas. Uma data por conta é o que dá para
 * revogar sem inventar esse registro todo: quem trocou a senha carimba
 * "agora", e todo token assinado antes disso morre na requisição seguinte.
 *
 * Isso importa porque o app renova a sessão a cada abertura. Os 90 dias não
 * são teto para quem está COM o aparelho: quem levou o celular e continua
 * abrindo o app renova para sempre. Sem revogação, trocar a senha não tirava
 * ninguém de lugar nenhum, que é justo o que a pessoa faz quando desconfia
 * que entraram na conta dela.
 *
 * A comparação é em segundos porque o `iat` do JWT é em segundos (RFC 7519).
 * Consequência assumida: um token assinado no MESMO segundo do carimbo
 * sobrevive. É o que mantém viva a sessão de quem acabou de trocar a senha,
 * e a brecha exigiria que o invasor tivesse entrado no mesmo segundo.
 */
export function sessaoRevogada(
  iat: number | undefined,
  revogadasEm: Date | null | undefined,
): boolean {
  if (!revogadasEm) return false;
  // Token sem `iat` não tem como provar que é posterior ao carimbo. Recusar é
  // a única resposta segura, e na prática não acontece: quem assina é o
  // `assinarSessao`, e o jsonwebtoken sempre põe `iat`.
  if (typeof iat !== "number") return true;
  return iat < Math.floor(revogadasEm.getTime() / 1000);
}
