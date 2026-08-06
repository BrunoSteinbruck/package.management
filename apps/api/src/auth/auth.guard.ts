import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { JwtPayload } from "@pacotes/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException("Token ausente");
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException("Token inválido ou expirado");
    }
    // Só tokens de SESSÃO abrem rotas. Foto-tokens e QR-tokens são assinados
    // com o mesmo segredo, mas não têm tipo de sessão: barrados aqui.
    if (payload.tipo !== "usuario" && payload.tipo !== "morador") {
      throw new UnauthorizedException("Token não é de sessão");
    }
    // A conta precisa continuar existindo E ativa. O JWT vale 90 dias, e sem
    // esta checagem um token emitido ANTES da exclusão/desativação seguia
    // operando a portaria (code review provou: registro de pacote com 201
    // usando token de conta excluída). Vale também para o porteiro que o
    // síndico desativa no painel. Custo: 1 lookup por PK por request.
    const contaViva =
      payload.tipo === "usuario"
        ? await this.prisma.usuario.count({
            where: { id: payload.sub, ativo: true },
          })
        : await this.prisma.morador.count({ where: { id: payload.sub } });
    if (!contaViva) {
      throw new UnauthorizedException("Conta desativada ou excluída");
    }
    req.user = payload;
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload =>
    ctx.switchToHttp().getRequest().user,
);
