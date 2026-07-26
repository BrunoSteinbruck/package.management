import { z } from "zod";
import { STATUS_AVISO, TIPOS_MEDIDOR } from "./enums";

// Corpos de request validados na borda da API. O que a API devolve fica em
// api.ts.

export const TelefoneSchema = z
  .string()
  .regex(/^\+?\d{10,14}$/, "Telefone inválido (use DDD + número, só dígitos)");

/**
 * Key de foto como o upload emite (uuid + extensão de imagem). Espelha o
 * KEY_FOTO_SEGURA que a API usa ao servir: validar também na entrada impede
 * gravar lixo ou caminho no lugar de uma key.
 */
export const FotoKeySchema = z
  .string()
  .max(120)
  .regex(/^[\w-]+\.(jpg|jpeg|png|webp)$/i, "Key de foto inválida");

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
  fotoEntradaKey: FotoKeySchema.optional(),
  localArmazenamento: z.string().max(120).optional(),
});
export type RegistrarPacoteDto = z.infer<typeof RegistrarPacoteSchema>;

export const RegistrarRetiradaSchema = z.object({
  pacoteIds: z.array(z.string().uuid()).min(1),
  fotoSaidaKey: FotoKeySchema.optional(),
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
  fotoKey: FotoKeySchema.optional(),
});
export type CriarAvisoDto = z.infer<typeof CriarAvisoSchema>;

/** Via 2: ocorrência reportada pelo morador. */
export const CriarOcorrenciaSchema = z.object({
  unidadeId: z.string().uuid(),
  categoria: z.string().min(1).max(120),
  descricao: z.string().max(500).optional(),
  fotoKey: FotoKeySchema.optional(),
});
export type CriarOcorrenciaDto = z.infer<typeof CriarOcorrenciaSchema>;

export const MudarStatusAvisoSchema = z.object({
  status: z.enum(STATUS_AVISO),
});
export type MudarStatusAvisoDto = z.infer<typeof MudarStatusAvisoSchema>;

// ----- Módulo Leituras de medidores -----

/**
 * Competência sempre trafega como "YYYY-MM". Vira data (dia 1, UTC) só dentro
 * da API; cliente nunca constrói Date de competência (fuso deslocaria o dia).
 */
export const CompetenciaSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Competência inválida (use YYYY-MM)");

export const RegistrarLeituraSchema = z.object({
  unidadeId: z.string().uuid(),
  tipo: z.enum(TIPOS_MEDIDOR),
  competencia: CompetenciaSchema,
  valor: z.number().min(0).max(999_999_999),
  fotoKey: FotoKeySchema.optional(),
});
export type RegistrarLeituraDto = z.infer<typeof RegistrarLeituraSchema>;

export const SalvarTarifaSchema = z.object({
  tipo: z.enum(TIPOS_MEDIDOR),
  valorPorM3: z.number().min(0).max(99_999),
});
export type SalvarTarifaDto = z.infer<typeof SalvarTarifaSchema>;

export const ExportLeiturasSchema = z.object({
  formato: z.enum(["xlsx", "pdf"]),
  // "mes": só a competência pedida. "geral": todo o histórico.
  escopo: z.enum(["mes", "geral"]),
  tipo: z.enum(TIPOS_MEDIDOR),
  competencia: CompetenciaSchema,
});
export type ExportLeiturasDto = z.infer<typeof ExportLeiturasSchema>;
