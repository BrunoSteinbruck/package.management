import { randomBytes } from "node:crypto";

// Sem caracteres ambíguos (0/O, 1/I/L): o código é digitado por humanos.
const ALFABETO_CONVITE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function gerarCodigoConvite(): string {
  const bytes = randomBytes(6);
  let codigo = "";
  for (const b of bytes) codigo += ALFABETO_CONVITE[b % ALFABETO_CONVITE.length];
  return codigo;
}
