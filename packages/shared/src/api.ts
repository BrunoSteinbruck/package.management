import type { PapelUsuario, StatusAviso, StatusPacote } from "./enums";

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
