import { Injectable, Logger } from "@nestjs/common";

/**
 * Canal WhatsApp: alcança quem ainda não instalou o app.
 *
 * Mesmo desenho de `SmsProvider`, e por trás da mesma interface, porque a
 * escolha de fornecedor aqui é reversível: Twilio hoje porque a conta e o
 * código REST já existem e o sandbox destrava o desenvolvimento antes da
 * verificação do Meta; Cloud API direto no dia em que o volume pagar a
 * infraestrutura própria (WABA, tokens, ciclo de templates).
 *
 * Mensagem iniciada pela empresa exige TEMPLATE aprovado pelo Meta: não dá
 * para mandar texto livre. Por isso a interface fala em `template` e
 * `variaveis`, e não em corpo pronto.
 */
export interface WhatsAppProvider {
  enviar(telefone: string, template: string, variaveis: string[]): Promise<void>;
  readonly real: boolean;
}

/** Sem credencial: loga o que teria mandado. */
class StubWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger("WhatsAppStub");
  readonly real = false;

  async enviar(
    telefone: string,
    template: string,
    variaveis: string[],
  ): Promise<void> {
    this.logger.log(
      `[stub] WhatsApp para +55${telefone} · ${template}: ${variaveis.join(" | ")}`,
    );
  }
}

/**
 * Twilio WhatsApp via REST, sem SDK, como o SMS.
 *
 * `ContentSid` + `ContentVariables` é o caminho de template aprovado. O
 * sandbox aceita os templates de teste sem verificação de negócio, o que
 * deixa este código ser exercitado antes de a LTDA existir.
 */
class TwilioWhatsAppProvider implements WhatsAppProvider {
  readonly real = true;

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly remetente: string,
  ) {}

  async enviar(
    telefone: string,
    template: string,
    variaveis: string[],
  ): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const corpo = new URLSearchParams({
      To: `whatsapp:+55${telefone}`,
      From: `whatsapp:${this.remetente}`,
      ContentSid: template,
      ContentVariables: JSON.stringify(
        Object.fromEntries(variaveis.map((v, i) => [String(i + 1), v])),
      ),
    });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization:
          "Basic " +
          Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64"),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: corpo.toString(),
    });
    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      throw new Error(`Twilio WhatsApp HTTP ${res.status}: ${detalhe.slice(0, 200)}`);
    }
  }
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly provider: WhatsAppProvider;
  /** Templates aprovados, por tipo de aviso. */
  private readonly templates: Record<string, string>;

  constructor() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;
    this.templates = {
      COMUNICADO: process.env.WHATSAPP_TEMPLATE_COMUNICADO ?? "",
      COBRANCA_GERADA: process.env.WHATSAPP_TEMPLATE_COBRANCA ?? "",
      COBRANCA_LEMBRETE: process.env.WHATSAPP_TEMPLATE_COBRANCA ?? "",
      COBRANCA_VENCIDA: process.env.WHATSAPP_TEMPLATE_COBRANCA ?? "",
    };
    if (sid && token && from) {
      this.provider = new TwilioWhatsAppProvider(sid, token, from);
      this.logger.log("WhatsApp via Twilio");
    } else {
      this.provider = new StubWhatsAppProvider();
      this.logger.warn(
        "TWILIO_WHATSAPP_FROM ausente: WhatsApp em STUB (nada e enviado). Exige verificacao do Meta Business, que pede CNPJ.",
      );
    }
  }

  get real(): boolean {
    return this.provider.real;
  }

  /**
   * Envia se houver template configurado para o tipo. Sem template, não
   * inventa texto livre: o Meta recusaria e a mensagem viraria erro em vez
   * de aviso.
   */
  async enviar(
    telefone: string,
    tipo: string,
    variaveis: string[],
  ): Promise<boolean> {
    const template = this.templates[tipo];
    if (this.provider.real && !template) {
      this.logger.warn(`Sem template aprovado para ${tipo}: nada enviado`);
      return false;
    }
    try {
      await this.provider.enviar(telefone, template || `stub:${tipo}`, variaveis);
      return true;
    } catch (e) {
      this.logger.warn(
        `WhatsApp falhou (${tipo}): ${(e as Error).message.slice(0, 120)}`,
      );
      return false;
    }
  }
}
