import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const INTERVALO_MS = 15_000;

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

  constructor(private readonly prisma: PrismaService) {}

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
        select: { id: true },
      });
      for (const { id } of condominios) {
        await this.processarCondominio(id);
      }
    } catch (e) {
      this.logger.error(`Falha no ciclo de push: ${(e as Error).message}`);
    } finally {
      this.rodando = false;
    }
  }

  private async processarCondominio(condominioId: string) {
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
          providerMsgId = "sem-destinatario";
          // TODO(fase 2): acionar fallback WhatsApp/SMS de convite aqui.
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
