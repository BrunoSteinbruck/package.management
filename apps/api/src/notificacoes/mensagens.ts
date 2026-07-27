import type {
  Aviso,
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
  /** Criada já como ENVIADA (marcador de dedup), nunca passa pela fila. */
  | "naoEnfileirada";

export interface Despacho {
  audiencia: Audiencia;
  titulo: (n: NotifComRelacoes) => string;
  corpo: (n: NotifComRelacoes) => string;
  data: (n: NotifComRelacoes) => Record<string, unknown>;
  /** Sem nenhum device do outro lado: manda convite por SMS ou desiste. */
  semApp: "convite-sms" | "ignorar";
  /** Vai para `providerMsgId` quando ninguém tem app, só para diagnóstico. */
  marcadorSemApp: string;
}

function deQuem(p: Pacote | null): string {
  return p?.transportadora ? ` de ${p.transportadora}` : "";
}

function rotuloStatus(s: string): string {
  return s === "ABERTO" ? "aberto" : "resolvido";
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
    // Broadcast do síndico. Sem app não vira SMS: comunicado não é gancho de
    // adoção e o volume tornaria o custo por envio imprevisível. Alcançar
    // quem não instalou é o trabalho do canal WhatsApp, na Onda 4.
    audiencia: "moradoresDoComunicado",
    titulo: (n) => n.comunicado?.titulo ?? "Comunicado do condomínio",
    corpo: (n) => primeiraLinha(n.comunicado?.corpo ?? ""),
    data: (n) => ({ comunicadoId: n.comunicadoId }),
    semApp: "ignorar",
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
