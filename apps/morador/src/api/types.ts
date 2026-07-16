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

export interface DetalhePacote {
  id: string;
  transportadora: string | null;
  codigoRastreio: string | null;
  status: "ARMAZENADO" | "ENTREGUE" | "EXTRAVIADO";
  localArmazenamento: string | null;
  recebidoEm: string;
  recebidoPorNome: string;
  notificadoEm: string | null;
  fotoEntradaKey: string | null;
  fotoSaidaKey: string | null;
  retiradoEm: string | null;
  entreguePorNome: string | null;
}

export interface Vinculado {
  nome: string;
  telefone: string;
  titular: boolean;
  voce: boolean;
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
