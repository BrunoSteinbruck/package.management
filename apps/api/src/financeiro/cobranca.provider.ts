import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

/**
 * O que o produto precisa de um provedor de cobrança, e nada além.
 *
 * Interface estreita de propósito: o dia em que o Asaas deixar de servir, o
 * que se reescreve é uma classe, não o módulo. Mesmo desenho de `SmsProvider`.
 */
export interface CobrancaProvider {
  /**
   * Garante o cliente (pagador) na subconta e devolve o id dele.
   *
   * Existe porque não se emite boleto no vazio: o provedor precisa saber em
   * nome de quem cobrar, com nome e CPF/CNPJ. Quem chama guarda o id
   * devolvido, para a próxima geração reusar em vez de duplicar a pessoa.
   */
  garantirCliente(entrada: EntradaCliente): Promise<string>;
  /** Cria a cobrança e devolve o que o morador usa para pagar. */
  criar(entrada: EntradaCobranca): Promise<SaidaCobranca>;
  cancelar(apiKey: string, provedorCobrancaId: string): Promise<void>;
  readonly nome: string;
  /** Falso quando roda em stub: nada de verdade é cobrado. */
  readonly real: boolean;
}

export interface EntradaCliente {
  apiKey: string;
  nome: string;
  /** Só dígitos. O provedor recusa documento inválido. */
  cpfCnpj: string;
  email?: string;
  /** Nossa referência (unidadeId): ajuda a reconciliar do lado do provedor. */
  referenciaExterna: string;
}

export interface EntradaCobranca {
  apiKey: string;
  /** Identifica a unidade no provedor (cliente da subconta). */
  clienteExternoId: string;
  valor: number;
  vencimento: string;
  descricao: string;
  /** `condominioId:cobrancaId`: é por aqui que o webhook acha o tenant. */
  referenciaExterna: string;
}

export interface SaidaCobranca {
  provedorCobrancaId: string;
  linhaDigitavel: string | null;
  urlBoleto: string | null;
  pixCopiaCola: string | null;
}

/**
 * Sem credencial: finge que cobrou e diz isso em alto e bom som.
 *
 * Existe para o módulo inteiro ser exercitável (geração, régua, baixa,
 * inadimplência) sem conta no provedor, como o SMS e o OCR já fazem. O que
 * ele NÃO faz é cobrar alguém: os identificadores são visivelmente falsos,
 * para ninguém confundir tela de teste com boleto emitido.
 */
class StubCobrancaProvider implements CobrancaProvider {
  private readonly logger = new Logger("CobrancaStub");
  readonly nome = "stub";
  readonly real = false;

  async garantirCliente(entrada: EntradaCliente): Promise<string> {
    this.logger.warn(
      `[stub] Cliente NAO criado de verdade: ${entrada.nome} (${entrada.referenciaExterna})`,
    );
    return `stub_cli_${randomUUID()}`;
  }

  async criar(entrada: EntradaCobranca): Promise<SaidaCobranca> {
    this.logger.warn(
      `[stub] Cobranca NAO emitida de verdade: R$ ${entrada.valor.toFixed(2)} venc. ${entrada.vencimento} (${entrada.referenciaExterna})`,
    );
    return {
      provedorCobrancaId: `stub_${randomUUID()}`,
      linhaDigitavel: "00000.00000 00000.000000 00000.000000 0 00000000000000",
      urlBoleto: null,
      pixCopiaCola: null,
    };
  }

  async cancelar(): Promise<void> {
    this.logger.warn("[stub] Cancelamento de cobranca simulado");
  }
}

interface RespostaAsaas {
  id: string;
  identificationField?: string;
  bankSlipUrl?: string;
  invoiceUrl?: string;
}

/**
 * Asaas via REST.
 *
 * Escolhido porque é subconta por condomínio: a cobrança liquida na conta do
 * próprio condomínio (no CNPJ dele), e não na nossa. Provedores de conta
 * única (Cora, Inter, Efí) fariam a receita de terceiros passar pelo nosso
 * caixa, que é custódia de fundos e outro negócio.
 *
 * A `apiKey` vem por chamada, não por construtor: é a chave da SUBCONTA do
 * condomínio, e cada requisição pertence a um tenant diferente.
 */
class AsaasProvider implements CobrancaProvider {
  private readonly logger = new Logger("Asaas");
  readonly nome = "asaas";
  readonly real = true;

  constructor(private readonly base: string) {}

  private async chamar<T>(
    apiKey: string,
    caminho: string,
    init: RequestInit,
  ): Promise<T> {
    const res = await fetch(`${this.base}${caminho}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        access_token: apiKey,
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      // A chave nunca entra na mensagem de erro: ela vai para o log, que vai
      // para o Sentry.
      throw new Error(`Asaas HTTP ${res.status}: ${detalhe.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  /**
   * Cria o cliente na subconta. O Asaas PERMITE duplicata (documentado por
   * eles), então quem chama é responsável por guardar o id: por isso este
   * método devolve o id em vez de ser chamado a cada cobrança.
   */
  async garantirCliente(entrada: EntradaCliente): Promise<string> {
    const r = await this.chamar<{ id: string }>(entrada.apiKey, "/customers", {
      method: "POST",
      body: JSON.stringify({
        name: entrada.nome,
        cpfCnpj: entrada.cpfCnpj,
        ...(entrada.email ? { email: entrada.email } : {}),
        externalReference: entrada.referenciaExterna,
        // O condomínio não notifica pelo Asaas: quem avisa o morador é o
        // nosso push (e o WhatsApp, quando ligado). Sem isto o pagador
        // receberia dois avisos da mesma cobrança, de remetentes diferentes.
        notificationDisabled: true,
      }),
    });
    this.logger.log(`Cliente ${r.id} criado para ${entrada.referenciaExterna}`);
    return r.id;
  }

  async criar(entrada: EntradaCobranca): Promise<SaidaCobranca> {
    const r = await this.chamar<RespostaAsaas>(entrada.apiKey, "/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: entrada.clienteExternoId,
        // Boleto híbrido: o morador escolhe pagar no código de barras ou no
        // PIX, com uma cobrança só.
        billingType: "BOLETO",
        value: entrada.valor,
        dueDate: entrada.vencimento,
        description: entrada.descricao,
        externalReference: entrada.referenciaExterna,
      }),
    });
    return {
      provedorCobrancaId: r.id,
      linhaDigitavel: r.identificationField ?? null,
      urlBoleto: r.bankSlipUrl ?? r.invoiceUrl ?? null,
      pixCopiaCola: await this.pixCopiaCola(entrada.apiKey, r.id),
    };
  }

  /**
   * O código PIX vem numa chamada separada: o POST /payments não o devolve.
   *
   * Falha em silêncio de propósito. Sem PIX o morador ainda paga pelo código
   * de barras ou pela página do boleto, e derrubar a geração do mês inteiro
   * porque a conta do condomínio não tem chave PIX habilitada seria uma
   * troca ruim.
   */
  private async pixCopiaCola(
    apiKey: string,
    pagamentoId: string,
  ): Promise<string | null> {
    try {
      const r = await this.chamar<{ payload?: string }>(
        apiKey,
        `/payments/${pagamentoId}/pixQrCode`,
        { method: "GET" },
      );
      return r.payload ?? null;
    } catch (e) {
      this.logger.warn(
        `PIX indisponivel para ${pagamentoId}: ${(e as Error).message.slice(0, 120)}`,
      );
      return null;
    }
  }

  async cancelar(apiKey: string, provedorCobrancaId: string): Promise<void> {
    await this.chamar(apiKey, `/payments/${provedorCobrancaId}`, {
      method: "DELETE",
    });
    this.logger.log(`Cobranca ${provedorCobrancaId} cancelada`);
  }
}

@Injectable()
export class CobrancaProviderService {
  private readonly logger = new Logger(CobrancaProviderService.name);
  readonly provider: CobrancaProvider;

  constructor() {
    const base = process.env.ASAAS_API_URL;
    if (base) {
      this.provider = new AsaasProvider(base.replace(/\/$/, ""));
      this.logger.log(`Cobranca via Asaas (${base})`);
    } else {
      this.provider = new StubCobrancaProvider();
      this.logger.warn(
        "ASAAS_API_URL ausente: cobranca em STUB (nada e emitido de verdade). Use https://api-sandbox.asaas.com/v3 para testar.",
      );
    }
  }

  get real(): boolean {
    return this.provider.real;
  }
}
