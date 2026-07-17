import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { JwtPayload } from "@pacotes/shared";
import { createHmac, randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_TENTATIVAS = 5;
// Rate limit de ENVIO: protege contra SMS pumping (abuso vira conta de SMS).
// Em memória por processo — TODO(produção multi-instância): mover para Redis.
const JANELA_ENVIO_MS = 60 * 60 * 1000;
const MAX_ENVIOS_POR_TELEFONE = 3;
const MAX_ENVIOS_POR_IP = 10;

// HMAC com o segredo do servidor: um dump do banco sozinho não permite
// derivar códigos válidos (o espaço de 6 dígitos é pequeno demais para
// hash puro). Lido em tempo de chamada para respeitar o .env do Config.
function hash(codigo: string) {
  return createHmac("sha256", process.env.JWT_SECRET || "dev-secret")
    .update(codigo)
    .digest("hex");
}

@Injectable()
export class AuthService {
  private enviosPorChave = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private registrarEnvio(chave: string, maximo: number): boolean {
    const agora = Date.now();
    const recentes = (this.enviosPorChave.get(chave) ?? []).filter(
      (t) => agora - t < JANELA_ENVIO_MS,
    );
    if (recentes.length >= maximo) return false;
    recentes.push(agora);
    this.enviosPorChave.set(chave, recentes);
    return true;
  }

  async requestOtp(telefone: string, ip?: string) {
    const dentroDoLimite =
      this.registrarEnvio(`tel:${telefone}`, MAX_ENVIOS_POR_TELEFONE) &&
      (!ip || this.registrarEnvio(`ip:${ip}`, MAX_ENVIOS_POR_IP));
    if (!dentroDoLimite) {
      throw new HttpException(
        "Muitos códigos solicitados. Tente novamente em até 1 hora.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const codigo = randomInt(100000, 999999).toString();
    await this.prisma.otpChallenge.upsert({
      where: { telefone },
      create: {
        telefone,
        codigoHash: hash(codigo),
        expiraEm: new Date(Date.now() + OTP_TTL_MS),
      },
      update: {
        codigoHash: hash(codigo),
        expiraEm: new Date(Date.now() + OTP_TTL_MS),
        tentativas: 0,
      },
    });

    // TODO(etapa 5): enviar via provedor de SMS.
    // O código só é ecoado na resposta com opt-in EXPLÍCITO (OTP_DEV_ECHO=1):
    // depender de NODE_ENV seria takeover de conta num deploy mal configurado.
    if (process.env.OTP_DEV_ECHO === "1") {
      console.log(`[dev] OTP para ${telefone}: ${codigo}`);
      return { enviado: true, devCodigo: codigo };
    }
    return { enviado: true };
  }

  async verifyOtp(
    telefone: string,
    codigo: string,
    extra?: { nome?: string; convite?: string },
  ) {
    const challenge = await this.prisma.otpChallenge.findUnique({
      where: { telefone },
    });
    if (!challenge || challenge.expiraEm < new Date()) {
      throw new UnauthorizedException("Código expirado, solicite outro");
    }
    if (challenge.tentativas >= MAX_TENTATIVAS) {
      throw new UnauthorizedException("Muitas tentativas, solicite outro código");
    }
    if (challenge.codigoHash !== hash(codigo)) {
      await this.prisma.otpChallenge.update({
        where: { telefone },
        data: { tentativas: { increment: 1 } },
      });
      throw new UnauthorizedException("Código incorreto");
    }

    const encerrar = () =>
      this.prisma.otpChallenge.delete({ where: { telefone } });

    const usuario = await this.prisma.usuario.findFirst({
      where: { telefone, ativo: true },
      include: { condominio: true },
    });
    if (usuario) {
      await encerrar();
      const payload: JwtPayload = {
        sub: usuario.id,
        tipo: "usuario",
        nome: usuario.nome,
        condominioId: usuario.condominioId,
        condominioNome: usuario.condominio.nome,
        papel: usuario.papel,
      };
      return { token: await this.jwt.signAsync(payload), perfil: payload };
    }

    const morador = await this.prisma.morador.findUnique({
      where: { telefone },
    });
    if (morador) {
      await encerrar();
      const payload: JwtPayload = {
        sub: morador.id,
        tipo: "morador",
        nome: morador.nome,
      };
      return { token: await this.jwt.signAsync(payload), perfil: payload };
    }

    if (extra?.convite) {
      try {
        const novo = await this.registrarPorConvite(
          telefone,
          extra.convite,
          extra.nome,
        );
        await encerrar();
        return novo;
      } catch (e) {
        // Convite inválido consome tentativa do challenge: impede varredura
        // de códigos de convite reutilizando o mesmo OTP válido.
        await this.prisma.otpChallenge.update({
          where: { telefone },
          data: { tentativas: { increment: 1 } },
        });
        throw e;
      }
    }

    // Mantém o challenge vivo: o app coleta nome + convite e verifica de novo
    // com o mesmo código (passo "Unidade" do onboarding).
    throw new NotFoundException(
      "Telefone não cadastrado. Peça um convite a um morador da sua unidade.",
    );
  }

  private async registrarPorConvite(
    telefone: string,
    codigoConvite: string,
    nome?: string,
  ) {
    if (!nome || nome.trim().length < 2) {
      throw new UnauthorizedException("Informe seu nome para usar o convite");
    }
    const convite = await this.prisma.convite.findUnique({
      where: { codigo: codigoConvite.toUpperCase().trim() },
    });
    if (
      !convite ||
      convite.usadoEm !== null ||
      convite.expiraEm < new Date() ||
      !convite.unidadeId
    ) {
      throw new UnauthorizedException("Convite inválido ou expirado");
    }

    const morador = await this.prisma.$transaction(async (tx) => {
      const criado = await tx.morador.create({
        data: { nome: nome.trim(), telefone },
      });
      await tx.vinculo.create({
        data: {
          moradorId: criado.id,
          unidadeId: convite.unidadeId!,
          condominioId: convite.condominioId,
          status: "ATIVO",
        },
      });
      await tx.convite.update({
        where: { id: convite.id },
        data: { usadoEm: new Date() },
      });
      return criado;
    });

    const payload: JwtPayload = {
      sub: morador.id,
      tipo: "morador",
      nome: morador.nome,
    };
    return { token: await this.jwt.signAsync(payload), perfil: payload };
  }

  /**
   * Renovação silenciosa: token válido → token novo com validade cheia.
   * O app chama ao abrir; assim o OTP só acontece em device novo ou
   * app abandonado por mais de 30 dias.
   */
  async refresh(user: JwtPayload) {
    const { exp, iat, ...payload } = user as JwtPayload & {
      exp?: number;
      iat?: number;
    };
    return { token: await this.jwt.signAsync(payload), perfil: payload };
  }
}
