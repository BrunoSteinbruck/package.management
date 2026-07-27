import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CriarVisitaDto,
  JwtPayload,
  VisitaMorador,
  VisitaPortaria,
} from "@pacotes/shared";
import { PrismaService } from "../prisma/prisma.service";

/** Uma visita "de hoje" é do dia do condomínio, não do fuso do servidor. */
function hojeNoCondominio(timezone: string): Date {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${iso}T00:00:00.000Z`);
}

type LinhaVisita = {
  id: string;
  nomeVisitante: string;
  documento: string | null;
  dataPrevista: Date;
  janelaInicio: string | null;
  janelaFim: string | null;
  status: "AUTORIZADA" | "CHEGOU" | "CANCELADA";
  chegadaEm: Date | null;
  unidade: { bloco: string | null; identificacao: string };
};

function paraMorador(v: LinhaVisita): VisitaMorador {
  return {
    id: v.id,
    nomeVisitante: v.nomeVisitante,
    // A coluna é DATE: fatiar o ISO evita o fuso do servidor empurrar a
    // visita para o dia anterior, que é o bug clássico de data sem hora.
    dataPrevista: v.dataPrevista.toISOString().slice(0, 10),
    janelaInicio: v.janelaInicio,
    janelaFim: v.janelaFim,
    status: v.status,
    chegadaEm: v.chegadaEm?.toISOString() ?? null,
    unidade: {
      bloco: v.unidade.bloco,
      identificacao: v.unidade.identificacao,
    },
  };
}

@Injectable()
export class VisitasService {
  constructor(private readonly prisma: PrismaService) {}

  private tenantEquipe(user: JwtPayload): string {
    if (user.tipo !== "usuario" || !user.condominioId) {
      throw new ForbiddenException("Apenas equipe do condomínio");
    }
    return user.condominioId;
  }

  private exigirMorador(user: JwtPayload): string {
    if (user.tipo !== "morador") throw new ForbiddenException("Apenas moradores");
    return user.sub;
  }

  // ---------- Morador ----------

  async criar(user: JwtPayload, dto: CriarVisitaDto) {
    const moradorId = this.exigirMorador(user);
    const vinculo = await this.prisma.vinculo.findFirst({
      where: { moradorId, unidadeId: dto.unidadeId, status: "ATIVO" },
    });
    if (!vinculo) {
      throw new ForbiddenException("Você não tem vínculo com esta unidade");
    }
    return this.prisma.withTenant(vinculo.condominioId, (tx) =>
      tx.visita.create({
        data: {
          condominioId: vinculo.condominioId,
          unidadeId: dto.unidadeId,
          moradorId,
          nomeVisitante: dto.nomeVisitante.trim(),
          documento: dto.documento?.trim() || null,
          dataPrevista: new Date(`${dto.dataPrevista}T00:00:00.000Z`),
          janelaInicio: dto.janelaInicio ?? null,
          janelaFim: dto.janelaFim ?? null,
        },
      }),
    );
  }

  /** As visitas que o morador autorizou, mais recentes primeiro. */
  async minhas(user: JwtPayload): Promise<VisitaMorador[]> {
    const moradorId = this.exigirMorador(user);
    const vinculos = await this.prisma.vinculo.findMany({
      where: { moradorId, status: "ATIVO" },
      select: { condominioId: true },
    });
    const ids = [...new Set(vinculos.map((v) => v.condominioId))];
    const listas = await Promise.all(
      ids.map((cid) =>
        this.prisma.withTenant(cid, (tx) =>
          tx.visita.findMany({
            where: { moradorId },
            include: { unidade: true },
            orderBy: [{ dataPrevista: "desc" }, { criadoEm: "desc" }],
            take: 50,
          }),
        ),
      ),
    );
    return listas.flat().map(paraMorador);
  }

  async cancelar(user: JwtPayload, visitaId: string) {
    const moradorId = this.exigirMorador(user);
    const vinculos = await this.prisma.vinculo.findMany({
      where: { moradorId, status: "ATIVO" },
      select: { condominioId: true },
    });
    for (const cid of new Set(vinculos.map((v) => v.condominioId))) {
      const ok = await this.prisma.withTenant(cid, async (tx) => {
        // Só cancela o que ele autorizou e que ainda não chegou: cancelar
        // depois da entrada reescreveria um fato do portão.
        const { count } = await tx.visita.updateMany({
          where: { id: visitaId, moradorId, status: "AUTORIZADA" },
          data: { status: "CANCELADA" },
        });
        return count > 0;
      });
      if (ok) return { cancelada: true };
    }
    throw new NotFoundException("Visita não encontrada ou já registrada");
  }

  // ---------- Portaria ----------

  /** Quem é esperado hoje, para a tela de conferência do portão. */
  async doDia(user: JwtPayload): Promise<VisitaPortaria[]> {
    const cid = this.tenantEquipe(user);
    const condominio = await this.prisma.condominio.findUniqueOrThrow({
      where: { id: cid },
      select: { timezone: true },
    });
    const hoje = hojeNoCondominio(condominio.timezone);
    const visitas = await this.prisma.withTenant(cid, (tx) =>
      tx.visita.findMany({
        where: { dataPrevista: hoje, status: { in: ["AUTORIZADA", "CHEGOU"] } },
        include: { unidade: true, morador: true },
        orderBy: [{ status: "asc" }, { janelaInicio: "asc" }],
      }),
    );
    return visitas.map((v) => ({
      ...paraMorador(v),
      documento: v.documento,
      autorizadoPor: v.morador.nome,
    }));
  }

  /** Baixa na chegada: a portaria confirma e a unidade é avisada na hora. */
  async registrarChegada(user: JwtPayload, visitaId: string) {
    const cid = this.tenantEquipe(user);
    return this.prisma.withTenant(cid, async (tx) => {
      const visita = await tx.visita.findFirst({
        where: { id: visitaId, status: "AUTORIZADA" },
      });
      if (!visita) {
        throw new NotFoundException("Visita não encontrada ou já registrada");
      }
      const atualizada = await tx.visita.update({
        where: { id: visita.id },
        data: {
          status: "CHEGOU",
          chegadaEm: new Date(),
          baixaPorId: user.sub,
        },
      });
      await tx.notificacao.create({
        data: {
          condominioId: cid,
          visitaId: visita.id,
          canal: "PUSH",
          tipo: "VISITA_CHEGOU",
        },
      });
      return atualizada;
    });
  }

  /** Histórico por unidade, para o painel do gestor. */
  async historico(user: JwtPayload, unidadeId?: string): Promise<VisitaPortaria[]> {
    const cid = this.tenantEquipe(user);
    const visitas = await this.prisma.withTenant(cid, (tx) =>
      tx.visita.findMany({
        where: unidadeId ? { unidadeId } : {},
        include: { unidade: true, morador: true },
        orderBy: [{ dataPrevista: "desc" }, { criadoEm: "desc" }],
        take: 200,
      }),
    );
    return visitas.map((v) => ({
      ...paraMorador(v),
      documento: v.documento,
      autorizadoPor: v.morador.nome,
    }));
  }
}
