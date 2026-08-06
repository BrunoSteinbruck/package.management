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
  SaidaCamera: {
    pacoteIds: string[];
    unidadeLabel: string;
    /** Quem recebeu: morador da unidade OU nome livre, nunca os dois. */
    recebidoPorMoradorId?: string;
    recebidoPorNome?: string;
    /**
     * Só para escrever na tela. Existe separado porque `recebidoPorNome` fica
     * vazio quando o recebedor é morador (aí vale a FK), e a legenda da câmera
     * precisa do nome nos dois casos.
     */
    recebedorRotulo?: string;
  };
  // Sem parâmetro: a foto é um campo opcional dentro do formulário, com a
  // câmera embutida, e não um passo anterior a ele.
  Avisar: undefined;
  // Leitura de medidores (água/gás): câmera primeiro, o zelador diz de qual
  // apartamento é na confirmação. `sugestao` é o número lido pelo OCR local.
  Leituras: undefined;
  LeituraCamera: undefined;
  LeituraConfirm: { fotoUri: string | null; sugestao: number | null };
  // Visitas esperadas hoje: a portaria confere e dá baixa na chegada.
  VisitasHoje: undefined;
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
  | "EntradaCamera"
  | "EntradaConfirm"
  | "Retirada"
  | "QrScan"
  | "SaidaCamera"
  | "Leituras"
  | "LeituraCamera"
  | "LeituraConfirm"
> & {
  Ocorrencias: undefined;
  OcorrenciaDetalhe: { avisoId: string };
  Aprovacoes: undefined;
  // As unidades do condomínio e quem está em cada uma: é daqui que sai o
  // convite para quem ainda não baixou o app.
  Unidades: undefined;
  // Porteiros, apoio e outros síndicos: quem opera a portaria.
  Equipe: undefined;
  // Os números do mês da portaria, no mesmo recorte do painel.
  Relatorios: undefined;
  // Cobranças, valor por unidade e conciliação bancária.
  Financeiro: undefined;
  // Painel de consumos: o síndico acompanha e exporta, não registra leitura.
  Consumos: undefined;
  // Comunicados: quem publica é o síndico, então a lista e o compositor
  // existem só nesta pilha. O morador tem a rota de leitura, não a de escrita.
  Comunicados: undefined;
  NovoComunicado: undefined;
  Documentos: undefined;
};

/** Pilha do morador (perfil.tipo === "morador"). */
export type MoradorStackParamList = {
  Home: undefined;
  // A lista de encomendas do morador: pendentes na portaria e histórico. Sem
  // parâmetro porque carrega as unidades dele, como as demais entradas.
  Encomendas: undefined;
  Qr: { unidadeId: string; rotulo: string; pendentes: number };
  Detalhe: { pacoteId: string };
  MinhaUnidade: { unidadeId: string; rotulo: string; condominio: string };
  Avisos: undefined;
  // Sem parâmetro de propósito: a tela carrega as unidades do morador e deixa
  // escolher. Antes vinha a primeira unidade da home, e quem tinha duas não
  // conseguia relatar pela segunda.
  Reportar: undefined;
  // Lista e leitura. A lista sai do feed unificado filtrado; o sino continua
  // abrindo o feed inteiro.
  Comunicados: undefined;
  Comunicado: { comunicadoId: string };
  Documentos: undefined;
  Visitas: undefined;
  NovaVisita: undefined;
  Cobrancas: undefined;
};
