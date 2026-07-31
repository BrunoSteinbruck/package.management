import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * Hash de senha do painel, com scrypt do próprio Node.
 *
 * scrypt e não Argon2 porque Argon2 é módulo nativo: exigiria toolchain de
 * compilação na imagem do Render e um binário a mais para quebrar em cada
 * atualização de Node. scrypt é do `node:crypto`, é memory-hard como o
 * Argon2, e é recomendado pelo OWASP com estes parâmetros.
 *
 * N=16384 (2^14) custa ~16 MB e ~50 ms por verificação nesta máquina: caro o
 * bastante para força bruta offline, barato o bastante para o login não
 * pesar. O custo fica GRAVADO no hash, então subir N no futuro não invalida
 * as senhas já existentes: cada uma continua sendo verificada com o custo
 * que tinha quando foi criada.
 */
const N = 16384;
const R = 8;
const P = 1;
const BYTES_SAL = 16;
const BYTES_HASH = 32;

/** `scrypt:N:r:p:sal:hash`, tudo em base64url. */
export function gerarHash(senha: string): string {
  const sal = randomBytes(BYTES_SAL);
  const derivado = scryptSync(senha.normalize("NFKC"), sal, BYTES_HASH, {
    N,
    r: R,
    p: P,
  });
  return [
    "scrypt",
    N,
    R,
    P,
    sal.toString("base64url"),
    derivado.toString("base64url"),
  ].join(":");
}

/**
 * Nunca lança: hash malformado, vazio ou de outro algoritmo devolve false.
 *
 * Um throw aqui viraria 500 no login e, pior, distinguiria "usuário sem
 * senha" de "senha errada" pelo código de resposta, que é a informação que
 * o anti-enumeração está justamente tentando esconder.
 */
export function verificarHash(senha: string, armazenado: string | null): boolean {
  if (!armazenado) return false;
  const partes = armazenado.split(":");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, sal, esperado] = partes;
  try {
    const alvo = Buffer.from(esperado, "base64url");
    if (alvo.length === 0) return false;
    const derivado = scryptSync(
      senha.normalize("NFKC"),
      Buffer.from(sal, "base64url"),
      alvo.length,
      { N: Number(n), r: Number(r), p: Number(p) },
    );
    return timingSafeEqual(derivado, alvo);
  } catch {
    return false;
  }
}

/**
 * Hash de uma senha que ninguém tem, para o caminho do usuário inexistente.
 *
 * Sem ele, "e-mail não cadastrado" responderia na hora e "senha errada"
 * levaria os ~50 ms do scrypt: a diferença de tempo diria a um atacante
 * quais e-mails existem, que é exatamente o que a mensagem genérica esconde.
 * Gerado uma vez na carga do módulo, de uma senha aleatória descartada.
 */
export const HASH_FANTASMA = gerarHash(randomBytes(32).toString("base64url"));

/**
 * Token de redefinição: o que vai no link e o que fica no banco.
 *
 * No banco guardamos só o SHA-256. Um dump do banco não permite redefinir a
 * senha de ninguém, e o link do e-mail continua sendo o único portador do
 * segredo. SHA-256 puro basta aqui (ao contrário do OTP de 6 dígitos, que
 * precisa de HMAC): 32 bytes aleatórios não são força-brutáveis.
 */
export function gerarTokenRedefinicao(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashDoToken(token) };
}

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
