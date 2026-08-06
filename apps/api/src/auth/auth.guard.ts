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
import { sessaoRevogada } from "./sessao.util";

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
    // `iat` vem do próprio JWT e não é declarado no `JwtPayload` do shared,
    // que descreve o que NÓS assinamos. Aqui ele é lido para a revogação.
    let payload: JwtPayload & { iat?: number };
    try {
      payload = await this.jwt.verifyAsync<JwtPayload & { iat?: number }>(token);
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
    //
    // O mesmo lookup traz o corte de revogação: era um `count`, virou um
    // `findUnique` com um campo, então a checagem de sessão revogada não
    // custa uma segunda ida ao banco.
    const conta =
      payload.tipo === "usuario"
        ? await this.prisma.usuario.findFirst({
            where: { id: payload.sub, ativo: true },
            select: { sessoesValidasApos: true },
          })
        : await this.prisma.morador.findUnique({
            where: { id: payload.sub },
            select: { sessoesValidasApos: true },
          });
    if (!conta) {
      throw new UnauthorizedException("Conta desativada ou excluída");
    }
    // Trocar a senha, redefinir a senha ou pedir para sair dos outros
    // aparelhos carimba a data. Todo token anterior morre aqui.
    if (sessaoRevogada(payload.iat, conta.sessoesValidasApos)) {
      throw new UnauthorizedException("Sessão encerrada em outro aparelho");
    }
    req.user = payload;
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload =>
    ctx.switchToHttp().getRequest().user,
);
