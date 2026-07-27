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

/** Medidores individuais lidos pelo zelador (leitura por foto). */
export const TIPOS_MEDIDOR = ["AGUA", "GAS"] as const;
export type TipoMedidor = (typeof TIPOS_MEDIDOR)[number];

/**
 * Módulos que o síndico liga por condomínio.
 *
 * Encomenda, aviso e leitura não estão aqui: são a base que todo condomínio
 * contrata. A lista existe para o que veio depois, e resolve duas coisas de
 * uma vez. O síndico escolhe o que o prédio usa, e um app já publicado nas
 * lojas não oferece porta de entrada para um módulo que o condomínio dele não
 * tem: sem isso, cada módulo novo exigiria esperar a adoção da versão.
 */
export const MODULOS_CONDOMINIO = [
  "comunicados",
  "documentos",
  "visitantes",
  "financeiro",
  "whatsapp",
  /**
   * QR de retirada. Único item da lista que não é módulo novo, e sim recurso
   * rebaixado: na prática o QR resolve a UNIDADE, que é o mesmo que a pessoa
   * dizer o número do apartamento, e só funciona para quem tem o app. Quem
   * registra a entrega é a foto mais o nome de quem recebeu. Fica desligado
   * por padrão, para o síndico que quiser a conferência extra.
   */
  "qr_retirada",
] as const;
export type ModuloCondominio = (typeof MODULOS_CONDOMINIO)[number];

/**
 * Ciclo da visita pré-autorizada. CHEGADA é terminal como CANCELADA: quem
 * entrou, entrou; o registro vira histórico.
 */
export const STATUS_VISITA = ["AUTORIZADA", "CHEGOU", "CANCELADA"] as const;
export type StatusVisita = (typeof STATUS_VISITA)[number];

/** Ciclo da cobrança da taxa condominial. */
export const STATUS_COBRANCA = [
  "PENDENTE",
  "PAGA",
  "VENCIDA",
  "CANCELADA",
] as const;
export type StatusCobranca = (typeof STATUS_COBRANCA)[number];

/** Prateleiras do repositório de documentos do condomínio. */
export const CATEGORIAS_DOCUMENTO = [
  "ATA",
  "REGIMENTO",
  "CONVENCAO",
  "OUTRO",
] as const;
export type CategoriaDocumento = (typeof CATEGORIAS_DOCUMENTO)[number];

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
