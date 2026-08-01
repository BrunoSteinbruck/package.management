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

/**
 * Telefone só com dígitos, sem o código do país.
 *
 * O `+55` que a pessoa digita naturalmente quebrava o login em silêncio: o
 * telefone é chave de busca exata, e "5551900000001" não encontra o cadastro
 * gravado como "51900000001". No app isso aparecia como "Código expirado",
 * que manda a pessoa pedir outro código e falhar de novo. Já produziu dado
 * ruim: existe morador no banco gravado com o 55 na frente, que hoje só
 * consegue entrar se digitar o país toda vez.
 *
 * O código do país só cai quando o que sobra tem tamanho de telefone
 * brasileiro (12 ou 13 dígitos no total). O DDD 55, de Santa Maria, tem 10
 * ou 11 dígitos ao todo e não é tocado: sem essa condição, "5599999999"
 * viraria "99999999" e perderia o próprio DDD.
 */
export function normalizarTelefone(bruto: string): string {
  const digitos = bruto.replace(/\D/g, "");
  const comPais =
    (digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55");
  return comPais ? digitos.slice(2) : digitos;
}

export const TelefoneSchema = z
  .string()
  .max(24)
  .transform(normalizarTelefone)
  // A faixa continua a mesma de antes da normalização: apertar aqui recusaria
  // cadastros que hoje funcionam, e não é isso que este ajuste resolve.
  .pipe(
    z
      .string()
      .regex(/^\d{10,14}$/, "Telefone inválido (use DDD + número, só dígitos)"),
  );

/**
 * Texto opcional em que "em branco" quer dizer AUSENTE, não string vazia.
 *
 * As telas escrevem `dado ?? "padrão"`, que cobre null e não cobre `""`: uma
 * encomenda gravada com `transportadora: "   "` aparecia SEM TÍTULO na home
 * do morador, um cartão em branco com uma data. Reproduzido contra a API, que
 * aceitava e devolvia os três espaços intactos. O trim na borda faz o `??` do
 * cliente voltar a funcionar em vez de exigir a mesma defesa em cada tela.
 *
 * O `.max()` vem antes do trim: aparar 1 MB de espaço para depois recusar é
 * trabalho jogado fora.
 */
export function textoOpcional(max: number) {
  return z
    .string()
    .max(max)
    .transform((s) => s.trim())
    .transform((s) => (s === "" ? undefined : s))
    .optional();
}

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
  /**
   * O painel só aceita a equipe do condomínio.
   *
   * Sem isto o servidor entregava o token ao morador e a recusa acontecia no
   * cliente, depois do código já ter sido consumido: o morador que digitasse
   * o telefone no painel por engano queimava o OTP e, com o limite de 3 por
   * hora, se trancava fora do proprio app. Com a flag, a checagem acontece
   * antes de encerrar o desafio, e o código continua valendo.
   */
  somenteEquipe: z.boolean().optional(),
});
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;

/**
 * E-mail como identificador: minúsculo e aparado.
 *
 * "Sindico@Convivar.com " e "sindico@convivar.com" são a mesma pessoa, e o
 * gestor digita do jeito que o teclado do celular capitalizou. A comparação
 * no banco é exata, então a normalização tem que acontecer na borda, nos dois
 * sentidos: ao cadastrar e ao procurar.
 */
export const EmailSchema = z
  .string()
  .max(160)
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.string().email("E-mail inválido"));

/**
 * Senha do painel: mínimo oito, sem aparar as pontas.
 *
 * Aparar seria destrutivo aqui. O gerenciador de senhas gera valores com
 * espaço, e uma senha que o navegador salvou com espaço no fim deixaria de
 * funcionar no dia em que o servidor decidisse apará-la. Oito caracteres é o
 * piso do NIST 800-63B; não exigimos combinação de tipos, que comprovadamente
 * produz "Senha@123" e não senha melhor.
 */
export const SenhaSchema = z
  .string()
  .min(8, "A senha precisa de pelo menos 8 caracteres")
  .max(100);

export const LoginSenhaSchema = z.object({
  /** E-mail ou celular: quem digita não deveria precisar saber qual dos dois. */
  identificador: z.string().min(1).max(160).transform((s) => s.trim()),
  senha: SenhaSchema,
});
export type LoginSenhaDto = z.infer<typeof LoginSenhaSchema>;

export const EsqueciSenhaSchema = z.object({ email: EmailSchema });
export type EsqueciSenhaDto = z.infer<typeof EsqueciSenhaSchema>;

export const RedefinirSenhaSchema = z.object({
  token: z.string().min(20).max(100),
  novaSenha: SenhaSchema,
});
export type RedefinirSenhaDto = z.infer<typeof RedefinirSenhaSchema>;

/**
 * Trocar a própria senha, já dentro do painel.
 *
 * A senha atual é exigida mesmo com a sessão aberta: um navegador esquecido
 * aberto no computador da administração não pode virar troca de senha, que
 * expulsaria o dono da própria conta.
 */
export const AlterarSenhaSchema = z.object({
  senhaAtual: z.string().min(1).max(100),
  novaSenha: SenhaSchema,
});
export type AlterarSenhaDto = z.infer<typeof AlterarSenhaSchema>;

/**
 * Definir ou trocar o próprio e-mail de recuperação.
 *
 * `senhaAtual` é opcional porque o gestor cadastrado antes da senha existir
 * não tem nenhuma: é justamente ele que precisa deste endpoint para sair da
 * rampa. Quem JÁ tem senha precisa informá-la, e o serviço cobra: trocar o
 * e-mail de recuperação sem prova é redirecionar o "esqueci a senha" para a
 * caixa de outra pessoa, que é tomar a conta.
 */
export const AlterarEmailSchema = z.object({
  email: EmailSchema,
  senhaAtual: z.string().min(1).max(100).optional(),
});
export type AlterarEmailDto = z.infer<typeof AlterarEmailSchema>;

/** O síndico completa o cadastro de quem ainda não tem e-mail nenhum. */
export const DefinirEmailDeMembroSchema = z.object({ email: EmailSchema });
export type DefinirEmailDeMembroDto = z.infer<typeof DefinirEmailDeMembroSchema>;

export const EmitirConviteSchema = z.object({
  unidadeId: z.string().uuid(),
});
export type EmitirConviteDto = z.infer<typeof EmitirConviteSchema>;

export const RegistrarPacoteSchema = z.object({
  unidadeId: z.string().uuid(),
  transportadora: textoOpcional(120),
  codigoRastreio: textoOpcional(120),
  notaFiscal: textoOpcional(120),
  fotoEntradaKey: FotoKeySchema.optional(),
  localArmazenamento: textoOpcional(120),
});
export type RegistrarPacoteDto = z.infer<typeof RegistrarPacoteSchema>;

export const RegistrarRetiradaSchema = z.object({
  // Teto como nos outros lotes do arquivo: uma retirada real tem unidades,
  // não milhares de pacotes.
  pacoteIds: z.array(z.string().uuid()).min(1).max(200),
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

/**
 * Bloco e identificação são CHAVE DE NEGÓCIO, não texto livre: a unidade é
 * casada por `bloco|identificacao` (no import de moradores e de vagas) e o
 * banco tem `@@unique([condominioId, bloco, identificacao])`.
 *
 * Sem normalizar, "777", "777 " e "777 " (espaço à direita, ou colado de
 * planilha com espaço não separável) viram TRÊS unidades distintas que a tela
 * desenha idênticas: o síndico vê "777 · Z" três vezes, e a encomenda entra
 * na errada. O `@@unique` não protege, porque as strings de fato diferem.
 *
 * Então: espaço não separável vira espaço comum, sequências internas viram um
 * espaço só, e as pontas caem fora.
 */
export const ChaveUnidadeSchema = z
  .string()
  .max(40)
  .transform((s) => s.replace(/[   ]/g, " ").trim().replace(/\s+/g, " "));

export const CriarUnidadesSchema = z.object({
  unidades: z
    .array(
      z.object({
        bloco: ChaveUnidadeSchema.optional(),
        identificacao: ChaveUnidadeSchema.pipe(z.string().min(1)),
      }),
    )
    .min(1)
    // Teto como nos outros lotes: import de prédio inteiro cabe bem aqui.
    .max(2000),
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
  // Teto antes do JWT: sem ele, 1 MB de texto ia inteiro para o verificador.
  qrToken: z.string().min(10).max(2000),
});
export type ResolverQrDto = z.infer<typeof ResolverQrSchema>;

export const ImportarMoradoresSchema = z.object({
  linhas: z
    .array(
      z.object({
        nome: z.string().min(2).max(120),
        telefone: TelefoneSchema,
        // Mesma normalização do cadastro de unidades: é por este par que a
        // linha da planilha encontra a unidade.
        bloco: ChaveUnidadeSchema.optional(),
        identificacao: ChaveUnidadeSchema.pipe(z.string().min(1)),
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
  /**
   * Opcional no schema e OBRIGATÓRIO para SINDICO, cobrado no serviço.
   *
   * A regra é do negócio, não do formato: o gestor entra no painel por senha
   * e a única forma de recuperá-la é o link por e-mail, então um síndico sem
   * e-mail nasce sem caminho de volta. O porteiro não tem senha e não precisa
   * de e-mail. Um zod que exigisse sempre recusaria o cadastro de porteiro;
   * um que nunca exigisse deixaria o síndico se trancar para fora.
   */
  email: EmailSchema.optional(),
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

/**
 * A mesma regra do schema, para o cliente poder habilitar o botão.
 *
 * O app checava só `length >= 6`: "ABCDEF" passava, ia ao servidor e voltava
 * "Placa inválida" depois do toque. Com a regra exportada, a validação é a
 * mesma nas duas pontas por construção, e não por duas cópias que combinam
 * hoje e divergem na próxima mudança de formato.
 */
export function placaValida(texto: string): boolean {
  return texto.length <= 20 && PLACA_REGEX.test(normalizarPlaca(texto));
}

export const PlacaSchema = z
  .string()
  // O teto vem ANTES do transform: `normalizarPlaca` varre a string inteira,
  // e sem limite varria 1 MB duas vezes só para devolver 400 no fim.
  .max(20)
  .transform(normalizarPlaca)
  .refine((p) => PLACA_REGEX.test(p), "Placa inválida");

export const CriarVagasSchema = z.object({
  vagas: z
    .array(
      z.object({
        identificacao: ChaveUnidadeSchema.pipe(z.string().min(1)),
        bloco: ChaveUnidadeSchema.optional(),
        unidade: ChaveUnidadeSchema.pipe(z.string().min(1)),
      }),
    )
    .min(1)
    .max(2000),
});
export type CriarVagasDto = z.infer<typeof CriarVagasSchema>;

export const CriarVeiculoSchema = z.object({
  unidadeId: z.string().uuid(),
  placa: PlacaSchema,
  modelo: textoOpcional(80),
  cor: textoOpcional(40),
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
  descricao: textoOpcional(500),
  fotoKey: FotoKeySchema.optional(),
});
export type CriarAvisoDto = z.infer<typeof CriarAvisoSchema>;

/** Via 2: ocorrência reportada pelo morador. */
export const CriarOcorrenciaSchema = z.object({
  unidadeId: z.string().uuid(),
  categoria: z.string().min(1).max(120),
  descricao: textoOpcional(500),
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
/**
 * Data do calendário como "AAAA-MM-DD".
 *
 * O regex sozinho não basta: `\d{2}` aceitava mês 99 e dia 99, e o servidor
 * montava `new Date("2026-99-99T00:00:00Z")` = Invalid Date, que chegava ao
 * Prisma e virava 500. O mês entra pelo padrão, e o dia por refinamento,
 * porque o limite depende do mês (e de ano bissexto): a checagem monta a data
 * e confirma que o dia sobreviveu, o que reprova 31/04 e 29/02 fora de
 * bissexto sem tabela de dias.
 */
export const DataSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Data inválida (use AAAA-MM-DD)")
  .refine((d) => {
    const [ano, mes, dia] = d.split("-").map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    return data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
  }, "Data inexistente no calendário");

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
          // Teto antes do refine, que limpa a string toda: multiplicado por 2000
          // linhas, sem limite vira trabalho inútil caro.
          .max(20)
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
  data: DataSchema,
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
