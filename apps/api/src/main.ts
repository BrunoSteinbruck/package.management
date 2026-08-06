// Sentry primeiro: só instrumenta o que é carregado depois dele.
import "./instrument";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";
import { diagnosticoDeSubida } from "./financeiro/cripto.util";

/**
 * Teto do corpo JSON.
 *
 * O padrão do Express é 100 KB, e isso tornava a conciliação bancária
 * inutilizável: `ImportarExtratoSchema` aceita 2 MB de OFX, mas um extrato de
 * 900 lançamentos (136 KB, um mês comum) morria com 413 antes de chegar ao
 * zod. O limite fica um pouco acima do teto do schema para a mensagem de erro
 * vir do nosso validador, que diz o que está errado, e não do body-parser.
 *
 * Foto e PDF não passam por aqui: são multipart, com limite próprio no
 * interceptor de cada upload (10 MB e 20 MB).
 */
const LIMITE_JSON = "3mb";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.useBodyParser("json", { limit: LIMITE_JSON });
  app.useBodyParser("urlencoded", { limit: LIMITE_JSON, extended: true });
  app.setGlobalPrefix("v1");

  /**
   * Confia no primeiro salto do proxy para ler o IP real do cliente.
   *
   * Em produção a API fica atrás do proxy da hospedagem, e sem isto TODA
   * requisição chega com o IP dele: os limites por IP virariam um balde único
   * para o mundo inteiro, e o primeiro usuário a estourá-lo derrubaria todos
   * os outros. Também conserta o rate limit de envio de OTP, que já lia o IP.
   *
   * O `1` é o número de saltos confiáveis, e não um booleano por um motivo:
   * confiar no cabeçalho inteiro deixaria qualquer um forjar o próprio IP e
   * escapar de todos os limites trocando um header.
   */
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // CORS: aberto em dev; em produção só as origens explicitamente listadas
  // (apps nativos não enviam Origin: isto afeta apenas navegadores/painel).
  const origins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length > 0 ? origins : process.env.NODE_ENV === "production" ? false : true,
  });

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });

  // Checagem de configuração ANTES do listen: um processo que não pode fazer
  // o que promete não deve começar a aceitar requisição.
  const cripto = diagnosticoDeSubida();
  if (cripto.nivel === "fatal") {
    console.error(`Configuração inválida: ${cripto.mensagem}`);
    process.exit(1);
  }
  if (cripto.nivel === "aviso") {
    console.warn(`Atenção: ${cripto.mensagem}`);
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API rodando em http://localhost:${port}/v1`);
}

bootstrap();
