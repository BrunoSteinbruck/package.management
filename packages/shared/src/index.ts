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
});
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;

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

export const PAPEIS_USUARIO = ["PORTEIRO", "APOIO", "SINDICO", "ADMIN"] as const;
export type PapelUsuario = (typeof PAPEIS_USUARIO)[number];

export const STATUS_PACOTE = ["ARMAZENADO", "ENTREGUE", "EXTRAVIADO"] as const;
export type StatusPacote = (typeof STATUS_PACOTE)[number];

export interface JwtPayload {
  sub: string;
  tipo: "usuario" | "morador";
  nome: string;
  condominioId?: string;
  papel?: PapelUsuario;
}
