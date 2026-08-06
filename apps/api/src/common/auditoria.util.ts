import type { Prisma } from "@prisma/client";

/**
 * O vocabulário fechado do que se audita.
 *
 * União de literais e não `string` solta: um verbo escrito errado num lugar
 * viraria uma linha que nenhuma consulta encontra, e o erro só apareceria no
 * dia em que alguém precisasse do registro, que é exatamente o pior dia.
 */
export type AcaoAuditada =
  | "financeiro.salvar_config"
  | "financeiro.salvar_integracao"
  | "financeiro.salvar_taxas"
  | "financeiro.gerar_cobrancas"
  | "financeiro.criar_despesa"
  | "financeiro.remover_despesa"
  | "financeiro.aceitar_conciliacao"
  | "financeiro.ignorar_extrato"
  | "cadastro.aprovar_vinculo"
  | "cadastro.recusar_vinculo";

/**
 * Grava quem fez o quê, DENTRO da transação de quem chamou.
 *
 * Recebe o `tx` de propósito: o registro entra na mesma transação da mutação,
 * então ou os dois acontecem ou nenhum. Uma auditoria que pode falhar sozinha
 * é pior que não ter auditoria, porque dá a impressão de cobertura completa.
 *
 * NUNCA passe segredo no `detalhe`: a credencial do provedor não entra, e
 * documento entra mascarado (ver `mascararCpfCnpj`).
 */
export function registrarAcao(
  tx: Prisma.TransactionClient,
  dados: {
    condominioId: string;
    usuarioId: string;
    acao: AcaoAuditada;
    detalhe?: Prisma.InputJsonValue;
  },
) {
  return tx.registroAcao.create({
    data: {
      condominioId: dados.condominioId,
      usuarioId: dados.usuarioId,
      acao: dados.acao,
      detalhe: dados.detalhe,
    },
  });
}

/**
 * Documento no registro de auditoria: só os últimos dígitos.
 *
 * A trilha existe para responder "quem mudou o quê", e para isso basta ver
 * que o pagador saiu de um documento para outro. Guardar o CPF inteiro
 * duplicaria dado pessoal numa tabela que ninguém pensa em proteger ao
 * exportar, e a LGPD cobra o mínimo necessário, não o conveniente.
 */
export function mascararCpfCnpj(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length <= 3) return "*".repeat(digitos.length);
  return "*".repeat(digitos.length - 3) + digitos.slice(-3);
}
