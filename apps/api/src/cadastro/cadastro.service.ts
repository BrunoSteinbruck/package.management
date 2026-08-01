import {
  BadRequestException,
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
  ModuloCondominio,
  SalvarModulosDto,
} from "@pacotes/shared";
import { MODULOS_CONDOMINIO } from "@pacotes/shared";
import { PrismaService } from "../prisma/prisma.service";

/** Quem entra no painel por senha precisa do e-mail para recuperá-la. */
const PRECISA_DE_EMAIL: CriarUsuarioDto["papel"][] = ["SINDICO"];

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

  /**
   * Módulos ligados no condomínio, para a aba Configurações.
   *
   * Devolve a lista inteira com o estado de cada um (e não só os ligados):
   * a tela precisa mostrar o que existe para contratar, não apenas o que já
   * está em uso.
   */
  async listarModulos(user: JwtPayload) {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    const condominio = await this.prisma.condominio.findUniqueOrThrow({
      where: { id: condominioId },
      select: { modulos: true },
    });
    const ligados = new Set(condominio.modulos);
    return MODULOS_CONDOMINIO.map((id) => ({ id, ativo: ligados.has(id) }));
  }

  async salvarModulos(user: JwtPayload, dto: SalvarModulosDto) {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    // Ordem e duplicatas normalizadas contra MODULOS_CONDOMINIO: o que fica
    // gravado não depende da ordem em que a tela mandou.
    const pedidos = new Set<ModuloCondominio>(dto.modulos);
    const modulos = MODULOS_CONDOMINIO.filter((m) => pedidos.has(m));
    await this.prisma.condominio.update({
      where: { id: condominioId },
      data: { modulos: [...modulos] },
    });
    return { modulos };
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
      select: {
        id: true,
        nome: true,
        telefone: true,
        email: true,
        papel: true,
        ativo: true,
      },
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

    /**
     * Síndico sem e-mail nasce sem caminho de volta.
     *
     * Ele entra no painel por senha, e a única forma de recuperá-la é o link
     * por e-mail. Sem e-mail, a conta depende de outro gestor para existir, e
     * num condomínio com um síndico só isso é um beco. A regra é do negócio e
     * não do formato, por isso vive aqui: o mesmo schema cria porteiro, que
     * não tem senha e não precisa de e-mail.
     */
    if (PRECISA_DE_EMAIL.includes(dto.papel) && !dto.email) {
      throw new BadRequestException(
        "Síndico precisa de e-mail: é por ele que a senha do painel é definida e recuperada.",
      );
    }
    if (dto.email) {
      const comEmail = await this.prisma.usuario.findUnique({
        where: { email: dto.email },
      });
      if (comEmail) {
        throw new ConflictException("Este e-mail já pertence a alguém da equipe");
      }
    }

    return this.prisma.usuario.create({
      data: {
        condominioId,
        nome: dto.nome.trim(),
        telefone,
        papel: dto.papel,
        email: dto.email ?? null,
      },
      select: {
        id: true,
        nome: true,
        telefone: true,
        email: true,
        papel: true,
        ativo: true,
      },
    });
  }

  /**
   * O síndico completa o cadastro de quem AINDA NÃO tem e-mail.
   *
   * Trocar o e-mail de quem já tem seria tomada de conta: bastaria apontar a
   * recuperação para a própria caixa e pedir "esqueci a senha". Síndicos são
   * pares, com o mesmo poder sobre o condomínio, então um não pode virar dono
   * da conta do outro. Quem já tem e-mail troca sozinho, em Minha conta, e lá
   * a senha atual é cobrada.
   *
   * Existe porque as contas criadas antes da senha não têm e-mail nenhum, e
   * sem este caminho a única saída seria mexer no banco à mão.
   */
  async definirEmailDeMembro(
    user: JwtPayload,
    usuarioId: string,
    email: string,
  ) {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    const alvo = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, condominioId },
    });
    if (!alvo) throw new ForbiddenException("Usuário não encontrado");
    if (alvo.email) {
      throw new ConflictException(
        `${alvo.nome} já tem e-mail cadastrado. Só a própria pessoa pode trocá-lo, em Minha conta.`,
      );
    }
    const jaUsado = await this.prisma.usuario.findUnique({ where: { email } });
    if (jaUsado) {
      throw new ConflictException("Este e-mail já pertence a alguém da equipe");
    }
    const atualizado = await this.prisma.usuario.update({
      where: { id: alvo.id },
      data: { email },
      select: {
        id: true,
        nome: true,
        telefone: true,
        email: true,
        papel: true,
        ativo: true,
      },
    });
    return atualizado;
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
