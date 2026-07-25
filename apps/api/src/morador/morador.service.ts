import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type {
  CriarVeiculoDto,
  EmitirConviteDto,
  EmitirQrDto,
  JwtPayload,
  RegistrarDeviceDto,
} from "@pacotes/shared";
import { gerarCodigoConvite } from "../common/convite.util";
import { PrismaService } from "../prisma/prisma.service";

const CONVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

  /** Veículos da unidade (self-service do morador; usados na Via 1 por placa). */
  async listarVeiculos(user: JwtPayload, unidadeId: string) {
    const moradorId = this.exigirMorador(user);
    const vinculo = await this.exigirVinculoAtivo(moradorId, unidadeId);
    return this.prisma.withTenant(vinculo.condominioId, (tx) =>
      tx.veiculo.findMany({ where: { unidadeId }, orderBy: { placa: "asc" } }),
    );
  }

  async criarVeiculo(user: JwtPayload, dto: CriarVeiculoDto) {
    const moradorId = this.exigirMorador(user);
    const vinculo = await this.exigirVinculoAtivo(moradorId, dto.unidadeId);
    return this.prisma.withTenant(vinculo.condominioId, (tx) =>
      tx.veiculo.upsert({
        where: {
          condominioId_placa: { condominioId: vinculo.condominioId, placa: dto.placa },
        },
        update: { unidadeId: dto.unidadeId, modelo: dto.modelo, cor: dto.cor },
        create: {
          condominioId: vinculo.condominioId,
          unidadeId: dto.unidadeId,
          placa: dto.placa,
          modelo: dto.modelo,
          cor: dto.cor,
        },
      }),
    );
  }

  async removerVeiculo(user: JwtPayload, veiculoId: string) {
    const moradorId = this.exigirMorador(user);
    const vinculos = await this.prisma.vinculo.findMany({
      where: { moradorId, status: "ATIVO" },
      select: { unidadeId: true, condominioId: true },
    });
    for (const v of vinculos) {
      const ok = await this.prisma.withTenant(v.condominioId, async (tx) => {
        const { count } = await tx.veiculo.deleteMany({
          where: { id: veiculoId, unidadeId: v.unidadeId },
        });
        return count > 0;
      });
      if (ok) return { removido: true };
    }
    throw new ForbiddenException("Veículo não encontrado");
  }

  async registrarDevice(user: JwtPayload, dto: RegistrarDeviceDto) {
    const moradorId = this.exigirMorador(user);
    // Token de conta já excluída: a FK estouraria em 500. O app chama isto ao
    // abrir, antes de qualquer tela — devolver 401 faz ele cair no login.
    const existe = await this.prisma.morador.count({ where: { id: moradorId } });
    if (!existe) throw new UnauthorizedException("Conta não encontrada");
    await this.prisma.device.upsert({
      where: { pushToken: dto.pushToken },
      create: { moradorId, pushToken: dto.pushToken, plataforma: dto.plataforma },
      update: { moradorId, ultimoUso: new Date() },
    });
    return { registrado: true };
  }

  private async exigirVinculoAtivo(moradorId: string, unidadeId: string) {
    const vinculo = await this.prisma.vinculo.findFirst({
      where: { moradorId, unidadeId, status: "ATIVO" },
    });
    if (!vinculo) {
      throw new ForbiddenException("Você não tem vínculo ativo com esta unidade");
    }
    return vinculo;
  }

  async emitirConvite(user: JwtPayload, dto: EmitirQrDto | EmitirConviteDto) {
    const moradorId = this.exigirMorador(user);
    const vinculo = await this.exigirVinculoAtivo(moradorId, dto.unidadeId);
    // Cap de convites vivos por unidade: cada código é uma credencial de
    // vínculo — sem teto, um morador poderia emitir infinitos.
    const ativos = await this.prisma.convite.count({
      where: {
        unidadeId: dto.unidadeId,
        canal: "MORADOR",
        usadoEm: null,
        expiraEm: { gt: new Date() },
      },
    });
    if (ativos >= 5) {
      throw new ForbiddenException(
        "Sua unidade já tem 5 convites ativos. Use um deles ou aguarde expirarem.",
      );
    }
    const convite = await this.prisma.convite.create({
      data: {
        condominioId: vinculo.condominioId,
        unidadeId: vinculo.unidadeId,
        codigo: gerarCodigoConvite(),
        canal: "MORADOR",
        expiraEm: new Date(Date.now() + CONVITE_TTL_MS),
      },
    });
    return { codigo: convite.codigo, expiraEm: convite.expiraEm };
  }

  async vinculadosDaUnidade(user: JwtPayload, unidadeId: string) {
    const moradorId = this.exigirMorador(user);
    await this.exigirVinculoAtivo(moradorId, unidadeId);
    const vinculos = await this.prisma.vinculo.findMany({
      where: { unidadeId, status: "ATIVO" },
      include: { morador: true },
      orderBy: { criadoEm: "asc" },
    });
    return vinculos.map((v, i) => ({
      nome: v.morador.nome,
      telefone: v.morador.telefone,
      titular: i === 0,
      voce: v.moradorId === moradorId,
    }));
  }

  async detalhePacote(user: JwtPayload, pacoteId: string) {
    const moradorId = this.exigirMorador(user);
    const vinculos = await this.prisma.vinculo.findMany({
      where: { moradorId, status: "ATIVO" },
    });

    for (const vinculo of vinculos) {
      const encontrado = await this.prisma.withTenant(
        vinculo.condominioId,
        async (tx) => {
          const pacote = await tx.pacote.findFirst({
            where: { id: pacoteId, unidadeId: vinculo.unidadeId },
            include: {
              recebidoPor: true,
              retirada: { include: { entreguePor: true } },
            },
          });
          if (!pacote) return null;
          const notificacaoEntrada = await tx.notificacao.findFirst({
            where: { pacoteId, tipo: "ENTRADA", status: "ENVIADA" },
            orderBy: { criadoEm: "asc" },
          });
          return { pacote, notificadoEm: notificacaoEntrada?.criadoEm ?? null };
        },
      );
      if (encontrado) {
        const { pacote, notificadoEm } = encontrado;
        return {
          id: pacote.id,
          transportadora: pacote.transportadora,
          codigoRastreio: pacote.codigoRastreio,
          status: pacote.status,
          localArmazenamento: pacote.localArmazenamento,
          recebidoEm: pacote.recebidoEm,
          recebidoPorNome: pacote.recebidoPor.nome,
          notificadoEm,
          fotoEntrada: await this.fotoAssinada(pacote.fotoEntradaKey),
          fotoSaida: await this.fotoAssinada(pacote.retirada?.fotoSaidaKey ?? null),
          retiradoEm: pacote.retirada?.retiradoEm ?? null,
          entreguePorNome: pacote.retirada?.entreguePor.nome ?? null,
        };
      }
    }
    throw new NotFoundException("Encomenda não encontrada");
  }

  /** Histórico de avisos do morador (entradas/retiradas das suas unidades). */
  async minhasNotificacoes(user: JwtPayload) {
    const moradorId = this.exigirMorador(user);
    const vinculos = await this.prisma.vinculo.findMany({
      where: { moradorId, status: "ATIVO" },
    });
    const avisos: Array<{
      id: string;
      tipo: string;
      criadoEm: Date;
      transportadora: string | null;
      pacoteId: string | null;
    }> = [];
    for (const vinculo of vinculos) {
      const notifs = await this.prisma.withTenant(vinculo.condominioId, (tx) =>
        tx.notificacao.findMany({
          where: { pacote: { unidadeId: vinculo.unidadeId } },
          include: { pacote: { select: { transportadora: true } } },
          orderBy: { criadoEm: "desc" },
          take: 30,
        }),
      );
      avisos.push(
        ...notifs.map((n) => ({
          id: n.id,
          tipo: n.tipo,
          criadoEm: n.criadoEm,
          transportadora: n.pacote?.transportadora ?? null,
          pacoteId: n.pacoteId,
        })),
      );
    }
    return avisos
      .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())
      .slice(0, 30);
  }

  /** Foto-token dedicado: curto (1h), preso à key — o JWT de sessão nunca vai em URL. */
  private async fotoAssinada(key: string | null) {
    if (!key) return null;
    const token = await this.jwt.signAsync(
      { tipo: "foto", key },
      { expiresIn: "1h" },
    );
    return { key, token };
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
