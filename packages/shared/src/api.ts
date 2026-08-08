import { formatarTelefone } from "./dto";
import type {
  CategoriaDocumento,
  ModuloCondominio,
  PapelUsuario,
  StatusAviso,
  StatusCobranca,
  StatusPacote,
  StatusVisita,
  TipoMedidor,
} from "./enums";

/**
 * Contrato das respostas da API: o formato do fio, já serializado em JSON.
 *
 * Duas regras que valem para tudo aqui:
 *
 * 1. Datas são `string`. O servidor devolve `Date` e o Nest serializa na saída;
 *    o cliente nunca vê um `Date`.
 * 2. Cada tipo declara um subconjunto do que a API envia. Campo a mais no
 *    servidor é inofensivo (o cliente ignora); campo declarado aqui que a API
 *    não manda é bug, e é isso que o typecheck dos clientes protege.
 */

// ----- Comum -----

/** O par que identifica a unidade para o olho humano. */
export interface UnidadeRotulo {
  bloco: string | null;
  identificacao: string;
}

/**
 * Como a unidade é escrita em qualquer lugar do produto: bloco antes do
 * apartamento, separados por meio-ponto. "B · 302", nunca "302 · Bloco B".
 *
 * Vive no shared porque estava reimplementado em quatro arquivos e em três
 * formatos diferentes: o app dizia "302 · Bloco B", o painel dizia ora
 * "302 · B" ora "B · 302", e a conciliação bancária dizia "302 · B". Quem lê
 * o extrato e a tela lado a lado tinha que traduzir de cabeça.
 */
export function rotuloUnidade(u: UnidadeRotulo | undefined | null): string {
  if (!u) return "-";
  return u.bloco ? `${u.bloco} · ${u.identificacao}` : u.identificacao;
}

export interface Unidade extends UnidadeRotulo {
  id: string;
}

/** Foto com token curto e preso à key. O JWT de sessão nunca vai em URL. */
export interface FotoRef {
  key: string;
  token: string;
}

/**
 * O que a sessão atual pode ver. GET /conta/capacidades
 *
 * Fica fora do JWT de propósito: o token vale 90 dias, e módulo ligado pelo
 * síndico precisa aparecer na próxima abertura do app, não no próximo login.
 *
 * Para o morador é a união dos módulos dos condomínios onde ele tem vínculo
 * ativo. Quem mora em dois prédios vê o menu do que qualquer um dos dois
 * oferece; a autorização de cada rota continua sendo do servidor, esta lista
 * só decide o que a home mostra.
 */
export interface Capacidades {
  modulos: ModuloCondominio[];
  /**
   * Onde baixar o app, para os convites por WhatsApp anexarem ao texto.
   *
   * Vem do mesmo `APP_DOWNLOAD_URL` que o SMS de convite automático já usa,
   * então existe UM lugar para trocar quando a loja mudar. Null enquanto o
   * env não estiver definido: o convite sai sem link em vez de sair com um
   * "undefined" colado no fim da frase.
   */
  appDownloadUrl: string | null;
}

// ----- Pacotes -----

/** A linha crua do pacote, sem os relacionamentos. */
export interface Pacote {
  id: string;
  unidadeId: string;
  transportadora: string | null;
  codigoRastreio: string | null;
  notaFiscal: string | null;
  localArmazenamento: string | null;
  status: StatusPacote;
  recebidoEm: string;
}

/**
 * Uma linha de `/portaria/pacotes`. O serviço devolve a linha do Prisma com
 * `unidade` e `retirada` incluídos, então tanto o app quanto o painel leem
 * daqui: o painel usa menos campos, o que é seguro.
 */
export interface PacoteLinha extends Pacote {
  unidade: Unidade;
  retirada: {
    retiradoEm: string;
    /**
     * Nome atual do morador quando a retirada tem vínculo, senão o texto que
     * o porteiro escreveu ("Ana (faxina)"). Null nas retiradas anteriores ao
     * campo, que só registravam a unidade.
     */
    retiradoPorNome: string | null;
  } | null;
}

export interface ListaPacotes {
  total: number;
  pagina: number;
  porPagina: number;
  itens: PacoteLinha[];
}

export interface Pendencia {
  unidade?: Unidade;
  pendentes: number;
  maisAntigoEm: string | null;
}

export interface ResultadoRetirada {
  retiradas: unknown[];
  pendentesRestantes: number;
}

export interface RespostaOcr {
  fotoKey: string;
  extraido: {
    rastreio?: string;
    transportadora?: string;
    bloco?: string;
    identificacao?: string;
  };
  sugestoes: Array<Unidade & { score: number }>;
}

// ----- Morador -----

export interface PacoteMorador {
  id: string;
  transportadora: string | null;
  codigoRastreio: string | null;
  status: StatusPacote;
  recebidoEm: string;
  retirada: { retiradoEm: string } | null;
}

export interface MinhaUnidade {
  unidade: Unidade & { condominio: string };
  pendentes: PacoteMorador[];
  historico: PacoteMorador[];
}

export interface DetalhePacote {
  id: string;
  transportadora: string | null;
  codigoRastreio: string | null;
  status: StatusPacote;
  localArmazenamento: string | null;
  recebidoEm: string;
  recebidoPorNome: string;
  notificadoEm: string | null;
  fotoEntrada: FotoRef | null;
  fotoSaida: FotoRef | null;
  retiradoEm: string | null;
  entreguePorNome: string | null;
  /**
   * Quem recebeu a encomenda: o morador da unidade ou a pessoa que o porteiro
   * anotou. Null nas retiradas feitas antes do campo existir.
   */
  retiradoPorNome: string | null;
}

/** Morador da unidade, para o chip de "quem recebeu" na portaria. */
export interface MoradorDaUnidade {
  id: string;
  nome: string;
}

export interface Vinculado {
  nome: string;
  telefone: string;
  titular: boolean;
  voce: boolean;
}

// ----- Avisos & Ocorrências -----

export interface Veiculo {
  id: string;
  placa: string;
  modelo: string | null;
  cor: string | null;
}

export interface AlvoIdentificado {
  origem: "placa" | "vaga" | null;
  valor: string;
  unidade: Unidade | null;
}

/** Via 1, o que a equipe mandou para a unidade. GET /morador/avisos */
export interface AvisoMorador {
  id: string;
  motivo: string;
  descricao: string | null;
  status: StatusAviso;
  criadoEm: string;
  foto: FotoRef | null;
}

/**
 * Via 2, o que o morador reportou. GET /morador/ocorrencias
 *
 * É a mesma linha de `Aviso` que alimenta `AvisoMorador`, com a coluna
 * `motivo` exposta como `categoria`. A duplicação de vocabulário nasce aqui
 * e é o que o feed unificado resolve.
 */
export interface OcorrenciaMorador {
  id: string;
  categoria: string;
  descricao: string | null;
  status: StatusAviso;
  criadoEm: string;
  foto: FotoRef | null;
}

/** A mesma ocorrência vista pelo gestor. GET /cadastro/ocorrencias */
export interface OcorrenciaGestor extends OcorrenciaMorador {
  unidade: UnidadeRotulo;
  autor: string;
}

// ----- Comunicados & Documentos -----

/** Detalhe do comunicado para o morador. GET /morador/comunicados/:id */
export interface ComunicadoMorador {
  id: string;
  titulo: string;
  corpo: string;
  criadoEm: string;
  autor: string;
}

/**
 * A mesma publicação vista pelo síndico, com o que ele quer saber depois de
 * publicar: quantos dos moradores alcançados leram.
 */
export interface ComunicadoGestor {
  id: string;
  titulo: string;
  corpo: string;
  criadoEm: string;
  autor: string;
  /** Vazio = condomínio inteiro. */
  blocos: string[];
  leituras: number;
  /** Moradores com vínculo ativo nos blocos alvo, no momento da consulta. */
  alcance: number;
}

/** Quem leu um comunicado. GET /cadastro/comunicados/:id/leituras */
export interface LeituraComunicado {
  nome: string;
  unidade: UnidadeRotulo;
  lidoEm: string;
}

/**
 * Documento do condomínio. `arquivo` traz o link assinado (1h) pronto para
 * abrir; morador e gestor leem do mesmo formato.
 */
export interface DocumentoLinha {
  id: string;
  titulo: string;
  categoria: CategoriaDocumento;
  tamanhoBytes: number;
  criadoEm: string;
  arquivo: FotoRef;
}

// ----- Visitantes -----

/**
 * Visita como o morador vê: sem o documento, que ele mesmo digitou mas não
 * precisa reler, e que só interessa a quem confere no portão.
 */
export interface VisitaMorador {
  id: string;
  nomeVisitante: string;
  /**
   * Código curto que o morador passa para quem vem ("V-4821"). Serve para a
   * portaria achar a linha certa na lista do dia, não para autenticar
   * ninguém. Null nas visitas criadas antes do campo.
   */
  codigo: string | null;
  dataPrevista: string;
  janelaInicio: string | null;
  janelaFim: string | null;
  status: StatusVisita;
  chegadaEm: string | null;
  unidade: UnidadeRotulo;
}

/**
 * A mesma visita na tela da portaria, com o que o porteiro precisa para
 * conferir quem está na frente dele: unidade, documento e quem autorizou.
 */
export interface VisitaPortaria extends VisitaMorador {
  documento: string | null;
  autorizadoPor: string;
}

// ----- Financeiro -----

/** A cobrança como o morador vê, com o que ele precisa para pagar. */
export interface CobrancaMorador {
  id: string;
  competencia: string;
  valor: number;
  vencimento: string;
  status: StatusCobranca;
  linhaDigitavel: string | null;
  urlBoleto: string | null;
  pixCopiaCola: string | null;
  pagoEm: string | null;
  unidade: UnidadeRotulo;
}

export interface CobrancaGestor extends CobrancaMorador {
  /** Dias de atraso; 0 quando em dia ou paga. */
  diasAtraso: number;
}

export interface ResumoFinanceiro {
  competencia: string;
  totalCobrado: number;
  totalPago: number;
  inadimplencia: number;
  unidadesCobradas: number;
  unidadesPagas: number;
  /** Falso quando o provedor roda em stub: nada foi emitido de verdade. */
  emissaoReal: boolean;
}

// ----- Conciliação bancária -----

export interface DespesaLinha {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  /** Já casada com uma linha do extrato. */
  conciliada: boolean;
}

/** Uma linha do extrato na tela de conciliação. */
export interface ExtratoLinha {
  id: string;
  data: string;
  valor: number;
  descricao: string;
}

/** Sugestão pronta para o aceite de um clique. */
export interface SugestaoConciliacao {
  extrato: ExtratoLinha;
  alvoTipo: "COBRANCA" | "DESPESA";
  alvoId: string;
  /** "302 · B, Julho/2026" ou a descrição da despesa. */
  alvoRotulo: string;
  alvoData: string;
  alvoValor: number;
  confianca: "exata" | "provavel";
  motivo: string;
}

export interface PainelConciliacao {
  /** O que o motor conseguiu explicar: um clique para aceitar. */
  sugestoes: SugestaoConciliacao[];
  /** Linhas do extrato que precisam de olho humano. */
  semPar: ExtratoLinha[];
  /** Cobranças pagas e despesas que o extrato não mostra. */
  alvosSemExtrato: Array<{
    tipo: "COBRANCA" | "DESPESA";
    rotulo: string;
    data: string;
    valor: number;
  }>;
  conciliadas: number;
  ignoradas: number;
}

export interface ResultadoImportacaoExtrato {
  importados: number;
  /** FITID repetido: reimportar o mesmo arquivo não duplica. */
  repetidos: number;
  ilegiveis: number;
}

export interface ConfigFinanceiro {
  diaVencimento: number;
  geracaoAutomatica: boolean;
  reguaAtiva: boolean;
  /** Existe subconta configurada no provedor? */
  integrado: boolean;
  emissaoReal: boolean;
}

export interface TaxaLinha {
  unidadeId: string;
  unidade: UnidadeRotulo;
  valorMensal: number | null;
  /**
   * Responsável financeiro (o proprietário, que pode não ser quem mora).
   * Sem nome e documento o provedor real não emite boleto para a unidade.
   */
  responsavelNome: string | null;
  responsavelCpfCnpj: string | null;
  responsavelEmail: string | null;
  /** Cliente já criado no provedor: a unidade está pronta para ser cobrada. */
  clienteCriado: boolean;
}

// ----- Painel (gestão) -----

export interface Resumo {
  naPortaria: number;
  retiradasHoje: number;
  paradas3Dias: number;
}

export interface Adocao {
  totalUnidades: number;
  unidadesComApp: number;
  percentual: number;
}

/** Um acontecimento no feed da Visão geral. */
export type TipoAtividade =
  | "cobranca_paga"
  | "cobrancas_geradas"
  | "comunicado"
  | "documento"
  | "relato"
  | "visita";

export interface Atividade {
  tipo: TipoAtividade;
  /** Texto pronto: quem sabe nomear o acontecimento é quem o leu do banco. */
  titulo: string;
  /** Unidade, categoria, autor. Nulo quando não acrescenta nada. */
  detalhe: string | null;
  quando: string;
}

/**
 * O que a Visão geral do painel precisa e não tinha. GET /cadastro/visao-geral
 *
 * Uma requisição para quatro contagens e o feed, porque são todas do mesmo
 * tenant e a home não deve abrir com seis spinners. Aprovações e relatos
 * abertos ficam de FORA de propósito: o Dashboard já os carrega para a barra
 * lateral e os repassa por prop, e duplicá-los aqui daria dois números que
 * podem divergir na mesma tela.
 */
export interface VisaoGeralPainel {
  moradores: number;
  funcionarios: number;
  /** Linhas do extrato esperando decisão. Zero sem o módulo financeiro. */
  conciliacaoPendente: number;
  cobrancasVencidas: number;
  atividade: Atividade[];
}

/** Um mês na série de cobrado x recebido. GET /cadastro/financeiro/serie */
export interface MesFinanceiro {
  competencia: string;
  cobrado: number;
  recebido: number;
}

/**
 * Uma unidade na tabela de moradores do painel. GET /cadastro/unidades/panorama
 *
 * Responde a pergunta que a lista de pendentes não responde: quem já está
 * cadastrado, e em quais apartamentos ninguém baixou o app. Sem isso o síndico
 * via só o percentual de adoção e não sabia onde bater na porta.
 */
export interface UnidadePanorama {
  unidadeId: string;
  bloco: string | null;
  identificacao: string;
  /** O primeiro vinculado, por ordem de aprovação. Null quando não há nenhum. */
  titular: { nome: string; telefone: string } | null;
  vinculados: number;
  temApp: boolean;
}

export interface DiaSerie {
  dia: string;
  entradas: number;
  retiradas: number;
}

export interface Relatorios {
  tempoMedioDias: number;
  volume: number;
  notificacoesPct: number;
  porTransportadora: { nome: string; qtd: number; pct: number }[];
  porHorario: { faixa: string; qtd: number; pct: number }[];
}

export interface VinculoPendente {
  id: string;
  criadoEm: string;
  morador: { nome: string; telefone: string };
  unidade: UnidadeRotulo;
}

export interface VagaLinha {
  id: string;
  identificacao: string;
  unidade: UnidadeRotulo;
}

export interface MembroEquipe {
  id: string;
  nome: string;
  telefone: string;
  /** Só quem entra no painel por senha tem: porteiro e apoio ficam nulos. */
  email: string | null;
  papel: PapelUsuario | string;
  ativo: boolean;
}

/**
 * O telefone do membro como se mostra na tela.
 *
 * Excluir a conta anonimiza o registro gravando `removido:<uuid>` na coluna
 * de telefone (`conta.service.ts`), para o histórico de quem entregou pacote
 * não apontar para lugar nenhum. Esse uuid não é telefone e não é para
 * ninguém ler: a linha continua na lista como rastro do quadro antigo, mas
 * dizendo o que de fato é.
 */
export function contatoDeMembro(telefone: string): string {
  return telefone.startsWith("removido:")
    ? "conta excluída"
    : formatarTelefone(telefone);
}

// ----- Leituras de medidores -----

/** Sinal visual no painel; não bloqueia nada. */
export type AlertaConsumo = "NEGATIVO" | "ACIMA_MEDIA" | null;

/** Uma linha da tabela de consumos (unidade × competência × tipo). */
export interface ConsumoLinha {
  unidadeId: string;
  bloco: string | null;
  identificacao: string;
  /** Leitura mais recente ANTERIOR à competência (não obrigatoriamente mês-1). */
  anterior: { competencia: string; valor: number } | null;
  atual: {
    valor: number;
    lidoEm: string;
    lidoPor: string;
    fotoRef: FotoRef | null;
  } | null;
  /** atual − anterior; null sem par de leituras. */
  consumo: number | null;
  /** consumo × tarifa; null sem tarifa ou sem consumo. */
  valorReais: number | null;
  alerta: AlertaConsumo;
}

export interface ConsumosResposta {
  competencia: string;
  tipo: TipoMedidor;
  /** Tarifa vigente por m³; null enquanto o síndico não cadastrar. */
  tarifa: number | null;
  linhas: ConsumoLinha[];
  totais: {
    lidas: number;
    totalUnidades: number;
    consumo: number;
    valorReais: number | null;
  };
}

/**
 * Estado do mês para o app do porteiro: progresso + leitura anterior por
 * unidade, num fetch só (cacheável para a confirmação funcionar offline).
 */
export interface EstadoLeituras {
  competencia: string;
  tipo: TipoMedidor;
  total: number;
  lidas: number;
  unidades: {
    unidadeId: string;
    bloco: string | null;
    identificacao: string;
    anterior: { competencia: string; valor: number } | null;
    atual: number | null;
  }[];
}

/** Resposta do POST /leituras: feedback imediato na tela de confirmação. */
export interface LeituraRegistrada {
  anterior: { competencia: string; valor: number } | null;
  consumo: number | null;
  alerta: AlertaConsumo;
}

export interface TarifaLinha {
  tipo: TipoMedidor;
  valorPorM3: number;
  atualizadoEm: string;
}

/** Um mês do histórico agregado do condomínio. */
export interface HistoricoConsumoMes {
  competencia: string;
  consumoTotal: number;
  /** Com a tarifa vigente; null sem tarifa. */
  valorTotal: number | null;
  unidadesLidas: number;
}

// ----- Conta do gestor (painel) -----

/**
 * O que a tela "Minha conta" mostra sobre quem está logado.
 *
 * `temSenha` é falso para o gestor cadastrado antes da senha existir: é o que
 * deixa a tela pedir só o e-mail em vez de cobrar uma senha atual que ele
 * nunca teve.
 */
export interface MinhaConta {
  nome: string;
  telefone: string;
  email: string | null;
  papel: PapelUsuario | string;
  condominioNome: string;
  temSenha: boolean;
}
