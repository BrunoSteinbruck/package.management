import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ComunicadoGestor,
  ComunicadoMorador,
  CriarComunicadoDto,
  JwtPayload,
  LeituraComunicado,
} from "@pacotes/shared";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Comunicados: o síndico fala com o condomínio inteiro (ou com blocos).
 *
 * A Via 1 de `Aviso` já falava com uma unidade e a Via 2 trazia o morador de
 * volta; faltava o broadcast, que é o que todo app de condomínio tem e o que
 * o síndico pede primeiro. Mora em tabela própria porque `Aviso` exige
 * `unidadeId`: ver o comentário do modelo `Comunicado` no schema.
 */
@Injectable()
export class ComunicadosService {
  constructor(private readonly prisma: PrismaService) {}

  private exigirGestor(user: JwtPayload): string {
    if (user.tipo !== "usuario" || !user.condominioId) {
      throw new ForbiddenException("Apenas equipe do condomínio");
    }
    if (user.papel !== "SINDICO" && user.papel !== "ADMIN") {
      throw new ForbiddenException("Apenas síndico ou admin");
    }
    return user.condominioId;
  }

  private exigirMorador(user: JwtPayload): string {
    if (user.tipo !== "morador") throw new ForbiddenException("Apenas moradores");
    return user.sub;
  }

  async criar(user: JwtPayload, dto: CriarComunicadoDto) {
    const cid = this.exigirGestor(user);
    // Bloco vazio ("") não é bloco: chegaria aqui de um campo de texto em
    // branco e transformaria "todo mundo" numa lista com um alvo impossível.
    const blocos = (dto.blocos ?? []).map((b) => b.trim()).filter(Boolean);
    return this.prisma.withTenant(cid, async (tx) => {
      const comunicado = await tx.comunicado.create({
        data: {
          condominioId: cid,
          titulo: dto.titulo.trim(),
          corpo: dto.corpo.trim(),
          blocos,
          criadoPorUsuarioId: user.sub,
        },
      });
      await tx.notificacao.create({
        data: {
          condominioId: cid,
          comunicadoId: comunicado.id,
          canal: "PUSH",
          tipo: "COMUNICADO",
        },
      });
      return comunicado;
    });
  }

  /** Publicações do condomínio com a taxa de leitura, para o painel. */
  async listarGestor(user: JwtPayload): Promise<ComunicadoGestor[]> {
    const cid = this.exigirGestor(user);
    const comunicados = await this.prisma.withTenant(cid, (tx) =>
      tx.comunicado.findMany({
        include: { criadoPor: true, _count: { select: { leituras: true } } },
        orderBy: { criadoEm: "desc" },
        take: 100,
      }),
    );
    return Promise.all(
      comunicados.map(async (c) => ({
        id: c.id,
        titulo: c.titulo,
        corpo: c.corpo,
        criadoEm: c.criadoEm.toISOString(),
        autor: c.criadoPor.nome,
        blocos: c.blocos,
        leituras: c._count.leituras,
        alcance: await this.alcance(cid, c.blocos),
      })),
    );
  }

  /**
   * Quantos moradores o comunicado alcança hoje: vínculos ativos nas unidades
   * dos blocos alvo. Calculado na hora, e não gravado na publicação, porque a
   * pergunta que o síndico faz é sobre o condomínio de agora ("faltam quantos
   * lerem?"), não sobre quem morava aqui no dia do envio.
   */
  private async alcance(condominioId: string, blocos: string[]): Promise<number> {
    const unidades = await this.prisma.withTenant(condominioId, (tx) =>
      tx.unidade.findMany({
        where: blocos.length > 0 ? { bloco: { in: blocos } } : {},
        select: { id: true },
      }),
    );
    if (unidades.length === 0) return 0;
    return this.prisma.vinculo.count({
      where: { unidadeId: { in: unidades.map((u) => u.id) }, status: "ATIVO" },
    });
  }

  async leituras(user: JwtPayload, comunicadoId: string): Promise<LeituraComunicado[]> {
    const cid = this.exigirGestor(user);
    const linhas = await this.prisma.withTenant(cid, async (tx) => {
      const existe = await tx.comunicado.findUnique({ where: { id: comunicadoId } });
      if (!existe) throw new NotFoundException("Comunicado não encontrado");
      return tx.comunicadoLeitura.findMany({
        where: { comunicadoId },
        include: { morador: true },
        orderBy: { lidoEm: "desc" },
        take: 500,
      });
    });
    // A unidade vem do vínculo, não do recibo: o recibo é do morador, e
    // guardar a unidade nele duplicaria um dado que já muda de lugar sozinho.
    //
    // Duas consultas em vez de um `include`: `vinculos` é global e `unidades`
    // tem RLS, então a relação só materializa dentro do tenant.
    const vinculos = await this.prisma.vinculo.findMany({
      where: {
        moradorId: { in: linhas.map((l) => l.moradorId) },
        condominioId: cid,
        status: "ATIVO",
      },
      select: { moradorId: true, unidadeId: true },
    });
    const unidades = await this.prisma.withTenant(cid, (tx) =>
      tx.unidade.findMany({
        where: { id: { in: vinculos.map((v) => v.unidadeId) } },
        select: { id: true, bloco: true, identificacao: true },
      }),
    );
    const porId = new Map(unidades.map((u) => [u.id, u]));
    const unidadePorMorador = new Map(
      vinculos.map((v) => [v.moradorId, porId.get(v.unidadeId)]),
    );
    return linhas.map((l) => {
      const u = unidadePorMorador.get(l.moradorId);
      return {
        nome: l.morador.nome,
        unidade: {
          bloco: u?.bloco ?? null,
          identificacao: u?.identificacao ?? "-",
        },
        lidoEm: l.lidoEm.toISOString(),
      };
    });
  }

  // ---------- Morador ----------

  /**
   * Detalhe do comunicado. Marcar como lido acontece aqui, e não num endpoint
   * separado: abrir É ler, e um POST à parte só criaria a chance de o app
   * esquecer de mandar.
   */
  async detalhe(user: JwtPayload, comunicadoId: string): Promise<ComunicadoMorador> {
    const moradorId = this.exigirMorador(user);
    // Sem `include: { unidade: true }`: `vinculos` é tabela global e
    // `unidades` tem RLS, então a relação vem nula fora de uma transação com
    // tenant e o Prisma quebra num campo obrigatório. O bloco é buscado
    // dentro do `withTenant` abaixo, como o feed já faz.
    const vinculos = await this.prisma.vinculo.findMany({
      where: { moradorId, status: "ATIVO" },
      select: { condominioId: true, unidadeId: true },
    });
    for (const v of vinculos) {
      const achado = await this.prisma.withTenant(v.condominioId, async (tx) => {
        const c = await tx.comunicado.findUnique({
          where: { id: comunicadoId },
          include: { criadoPor: true },
        });
        // Bloco fora do alvo é o mesmo que não existir: o morador do bloco B
        // não deve nem saber que houve um comunicado só do bloco A.
        if (!c) return null;
        if (c.blocos.length > 0) {
          const unidade = await tx.unidade.findUnique({
            where: { id: v.unidadeId },
            select: { bloco: true },
          });
          if (!c.blocos.includes(unidade?.bloco ?? "")) return null;
        }
        await tx.comunicadoLeitura.upsert({
          where: { comunicadoId_moradorId: { comunicadoId, moradorId } },
          create: { condominioId: v.condominioId, comunicadoId, moradorId },
          update: {},
        });
        return c;
      });
      if (achado) {
        return {
          id: achado.id,
          titulo: achado.titulo,
          corpo: achado.corpo,
          criadoEm: achado.criadoEm.toISOString(),
          autor: achado.criadoPor.nome,
        };
      }
    }
    throw new NotFoundException("Comunicado não encontrado");
  }
}
