export interface Unidade {
  id: string;
  bloco: string | null;
  identificacao: string;
}

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

export function rotuloUnidade(u: Unidade | undefined): string {
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
