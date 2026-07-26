import { z } from "zod";

export const TelefoneSchema = z
  .string()
  .regex(/^\+?\d{10,14}$/, "Telefone inválido (use DDD + número, só dígitos)");

export const RequestOtpSchema = z.object({
  telefone: TelefoneSchema,
});
export type RequestOtpDto = z.infer<typeof RequestOtpSchema>;

export const VerifyOtpSchema = z.object({
  telefone: TelefoneSchema,
  codigo: z.string().length(6),
  // Onboarding de convidado: telefone ainda não cadastrado + convite válido
  // criam o morador e o vínculo na hora (confiança transitiva).
  nome: z.string().min(2).max(120).optional(),
  convite: z.string().min(4).max(12).optional(),
});
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;

export const EmitirConviteSchema = z.object({
  unidadeId: z.string().uuid(),
});
export type EmitirConviteDto = z.infer<typeof EmitirConviteSchema>;

export const RegistrarPacoteSchema = z.object({
  unidadeId: z.string().uuid(),
  transportadora: z.string().max(120).optional(),
  codigoRastreio: z.string().max(120).optional(),
  notaFiscal: z.string().max(120).optional(),
  fotoEntradaKey: z.string().max(500).optional(),
  localArmazenamento: z.string().max(120).optional(),
});
export type RegistrarPacoteDto = z.infer<typeof RegistrarPacoteSchema>;

export const RegistrarRetiradaSchema = z.object({
  pacoteIds: z.array(z.string().uuid()).min(1),
  fotoSaidaKey: z.string().max(500).optional(),
});
export type RegistrarRetiradaDto = z.infer<typeof RegistrarRetiradaSchema>;

export const CriarUnidadesSchema = z.object({
  unidades: z
    .array(
      z.object({
        bloco: z.string().max(40).optional(),
        identificacao: z.string().min(1).max(40),
      }),
    )
    .min(1),
});
export type CriarUnidadesDto = z.infer<typeof CriarUnidadesSchema>;

export const RegistrarDeviceSchema = z.object({
  pushToken: z.string().min(10).max(400),
  plataforma: z.enum(["IOS", "ANDROID"]),
});
export type RegistrarDeviceDto = z.infer<typeof RegistrarDeviceSchema>;

export const EmitirQrSchema = z.object({
  unidadeId: z.string().uuid(),
});
export type EmitirQrDto = z.infer<typeof EmitirQrSchema>;

export const ResolverQrSchema = z.object({
  qrToken: z.string().min(10),
});
export type ResolverQrDto = z.infer<typeof ResolverQrSchema>;

export const ImportarMoradoresSchema = z.object({
  linhas: z
    .array(
      z.object({
        nome: z.string().min(2).max(120),
        telefone: TelefoneSchema,
        bloco: z.string().max(40).optional(),
        identificacao: z.string().min(1).max(40),
      }),
    )
    .min(1)
    .max(2000),
});
export type ImportarMoradoresDto = z.infer<typeof ImportarMoradoresSchema>;

export const AnalisarTextoSchema = z.object({
  texto: z.string().min(1).max(20000),
});
export type AnalisarTextoDto = z.infer<typeof AnalisarTextoSchema>;

export const PAPEIS_USUARIO = ["PORTEIRO", "APOIO", "SINDICO", "ADMIN"] as const;
export type PapelUsuario = (typeof PAPEIS_USUARIO)[number];

export const CriarUsuarioSchema = z.object({
  nome: z.string().min(2).max(120),
  telefone: TelefoneSchema,
  papel: z.enum(["PORTEIRO", "APOIO", "SINDICO"]),
});
export type CriarUsuarioDto = z.infer<typeof CriarUsuarioSchema>;

// ----- Módulo Avisos & Ocorrências -----

/** Placa normalizada: UPPER, só alfanumérico. Aceita Mercosul e antiga. */
export function normalizarPlaca(placa: string): string {
  return placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
const PLACA_REGEX = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/; // Mercosul ABC1D23 e antiga ABC1234

export const PlacaSchema = z
  .string()
  .transform(normalizarPlaca)
  .refine((p) => PLACA_REGEX.test(p), "Placa inválida");

export const CriarVagasSchema = z.object({
  vagas: z
    .array(
      z.object({
        identificacao: z.string().min(1).max(40),
        bloco: z.string().max(40).optional(),
        unidade: z.string().min(1).max(40),
      }),
    )
    .min(1)
    .max(2000),
});
export type CriarVagasDto = z.infer<typeof CriarVagasSchema>;

export const CriarVeiculoSchema = z.object({
  unidadeId: z.string().uuid(),
  placa: PlacaSchema,
  modelo: z.string().max(80).optional(),
  cor: z.string().max(40).optional(),
});
export type CriarVeiculoDto = z.infer<typeof CriarVeiculoSchema>;

export const IdentificarAlvoSchema = z.object({
  texto: z.string().min(1).max(200),
});
export type IdentificarAlvoDto = z.infer<typeof IdentificarAlvoSchema>;

/** Via 1: aviso da equipe para uma unidade. */
export const CriarAvisoSchema = z.object({
  unidadeId: z.string().uuid(),
  motivo: z.string().min(1).max(120),
  descricao: z.string().max(500).optional(),
  fotoKey: z.string().max(500).optional(),
});
export type CriarAvisoDto = z.infer<typeof CriarAvisoSchema>;

/** Via 2: ocorrência reportada pelo morador. */
export const CriarOcorrenciaSchema = z.object({
  unidadeId: z.string().uuid(),
  categoria: z.string().min(1).max(120),
  descricao: z.string().max(500).optional(),
  fotoKey: z.string().max(500).optional(),
});
export type CriarOcorrenciaDto = z.infer<typeof CriarOcorrenciaSchema>;

export const STATUS_AVISO = ["ABERTO", "EM_ANDAMENTO", "RESOLVIDO"] as const;
export type StatusAviso = (typeof STATUS_AVISO)[number];

export const MudarStatusAvisoSchema = z.object({
  status: z.enum(STATUS_AVISO),
});
export type MudarStatusAvisoDto = z.infer<typeof MudarStatusAvisoSchema>;

/** Motivos sugeridos na Via 1 (equipe) e categorias na Via 2 (morador). */
export const MOTIVOS_AVISO = [
  "Luz acesa",
  "Alarme disparado",
  "Vidro aberto",
  "Mal estacionado",
  "Vazamento",
  "Janela aberta",
] as const;
export const CATEGORIAS_OCORRENCIA = [
  "Segurança",
  "Iluminação",
  "Limpeza",
  "Vazamento",
  "Elevador",
  "Portão",
] as const;

export const STATUS_PACOTE = ["ARMAZENADO", "ENTREGUE", "EXTRAVIADO"] as const;
export type StatusPacote = (typeof STATUS_PACOTE)[number];

export interface JwtPayload {
  sub: string;
  tipo: "usuario" | "morador";
  nome: string;
  condominioId?: string;
  condominioNome?: string;
  papel?: PapelUsuario;
}

// ----- Perfil: o eixo de UX -----

/**
 * O perfil que decide qual experiência o cliente monta. Não confundir com
 * `tipo` (em qual tabela a identidade vive) nem com `papel` (o enum do banco):
 * é a projeção dos dois no vocabulário do produto. APOIO não se distingue de
 * PORTEIRO em lugar nenhum do backend, então também não se distingue aqui.
 */
export type Perfil = "porteiro" | "morador" | "sindico";

export function perfilDe(p: JwtPayload): Perfil {
  if (p.tipo === "morador") return "morador";
  return p.papel === "SINDICO" || p.papel === "ADMIN" ? "sindico" : "porteiro";
}
