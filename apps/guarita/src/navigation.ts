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
  // Sem parâmetro: a foto é um campo opcional dentro do formulário, com a
  // câmera embutida, e não um passo anterior a ele.
  Avisar: undefined;
};

/**
 * Pilha do síndico.
 *
 * O síndico não movimenta encomenda: nem registra entrada nem faz entrega.
 * Ele acompanha, então fica só com as telas de leitura (`Armazenados` e
 * `RetiradasHoje`) mais o que é dele, gestão e aviso.
 *
 * As rotas de movimentação saem do tipo, e não só do manifesto, para que
 * declará-las para o síndico pare de compilar em vez de depender de
 * disciplina.
 */
export type SindicoStackParamList = Omit<
  PortariaStackParamList,
  "EntradaCamera" | "EntradaConfirm" | "Retirada" | "QrScan" | "SaidaCamera"
> & {
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
