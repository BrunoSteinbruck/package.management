// ----- Comum -----

export interface Unidade {
  id: string;
  bloco: string | null;
  identificacao: string;
}

export function rotuloUnidade(
  u: { bloco: string | null; identificacao: string } | undefined,
): string {
  if (!u) return "—";
  return u.bloco ? `${u.identificacao} · Bloco ${u.bloco}` : u.identificacao;
}

export function diasAtras(iso: string | null): string {
  if (!iso) return "";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

export function diasNaPortaria(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ----- Portaria (equipe) -----

export interface Pacote {
  id: string;
  unidadeId: string;
  transportadora: string | null;
  codigoRastreio: string | null;
  notaFiscal: string | null;
  localArmazenamento: string | null;
  status: "ARMAZENADO" | "ENTREGUE" | "EXTRAVIADO";
  recebidoEm: string;
}

export interface Pendencia {
  unidade: Unidade | undefined;
  pendentes: number;
  maisAntigoEm: string | null;
}

export interface ResultadoRetirada {
  retiradas: unknown[];
  pendentesRestantes: number;
}

export interface PacoteArmazenado extends Pacote {
  unidade: Unidade;
  retirada?: { retiradoEm: string } | null;
}

export interface ListaPacotes {
  total: number;
  pagina: number;
  porPagina: number;
  itens: PacoteArmazenado[];
}

export interface RespostaOcr {
  fotoKey: string;
  extraido: {
    rastreio?: string;
    transportadora?: string;
    bloco?: string;
    identificacao?: string;
  };
  sugestoes: Array<{
    id: string;
    bloco: string | null;
    identificacao: string;
    score: number;
  }>;
}

// ----- Morador -----

export interface PacoteMorador {
  id: string;
  transportadora: string | null;
  codigoRastreio: string | null;
  status: "ARMAZENADO" | "ENTREGUE" | "EXTRAVIADO";
  recebidoEm: string;
  retirada: { retiradoEm: string } | null;
}

export interface MinhaUnidade {
  unidade: {
    id: string;
    bloco: string | null;
    identificacao: string;
    condominio: string;
  };
  pendentes: PacoteMorador[];
  historico: PacoteMorador[];
}

export interface FotoAssinada {
  key: string;
  token: string;
}

export interface DetalhePacote {
  id: string;
  transportadora: string | null;
  codigoRastreio: string | null;
  status: "ARMAZENADO" | "ENTREGUE" | "EXTRAVIADO";
  localArmazenamento: string | null;
  recebidoEm: string;
  recebidoPorNome: string;
  notificadoEm: string | null;
  fotoEntrada: FotoAssinada | null;
  fotoSaida: FotoAssinada | null;
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

export interface AvisoMorador {
  id: string;
  motivo: string;
  descricao: string | null;
  status: "ABERTO" | "EM_ANDAMENTO" | "RESOLVIDO";
  criadoEm: string;
  foto: FotoAssinada | null;
}

export interface OcorrenciaMorador {
  id: string;
  categoria: string;
  descricao: string | null;
  status: "ABERTO" | "EM_ANDAMENTO" | "RESOLVIDO";
  criadoEm: string;
  foto: FotoAssinada | null;
}

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

export function rotuloStatusAviso(s: string): string {
  return s === "ABERTO" ? "Aberto" : s === "EM_ANDAMENTO" ? "Em andamento" : "Resolvido";
}
