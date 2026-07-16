import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type {
  EmitirConviteDto,
  EmitirQrDto,
  JwtPayload,
  RegistrarDeviceDto,
} from "@pacotes/shared";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

// Sem caracteres ambíguos (0/O, 1/I/L) — o código é digitado por humanos.
const ALFABETO_CONVITE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CONVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function gerarCodigoConvite(): string {
  const bytes = randomBytes(6);
  let codigo = "";
  for (const b of bytes) codigo += ALFABETO_CONVITE[b % ALFABETO_CONVITE.length];
  return codigo;
}

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

  private async exigirVinculoAtivo(moradorId: string, unidadeId: string) {
    const vinculo = await this.prisma.vinculo.findFirst({
      where: { moradorId, unidadeId, status: "ATIVO" },
    });
    if (!vinculo) {
      throw new ForbiddenException("Você não tem vínculo ativo com esta unidade");
    }
    return vinculo;
  }

  async emitirConvite(user: JwtPayload, dto: EmitirConviteDto) {
    const moradorId = this.exigirMorador(user);
    const vinculo = await this.exigirVinculoAtivo(moradorId, dto.unidadeId);
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
          fotoEntradaKey: pacote.fotoEntradaKey,
          fotoSaidaKey: pacote.retirada?.fotoSaidaKey ?? null,
          retiradoEm: pacote.retirada?.retiradoEm ?? null,
          entreguePorNome: pacote.retirada?.entreguePor.nome ?? null,
        };
      }
    }
    throw new NotFoundException("Encomenda não encontrada");
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
