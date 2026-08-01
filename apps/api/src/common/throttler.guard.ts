import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request } from "express";

/**
 * Quem é "o mesmo cliente" para o limite de requisições.
 *
 * Por padrão o throttler conta por IP, e só isso deixaria um buraco na porta
 * de senha: o bloqueio de 5 erros é POR CONTA, então quem soubesse o e-mail
 * do síndico poderia mantê-lo trancado para fora errando a senha de 15 em 15
 * minutos, de qualquer lugar. Contando também pelo alvo, o atacante gasta o
 * próprio balde antes de conseguir manter o bloqueio de pé.
 *
 * Nas demais rotas a chave continua sendo só o IP: elas não têm um "alvo" no
 * corpo, e inventar um daria a um atacante o poder de trocar de balde só
 * mudando um campo.
 */
@Injectable()
export class ChaveDeAlvoGuard extends ThrottlerGuard {
  private static readonly ROTAS_COM_ALVO: Record<string, string> = {
    "/v1/auth/senha/login": "identificador",
    "/v1/auth/otp/verify": "telefone",
    "/v1/auth/senha/esqueci": "email",
  };

  protected async getTracker(req: Request): Promise<string> {
    const ip = req.ip ?? "sem-ip";
    const campo = ChaveDeAlvoGuard.ROTAS_COM_ALVO[req.path];
    if (!campo) return ip;
    // O body-parser é middleware do Express e roda antes do roteamento do
    // Nest, então o corpo já está aqui.
    const corpo = req.body as Record<string, unknown> | undefined;
    const alvo = corpo?.[campo];
    return typeof alvo === "string" && alvo.length > 0
      ? `${ip}|${alvo.toLowerCase().slice(0, 120)}`
      : ip;
  }

  /**
   * A mensagem padrão é "ThrottlerException: Too Many Requests", que o painel
   * mostraria literalmente para um síndico. Quem esbarra aqui quase sempre é
   * gente legítima com pressa, então a frase diz o que fazer em vez de nomear
   * a exceção da biblioteca.
   */
  protected async throwThrottlingException(): Promise<void> {
    throw new HttpException(
      "Muitas tentativas seguidas. Espere um minuto e tente de novo.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
