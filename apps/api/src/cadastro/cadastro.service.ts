import { ForbiddenException, Injectable } from "@nestjs/common";
import type { CriarUnidadesDto, JwtPayload } from "@pacotes/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CadastroService {
  constructor(private readonly prisma: PrismaService) {}

  private tenantDe(user: JwtPayload): string {
    if (user.tipo !== "usuario" || !user.condominioId) {
      throw new ForbiddenException("Apenas operadores do condomínio");
    }
    return user.condominioId;
  }

  private exigirGestor(user: JwtPayload) {
    if (user.papel !== "SINDICO" && user.papel !== "ADMIN") {
      throw new ForbiddenException("Apenas síndico ou admin");
    }
  }

  listarUnidades(user: JwtPayload) {
    const condominioId = this.tenantDe(user);
    return this.prisma.withTenant(condominioId, (tx) =>
      tx.unidade.findMany({ orderBy: [{ bloco: "asc" }, { identificacao: "asc" }] }),
    );
  }

  criarUnidades(user: JwtPayload, dto: CriarUnidadesDto) {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    return this.prisma.withTenant(condominioId, (tx) =>
      tx.unidade.createMany({
        data: dto.unidades.map((u) => ({ ...u, condominioId })),
        skipDuplicates: true,
      }),
    );
  }

  async vinculosPendentes(user: JwtPayload) {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    // Vinculo/Morador são globais; o filtro de tenant vem da unidade.
    return this.prisma.vinculo.findMany({
      where: { status: "PENDENTE", unidade: { condominioId } },
      include: { morador: true, unidade: true },
      orderBy: { criadoEm: "asc" },
    });
  }

  async aprovarVinculo(user: JwtPayload, vinculoId: string) {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    const { count } = await this.prisma.vinculo.updateMany({
      where: {
        id: vinculoId,
        status: "PENDENTE",
        unidade: { condominioId },
      },
      data: { status: "ATIVO", aprovadoPorId: user.sub },
    });
    if (count === 0) {
      throw new ForbiddenException("Vínculo não encontrado ou já tratado");
    }
    return { aprovado: true };
  }
}
