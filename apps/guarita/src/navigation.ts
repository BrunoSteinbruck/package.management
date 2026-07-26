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
  AvisarCamera: undefined;
  AvisarConfirm: { fotoUri: string | null };
};

/**
 * Pilha do síndico.
 *
 * Inclui as rotas da portaria porque síndico de condomínio pequeno opera a
 * portaria de vez em quando, e ele já tinha essas telas quando caía na pilha
 * do porteiro: tirá-las agora seria regressão. O que muda é a home, que passa
 * a ser de gestão, com a portaria como prateleira secundária.
 */
export type SindicoStackParamList = PortariaStackParamList & {
  Ocorrencias: undefined;
  OcorrenciaDetalhe: { avisoId: string };
  Aprovacoes: undefined;
};

/** Pilha do morador (perfil.tipo === "morador"). */
export type MoradorStackParamList = {
  Home: undefined;
  Qr: { unidadeId: string; rotulo: string; pendentes: number };
  Detalhe: { pacoteId: string };
  MinhaUnidade: { unidadeId: string; rotulo: string; condominio: string };
  Avisos: undefined;
  // Sem parâmetro de propósito: a tela carrega as unidades do morador e deixa
  // escolher. Antes vinha a primeira unidade da home, e quem tinha duas não
  // conseguia relatar pela segunda.
  Reportar: undefined;
};
