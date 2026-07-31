import { Injectable, Logger } from "@nestjs/common";

export interface EmailProvider {
  enviar(para: string, assunto: string, texto: string): Promise<void>;
}

/** Sem credencial: loga e segue, como o stub de SMS. */
class StubEmailProvider implements EmailProvider {
  private readonly logger = new Logger("EmailStub");
  async enviar(para: string, assunto: string, texto: string): Promise<void> {
    this.logger.log(`[stub] E-mail para ${para} | ${assunto}\n${texto}`);
  }
}

/**
 * Resend por HTTP, sem SDK.
 *
 * HTTP e não SMTP porque provedores de hospedagem costumam bloquear a porta
 * 587 de saída (o Render bloqueia), e uma dependência a menos é uma
 * atualização a menos para quebrar no build. Trocar de provedor é reescrever
 * esta classe: o resto do sistema só conhece `enviar`.
 */
class ResendProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly remetente: string,
  ) {}

  async enviar(para: string, assunto: string, texto: string): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: this.remetente,
        to: [para],
        subject: assunto,
        text: texto,
      }),
    });
    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      throw new Error(`Resend HTTP ${res.status}: ${detalhe.slice(0, 200)}`);
    }
  }
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: EmailProvider;
  readonly configurado: boolean;

  constructor() {
    const chave = process.env.RESEND_API_KEY;
    const remetente = process.env.EMAIL_REMETENTE;
    if (chave && remetente) {
      this.provider = new ResendProvider(chave, remetente);
      this.configurado = true;
      this.logger.log(`E-mail via Resend configurado (${remetente})`);
    } else {
      this.provider = new StubEmailProvider();
      this.configurado = false;
    }
  }

  enviar(para: string, assunto: string, texto: string): Promise<void> {
    return this.provider.enviar(para, assunto, texto);
  }
}

/**
 * O texto do e-mail de redefinição.
 *
 * Puro e exportado para virar teste: é a única coisa que o gestor lê num
 * momento em que já está com dificuldade de entrar, e o link errado ali é um
 * chamado de suporte garantido.
 *
 * Texto simples, sem HTML: passa em qualquer cliente, não cai em filtro de
 * imagem bloqueada, e não tem como quebrar o link com marcação.
 */
export function textoRedefinicao(nome: string, link: string): string {
  return [
    `Olá, ${nome}.`,
    "",
    "Alguém pediu para redefinir a senha do seu acesso ao painel do Convivar.",
    "Se foi você, use o link abaixo. Ele vale por 1 hora e só funciona uma vez:",
    "",
    link,
    "",
    "Se não foi você, ignore este e-mail: nada muda e sua senha atual continua valendo.",
    "",
    "Convivar",
  ].join("\n");
}
