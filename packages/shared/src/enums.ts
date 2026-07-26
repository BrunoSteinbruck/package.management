// Vocabulário fechado do domínio. Espelha os enums do Prisma e as listas que
// aparecem na UI. Fica isolado para que dto.ts e api.ts possam depender daqui
// sem ciclo.

export const PAPEIS_USUARIO = ["PORTEIRO", "APOIO", "SINDICO", "ADMIN"] as const;
export type PapelUsuario = (typeof PAPEIS_USUARIO)[number];

/** Ou está aberto, ou está resolvido. Não há meio-termo útil para quem lê. */
export const STATUS_AVISO = ["ABERTO", "RESOLVIDO"] as const;
export type StatusAviso = (typeof STATUS_AVISO)[number];

export const STATUS_PACOTE = ["ARMAZENADO", "ENTREGUE", "EXTRAVIADO"] as const;
export type StatusPacote = (typeof STATUS_PACOTE)[number];

/** Motivos sugeridos na Via 1 (equipe avisa a unidade). */
export const MOTIVOS_AVISO = [
  "Luz acesa",
  "Alarme disparado",
  "Vidro aberto",
  "Mal estacionado",
  "Vazamento",
  "Janela aberta",
] as const;

/** Categorias sugeridas na Via 2 (morador reporta à administração). */
export const CATEGORIAS_OCORRENCIA = [
  "Segurança",
  "Iluminação",
  "Limpeza",
  "Vazamento",
  "Elevador",
  "Portão",
] as const;
