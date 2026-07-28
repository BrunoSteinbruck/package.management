/**
 * CPF e CNPJ do responsável financeiro da unidade.
 *
 * Validado aqui, e não só no provedor, porque o Asaas recusa a criação do
 * cliente com documento inválido e a falha chegaria tarde: no meio da geração
 * do mês, com a cobrança já gravada e sem boleto. Um dígito trocado na
 * planilha do síndico vira erro na hora de digitar, não no dia 1.
 */

/** Só os dígitos: o síndico digita com ponto, traço ou barra. */
export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

function digitoVerificador(base: string, pesoInicial: number): number {
  let peso = pesoInicial;
  let soma = 0;
  for (const c of base) {
    soma += Number(c) * peso;
    peso = peso === 2 ? 9 : peso - 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 11) return false;
  // Todos os dígitos iguais passam na conta dos verificadores (111.111.111-11
  // fecha), então precisam ser barrados à parte.
  if (/^(\d)\1{10}$/.test(d)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(d[i]) * (10 - i);
  let resto = (soma * 10) % 11 % 10;
  if (resto !== Number(d[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(d[i]) * (11 - i);
  resto = (soma * 10) % 11 % 10;
  return resto === Number(d[10]);
}

export function cnpjValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  if (digitoVerificador(d.slice(0, 12), 5) !== Number(d[12])) return false;
  return digitoVerificador(d.slice(0, 13), 6) === Number(d[13]);
}

/** Aceita os dois: a unidade pode ser de pessoa física ou de empresa. */
export function cpfCnpjValido(valor: string): boolean {
  const d = soDigitos(valor);
  return d.length === 14 ? cnpjValido(d) : cpfValido(d);
}

/** Formata para leitura na tela. Documento inválido volta como veio. */
export function formatarCpfCnpj(valor: string): string {
  const d = soDigitos(valor);
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return valor;
}
