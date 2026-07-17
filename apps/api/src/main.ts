import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("v1");

  // CORS: aberto em dev; em produção só as origens explicitamente listadas
  // (apps nativos não enviam Origin — isto afeta apenas navegadores/painel).
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

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API rodando em http://localhost:${port}/v1`);
}

bootstrap();
