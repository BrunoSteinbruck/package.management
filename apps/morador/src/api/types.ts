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

export function rotuloUnidade(u: MinhaUnidade["unidade"]): string {
  return u.bloco ? `${u.identificacao} · Bloco ${u.bloco}` : u.identificacao;
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
