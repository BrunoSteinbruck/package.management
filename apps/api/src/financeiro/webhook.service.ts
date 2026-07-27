import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

/** O recorte do payload do Asaas que interessa. */
interface EventoAsaas {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    externalReference?: string;
    value?: number;
    paymentDate?: string;
    status?: string;
  };
}

/** Eventos que significam "o dinheiro entrou". */
const EVENTOS_PAGOS = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
]);

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Comparação de segredo sem vazar o tamanho pelo tempo de resposta. */
function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Recebe as confirmações de pagamento do provedor.
 *
 * Três coisas fazem este ser o ponto mais delicado do módulo:
 *
 * 1. É PÚBLICO, fora do AuthGuard: quem chama é o provedor, não uma sessão.
 *    A autenticação é o token que ele manda no header, conferido contra o
 *    segredo guardado na integração do condomínio.
 * 2. Não tem tenant. O `externalReference` (`condominioId:cobrancaId`) é o
 *    que revela de quem é a cobrança, e só depois disso dá para abrir a
 *    transação com RLS.
 * 3. Reentrega é normal, não exceção. Provedor reenvia quando não recebe
 *    200, então processar duas vezes tem que ser inofensivo: a linha em
 *    `eventos_webhook_financeiro` (evento_id único) é a trava.
 */
@Injectable()
export class WebhookFinanceiroService {
  private readonly logger = new Logger(WebhookFinanceiroService.name);

  constructor(private readonly prisma: PrismaService) {}

  async receber(token: string | undefined, corpo: EventoAsaas) {
    const referencia = corpo.payment?.externalReference ?? "";
    const [condominioId, cobrancaId] = referencia.split(":");
    // A referência vem de fora e vai virar tenant numa transação: exigir o
    // formato de UUID antes impede que lixo chegue ao `set_config` e derrube
    // a query no cast da policy.
    if (!UUID.test(condominioId ?? "") || !UUID.test(cobrancaId ?? "")) {
      // Sem referência não há o que fazer, e responder 200 evita o provedor
      // reenviar para sempre um evento que nunca vai casar com nada nosso.
      this.logger.warn(`Webhook sem externalReference utilizável: ${referencia}`);
      return { ignorado: true };
    }

    // O tenant sai da referência do payload, e só então dá para ler a
    // integração: `integracoes_financeiras` tem RLS, e uma leitura fora do
    // tenant voltaria null, fazendo todo webhook legítimo ser ignorado.
    const integracao = await this.prisma.withTenant(condominioId, (tx) =>
      tx.integracaoFinanceira.findUnique({ where: { condominioId } }),
    );
    if (!integracao?.ativo) {
      this.logger.warn(`Webhook para condomínio sem integração: ${condominioId}`);
      return { ignorado: true };
    }
    // Falha fechada: sem segredo gravado, ninguém entra. Aceitar o webhook
    // "porque a integração não tem segredo" deixaria qualquer um que
    // descobrisse a URL marcar cobranças como pagas, que é o pior estrago
    // possível aqui. O segredo é gerado ao ligar a integração, então a única
    // forma de faltar é alguém ter mexido no banco à mão.
    if (!integracao.webhookSegredo) {
      this.logger.error(
        `Integração de ${condominioId} sem segredo de webhook: recusando.`,
      );
      throw new UnauthorizedException("Webhook não configurado");
    }
    if (!token || !iguais(token, integracao.webhookSegredo)) {
      throw new UnauthorizedException("Token de webhook inválido");
    }

    // Idempotência: se o evento já entrou, não processa de novo. Quando o
    // provedor não manda id próprio, a chave é a cobrança + tipo do evento,
    // que é o suficiente para "pago" não ser aplicado duas vezes.
    const eventoId = corpo.id ?? `${cobrancaId}:${corpo.event ?? "sem-tipo"}`;
    const existente = await this.prisma.eventoWebhookFinanceiro.findUnique({
      where: { eventoId },
    });
    if (existente?.processadoEm) return { repetido: true };

    await this.prisma.eventoWebhookFinanceiro.upsert({
      where: { eventoId },
      create: {
        eventoId,
        tipo: corpo.event ?? "desconhecido",
        payload: corpo as object,
      },
      update: {},
    });

    try {
      if (EVENTOS_PAGOS.has(corpo.event ?? "")) {
        await this.marcarPaga(condominioId, cobrancaId, corpo);
      }
      await this.prisma.eventoWebhookFinanceiro.update({
        where: { eventoId },
        data: { processadoEm: new Date() },
      });
      return { processado: true };
    } catch (e) {
      // O erro fica gravado: quando alguém disser "paguei e não baixou", a
      // resposta está no banco e não some com o rodízio de log.
      await this.prisma.eventoWebhookFinanceiro.update({
        where: { eventoId },
        data: { erro: (e as Error).message.slice(0, 500) },
      });
      throw e;
    }
  }

  private async marcarPaga(
    condominioId: string,
    cobrancaId: string,
    corpo: EventoAsaas,
  ) {
    await this.prisma.withTenant(condominioId, async (tx) => {
      // updateMany com o status na condição: duas entregas simultâneas do
      // mesmo evento não geram dois recibos, porque a segunda não encontra
      // mais nada para atualizar.
      const { count } = await tx.cobranca.updateMany({
        where: { id: cobrancaId, status: { in: ["PENDENTE", "VENCIDA"] } },
        data: {
          status: "PAGA",
          pagoEm: corpo.payment?.paymentDate
            ? new Date(`${corpo.payment.paymentDate}T00:00:00.000Z`)
            : new Date(),
          valorPago: corpo.payment?.value ?? undefined,
        },
      });
      if (count === 0) return;
      await tx.notificacao.create({
        data: {
          condominioId,
          cobrancaId,
          canal: "PUSH",
          tipo: "COBRANCA_PAGA",
        },
      });
      this.logger.log(`Cobranca ${cobrancaId} baixada como PAGA`);
    });
  }
}
