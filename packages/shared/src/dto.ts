import { z } from "zod";
import { cpfCnpjValido } from "./documento";
import {
  CATEGORIAS_DOCUMENTO,
  MODULOS_CONDOMINIO,
  STATUS_AVISO,
  TIPOS_MEDIDOR,
} from "./enums";

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
  /**
   * Quem recebeu. Morador da unidade (id) ou outra pessoa (nome livre).
   *
   * Os dois são opcionais e mutuamente exclusivos na prática: o app manda o
   * id quando o porteiro toca no chip do morador, e o nome quando digita
   * outra pessoa. Opcional porque a versão do app já publicada nas lojas não
   * manda nenhum dos dois, e a entrega não pode passar a falhar por isso.
   */
  recebidoPorMoradorId: z.string().uuid().optional(),
  recebidoPorNome: z.string().min(2).max(120).optional(),
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

/**
 * A lista inteira, não um toggle por módulo: o painel manda o estado final
 * que o síndico está vendo, então dois gestores editando ao mesmo tempo não
 * produzem uma combinação que nenhum dos dois pediu.
 */
export const SalvarModulosSchema = z.object({
  modulos: z.array(z.enum(MODULOS_CONDOMINIO)),
});
export type SalvarModulosDto = z.infer<typeof SalvarModulosSchema>;

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

// ----- Módulo Comunicados & Documentos -----

/**
 * Key de arquivo de documento (uuid + .pdf). Separada de `FotoKeySchema`
 * porque as duas coisas percorrem caminhos diferentes no upload e o que vale
 * numa não vale na outra.
 */
export const DocumentoKeySchema = z
  .string()
  .max(120)
  .regex(/^[\w-]+\.pdf$/i, "Key de documento inválida");

export const CriarComunicadoSchema = z.object({
  titulo: z.string().min(3).max(120),
  corpo: z.string().min(1).max(4000),
  /** Vazio (ou ausente) = condomínio inteiro. */
  blocos: z.array(z.string().max(40)).max(50).optional(),
});
export type CriarComunicadoDto = z.infer<typeof CriarComunicadoSchema>;

export const CriarDocumentoSchema = z.object({
  titulo: z.string().min(3).max(160),
  categoria: z.enum(CATEGORIAS_DOCUMENTO),
  arquivoKey: DocumentoKeySchema,
  tamanhoBytes: z.number().int().min(1).max(20 * 1024 * 1024),
});
export type CriarDocumentoDto = z.infer<typeof CriarDocumentoSchema>;

// ----- Módulo Visitantes -----

/** Data sem hora: o dia previsto da visita. Nunca vira Date no cliente. */
export const DataSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)");

/** Hora do dia em 24h. A janela é opcional, mas se vier tem que ser hora. */
export const HoraSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (use HH:MM)");

export const CriarVisitaSchema = z
  .object({
    unidadeId: z.string().uuid(),
    nomeVisitante: z.string().min(2).max(120),
    /** Documento de terceiro: opcional por minimização (LGPD). */
    documento: z.string().max(40).optional(),
    dataPrevista: DataSchema,
    janelaInicio: HoraSchema.optional(),
    janelaFim: HoraSchema.optional(),
  })
  .refine(
    (v) => !v.janelaInicio || !v.janelaFim || v.janelaInicio <= v.janelaFim,
    { message: "A janela termina antes de começar", path: ["janelaFim"] },
  );
export type CriarVisitaDto = z.infer<typeof CriarVisitaSchema>;

/** Opt-in de WhatsApp: só o próprio morador muda. */
export const AlternarWhatsappSchema = z.object({ aceita: z.boolean() });
export type AlternarWhatsappDto = z.infer<typeof AlternarWhatsappSchema>;

// ----- Módulo Financeiro -----

export const SalvarConfigFinanceiroSchema = z.object({
  diaVencimento: z.number().int().min(1).max(31),
  geracaoAutomatica: z.boolean(),
  reguaAtiva: z.boolean(),
});
export type SalvarConfigFinanceiroDto = z.infer<
  typeof SalvarConfigFinanceiroSchema
>;

/** Valor mensal por unidade: a fração ideal varia, então vem lista. */
export const SalvarTaxasSchema = z.object({
  taxas: z
    .array(
      z.object({
        unidadeId: z.string().uuid(),
        valorMensal: z.number().min(0).max(1_000_000),
        /**
         * Responsável financeiro: quem o boleto cobra. Opcional no contrato
         * porque o síndico costuma cadastrar os valores primeiro e os
         * pagadores depois, mas SEM os dois primeiros campos o provedor real
         * não emite nada (ele exige nome e CPF/CNPJ para criar o cliente).
         *
         * É o proprietário, que na unidade alugada não é quem mora: por isso
         * não sai do cadastro de moradores.
         */
        responsavelNome: z.string().min(2).max(120).optional(),
        responsavelCpfCnpj: z
          .string()
          .refine(cpfCnpjValido, "CPF ou CNPJ inválido")
          .optional(),
        responsavelEmail: z.string().email().max(160).optional(),
      }),
    )
    .min(1)
    .max(2000),
});
export type SalvarTaxasDto = z.infer<typeof SalvarTaxasSchema>;

/** Despesa para a prestação de contas (não é contas a pagar: só registro). */
export const CriarDespesaSchema = z.object({
  descricao: z.string().min(2).max(160),
  valor: z.number().min(0.01).max(1_000_000),
  /** Dia em que o débito deve aparecer no extrato. */
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)"),
});
export type CriarDespesaDto = z.infer<typeof CriarDespesaSchema>;

/** Upload do extrato OFX. O conteúdo vem como texto: OFX é texto puro. */
export const ImportarExtratoSchema = z.object({
  ofx: z.string().min(20).max(2_000_000),
});
export type ImportarExtratoDto = z.infer<typeof ImportarExtratoSchema>;

/**
 * Aceite das sugestões de conciliação. O motivo viaja junto porque é ele que
 * fica gravado como justificativa auditável do match.
 */
export const AceitarConciliacaoSchema = z.object({
  itens: z
    .array(
      z.object({
        extratoItemId: z.string().uuid(),
        alvoTipo: z.enum(["COBRANCA", "DESPESA"]),
        alvoId: z.string().uuid(),
        motivo: z.string().min(3).max(300),
      }),
    )
    .min(1)
    .max(1000),
});
export type AceitarConciliacaoDto = z.infer<typeof AceitarConciliacaoSchema>;

export const IgnorarExtratoItemSchema = z.object({
  motivo: z.string().min(3).max(200),
});
export type IgnorarExtratoItemDto = z.infer<typeof IgnorarExtratoItemSchema>;

/**
 * Liga a subconta do condomínio no provedor. A chave é da subconta DELE, no
 * CNPJ dele: o dinheiro nunca passa pela nossa conta.
 */
export const SalvarIntegracaoSchema = z.object({
  contaExternaId: z.string().min(3).max(120),
  apiKey: z.string().min(10).max(400),
});
export type SalvarIntegracaoDto = z.infer<typeof SalvarIntegracaoSchema>;

export const GerarCobrancasSchema = z.object({
  competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use AAAA-MM"),
});
export type GerarCobrancasDto = z.infer<typeof GerarCobrancasSchema>;

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
