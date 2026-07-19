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
