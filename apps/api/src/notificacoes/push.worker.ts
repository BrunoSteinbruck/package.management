import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { gerarCodigoConvite } from "../common/convite.util";
import { PrismaService } from "../prisma/prisma.service";
import { SmsService } from "../sms/sms.service";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const INTERVALO_MS = 15_000;
// Convite de adoção: no máximo 1 SMS por unidade a cada 14 dias, disparado
// quando chega encomenda para unidade SEM app. Decisão de produto: quem não
// tem o app NÃO recebe aviso de pacote — recebe o convite para instalar.
const CONVITE_SMS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
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
        include: { pacote: true },
      }),
    );

    for (const notif of notificacoes) {
      let novoStatus: "ENVIADA" | "FALHA" = "FALHA";
      let providerMsgId: string | undefined;

      if (notif.pacote) {
        const vinculos = await this.prisma.vinculo.findMany({
          where: { unidadeId: notif.pacote.unidadeId, status: "ATIVO" },
          select: { moradorId: true },
        });
        const devices = await this.prisma.device.findMany({
          where: { moradorId: { in: vinculos.map((v) => v.moradorId) } },
        });

        // Só tokens no formato Expo — evita mandar lixo pra API de push.
        const tokensValidos = devices
          .map((d) => d.pushToken)
          .filter((t) => /^ExponentPushToken\[.+\]$/.test(t));

        if (tokensValidos.length === 0) {
          // Unidade sem app: aviso de pacote não vai (decisão de produto) —
          // vai o convite de adoção, com teto de 1 SMS/unidade a cada 14 dias.
          providerMsgId =
            notif.tipo === "ENTRADA"
              ? await this.enviarConviteSms(condominio, notif.pacote.unidadeId)
              : "sem-destinatario";
        } else {
          const resultado = await this.enviarExpo(
            tokensValidos,
            notif.tipo === "ENTRADA"
              ? "Encomenda na portaria"
              : "Encomenda entregue",
            this.corpo(notif.tipo, notif.pacote.transportadora),
            { pacoteId: notif.pacoteId },
          );
          if (resultado.ok) {
            novoStatus = "ENVIADA";
            providerMsgId = resultado.ticketId;
          } else {
            providerMsgId = resultado.erro?.slice(0, 180);
          }
        }
      } else {
        providerMsgId = "sem-pacote";
      }

      await this.prisma.withTenant(condominioId, (tx) =>
        tx.notificacao.update({
          where: { id: notif.id },
          data: { status: novoStatus, providerMsgId },
        }),
      );
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
      // (160 chars/segmento em vez de 70) — metade do custo por envio.
      await this.sms.enviar(
        titular.morador.telefone,
        `Guarita: um pacote chegou para ${rotulo} na portaria do ${condominio.nome}! Baixe o app Guarita e receba estes avisos na hora, sempre que chegar encomenda.${link}`,
      );
      this.logger.log(`Convite SMS enviado para unidade ${rotulo}`);
      return "sem-app-convite-enviado";
    } catch (e) {
      this.logger.warn(`Convite SMS falhou: ${(e as Error).message.slice(0, 80)}`);
      return "sem-app-convite-falhou";
    }
  }

  private corpo(tipo: string, transportadora: string | null): string {
    const de = transportadora ? ` de ${transportadora}` : "";
    return tipo === "ENTRADA"
      ? `Sua encomenda${de} chegou na portaria.`
      : `Sua encomenda${de} foi retirada na portaria.`;
  }

  private async enviarExpo(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, unknown>,
  ): Promise<{ ok: boolean; ticketId?: string; erro?: string }> {
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
