import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { JwtPayload } from "@pacotes/shared";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Exclusão de conta: exigida pela App Store (desde 2022) e pelo Google Play
 * para todo app que permite criar conta.
 *
 * A regra de ouro aqui é a divisão de papéis da LGPD: o CONDOMÍNIO é o
 * controlador dos registros de portaria (quem recebeu qual pacote, quando),
 * nós somos operadores. Apagar a conta de uma pessoa não pode apagar o
 * registro operacional do condomínio, mas tem que apagar a identidade dela.
 *
 * Daí os dois caminhos:
 *  - MORADOR: some de verdade (não é autor de registro de custódia). Pacotes
 *    pertencem à UNIDADE, não ao morador, então o histórico do condomínio
 *    continua intacto.
 *  - EQUIPE: anonimiza e desativa. Pacote.recebidoPorId e Retirada.entreguePorId
 *    são obrigatórios (NOT NULL) e são a cadeia de custódia: o produto inteiro
 *    se apoia neles. Apagar a linha destruiria o histórico do condomínio; então
 *    a linha fica, sem nome e sem telefone, e ninguém mais loga nela.
 */
@Injectable()
export class ContaService {
  constructor(private readonly prisma: PrismaService) {}

  /** O que a exclusão vai fazer, para a tela de confirmação do app. */
  async previa(user: JwtPayload) {
    if (user.tipo === "morador") {
      const vinculos = await this.prisma.vinculo.findMany({
        where: { moradorId: user.sub, status: { not: "REMOVIDO" } },
      });
      return {
        tipo: "morador" as const,
        unidadesVinculadas: vinculos.length,
        efeitos: [
          "Seu cadastro, seus vínculos com a unidade e este aparelho são apagados.",
          "Você para de receber avisos de encomenda.",
          "O histórico de encomendas da unidade continua com o condomínio: ele é do condomínio, não seu.",
          "Para voltar depois, é preciso um novo convite de alguém da unidade.",
        ],
      };
    }

    const bloqueio = await this.motivoDeBloqueioDaEquipe(user.sub);
    return {
      tipo: "equipe" as const,
      bloqueio,
      efeitos: [
        "Seu nome e telefone são removidos e você perde o acesso ao app.",
        "Os registros de portaria que você fez continuam com o condomínio, sem o seu nome: eles são o comprovante das entregas.",
        "Para voltar, o síndico precisa cadastrar você de novo.",
      ],
    };
  }

  async excluir(user: JwtPayload) {
    return user.tipo === "morador"
      ? this.excluirMorador(user.sub)
      : this.excluirUsuario(user.sub);
  }

  private async excluirMorador(moradorId: string) {
    const morador = await this.prisma.morador.findUnique({
      where: { id: moradorId },
      include: { vinculos: true },
    });
    if (!morador) throw new NotFoundException("Conta não encontrada");

    // Avisos ficam (a ocorrência aberta é problema real do condomínio), mas
    // perdem o autor. `avisos` tem RLS, então precisa de uma transação por
    // tenant: um morador pode ter vínculo em mais de um condomínio.
    const condominios = new Set(morador.vinculos.map((v) => v.condominioId));
    for (const condominioId of condominios) {
      await this.prisma.withTenant(condominioId, (tx) =>
        tx.aviso.updateMany({
          where: { criadoPorMoradorId: moradorId },
          data: { criadoPorMoradorId: null },
        }),
      );
    }

    await this.prisma.$transaction([
      this.prisma.device.deleteMany({ where: { moradorId } }),
      this.prisma.vinculo.deleteMany({ where: { moradorId } }),
      this.prisma.morador.delete({ where: { id: moradorId } }),
      // Um OTP pendente reviveria o telefone recém-apagado no próximo verify.
      this.prisma.otpChallenge.deleteMany({
        where: { telefone: morador.telefone },
      }),
    ]);

    return { excluido: true };
  }

  private async excluirUsuario(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });
    if (!usuario) throw new NotFoundException("Conta não encontrada");

    // Fast-fail com a mensagem amigável; a checagem que VALE é a de dentro
    // da transação, logo abaixo.
    const bloqueio = await this.motivoDeBloqueioDaEquipe(usuarioId);
    if (bloqueio) throw new ConflictException(bloqueio);

    await this.prisma.withTenant(usuario.condominioId, (tx) =>
      tx.aviso.updateMany({
        where: { criadoPorUsuarioId: usuarioId },
        data: { criadoPorUsuarioId: null },
      }),
    );

    try {
      await this.prisma.$transaction(
        async (tx) => {
          // Recontagem DENTRO da transação serializável: os dois últimos
          // gestores se excluindo ao mesmo tempo passariam ambos na checagem
          // externa (TOCTOU) e deixariam o condomínio sem administrador.
          const aindaBloqueado = await this.motivoDeBloqueioDaEquipe(
            usuarioId,
            tx,
          );
          if (aindaBloqueado) throw new ConflictException(aindaBloqueado);

          await tx.vinculo.updateMany({
            where: { aprovadoPorId: usuarioId },
            data: { aprovadoPorId: null },
          });
          await tx.usuario.update({
            where: { id: usuarioId },
            data: {
              nome: "Usuário removido",
              // O telefone é UNIQUE e é a chave do login. O placeholder não é
              // numérico de propósito: nenhum telefone real (o schema só
              // aceita dígitos) colide com ele, então a conta fica
              // inalcançável mesmo que alguém reative a flag por engano.
              telefone: `removido:${randomUUID()}`,
              ativo: false,
            },
          });
          await tx.otpChallenge.deleteMany({
            where: { telefone: usuario.telefone },
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (e) {
      // Conflito de serialização (P2034): outra exclusão concorrente venceu.
      if ((e as { code?: string }).code === "P2034") {
        throw new ConflictException(
          "Outra alteração na equipe aconteceu ao mesmo tempo. Tente de novo.",
        );
      }
      throw e;
    }

    return { excluido: true };
  }

  /**
   * Um condomínio sem síndico ativo fica órfão: ninguém cadastra porteiro,
   * aprova vínculo ou administra nada, e não há tela para consertar isso.
   * Melhor barrar a saída do último gestor do que deixar o condomínio travado.
   */
  private async motivoDeBloqueioDaEquipe(
    usuarioId: string,
    db: Pick<PrismaService, "usuario"> = this.prisma,
  ) {
    const usuario = await db.usuario.findUnique({
      where: { id: usuarioId },
    });
    if (!usuario) return null;
    if (usuario.papel !== "SINDICO" && usuario.papel !== "ADMIN") return null;

    const outrosGestores = await db.usuario.count({
      where: {
        condominioId: usuario.condominioId,
        papel: { in: ["SINDICO", "ADMIN"] },
        ativo: true,
        id: { not: usuarioId },
      },
    });
    return outrosGestores > 0
      ? null
      : "Você é o último síndico deste condomínio. Cadastre outro síndico antes de excluir sua conta, senão o condomínio fica sem administrador.";
  }
}
