import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type {
  CriarDocumentoDto,
  DocumentoLinha,
  JwtPayload,
} from "@pacotes/shared";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Ata, regimento e convenção no app do morador.
 *
 * O arquivo em si segue o caminho já auditado das fotos: sobe por
 * `POST /uploads/documento`, é servido por `GET /uploads/:key?t=` e o link
 * vem assinado por um token curto preso à key. O JWT de sessão continua
 * nunca aparecendo em URL.
 */
@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private exigirGestor(user: JwtPayload): string {
    if (user.tipo !== "usuario" || !user.condominioId) {
      throw new ForbiddenException("Apenas equipe do condomínio");
    }
    if (user.papel !== "SINDICO" && user.papel !== "ADMIN") {
      throw new ForbiddenException("Apenas síndico ou admin");
    }
    return user.condominioId;
  }

  /** Link de 1h preso à key, no mesmo desenho de `fotoAssinada`. */
  private async assinar(key: string) {
    const token = await this.jwt.signAsync(
      { tipo: "documento", key },
      { expiresIn: "1h" },
    );
    return { key, token };
  }

  private async linhas(condominioId: string): Promise<DocumentoLinha[]> {
    const docs = await this.prisma.withTenant(condominioId, (tx) =>
      tx.documento.findMany({
        where: { removidoEm: null },
        orderBy: [{ categoria: "asc" }, { criadoEm: "desc" }],
        take: 300,
      }),
    );
    return Promise.all(
      docs.map(async (d) => ({
        id: d.id,
        titulo: d.titulo,
        categoria: d.categoria,
        tamanhoBytes: d.tamanhoBytes,
        criadoEm: d.criadoEm.toISOString(),
        arquivo: await this.assinar(d.arquivoKey),
      })),
    );
  }

  criar(user: JwtPayload, dto: CriarDocumentoDto) {
    const cid = this.exigirGestor(user);
    return this.prisma.withTenant(cid, (tx) =>
      tx.documento.create({
        data: {
          condominioId: cid,
          titulo: dto.titulo.trim(),
          categoria: dto.categoria,
          arquivoKey: dto.arquivoKey,
          tamanhoBytes: dto.tamanhoBytes,
          criadoPorUsuarioId: user.sub,
        },
      }),
    );
  }

  listarGestor(user: JwtPayload) {
    return this.linhas(this.exigirGestor(user));
  }

  /**
   * Documentos das unidades do morador. Percorre condomínios (não vínculos)
   * pelo mesmo motivo do feed: duas unidades no mesmo prédio veriam a
   * convenção duas vezes.
   */
  async listarMorador(user: JwtPayload): Promise<DocumentoLinha[]> {
    if (user.tipo !== "morador") throw new ForbiddenException("Apenas moradores");
    const vinculos = await this.prisma.vinculo.findMany({
      where: { moradorId: user.sub, status: "ATIVO" },
      select: { condominioId: true },
    });
    const ids = [...new Set(vinculos.map((v) => v.condominioId))];
    const listas = await Promise.all(ids.map((id) => this.linhas(id)));
    return listas.flat();
  }

  /** Soft delete: some da lista, continua sendo o que valia na época. */
  async remover(user: JwtPayload, id: string) {
    const cid = this.exigirGestor(user);
    return this.prisma.withTenant(cid, async (tx) => {
      const { count } = await tx.documento.updateMany({
        where: { id, removidoEm: null },
        data: { removidoEm: new Date() },
      });
      if (count === 0) throw new NotFoundException("Documento não encontrado");
      return { removido: true };
    });
  }
}
