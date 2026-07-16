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

  /** Listagem filtrada para o painel (tela Pacotes). */
  listarPacotes(
    user: JwtPayload,
    filtro: { status?: string; busca?: string; dias?: number; pagina: number },
  ) {
    const condominioId = this.tenantDe(user);
    const porPagina = 12;
    const where: Record<string, unknown> = {};
    if (filtro.status && ["ARMAZENADO", "ENTREGUE", "EXTRAVIADO"].includes(filtro.status)) {
      where.status = filtro.status;
    }
    if (filtro.dias) {
      where.recebidoEm = { gte: new Date(Date.now() - filtro.dias * 86_400_000) };
    }
    if (filtro.busca) {
      const q = filtro.busca.trim();
      where.OR = [
        { codigoRastreio: { contains: q, mode: "insensitive" } },
        { transportadora: { contains: q, mode: "insensitive" } },
        { unidade: { identificacao: { contains: q, mode: "insensitive" } } },
        { unidade: { bloco: { contains: q, mode: "insensitive" } } },
      ];
    }
    return this.prisma.withTenant(condominioId, async (tx) => {
      const total = await tx.pacote.count({ where });
      const itens = await tx.pacote.findMany({
        where,
        include: { unidade: true, retirada: true },
        orderBy: { recebidoEm: "desc" },
        skip: (filtro.pagina - 1) * porPagina,
        take: porPagina,
      });
      return { total, pagina: filtro.pagina, porPagina, itens };
    });
  }

  /** Agregações da tela Relatórios. */
  relatorios(user: JwtPayload, dias: number) {
    const condominioId = this.tenantDe(user);
    const desde = new Date(Date.now() - dias * 86_400_000);
    return this.prisma.withTenant(condominioId, async (tx) => {
      const retiradas = await tx.retirada.findMany({
        where: { retiradoEm: { gte: desde } },
        include: { pacote: { select: { recebidoEm: true } } },
      });
      const somaDias = retiradas.reduce(
        (soma, r) =>
          soma + (r.retiradoEm.getTime() - r.pacote.recebidoEm.getTime()) / 86_400_000,
        0,
      );
      const tempoMedioDias =
        retiradas.length > 0 ? Number((somaDias / retiradas.length).toFixed(1)) : 0;

      const volume = await tx.pacote.count({ where: { recebidoEm: { gte: desde } } });

      const [enviadas, totalNotif] = [
        await tx.notificacao.count({
          where: { criadoEm: { gte: desde }, status: "ENVIADA" },
        }),
        await tx.notificacao.count({ where: { criadoEm: { gte: desde } } }),
      ];
      const notificacoesPct =
        totalNotif > 0 ? Number(((enviadas / totalNotif) * 100).toFixed(1)) : 0;

      const grupos = await tx.pacote.groupBy({
        by: ["transportadora"],
        where: { recebidoEm: { gte: desde } },
        _count: { id: true },
      });
      const ordenados = grupos
        .map((g) => ({ nome: g.transportadora ?? "Outras", qtd: g._count.id }))
        .sort((a, b) => b.qtd - a.qtd);
      const top = ordenados.slice(0, 4);
      const resto = ordenados.slice(4).reduce((soma, g) => soma + g.qtd, 0);
      if (resto > 0) top.push({ nome: "Outras", qtd: resto });
      const porTransportadora = top.map((g) => ({
        ...g,
        pct: volume > 0 ? Math.round((g.qtd / volume) * 100) : 0,
      }));

      const faixas = [
        { faixa: "6 a 9h", de: 6, ate: 9 },
        { faixa: "9 a 12h", de: 9, ate: 12 },
        { faixa: "12 a 15h", de: 12, ate: 15 },
        { faixa: "15 a 18h", de: 15, ate: 18 },
        { faixa: "18 a 21h", de: 18, ate: 21 },
        { faixa: "21 a 24h", de: 21, ate: 24 },
      ];
      const contagem = faixas.map((f) => ({
        faixa: f.faixa,
        qtd: retiradas.filter((r) => {
          const h = r.retiradoEm.getHours();
          return h >= f.de && h < f.ate;
        }).length,
      }));
      const maxFaixa = Math.max(1, ...contagem.map((c) => c.qtd));
      const porHorario = contagem.map((c) => ({
        ...c,
        pct: Math.round((c.qtd / maxFaixa) * 100),
      }));

      return {
        tempoMedioDias,
        volume,
        notificacoesPct,
        porTransportadora,
        porHorario,
      };
    });
  }

  /** Entradas x retiradas por dia (gráfico da visão geral). */
  serieDiaria(user: JwtPayload, dias: number) {
    const condominioId = this.tenantDe(user);
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    desde.setDate(desde.getDate() - (dias - 1));
    return this.prisma.withTenant(condominioId, async (tx) => {
      const entradas = await tx.pacote.findMany({
        where: { recebidoEm: { gte: desde } },
        select: { recebidoEm: true },
      });
      const retiradas = await tx.retirada.findMany({
        where: { retiradoEm: { gte: desde } },
        select: { retiradoEm: true },
      });
      const chave = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const serie = [];
      for (let i = 0; i < dias; i++) {
        const dia = new Date(desde);
        dia.setDate(desde.getDate() + i);
        const k = chave(dia);
        serie.push({
          dia: k,
          entradas: entradas.filter((e) => chave(e.recebidoEm) === k).length,
          retiradas: retiradas.filter((r) => chave(r.retiradoEm) === k).length,
        });
      }
      return serie;
    });
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
