import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type {
  CriarAvisoDto,
  CriarOcorrenciaDto,
  ItemFeed,
  JwtPayload,
  StatusAviso,
} from "@pacotes/shared";
import { itensParaVersao, normalizarPlaca } from "@pacotes/shared";
import { PrismaService } from "../prisma/prisma.service";

const PLACA_NO_TEXTO = /[A-Z]{3}\d[A-Z0-9]\d{2}/;

// Rate limit de reportes: evita inundar a fila do síndico. Contagem no banco
// (não em memória): sobrevive a restart e vale em multi-instância.
const MAX_OCORRENCIAS_POR_DIA = 10;

@Injectable()
export class AvisosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

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

  private exigirGestor(user: JwtPayload): string {
    const cid = this.tenantEquipe(user);
    if (user.papel !== "SINDICO" && user.papel !== "ADMIN") {
      throw new ForbiddenException("Apenas síndico ou admin");
    }
    return cid;
  }

  /** Foto-token dedicado (1h, preso à key): o JWT de sessão nunca vai em URL. */
  private async fotoAssinada(key: string | null) {
    if (!key) return null;
    const token = await this.jwt.signAsync({ tipo: "foto", key }, { expiresIn: "1h" });
    return { key, token };
  }

  // ---------- Via 1: equipe ----------

  /** Resolve o dono a partir do texto do OCR: placa (veículo) ou vaga. */
  async identificarAlvo(user: JwtPayload, texto: string) {
    const cid = this.tenantEquipe(user);
    const normalizado = normalizarPlaca(texto);
    const placa = normalizado.match(PLACA_NO_TEXTO)?.[0] ?? null;
    return this.prisma.withTenant(cid, async (tx) => {
      if (placa) {
        const veiculo = await tx.veiculo.findFirst({
          where: { placa },
          include: { unidade: true },
        });
        if (veiculo) {
          return { origem: "placa" as const, valor: placa, unidade: veiculo.unidade };
        }
      }
      const alvoVaga = texto.trim();
      const vaga = await tx.vaga.findFirst({
        where: { identificacao: alvoVaga },
        include: { unidade: true },
      });
      if (vaga) {
        return { origem: "vaga" as const, valor: alvoVaga, unidade: vaga.unidade };
      }
      return { origem: null, valor: placa ?? alvoVaga, unidade: null };
    });
  }

  async criarAviso(user: JwtPayload, dto: CriarAvisoDto) {
    const cid = this.tenantEquipe(user);
    return this.prisma.withTenant(cid, async (tx) => {
      const unidade = await tx.unidade.findUnique({ where: { id: dto.unidadeId } });
      if (!unidade) throw new NotFoundException("Unidade não encontrada");
      const aviso = await tx.aviso.create({
        data: {
          condominioId: cid,
          via: "DIRECIONADO",
          unidadeId: dto.unidadeId,
          motivo: dto.motivo,
          descricao: dto.descricao,
          fotoKey: dto.fotoKey,
          criadoPorUsuarioId: user.sub,
        },
      });
      await tx.notificacao.create({
        data: { condominioId: cid, avisoId: aviso.id, canal: "PUSH", tipo: "AVISO" },
      });
      // temApp informa a UI se cabe o banner "avise pelo interfone".
      const vinculos = await this.prisma.vinculo.findMany({
        where: { unidadeId: dto.unidadeId, status: "ATIVO" },
        select: { moradorId: true },
      });
      const comApp = await this.prisma.device.count({
        where: { moradorId: { in: vinculos.map((v) => v.moradorId) } },
      });
      return { aviso, temApp: comApp > 0 };
    });
  }

  /** Avisos direcionados (Via 1): para equipe/painel. */
  listarAvisosEquipe(user: JwtPayload, status?: string) {
    const cid = this.tenantEquipe(user);
    return this.prisma.withTenant(cid, (tx) =>
      tx.aviso.findMany({
        where: { via: "DIRECIONADO", ...(status ? { status: status as StatusAviso } : {}) },
        include: { unidade: true },
        orderBy: { criadoEm: "desc" },
        take: 100,
      }),
    );
  }

  // ---------- Via 2: morador reporta / gestor gere ----------

  async criarOcorrencia(user: JwtPayload, dto: CriarOcorrenciaDto) {
    const moradorId = this.exigirMorador(user);
    const vinculo = await this.prisma.vinculo.findFirst({
      where: { moradorId, unidadeId: dto.unidadeId, status: "ATIVO" },
    });
    if (!vinculo) throw new ForbiddenException("Você não tem vínculo com esta unidade");
    return this.prisma.withTenant(vinculo.condominioId, async (tx) => {
      const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentes = await tx.aviso.count({
        where: {
          via: "OCORRENCIA",
          criadoPorMoradorId: moradorId,
          criadoEm: { gte: desde },
        },
      });
      if (recentes >= MAX_OCORRENCIAS_POR_DIA) {
        throw new HttpException(
          "Limite diário de relatos atingido. Tente novamente amanhã.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const aviso = await tx.aviso.create({
        data: {
          condominioId: vinculo.condominioId,
          via: "OCORRENCIA",
          unidadeId: dto.unidadeId,
          motivo: dto.categoria,
          descricao: dto.descricao,
          fotoKey: dto.fotoKey,
          criadoPorMoradorId: moradorId,
        },
      });
      // Avisa a administração da chegada. Antes o relato só existia no painel
      // e dependia de alguém abrir para descobrir.
      await tx.notificacao.create({
        data: {
          condominioId: vinculo.condominioId,
          avisoId: aviso.id,
          canal: "PUSH",
          tipo: "OCORRENCIA_NOVA",
        },
      });
      return aviso;
    });
  }

  /** Ocorrências (Via 2) para o painel do síndico. */
  async listarOcorrenciasGestor(user: JwtPayload, status?: string) {
    const cid = this.exigirGestor(user);
    const avisos = await this.prisma.withTenant(cid, (tx) =>
      tx.aviso.findMany({
        where: { via: "OCORRENCIA", ...(status ? { status: status as StatusAviso } : {}) },
        include: { unidade: true, criadoPorMorador: true },
        orderBy: { criadoEm: "desc" },
        take: 200,
      }),
    );
    return Promise.all(
      avisos.map(async (a) => ({
        id: a.id,
        categoria: a.motivo,
        descricao: a.descricao,
        status: a.status,
        criadoEm: a.criadoEm,
        unidade: { bloco: a.unidade.bloco, identificacao: a.unidade.identificacao },
        autor: a.criadoPorMorador?.nome ?? "-",
        foto: await this.fotoAssinada(a.fotoKey),
      })),
    );
  }

  async mudarStatus(user: JwtPayload, avisoId: string, status: StatusAviso) {
    const cid = this.exigirGestor(user);
    return this.prisma.withTenant(cid, async (tx) => {
      const aviso = await tx.aviso.findFirst({
        where: { id: avisoId, via: "OCORRENCIA" },
      });
      if (!aviso) throw new NotFoundException("Ocorrência não encontrada");
      const atualizado = await tx.aviso.update({
        where: { id: aviso.id },
        data: {
          status,
          resolvidoEm: status === "RESOLVIDO" ? new Date() : null,
        },
      });
      // Avisa o autor da mudança de status.
      await tx.notificacao.create({
        data: { condominioId: cid, avisoId: aviso.id, canal: "PUSH", tipo: "OCORRENCIA" },
      });
      return atualizado;
    });
  }

  // ---------- Morador ----------

  /**
   * A caixa de entrada do morador numa resposta só: avisos que a portaria
   * mandou, relatos que ele abriu e o que aconteceu com as encomendas dele.
   *
   * Substitui a tripla /morador/avisos + /morador/ocorrencias +
   * /morador/notificacoes, que devolvia três formatos para a mesma tela.
   *
   * Percorre condomínios, não vínculos: um morador com duas unidades no mesmo
   * condomínio veria cada relato seu duas vezes, porque a consulta de Via 2
   * filtra por autor e não por unidade.
   *
   * `versaoCliente` é a versão do contrato de feed do app que pediu. Tipo mais
   * novo que ela não sai daqui: o `switch` que monta a tela no app não tem
   * ramo final, então item desconhecido derrubaria a caixa de entrada de quem
   * ainda não atualizou.
   */
  async meuFeed(user: JwtPayload, versaoCliente = 1): Promise<ItemFeed[]> {
    const moradorId = this.exigirMorador(user);
    const vinculos = await this.prisma.vinculo.findMany({
      where: { moradorId, status: "ATIVO" },
      select: { condominioId: true, unidadeId: true },
    });

    const unidadesPorCondominio = new Map<string, string[]>();
    for (const v of vinculos) {
      const atual = unidadesPorCondominio.get(v.condominioId) ?? [];
      atual.push(v.unidadeId);
      unidadesPorCondominio.set(v.condominioId, atual);
    }

    const itens: ItemFeed[] = [];
    for (const [condominioId, unidadeIds] of unidadesPorCondominio) {
      const { avisos, notificacoes } = await this.prisma.withTenant(
        condominioId,
        async (tx) => ({
          avisos: await tx.aviso.findMany({
            where: {
              OR: [
                { via: "DIRECIONADO", unidadeId: { in: unidadeIds } },
                { via: "OCORRENCIA", criadoPorMoradorId: moradorId },
              ],
            },
            orderBy: { criadoEm: "desc" },
            take: 40,
          }),
          // As notificações de AVISO e OCORRENCIA são recibos de entrega do
          // push; a linha de Aviso acima já é a fonte, com o status atual.
          notificacoes: await tx.notificacao.findMany({
            where: {
              tipo: { in: ["ENTRADA", "RETIRADA", "LEMBRETE"] },
              pacote: { unidadeId: { in: unidadeIds } },
            },
            include: { pacote: true },
            orderBy: { criadoEm: "desc" },
            take: 40,
          }),
        }),
      );

      for (const a of avisos) {
        const base = {
          id: a.id,
          em: a.criadoEm.toISOString(),
          avisoId: a.id,
          descricao: a.descricao,
          status: a.status,
          foto: await this.fotoAssinada(a.fotoKey),
        };
        itens.push(
          a.via === "DIRECIONADO"
            ? {
                ...base,
                tipo: "AVISO",
                motivo: a.motivo,
                // Quem recebeu o aviso é quem diz que está resolvido.
                podeResolver: a.status !== "RESOLVIDO",
              }
            : { ...base, tipo: "OCORRENCIA", categoria: a.motivo },
        );
      }

      for (const n of notificacoes) {
        if (!n.pacote || !n.pacoteId) continue;
        const em = n.criadoEm.toISOString();
        if (n.tipo === "LEMBRETE") {
          itens.push({
            tipo: "LEMBRETE",
            id: n.id,
            em,
            pacoteId: n.pacoteId,
            dias: Math.max(
              0,
              Math.floor(
                (Date.now() - n.pacote.recebidoEm.getTime()) / 86_400_000,
              ),
            ),
          });
        } else {
          itens.push({
            tipo: n.tipo === "ENTRADA" ? "ENTRADA" : "RETIRADA",
            id: n.id,
            em,
            pacoteId: n.pacoteId,
            transportadora: n.pacote.transportadora,
          });
        }
      }
    }

    return itensParaVersao(itens, versaoCliente)
      .sort((x, y) => new Date(y.em).getTime() - new Date(x.em).getTime())
      .slice(0, 60);
  }

  /**
   * Avisos direcionados às unidades do morador (Via 1).
   *
   * @deprecated Use `meuFeed`. Mantido enquanto houver app instalado na versão
   * anterior; remover só depois que a nova estiver nas lojas.
   */
  async meusAvisos(user: JwtPayload) {
    const moradorId = this.exigirMorador(user);
    const vinculos = await this.prisma.vinculo.findMany({
      where: { moradorId, status: "ATIVO" },
    });
    const resultado = [];
    for (const v of vinculos) {
      const avisos = await this.prisma.withTenant(v.condominioId, (tx) =>
        tx.aviso.findMany({
          where: { via: "DIRECIONADO", unidadeId: v.unidadeId },
          orderBy: { criadoEm: "desc" },
          take: 30,
        }),
      );
      for (const a of avisos) {
        resultado.push({
          id: a.id,
          motivo: a.motivo,
          descricao: a.descricao,
          status: a.status,
          criadoEm: a.criadoEm,
          foto: await this.fotoAssinada(a.fotoKey),
        });
      }
    }
    return resultado.sort(
      (x, y) => new Date(y.criadoEm).getTime() - new Date(x.criadoEm).getTime(),
    );
  }

  /**
   * Ocorrências que o morador reportou (Via 2), com status.
   *
   * @deprecated Use `meuFeed`. Mantido enquanto houver app instalado na versão
   * anterior; remover só depois que a nova estiver nas lojas.
   */
  async minhasOcorrencias(user: JwtPayload) {
    const moradorId = this.exigirMorador(user);
    const vinculos = await this.prisma.vinculo.findMany({
      where: { moradorId, status: "ATIVO" },
    });
    const resultado = [];
    for (const v of vinculos) {
      const avisos = await this.prisma.withTenant(v.condominioId, (tx) =>
        tx.aviso.findMany({
          where: { via: "OCORRENCIA", criadoPorMoradorId: moradorId },
          orderBy: { criadoEm: "desc" },
          take: 30,
        }),
      );
      for (const a of avisos) {
        resultado.push({
          id: a.id,
          categoria: a.motivo,
          descricao: a.descricao,
          status: a.status,
          criadoEm: a.criadoEm,
          foto: await this.fotoAssinada(a.fotoKey),
        });
      }
    }
    return resultado.sort(
      (x, y) => new Date(y.criadoEm).getTime() - new Date(x.criadoEm).getTime(),
    );
  }

  async resolverAviso(user: JwtPayload, avisoId: string) {
    const moradorId = this.exigirMorador(user);
    const vinculos = await this.prisma.vinculo.findMany({
      where: { moradorId, status: "ATIVO" },
      select: { unidadeId: true, condominioId: true },
    });
    for (const v of vinculos) {
      const ok = await this.prisma.withTenant(v.condominioId, async (tx) => {
        const { count } = await tx.aviso.updateMany({
          where: { id: avisoId, via: "DIRECIONADO", unidadeId: v.unidadeId },
          data: { status: "RESOLVIDO", resolvidoEm: new Date() },
        });
        return count > 0;
      });
      if (ok) return { resolvido: true };
    }
    throw new NotFoundException("Aviso não encontrado");
  }
}
