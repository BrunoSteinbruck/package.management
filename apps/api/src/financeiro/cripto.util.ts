import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Cifra as chaves de API das subcontas em repouso.
 *
 * A ameaça concreta é um dump do banco: sem isto, quem tivesse o backup teria
 * a chave que movimenta a cobrança de cada condomínio. Com AES-256-GCM e a
 * chave-mestra fora do banco (env), o dump sozinho não vale nada.
 *
 * GCM e não CBC porque a autenticação vem junto: valor adulterado falha na
 * decifragem em vez de decifrar em lixo silencioso.
 *
 * Formato: iv:tag:cifrado, tudo em base64url. Guardar o iv junto é o normal
 * (ele não é segredo, só precisa ser único por mensagem).
 */

const ALGORITMO = "aes-256-gcm";

function chaveMestra(): Buffer {
  const bruta = process.env.FINANCEIRO_CRIPTO_CHAVE;
  if (!bruta || bruta.length < 16) {
    throw new Error(
      "FINANCEIRO_CRIPTO_CHAVE ausente ou curta demais: sem ela as credenciais de cobrança não podem ser guardadas com segurança.",
    );
  }
  // Deriva 32 bytes de qualquer segredo razoável, então a env pode ser uma
  // frase e não precisa ter exatamente o tamanho da chave.
  return createHash("sha256").update(bruta).digest();
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITMO, chaveMestra(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    cifrado.toString("base64url"),
  ].join(":");
}

export function decifrar(guardado: string): string {
  const [iv, tag, cifrado] = guardado.split(":");
  if (!iv || !tag || !cifrado) throw new Error("Credencial em formato inválido");
  const decipher = createDecipheriv(
    ALGORITMO,
    chaveMestra(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(cifrado, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Está configurado para guardar credencial com segurança? */
export function criptoConfigurado(): boolean {
  try {
    chaveMestra();
    return true;
  } catch {
    return false;
  }
}

/**
 * O que dizer na subida sobre a chave de cripto.
 *
 * Antes disto a ausência da env só aparecia no PRIMEIRO uso: o deploy subia
 * verde e quebrava quando o síndico salvava a credencial do provedor, que é
 * o pior momento possível para descobrir um problema de configuração.
 *
 * Fatal só com `ASAAS_API_URL` presente, e não sempre: o financeiro é módulo
 * opcional por condomínio, e derrubar a API inteira por causa de uma env que
 * a maioria das instalações não usa trocaria um problema pequeno por um
 * grande. Com provedor real configurado a conta é outra, porque aí a emissão
 * de boleto de verdade depende dela.
 */
export function diagnosticoDeSubida(
  env: { FINANCEIRO_CRIPTO_CHAVE?: string; ASAAS_API_URL?: string } = process.env,
):
  | { nivel: "ok" }
  | { nivel: "aviso" | "fatal"; mensagem: string } {
  const bruta = env.FINANCEIRO_CRIPTO_CHAVE;
  if (bruta && bruta.length >= 16) return { nivel: "ok" };

  const problema = !bruta
    ? "FINANCEIRO_CRIPTO_CHAVE ausente"
    : "FINANCEIRO_CRIPTO_CHAVE curta demais (mínimo 16 caracteres)";

  return env.ASAAS_API_URL
    ? {
        nivel: "fatal",
        mensagem: `${problema}, e ASAAS_API_URL está configurada: a credencial do provedor não poderia ser guardada nem lida, e nenhum boleto sairia.`,
      }
    : {
        nivel: "aviso",
        mensagem: `${problema}. O financeiro funciona em modo de teste; cadastrar credencial de provedor vai falhar.`,
      };
}
