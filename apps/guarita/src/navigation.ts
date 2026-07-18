import type { Unidade } from "./api/types";

/** Pilha da equipe da portaria (perfil.tipo === "usuario"). */
export type PortariaStackParamList = {
  Home: undefined;
  Armazenados: undefined;
  RetiradasHoje: undefined;
  EntradaCamera: undefined;
  EntradaConfirm: { fotoUri: string | null; codigoRastreio: string | null };
  Retirada: { unidadeInicial?: Unidade } | undefined;
  QrScan: undefined;
  SaidaCamera: { pacoteIds: string[]; unidadeLabel: string };
};

/** Pilha do morador (perfil.tipo === "morador"). */
export type MoradorStackParamList = {
  Home: undefined;
  Qr: { unidadeId: string; rotulo: string; pendentes: number };
  Detalhe: { pacoteId: string };
  MinhaUnidade: { unidadeId: string; rotulo: string; condominio: string };
  Avisos: undefined;
};
