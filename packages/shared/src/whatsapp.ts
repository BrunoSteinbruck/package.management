import { normalizarTelefone } from "./dto";

/**
 * Link de conversa no WhatsApp com a mensagem já escrita.
 *
 * O `wa.me` exige o número COM código do país, e o banco guarda telefone
 * local (`normalizarTelefone` tira o 55 justamente para a busca por telefone
 * bater). Então o caminho é: normalizar para o formato do cadastro e recolocar
 * o país na saída.
 *
 * O 55 só entra em número de 10 ou 11 dígitos, que é DDD + número daqui.
 * `TelefoneSchema` aceita até 14, e existe cadastro estrangeiro: prefixar tudo
 * transformaria um número de fora num destino que não existe. Fora dessa
 * faixa, o número vai como está e o WhatsApp decide o que fazer.
 *
 * O texto vai percent-encoded: acento, espaço e quebra de linha são comuns na
 * mensagem de convite e quebrariam a URL crua. Diferente do SMS, aqui não há
 * motivo para evitar acento (a restrição GSM-7 é de SMS, não daqui).
 */
export function linkWhatsApp(telefone: string, texto: string): string {
  const local = normalizarTelefone(telefone);
  const destino =
    local.length === 10 || local.length === 11 ? `55${local}` : local;
  return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`;
}
