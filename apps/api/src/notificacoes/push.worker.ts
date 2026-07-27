import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { gerarCodigoConvite } from "../common/convite.util";
import { PrismaService } from "../prisma/prisma.service";
import { SmsService } from "../sms/sms.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import {
  DESPACHOS,
  type Audiencia,
  type NotifComRelacoes,
} from "./mensagens";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const INTERVALO_MS = 15_000;
// Convite de adoção: no máximo 1 SMS por unidade a cada 14 dias, disparado
// quando chega encomenda para unidade SEM app. Decisão de produto: quem não
// tem o app NÃO recebe aviso de pacote: recebe o convite para instalar.
const CONVITE_SMS_TTL_MS = 14 * 24 * 60 * 60 * 1000;
// Lembrete de pacote parado: pacote ARMAZENADO há 3+ dias gera 1 push por
// unidade (agrupado). Decisão de produto: SÓ push, SÓ para quem tem o app,
// não-adotante não recebe nada (segue só o convite SMS de 14 dias na entrada).
const LEMBRETE_DIAS = 3;
const LEMBRETE_INTERVALO_MS = 20 * 60 * 60 * 1000; // roda no máx. 1x/~dia
// Documento do visitante (dado de terceiro) é apagado depois deste prazo.
// A linha da visita permanece: ver expurgarDocumentosDeVisita.
const DOC_VISITA_DIAS = 90;

/** Token que não é do Expo não vai para a API do Expo. */
function apenasExpo(devices: Array<{ pushToken: string }>): string[] {
  return devices
    .map((d) => d.pushToken)
    .filter((t) => /^ExponentPushToken\[.+\]$/.test(t));
}

/**
 * Worker simples por polling (dev). Em produção vira consumidor BullMQ.
 * Processa Notificacao FILA/PUSH: resolve os devices dos moradores com
 * vínculo ativo na unidade do pacote e envia via Expo Push.
 * TODO(fase 2): batching por unidade (N pacotes → 1 mensagem) e canal
 * WhatsApp como fallback quando a unidade não tem device.
 */
@Injectable()
export class PushWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private rodando = false;
  private ultimoLembrete = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  onModuleInit() {
    if (process.env.PUSH_WORKER_DESLIGADO === "1") return;
    this.timer = setInterval(() => void this.processarTudo(), INTERVALO_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async processarTudo() {
    if (this.rodando) return;
    this.rodando = true;
    try {
      const condominios = await this.prisma.condominio.findMany({
        select: { id: true, nome: true },
      });
      for (const condominio of condominios) {
        await this.processarCondominio(condominio);
      }

      // Passo diário: lembretes de pacotes parados há 3+ dias e expurgo do
      // documento de visitante.
      if (Date.now() - this.ultimoLembrete >= LEMBRETE_INTERVALO_MS) {
        this.ultimoLembrete = Date.now();
        for (const condominio of condominios) {
          await this.lembretesDoCondominio(condominio.id);
          await this.expurgarDocumentosDeVisita(condominio.id);
          await this.reguaDeCobranca(condominio.id);
        }
      }
    } catch (e) {
      this.logger.error(`Falha no ciclo de push: ${(e as Error).message}`);
    } finally {
      this.rodando = false;
    }
  }

  private async processarCondominio(condominio: { id: string; nome: string }) {
    const condominioId = condominio.id;
    const notificacoes = await this.prisma.withTenant(condominioId, (tx) =>
      tx.notificacao.findMany({
        where: { status: "FILA", canal: "PUSH" },
        take: 20,
        orderBy: { criadoEm: "asc" },
        include: {
          pacote: true,
          aviso: true,
          comunicado: true,
          visita: true,
          cobranca: true,
        },
      }),
    );

    for (const notif of notificacoes) {
      const despacho = DESPACHOS[notif.tipo];
      const tokens = await this.tokensDa(despacho.audiencia, notif);

      let novoStatus: "ENVIADA" | "FALHA" = "FALHA";
      let providerMsgId: string | undefined;
      let canal: "PUSH" | "WHATSAPP" | undefined;

      if (tokens === null) {
        // Relação esperada ausente (ou tipo que nunca deveria entrar na fila).
        providerMsgId = "sem-alvo";
      } else {
        if (tokens.length > 0) {
          const r = await this.enviarExpo(
            tokens,
            despacho.titulo(notif),
            despacho.corpo(notif),
            despacho.data(notif),
          );
          if (r.ok) {
            novoStatus = "ENVIADA";
            providerMsgId = r.ticketId;
          } else providerMsgId = r.erro?.slice(0, 180);
        }

        // O WhatsApp NÃO é alternativa ao push: é complemento, e roda mesmo
        // quando alguém já recebeu por push.
        //
        // A diferença aparece no comunicado do condomínio, onde parte dos
        // moradores tem o app e parte não. Tratar como "ou um, ou outro"
        // fazia um único vizinho com o app instalado silenciar o aviso para
        // todos os outros. Quem escolhe o destinatário certo é a consulta
        // do fallback, que só devolve morador SEM device: ninguém recebe a
        // mesma coisa duas vezes.
        if (despacho.semApp === "whatsapp") {
          const r = await this.fallbackWhatsapp(condominio, notif, despacho);
          if (tokens.length === 0) {
            providerMsgId = r.marca;
            // Sem push mas com WhatsApp entregue, a notificação saiu: marcar
            // FALHA diria que ninguém foi avisado, o que não é verdade. O
            // canal só vira WHATSAPP aqui, quando ele foi o único caminho:
            // com push também entregue, a linha continua PUSH. A decisão usa
            // a CONTAGEM devolvida, não o texto da marca: a heurística de
            // prefixo confundia "whatsapp-desligado" com envio feito.
            if (r.enviados > 0) {
              novoStatus = "ENVIADA";
              canal = "WHATSAPP";
            }
          }
        } else if (tokens.length === 0) {
          providerMsgId =
            despacho.semApp === "convite-sms" && notif.pacote
              ? await this.enviarConviteSms(condominio, notif.pacote.unidadeId)
              : despacho.marcadorSemApp;
        }
      }

      await this.prisma.withTenant(condominioId, (tx) =>
        tx.notificacao.update({
          where: { id: notif.id },
          data: { status: novoStatus, providerMsgId, ...(canal ? { canal } : {}) },
        }),
      );
    }
  }

  /**
   * Traduz a audiência declarada no registry em tokens. `null` significa que
   * a notificação não tem alvo resolvível: a relação que ela deveria carregar
   * está ausente, ou o tipo não pertence a esta fila.
   */
  private async tokensDa(
    audiencia: Audiencia,
    notif: NotifComRelacoes,
  ): Promise<string[] | null> {
    switch (audiencia) {
      case "unidadeDoPacote":
        return notif.pacote
          ? this.tokensDaUnidade(notif.pacote.unidadeId)
          : null;
      case "unidadeDoAviso":
        return notif.aviso ? this.tokensDaUnidade(notif.aviso.unidadeId) : null;
      case "autorDaOcorrencia":
        return notif.aviso?.criadoPorMoradorId
          ? this.tokensDoMorador(notif.aviso.criadoPorMoradorId)
          : null;
      case "gestoresDoCondominio":
        return this.tokensDosGestores(notif.condominioId);
      case "moradoresDoComunicado":
        return notif.comunicado
          ? this.tokensDoCondominio(notif.condominioId, notif.comunicado.blocos)
          : null;
      case "unidadeDaVisita":
        return notif.visita ? this.tokensDaUnidade(notif.visita.unidadeId) : null;
      case "unidadeDaCobranca":
        return notif.cobranca
          ? this.tokensDaUnidade(notif.cobranca.unidadeId)
          : null;
      case "naoEnfileirada":
        return null;
    }
  }

  /**
   * Tokens dos moradores do condomínio, filtrando pelos blocos alvo (lista
   * vazia = prédio inteiro).
   *
   * Uma linha de Notificacao cobre o broadcast inteiro e os tokens são
   * resolvidos no envio, como nas demais audiências: gravar uma linha por
   * morador transformaria cada comunicado em centenas de linhas de fila para
   * dizer a mesma coisa.
   */
  private async tokensDoCondominio(
    condominioId: string,
    blocos: string[],
  ): Promise<string[]> {
    const unidades = await this.prisma.withTenant(condominioId, (tx) =>
      tx.unidade.findMany({
        where: blocos.length > 0 ? { bloco: { in: blocos } } : {},
        select: { id: true },
      }),
    );
    if (unidades.length === 0) return [];
    const vinculos = await this.prisma.vinculo.findMany({
      where: { unidadeId: { in: unidades.map((u) => u.id) }, status: "ATIVO" },
      select: { moradorId: true },
    });
    if (vinculos.length === 0) return [];
    const devices = await this.prisma.device.findMany({
      where: { moradorId: { in: vinculos.map((v) => v.moradorId) } },
    });
    // Dedup: um morador com duas unidades no mesmo bloco alvo apareceria duas
    // vezes e receberia o push duplicado.
    return [...new Set(apenasExpo(devices))];
  }

  /** Tokens Expo válidos de um morador específico (destinatário de OCORRENCIA). */
  private async tokensDoMorador(moradorId: string): Promise<string[]> {
    const devices = await this.prisma.device.findMany({ where: { moradorId } });
    return apenasExpo(devices);
  }

  /** Tokens Expo válidos das unidades (moradores com vínculo ativo + device). */
  private async tokensDaUnidade(unidadeId: string): Promise<string[]> {
    const vinculos = await this.prisma.vinculo.findMany({
      where: { unidadeId, status: "ATIVO" },
      select: { moradorId: true },
    });
    const devices = await this.prisma.device.findMany({
      where: { moradorId: { in: vinculos.map((v) => v.moradorId) } },
    });
    return apenasExpo(devices);
  }

  /** Tokens Expo dos gestores ativos do condomínio (síndico e admin). */
  private async tokensDosGestores(condominioId: string): Promise<string[]> {
    const gestores = await this.prisma.usuario.findMany({
      where: { condominioId, ativo: true, papel: { in: ["SINDICO", "ADMIN"] } },
      select: { id: true },
    });
    if (gestores.length === 0) return [];
    const devices = await this.prisma.device.findMany({
      where: { usuarioId: { in: gestores.map((g) => g.id) } },
    });
    return apenasExpo(devices);
  }

  /**
   * Lembrete de pacotes parados há 3+ dias: 1 push por unidade (agrupando os
   * pacotes), só para quem tem app. Dedup: cada pacote lembrado ganha uma
   * Notificacao LEMBRETE: sem novo lembrete enquanto ele existir. Unidade sem
   * app não é marcada, então se o morador instalar depois, recebe no próximo dia.
   */
  private async lembretesDoCondominio(condominioId: string) {
    const limite = new Date(Date.now() - LEMBRETE_DIAS * 24 * 60 * 60 * 1000);
    const parados = await this.prisma.withTenant(condominioId, (tx) =>
      tx.pacote.findMany({
        where: {
          status: "ARMAZENADO",
          recebidoEm: { lte: limite },
          notificacoes: { none: { tipo: "LEMBRETE" } },
        },
        select: { id: true, unidadeId: true, recebidoEm: true },
      }),
    );
    if (parados.length === 0) return;

    // Agrupa por unidade.
    const porUnidade = new Map<string, typeof parados>();
    for (const p of parados) {
      const lista = porUnidade.get(p.unidadeId) ?? [];
      lista.push(p);
      porUnidade.set(p.unidadeId, lista);
    }

    for (const [unidadeId, pacotes] of porUnidade) {
      const tokens = await this.tokensDaUnidade(unidadeId);
      if (tokens.length === 0) continue; // sem app: nada (decisão de produto)

      const n = pacotes.length;
      const maisAntigo = pacotes.reduce(
        (min, p) => Math.min(min, p.recebidoEm.getTime()),
        Date.now(),
      );
      const dias = Math.floor((Date.now() - maisAntigo) / 86_400_000);
      const resultado = await this.enviarExpo(
        tokens,
        n === 1 ? "Encomenda na portaria" : "Encomendas na portaria",
        // Só informa. Sem "passe para retirar" e sem tom de cobrança: quem
        // decide quando buscar é o morador.
        n === 1
          ? `Sua encomenda está na portaria há ${dias} dias.`
          : `Você tem ${n} encomendas na portaria, a mais antiga há ${dias} dias.`,
        { tipo: "lembrete", unidadeId },
      );

      // Marca cada pacote como lembrado (dedup) só se enviou de fato.
      if (resultado.ok) {
        await this.prisma.withTenant(condominioId, async (tx) => {
          for (const p of pacotes) {
            await tx.notificacao.create({
              data: {
                condominioId,
                pacoteId: p.id,
                canal: "PUSH",
                tipo: "LEMBRETE",
                status: "ENVIADA",
                providerMsgId: resultado.ticketId,
              },
            });
          }
        });
        this.logger.log(`Lembrete: ${n} pacote(s) parados, unidade ${unidadeId}`);
      }
    }
  }

  /**
   * Alcança quem não instalou o app, por WhatsApp.
   *
   * Três portas, todas fechadas por padrão, e todas necessárias:
   *  1. o condomínio contratou o módulo (`whatsapp` nos módulos);
   *  2. o morador deu opt-in (`aceitaWhatsapp`), que é o consentimento LGPD;
   *  3. o tipo do aviso é um dos que valem a mensagem paga (`semApp`).
   *
   * O canal muda na linha de Notificacao, então o histórico registra por onde
   * cada aviso saiu, e não fica parecendo push entregue.
   */
  private async fallbackWhatsapp(
    condominio: { id: string; nome: string },
    notif: NotifComRelacoes,
    despacho: { titulo: (n: NotifComRelacoes) => string; corpo: (n: NotifComRelacoes) => string },
  ): Promise<{ marca: string; enviados: number }> {
    const cond = await this.prisma.condominio.findUnique({
      where: { id: condominio.id },
      select: { modulos: true },
    });
    if (!cond?.modulos.includes("whatsapp")) {
      return { marca: "whatsapp-desligado", enviados: 0 };
    }

    const unidadeId =
      notif.cobranca?.unidadeId ?? notif.visita?.unidadeId ?? null;
    const moradores = await this.destinatariosSemApp(
      condominio.id,
      unidadeId,
      notif.comunicado?.blocos ?? null,
    );
    if (moradores.length === 0) {
      return { marca: "sem-destinatario-whatsapp", enviados: 0 };
    }

    let enviados = 0;
    for (const m of moradores) {
      const ok = await this.whatsapp.enviar(m.telefone, notif.tipo, [
        condominio.nome,
        despacho.titulo(notif),
        despacho.corpo(notif),
      ]);
      if (ok) enviados++;
    }
    if (enviados > 0) {
      this.logger.log(`WhatsApp: ${enviados} envio(s) para quem não tem o app`);
    }
    return { marca: `whatsapp-${enviados}`, enviados };
  }

  /**
   * Moradores com opt-in e SEM device: quem já tem o app recebeu push e não
   * pode receber a mesma coisa duas vezes.
   */
  private async destinatariosSemApp(
    condominioId: string,
    unidadeId: string | null,
    blocos: string[] | null,
  ): Promise<Array<{ telefone: string }>> {
    const unidades = await this.prisma.withTenant(condominioId, (tx) =>
      tx.unidade.findMany({
        where: unidadeId
          ? { id: unidadeId }
          : blocos && blocos.length > 0
            ? { bloco: { in: blocos } }
            : {},
        select: { id: true },
      }),
    );
    if (unidades.length === 0) return [];
    const vinculos = await this.prisma.vinculo.findMany({
      where: { unidadeId: { in: unidades.map((u) => u.id) }, status: "ATIVO" },
      select: { moradorId: true },
    });
    if (vinculos.length === 0) return [];
    return this.prisma.morador.findMany({
      where: {
        id: { in: [...new Set(vinculos.map((v) => v.moradorId))] },
        aceitaWhatsapp: true,
        devices: { none: {} },
      },
      select: { telefone: true },
    });
  }

  /**
   * Régua de cobrança: lembra 3 dias antes e avisa no dia seguinte ao
   * vencimento, marcando a cobrança como VENCIDA.
   *
   * Dedup pela própria linha de Notificacao, como no lembrete de pacote: uma
   * cobrança que já tem COBRANCA_LEMBRETE não recebe outro. Sem isso, cada
   * ciclo do worker mandaria o mesmo push de novo, que num aviso sobre
   * dinheiro é o caminho mais curto para o morador desligar as notificações.
   *
   * Só roda com a régua ligada na configuração do condomínio.
   */
  private async reguaDeCobranca(condominioId: string) {
    // Dentro do tenant: `config_financeiro` tem RLS, e ler fora devolveria
    // null, o que desligaria a régua em silêncio para todo mundo.
    const cfg = await this.prisma.withTenant(condominioId, (tx) =>
      tx.configFinanceiro.findUnique({ where: { condominioId } }),
    );
    if (!cfg?.reguaAtiva) return;

    const hoje = new Date().toISOString().slice(0, 10);
    const daquiATres = new Date(Date.now() + 3 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    await this.prisma.withTenant(condominioId, async (tx) => {
      const aVencer = await tx.cobranca.findMany({
        where: {
          status: "PENDENTE",
          vencimento: new Date(`${daquiATres}T00:00:00.000Z`),
          notificacoes: { none: { tipo: "COBRANCA_LEMBRETE" } },
        },
        select: { id: true },
      });
      for (const c of aVencer) {
        await tx.notificacao.create({
          data: {
            condominioId,
            cobrancaId: c.id,
            canal: "PUSH",
            tipo: "COBRANCA_LEMBRETE",
          },
        });
      }

      // Venceu ontem ou antes e continua em aberto: marca VENCIDA e avisa
      // uma vez só.
      const vencidas = await tx.cobranca.findMany({
        where: {
          status: "PENDENTE",
          vencimento: { lt: new Date(`${hoje}T00:00:00.000Z`) },
        },
        select: { id: true, notificacoes: { where: { tipo: "COBRANCA_VENCIDA" } } },
      });
      for (const c of vencidas) {
        await tx.cobranca.update({
          where: { id: c.id },
          data: { status: "VENCIDA" },
        });
        if (c.notificacoes.length === 0) {
          await tx.notificacao.create({
            data: {
              condominioId,
              cobrancaId: c.id,
              canal: "PUSH",
              tipo: "COBRANCA_VENCIDA",
            },
          });
        }
      }

      if (aVencer.length || vencidas.length) {
        this.logger.log(
          `Régua: ${aVencer.length} lembrete(s), ${vencidas.length} vencida(s)`,
        );
      }
    });
  }

  /**
   * Minimização de dado de terceiro (LGPD): o documento do visitante é
   * apagado depois de DOC_VISITA_DIAS.
   *
   * O visitante não é usuário do sistema e não consentiu com nada; o número
   * do documento serve para o porteiro conferir quem está na frente dele
   * naquele dia, e perde a finalidade assim que a visita passa. A LINHA da
   * visita fica: quem entrou no prédio e quando é registro do condomínio,
   * como a cadeia de custódia das encomendas. Só o identificador some.
   */
  private async expurgarDocumentosDeVisita(condominioId: string) {
    const limite = new Date(Date.now() - DOC_VISITA_DIAS * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.withTenant(condominioId, (tx) =>
      tx.visita.updateMany({
        where: { dataPrevista: { lt: limite }, documento: { not: null } },
        data: { documento: null },
      }),
    );
    if (count > 0) {
      this.logger.log(`Expurgo LGPD: documento de ${count} visita(s) apagado`);
    }
  }

  /**
   * Convite de adoção para unidade sem app. O registro na tabela Convite É o
   * rate-limit: enquanto existir um convite SMS não expirado (14 dias) para a
   * unidade, nenhum novo SMS sai. Vai para o titular (vínculo mais antigo).
   */
  private async enviarConviteSms(
    condominio: { id: string; nome: string },
    unidadeId: string,
  ): Promise<string> {
    if (!this.sms.configurado) return "sem-app";
    const recente = await this.prisma.convite.findFirst({
      where: { unidadeId, canal: "SMS", expiraEm: { gt: new Date() } },
    });
    if (recente) return "sem-app-convite-recente";

    const titular = await this.prisma.vinculo.findFirst({
      where: { unidadeId, status: "ATIVO" },
      orderBy: { criadoEm: "asc" },
      include: { morador: true },
    });
    if (!titular) return "sem-morador";

    const unidade = await this.prisma.withTenant(condominio.id, (tx) =>
      tx.unidade.findUnique({ where: { id: unidadeId } }),
    );
    const rotulo = unidade
      ? unidade.bloco
        ? `${unidade.bloco}-${unidade.identificacao}`
        : unidade.identificacao
      : "sua unidade";

    // Registra ANTES de enviar: mesmo se o envio falhar, segura a janela de
    // 14 dias (evita rajada de tentativas a cada pacote novo).
    await this.prisma.convite.create({
      data: {
        condominioId: condominio.id,
        unidadeId,
        codigo: gerarCodigoConvite(),
        canal: "SMS",
        expiraEm: new Date(Date.now() + CONVITE_SMS_TTL_MS),
      },
    });

    const link = process.env.APP_DOWNLOAD_URL
      ? ` Baixe: ${process.env.APP_DOWNLOAD_URL}`
      : "";
    try {
      // Sem acentos de propósito: mantém o SMS em codificação GSM-7
      // (160 chars/segmento em vez de 70): metade do custo por envio.
      await this.sms.enviar(
        titular.morador.telefone,
        `Guarita: chegou uma encomenda para ${rotulo} na portaria do ${condominio.nome}. Com o app voce e avisado assim que a proxima chegar.${link}`,
      );
      this.logger.log(`Convite SMS enviado para unidade ${rotulo}`);
      return "sem-app-convite-enviado";
    } catch (e) {
      this.logger.warn(`Convite SMS falhou: ${(e as Error).message.slice(0, 80)}`);
      return "sem-app-convite-falhou";
    }
  }

  private async enviarExpo(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, unknown>,
  ): Promise<{ ok: boolean; ticketId?: string; erro?: string }> {
    // DEV ONLY: simula entrega bem-sucedida (loga em vez de enviar), para
    // testar o pipeline completo (marcadores, dedup, agrupamento) sem um
    // aparelho real com token Expo. Nunca ligar em produção.
    if (process.env.PUSH_DEV_SIMULAR === "1") {
      this.logger.log(`[push simulado] "${title}" → ${tokens.length} device(s): ${body}`);
      return { ok: true, ticketId: "simulado" };
    }
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tokens.map((to) => ({ to, title, body, data }))),
      });
      const json = (await res.json()) as {
        data?: Array<{ status: string; id?: string; message?: string }>;
      };
      const tickets = json.data ?? [];
      const okTicket = tickets.find((t) => t.status === "ok");
      if (okTicket) return { ok: true, ticketId: okTicket.id };
      return { ok: false, erro: tickets[0]?.message ?? "sem-ticket" };
    } catch (e) {
      return { ok: false, erro: (e as Error).message };
    }
  }
}
