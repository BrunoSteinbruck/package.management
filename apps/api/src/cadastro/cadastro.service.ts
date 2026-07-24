import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type {
  CriarUnidadesDto,
  CriarUsuarioDto,
  CriarVagasDto,
  ImportarMoradoresDto,
  JwtPayload,
} from "@pacotes/shared";
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

  /**
   * Import em massa (planilha do sistema atual do condomínio):
   * upsert do morador pelo telefone + vínculo ATIVO com a unidade.
   * Linhas cuja unidade não existe voltam em `semUnidade` para correção.
   */
  async importarMoradores(user: JwtPayload, dto: ImportarMoradoresDto) {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    return this.prisma.withTenant(condominioId, async (tx) => {
      const unidades = await tx.unidade.findMany();
      const porChave = new Map(
        unidades.map((u) => [`${(u.bloco ?? "").toUpperCase()}|${u.identificacao.toUpperCase()}`, u]),
      );
      let vinculados = 0;
      const semUnidade: string[] = [];
      for (const linha of dto.linhas) {
        const unidade = porChave.get(
          `${(linha.bloco ?? "").toUpperCase()}|${linha.identificacao.toUpperCase()}`,
        );
        if (!unidade) {
          semUnidade.push(`${linha.nome} (${linha.bloco ?? "-"}/${linha.identificacao})`);
          continue;
        }
        const telefone = linha.telefone.replace(/\D/g, "");
        const morador = await tx.morador.upsert({
          where: { telefone },
          update: { nome: linha.nome },
          create: { nome: linha.nome, telefone },
        });
        await tx.vinculo.upsert({
          where: {
            moradorId_unidadeId: { moradorId: morador.id, unidadeId: unidade.id },
          },
          update: { status: "ATIVO" },
          create: {
            moradorId: morador.id,
            unidadeId: unidade.id,
            condominioId,
            status: "ATIVO",
          },
        });
        vinculados++;
      }
      return { vinculados, semUnidade };
    });
  }

  /** % de unidades com pelo menos um morador com o app instalado (device). */
  async adocao(user: JwtPayload) {
    const condominioId = this.tenantDe(user);
    const totalUnidades = await this.prisma.withTenant(condominioId, (tx) =>
      tx.unidade.count(),
    );
    const vinculos = await this.prisma.vinculo.findMany({
      where: { condominioId, status: "ATIVO" },
      select: { unidadeId: true, moradorId: true },
    });
    const moradoresComApp = new Set(
      (
        await this.prisma.device.findMany({
          where: { moradorId: { in: [...new Set(vinculos.map((v) => v.moradorId))] } },
          select: { moradorId: true },
        })
      ).map((d) => d.moradorId),
    );
    const unidadesComApp = new Set(
      vinculos.filter((v) => moradoresComApp.has(v.moradorId)).map((v) => v.unidadeId),
    ).size;
    return {
      totalUnidades,
      unidadesComApp,
      percentual: totalUnidades > 0 ? Math.round((unidadesComApp / totalUnidades) * 100) : 0,
    };
  }

  /** Equipe do condomínio (porteiros, apoio, síndicos). Tabela global, escopada pela coluna. */
  listarEquipe(user: JwtPayload) {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    return this.prisma.usuario.findMany({
      where: { condominioId },
      select: { id: true, nome: true, telefone: true, papel: true, ativo: true },
      orderBy: [{ ativo: "desc" }, { papel: "asc" }, { nome: "asc" }],
    });
  }

  async criarUsuario(user: JwtPayload, dto: CriarUsuarioDto) {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    const telefone = dto.telefone.replace(/\D/g, "");
    // Telefone é identidade global de login: não pode colidir com outra
    // conta de equipe (de qualquer condomínio).
    const existente = await this.prisma.usuario.findUnique({
      where: { telefone },
    });
    if (existente) {
      throw new ConflictException("Este telefone já pertence a alguém da equipe");
    }
    return this.prisma.usuario.create({
      data: { condominioId, nome: dto.nome.trim(), telefone, papel: dto.papel },
      select: { id: true, nome: true, telefone: true, papel: true, ativo: true },
    });
  }

  async alternarAtivoUsuario(user: JwtPayload, usuarioId: string) {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    if (usuarioId === user.sub) {
      throw new ForbiddenException("Você não pode desativar a si mesmo");
    }
    const alvo = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, condominioId },
    });
    if (!alvo) throw new ForbiddenException("Usuário não encontrado");
    const atualizado = await this.prisma.usuario.update({
      where: { id: alvo.id },
      data: { ativo: !alvo.ativo },
      select: { id: true, ativo: true },
    });
    return atualizado;
  }

  listarVagas(user: JwtPayload) {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    return this.prisma.withTenant(condominioId, (tx) =>
      tx.vaga.findMany({
        include: { unidade: true },
        orderBy: { identificacao: "asc" },
      }),
    );
  }

  /** Import em massa de vagas: casa cada vaga com uma unidade existente. */
  async criarVagas(user: JwtPayload, dto: CriarVagasDto) {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    return this.prisma.withTenant(condominioId, async (tx) => {
      const unidades = await tx.unidade.findMany();
      const porChave = new Map(
        unidades.map((u) => [
          `${(u.bloco ?? "").toUpperCase()}|${u.identificacao.toUpperCase()}`,
          u,
        ]),
      );
      let criadas = 0;
      const semUnidade: string[] = [];
      for (const v of dto.vagas) {
        const unidade = porChave.get(
          `${(v.bloco ?? "").toUpperCase()}|${v.unidade.toUpperCase()}`,
        );
        if (!unidade) {
          semUnidade.push(`${v.identificacao} (${v.bloco ?? "-"}/${v.unidade})`);
          continue;
        }
        await tx.vaga.upsert({
          where: {
            condominioId_identificacao: { condominioId, identificacao: v.identificacao },
          },
          update: { unidadeId: unidade.id },
          create: { condominioId, identificacao: v.identificacao, unidadeId: unidade.id },
        });
        criadas++;
      }
      return { criadas, semUnidade };
    });
  }

  async vinculosPendentes(user: JwtPayload) {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    // Vinculo/Morador são globais; o include de unidade exige o tenant ativo.
    return this.prisma.withTenant(condominioId, (tx) =>
      tx.vinculo.findMany({
        where: { status: "PENDENTE", condominioId },
        include: { morador: true, unidade: true },
        orderBy: { criadoEm: "asc" },
      }),
    );
  }

  async aprovarVinculo(user: JwtPayload, vinculoId: string) {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    const { count } = await this.prisma.vinculo.updateMany({
      where: { id: vinculoId, status: "PENDENTE", condominioId },
      data: { status: "ATIVO", aprovadoPorId: user.sub },
    });
    if (count === 0) {
      throw new ForbiddenException("Vínculo não encontrado ou já tratado");
    }
    return { aprovado: true };
  }
}
