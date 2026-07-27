import type {
  CategoriaDocumento,
  ModuloCondominio,
  PapelUsuario,
  StatusAviso,
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
 * Fica fora do JWT de propósito: o token vale 30 dias, e módulo ligado pelo
 * síndico precisa aparecer na próxima abertura do app, não no próximo login.
 *
 * Para o morador é a união dos módulos dos condomínios onde ele tem vínculo
 * ativo. Quem mora em dois prédios vê o menu do que qualquer um dos dois
 * oferece; a autorização de cada rota continua sendo do servidor, esta lista
 * só decide o que a home mostra.
 */
export interface Capacidades {
  modulos: ModuloCondominio[];
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
  retirada: { retiradoEm: string } | null;
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
  papel: PapelUsuario | string;
  ativo: boolean;
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
