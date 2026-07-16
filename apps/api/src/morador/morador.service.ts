import { ForbiddenException, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type {
  EmitirQrDto,
  JwtPayload,
  RegistrarDeviceDto,
} from "@pacotes/shared";
import { PrismaService } from "../prisma/prisma.service";

export interface QrPayload {
  tipo: "qr-retirada";
  sub: string;
  unidadeId: string;
  condominioId: string;
}

@Injectable()
export class MoradorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private exigirMorador(user: JwtPayload): string {
    if (user.tipo !== "morador") {
      throw new ForbiddenException("Apenas moradores");
    }
    return user.sub;
  }

  async meusPacotes(user: JwtPayload) {
    const moradorId = this.exigirMorador(user);
    // Vinculos são globais; unidades/pacotes têm RLS. O condominioId
    // denormalizado no vínculo permite abrir a transação com o tenant certo.
    const vinculos = await this.prisma.vinculo.findMany({
      where: { moradorId, status: "ATIVO" },
    });
    const condominios = await this.prisma.condominio.findMany({
      where: { id: { in: [...new Set(vinculos.map((v) => v.condominioId))] } },
    });
    const nomeCondominio = new Map(condominios.map((c) => [c.id, c.nome]));

    const resultado = [];
    for (const vinculo of vinculos) {
      const { unidade, pacotes } = await this.prisma.withTenant(
        vinculo.condominioId,
        async (tx) => ({
          unidade: await tx.unidade.findUnique({ where: { id: vinculo.unidadeId } }),
          pacotes: await tx.pacote.findMany({
            where: { unidadeId: vinculo.unidadeId },
            orderBy: { recebidoEm: "desc" },
            take: 50,
            include: { retirada: true },
          }),
        }),
      );
      if (!unidade) continue;
      resultado.push({
        unidade: {
          id: unidade.id,
          bloco: unidade.bloco,
          identificacao: unidade.identificacao,
          condominio: nomeCondominio.get(vinculo.condominioId) ?? "",
        },
        pendentes: pacotes.filter((p) => p.status === "ARMAZENADO"),
        historico: pacotes.filter((p) => p.status !== "ARMAZENADO"),
      });
    }
    return resultado;
  }

  async registrarDevice(user: JwtPayload, dto: RegistrarDeviceDto) {
    const moradorId = this.exigirMorador(user);
    await this.prisma.device.upsert({
      where: { pushToken: dto.pushToken },
      create: { moradorId, pushToken: dto.pushToken, plataforma: dto.plataforma },
      update: { moradorId, ultimoUso: new Date() },
    });
    return { registrado: true };
  }

  async emitirQr(user: JwtPayload, dto: EmitirQrDto) {
    const moradorId = this.exigirMorador(user);
    const vinculo = await this.prisma.vinculo.findFirst({
      where: { moradorId, unidadeId: dto.unidadeId, status: "ATIVO" },
    });
    if (!vinculo) {
      throw new ForbiddenException("Você não tem vínculo ativo com esta unidade");
    }
    const payload: QrPayload = {
      tipo: "qr-retirada",
      sub: moradorId,
      unidadeId: vinculo.unidadeId,
      condominioId: vinculo.condominioId,
    };
    const qrToken = await this.jwt.signAsync(payload, { expiresIn: "90s" });
    return { qrToken, expiraEmSegundos: 90 };
  }
}
