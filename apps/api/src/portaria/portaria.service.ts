import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type {
  JwtPayload,
  RegistrarPacoteDto,
  RegistrarRetiradaDto,
  ResolverQrDto,
} from "@pacotes/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { QrPayload } from "../morador/morador.service";

@Injectable()
export class PortariaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private tenantDe(user: JwtPayload): string {
    if (user.tipo !== "usuario" || !user.condominioId) {
      throw new ForbiddenException("Apenas operadores do condomínio");
    }
    return user.condominioId;
  }

  registrarEntrada(user: JwtPayload, dto: RegistrarPacoteDto) {
    const condominioId = this.tenantDe(user);
    return this.prisma.withTenant(condominioId, async (tx) => {
      const pacote = await tx.pacote.create({
        data: {
          condominioId,
          unidadeId: dto.unidadeId,
          transportadora: dto.transportadora,
          codigoRastreio: dto.codigoRastreio,
          notaFiscal: dto.notaFiscal,
          fotoEntradaKey: dto.fotoEntradaKey,
          localArmazenamento: dto.localArmazenamento,
          recebidoPorId: user.sub,
        },
      });
      await tx.notificacao.create({
        data: {
          condominioId,
          pacoteId: pacote.id,
          canal: "PUSH",
          tipo: "ENTRADA",
        },
      });
      return pacote;
    });
  }

  pendentesDaUnidade(user: JwtPayload, unidadeId: string) {
    const condominioId = this.tenantDe(user);
    return this.prisma.withTenant(condominioId, (tx) =>
      tx.pacote.findMany({
        where: { unidadeId, status: "ARMAZENADO" },
        orderBy: { recebidoEm: "asc" },
      }),
    );
  }

  registrarRetirada(user: JwtPayload, dto: RegistrarRetiradaDto) {
    const condominioId = this.tenantDe(user);
    return this.prisma.withTenant(condominioId, async (tx) => {
      const pacotes = await tx.pacote.findMany({
        where: { id: { in: dto.pacoteIds } },
      });
      if (pacotes.length !== dto.pacoteIds.length) {
        throw new BadRequestException("Pacote não encontrado neste condomínio");
      }
      const jaEntregue = pacotes.find((p) => p.status !== "ARMAZENADO");
      if (jaEntregue) {
        throw new BadRequestException(
          `Pacote ${jaEntregue.id} não está mais armazenado`,
        );
      }

      const retiradas = [];
      for (const pacote of pacotes) {
        retiradas.push(
          await tx.retirada.create({
            data: {
              condominioId,
              pacoteId: pacote.id,
              entreguePorId: user.sub,
              fotoSaidaKey: dto.fotoSaidaKey,
            },
          }),
        );
        await tx.pacote.update({
          where: { id: pacote.id },
          data: { status: "ENTREGUE" },
        });
        await tx.notificacao.create({
          data: {
            condominioId,
            pacoteId: pacote.id,
            canal: "PUSH",
            tipo: "RETIRADA",
          },
        });
      }
      return { retiradas, pendentesRestantes: await this.contarPendentes(tx, pacotes[0].unidadeId) };
    });
  }

  private async contarPendentes(
    tx: Parameters<Parameters<PrismaService["withTenant"]>[1]>[0],
    unidadeId: string,
  ) {
    return tx.pacote.count({ where: { unidadeId, status: "ARMAZENADO" } });
  }

  async resolverQr(user: JwtPayload, dto: ResolverQrDto) {
    const condominioId = this.tenantDe(user);
    let payload: QrPayload;
    try {
      payload = await this.jwt.verifyAsync<QrPayload>(dto.qrToken);
    } catch {
      throw new BadRequestException("QR inválido ou expirado — peça para atualizar a tela");
    }
    if (payload.tipo !== "qr-retirada" || payload.condominioId !== condominioId) {
      throw new BadRequestException("QR não pertence a este condomínio");
    }
    return this.prisma.withTenant(condominioId, async (tx) => {
      const unidade = await tx.unidade.findUnique({
        where: { id: payload.unidadeId },
      });
      if (!unidade) throw new BadRequestException("Unidade não encontrada");
      return unidade;
    });
  }

  /** Números da home da portaria: estoque atual, retiradas de hoje, paradas 3+ dias. */
  resumo(user: JwtPayload) {
    const condominioId = this.tenantDe(user);
    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);
    const tresDiasAtras = new Date(Date.now() - 3 * 86_400_000);
    return this.prisma.withTenant(condominioId, async (tx) => ({
      naPortaria: await tx.pacote.count({ where: { status: "ARMAZENADO" } }),
      retiradasHoje: await tx.retirada.count({
        where: { retiradoEm: { gte: inicioDoDia } },
      }),
      paradas3Dias: await tx.pacote.count({
        where: { status: "ARMAZENADO", recebidoEm: { lte: tresDiasAtras } },
      }),
    }));
  }

  pendencias(user: JwtPayload) {
    const condominioId = this.tenantDe(user);
    return this.prisma.withTenant(condominioId, async (tx) => {
      const grupos = await tx.pacote.groupBy({
        by: ["unidadeId"],
        where: { status: "ARMAZENADO" },
        _count: { id: true },
        _min: { recebidoEm: true },
      });
      const unidades = await tx.unidade.findMany({
        where: { id: { in: grupos.map((g) => g.unidadeId) } },
      });
      const porId = new Map(unidades.map((u) => [u.id, u]));
      return grupos
        .map((g) => ({
          unidade: porId.get(g.unidadeId),
          pendentes: g._count.id,
          maisAntigoEm: g._min.recebidoEm,
        }))
        .sort((a, b) => b.pendentes - a.pendentes);
    });
  }
}
