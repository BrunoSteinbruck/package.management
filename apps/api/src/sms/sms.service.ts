import { Injectable, Logger } from "@nestjs/common";

export interface SmsProvider {
  enviar(telefone: string, mensagem: string): Promise<void>;
}

/** Sem credencial configurada: loga e segue (o OTP já sai no log em dev). */
class StubSmsProvider implements SmsProvider {
  private readonly logger = new Logger("SmsStub");
  async enviar(telefone: string, mensagem: string): Promise<void> {
    this.logger.log(`[stub] SMS para +55${telefone}: ${mensagem}`);
  }
}

/**
 * Twilio via REST (sem SDK). Conta trial envia só para números verificados,
 * suficiente para o piloto começar; produção remove essa limitação.
 */
class TwilioProvider implements SmsProvider {
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly remetente: string,
  ) {}

  async enviar(telefone: string, mensagem: string): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const corpo = new URLSearchParams({
      To: `+55${telefone}`,
      From: this.remetente,
      Body: mensagem,
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
      throw new Error(`Twilio HTTP ${res.status}: ${detalhe.slice(0, 200)}`);
    }
  }
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: SmsProvider;
  readonly configurado: boolean;

  constructor() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;
    if (sid && token && from) {
      this.provider = new TwilioProvider(sid, token, from);
      this.configurado = true;
      this.logger.log("SMS via Twilio configurado");
    } else {
      this.provider = new StubSmsProvider();
      this.configurado = false;
    }
  }

  enviar(telefone: string, mensagem: string): Promise<void> {
    return this.provider.enviar(telefone, mensagem);
  }
}
