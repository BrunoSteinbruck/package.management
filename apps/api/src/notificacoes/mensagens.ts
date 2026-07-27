import type {
  Aviso,
  Cobranca,
  Comunicado,
  Notificacao,
  Pacote,
  TipoNotificacao,
  Visita,
} from "@prisma/client";

export type NotifComRelacoes = Notificacao & {
  pacote: Pacote | null;
  aviso: Aviso | null;
  comunicado: Comunicado | null;
  visita: Visita | null;
  cobranca: Cobranca | null;
};

/**
 * Para quem a notificação vai. O worker é quem sabe resolver cada uma em
 * tokens; aqui só se declara qual é.
 */
export type Audiencia =
  | "unidadeDoPacote"
  | "unidadeDoAviso"
  | "autorDaOcorrencia"
  | "gestoresDoCondominio"
  /** Moradores com vínculo ativo no condomínio, filtrando pelos blocos alvo. */
  | "moradoresDoComunicado"
  | "unidadeDaVisita"
  | "unidadeDaCobranca"
  /** Criada já como ENVIADA (marcador de dedup), nunca passa pela fila. */
  | "naoEnfileirada";

export interface Despacho {
  audiencia: Audiencia;
  titulo: (n: NotifComRelacoes) => string;
  corpo: (n: NotifComRelacoes) => string;
  data: (n: NotifComRelacoes) => Record<string, unknown>;
  /**
   * O que fazer quando ninguém do outro lado tem o app.
   *
   * `convite-sms` é o motor de adoção (encomenda). `whatsapp` alcança quem
   * não instalou, e só vale para o que o condomínio realmente precisa que
   * chegue: comunicado e cobrança. Aviso de pacote continua em `ignorar` de
   * propósito, porque transformá-lo em mensagem paga destruiria o incentivo
   * de instalar o app, que é como o produto entra no prédio.
   */
  semApp: "convite-sms" | "whatsapp" | "ignorar";
  /** Vai para `providerMsgId` quando ninguém tem app, só para diagnóstico. */
  marcadorSemApp: string;
}

function deQuem(p: Pacote | null): string {
  return p?.transportadora ? ` de ${p.transportadora}` : "";
}

function rotuloStatus(s: string): string {
  return s === "ABERTO" ? "aberto" : "resolvido";
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Competência é DATE: fatia o ISO em vez de converter, para não trocar o mês. */
function mesDaCompetencia(c: { competencia: Date } | null): string {
  if (!c) return "";
  const [, mes] = c.competencia.toISOString().slice(0, 7).split("-");
  return MESES[Number(mes) - 1] ?? "";
}

function dataCurta(d: Date | null | undefined): string {
  if (!d) return "";
  const [, mes, dia] = d.toISOString().slice(0, 10).split("-");
  return `${dia}/${mes}`;
}

function dinheiro(v: unknown): string {
  if (v === null || v === undefined) return "";
  return Number(v).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Prévia do comunicado no push. Corta na primeira quebra de linha antes do
 * limite de caracteres: o síndico costuma abrir com uma frase de resumo, e
 * cortar no meio dela entregaria uma notificação que não diz nada.
 */
function primeiraLinha(corpo: string, max = 140): string {
  const linha = corpo.split("\n")[0].trim();
  return linha.length <= max ? linha : `${linha.slice(0, max - 1).trimEnd()}…`;
}

const NUNCA = () => "";

/**
 * Uma entrada por tipo de notificação. O `Record` sobre o enum do Prisma é o
 * ponto: acrescentar um valor em `TipoNotificacao` quebra a compilação aqui
 * até que se decida o que fazer com ele. Antes isso era um if/else encadeado,
 * onde um tipo novo simplesmente caía no ramo final e sumia.
 */
export const DESPACHOS: Record<TipoNotificacao, Despacho> = {
  ENTRADA: {
    audiencia: "unidadeDoPacote",
    titulo: () => "Encomenda na portaria",
    corpo: (n) => `Sua encomenda${deQuem(n.pacote)} chegou na portaria.`,
    data: (n) => ({ pacoteId: n.pacoteId }),
    // Quem não tem o app não recebe aviso de pacote: recebe o convite para
    // instalar (decisão de produto, com teto de 1 SMS por unidade a cada 14
    // dias imposto pelo próprio registro de Convite).
    semApp: "convite-sms",
    marcadorSemApp: "sem-app",
  },
  RETIRADA: {
    audiencia: "unidadeDoPacote",
    titulo: () => "Encomenda entregue",
    corpo: (n) => `Sua encomenda${deQuem(n.pacote)} foi retirada na portaria.`,
    data: (n) => ({ pacoteId: n.pacoteId }),
    semApp: "ignorar",
    marcadorSemApp: "sem-destinatario",
  },
  AVISO: {
    // Via 1: a equipe avisa a unidade. Sem app não vira SMS, porque o aviso
    // direcionado é contexto do condomínio e não gancho de adoção.
    audiencia: "unidadeDoAviso",
    titulo: () => "Aviso da portaria",
    corpo: (n) =>
      (n.aviso?.motivo ?? "") + (n.aviso?.fotoKey ? " (com foto)" : ""),
    data: (n) => ({ avisoId: n.avisoId }),
    semApp: "ignorar",
    marcadorSemApp: "sem-app",
  },
  OCORRENCIA: {
    // Via 2: mudou o status do que o morador reportou, avisa quem reportou.
    audiencia: "autorDaOcorrencia",
    titulo: () => "Seu relato foi atualizado",
    corpo: (n) =>
      `${n.aviso?.motivo ?? ""}: ${rotuloStatus(n.aviso?.status ?? "")}`,
    data: (n) => ({ avisoId: n.avisoId }),
    semApp: "ignorar",
    marcadorSemApp: "autor-sem-app",
  },
  OCORRENCIA_NOVA: {
    // Via 2 na ida: chegou relato novo, a administração precisa saber sem
    // depender de alguém abrir o painel. Só é entregável desde que Device
    // deixou de ser exclusivo de morador.
    audiencia: "gestoresDoCondominio",
    titulo: () => "Novo relato de morador",
    corpo: (n) => n.aviso?.motivo ?? "Um morador relatou um problema.",
    data: (n) => ({ avisoId: n.avisoId }),
    semApp: "ignorar",
    marcadorSemApp: "gestor-sem-app",
  },
  COMUNICADO: {
    // Broadcast do síndico. Sem app vai por WhatsApp, e não por SMS: no
    // volume de um comunicado a diferença de custo por mensagem é de ordem
    // de grandeza, e comunicado não é gancho de adoção como a encomenda.
    audiencia: "moradoresDoComunicado",
    titulo: (n) => n.comunicado?.titulo ?? "Comunicado do condomínio",
    corpo: (n) => primeiraLinha(n.comunicado?.corpo ?? ""),
    data: (n) => ({ comunicadoId: n.comunicadoId }),
    semApp: "whatsapp",
    marcadorSemApp: "condominio-sem-app",
  },
  VISITA_CHEGOU: {
    // A visita que o morador autorizou está no portão. É o aviso mais
    // sensível ao tempo do produto inteiro: sem app não vira SMS porque o
    // atraso do SMS tornaria o aviso inútil justamente quando ele importa.
    audiencia: "unidadeDaVisita",
    titulo: () => "Sua visita chegou",
    corpo: (n) =>
      `${n.visita?.nomeVisitante ?? "Sua visita"} está na portaria.`,
    data: (n) => ({ visitaId: n.visitaId }),
    semApp: "ignorar",
    marcadorSemApp: "sem-app",
  },
  COBRANCA_GERADA: {
    audiencia: "unidadeDaCobranca",
    titulo: () => "Boleto disponível",
    corpo: (n) =>
      `Taxa de ${mesDaCompetencia(n.cobranca)} · ${dinheiro(n.cobranca?.valor)}, vence ${dataCurta(n.cobranca?.vencimento)}.`,
    data: (n) => ({ cobrancaId: n.cobrancaId }),
    semApp: "whatsapp",
    marcadorSemApp: "sem-app",
  },
  COBRANCA_LEMBRETE: {
    audiencia: "unidadeDaCobranca",
    titulo: () => "Boleto vence em 3 dias",
    corpo: (n) =>
      `Taxa de ${mesDaCompetencia(n.cobranca)} · ${dinheiro(n.cobranca?.valor)}, vence ${dataCurta(n.cobranca?.vencimento)}.`,
    data: (n) => ({ cobrancaId: n.cobrancaId }),
    semApp: "whatsapp",
    marcadorSemApp: "sem-app",
  },
  COBRANCA_VENCIDA: {
    // Informa, não cobra: quem decide como resolver é o morador, e tom de
    // cobrança num push é o que faz desinstalar o app.
    audiencia: "unidadeDaCobranca",
    titulo: () => "Boleto vencido",
    corpo: (n) =>
      `A taxa de ${mesDaCompetencia(n.cobranca)} venceu em ${dataCurta(n.cobranca?.vencimento)}. A segunda via está no app.`,
    data: (n) => ({ cobrancaId: n.cobrancaId }),
    semApp: "whatsapp",
    marcadorSemApp: "sem-app",
  },
  COBRANCA_PAGA: {
    audiencia: "unidadeDaCobranca",
    titulo: () => "Pagamento confirmado",
    corpo: (n) =>
      `Recebemos a taxa de ${mesDaCompetencia(n.cobranca)}. Obrigado!`,
    data: (n) => ({ cobrancaId: n.cobrancaId }),
    semApp: "ignorar",
    marcadorSemApp: "sem-app",
  },
  LEMBRETE: {
    // O push de lembrete sai agrupado por unidade no passo diário; a linha de
    // Notificacao existe só como marcador de dedup, já em ENVIADA.
    audiencia: "naoEnfileirada",
    titulo: NUNCA,
    corpo: NUNCA,
    data: () => ({}),
    semApp: "ignorar",
    marcadorSemApp: "nao-enfileirada",
  },
  CONVITE: {
    // Convite de adoção sai por SMS dentro do fluxo de ENTRADA, sem linha
    // própria na fila de push.
    audiencia: "naoEnfileirada",
    titulo: NUNCA,
    corpo: NUNCA,
    data: () => ({}),
    semApp: "ignorar",
    marcadorSemApp: "nao-enfileirada",
  },
};
