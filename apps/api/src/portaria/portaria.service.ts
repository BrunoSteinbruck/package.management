import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type {
  JwtPayload,
  RegistrarPacoteDto,
  RegistrarRetiradaDto,
} from "@pacotes/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PortariaService {
  constructor(private readonly prisma: PrismaService) {}

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
