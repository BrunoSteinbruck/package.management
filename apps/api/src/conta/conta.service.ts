import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AlterarEmailDto,
  AlterarSenhaDto,
  Capacidades,
  JwtPayload,
  MinhaConta,
  ModuloCondominio,
} from "@pacotes/shared";
import { MODULOS_CONDOMINIO } from "@pacotes/shared";
import { randomUUID } from "node:crypto";
import { gerarHash, verificarHash } from "../auth/senha.util";
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

  /**
   * Módulos que esta sessão enxerga. O app chama ao abrir e guarda o
   * resultado; a home usa para decidir quais pontos de entrada mostrar.
   *
   * Fica fora do JWT porque o token vale 90 dias: módulo ligado hoje pelo
   * síndico precisa aparecer na próxima abertura, não no próximo login.
   *
   * Filtra contra `MODULOS_CONDOMINIO` porque a coluna é `text[]`: valor
   * escrito por script ou por versão futura da API não vaza para o cliente
   * como módulo que ele não sabe interpretar.
   */
  async capacidades(user: JwtPayload): Promise<Capacidades> {
    const ids =
      user.tipo === "morador"
        ? (
            await this.prisma.vinculo.findMany({
              where: { moradorId: user.sub, status: "ATIVO" },
              select: { condominioId: true },
            })
          ).map((v) => v.condominioId)
        : user.condominioId
          ? [user.condominioId]
          : [];
    // O link de download acompanha os dois caminhos: quem ainda não tem
    // vínculo nenhum também precisa dele para convidar (e é justamente o
    // primeiro dia do condomínio).
    const appDownloadUrl = process.env.APP_DOWNLOAD_URL ?? null;
    if (ids.length === 0) return { modulos: [], appDownloadUrl };

    const condominios = await this.prisma.condominio.findMany({
      where: { id: { in: ids } },
      select: { modulos: true },
    });
    const ligados = new Set(condominios.flatMap((c) => c.modulos));
    return {
      modulos: MODULOS_CONDOMINIO.filter((m) =>
        ligados.has(m),
      ) as ModuloCondominio[],
      appDownloadUrl,
    };
  }

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
          // A saída da equipe é soft delete, então o device sobreviveria e o
          // aparelho continuaria recebendo push de quem já saiu.
          await tx.device.deleteMany({ where: { usuarioId } });
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

  // ---------- conta do gestor (painel) ----------

  /** Só a equipe tem conta de painel; morador não passa por aqui. */
  private async gestorDaSessao(user: JwtPayload) {
    if (user.tipo !== "usuario") {
      throw new ForbiddenException("Apenas a equipe do condomínio");
    }
    return this.prisma.usuario.findUniqueOrThrow({
      where: { id: user.sub },
      include: { condominio: true },
    });
  }

  async minhaConta(user: JwtPayload): Promise<MinhaConta> {
    const u = await this.gestorDaSessao(user);
    return {
      nome: u.nome,
      telefone: u.telefone,
      email: u.email,
      papel: u.papel,
      condominioNome: u.condominio.nome,
      // O hash NUNCA sai daqui: a tela só precisa saber se existe, para pedir
      // (ou não) a senha atual.
      temSenha: u.senhaHash !== null,
    };
  }

  /**
   * Trocar a própria senha.
   *
   * A senha atual é exigida mesmo com a sessão aberta: o painel vive no
   * computador da administração, e um navegador esquecido aberto não pode
   * virar troca de senha, que expulsaria o dono da própria conta.
   */
  async alterarSenha(user: JwtPayload, dto: AlterarSenhaDto) {
    const u = await this.gestorDaSessao(user);
    if (!u.senhaHash) {
      throw new BadRequestException(
        "Sua conta ainda não tem senha. Use 'Esqueci a senha' na tela de entrada para criar a primeira.",
      );
    }
    /**
     * 400, e não 401: a SESSÃO está válida, o que está errado é um campo do
     * corpo. O painel trata todo 401 como sessão expirada e devolve a tela de
     * login, então um 401 aqui expulsaria do painel quem só errou a digitação
     * da senha atual, perdendo o que ele estivesse fazendo.
     */
    if (!verificarHash(dto.senhaAtual, u.senhaHash)) {
      throw new BadRequestException("A senha atual está incorreta");
    }
    await this.prisma.usuario.update({
      where: { id: u.id },
      data: {
        senhaHash: gerarHash(dto.novaSenha),
        senhaTentativas: 0,
        senhaBloqueadaAte: null,
        // Um link de redefinição pendente perde a validade: quem trocou a
        // senha sabendo a atual não deveria continuar alcançável por um
        // e-mail antigo parado numa caixa de entrada.
        redefinicaoTokenHash: null,
        redefinicaoExpiraEm: null,
      },
    });
    return { alterada: true };
  }

  /**
   * Definir ou trocar o próprio e-mail de recuperação.
   *
   * Quem JÁ tem senha precisa informá-la. Trocar o e-mail de recuperação sem
   * prova nenhuma é redirecionar o "esqueci a senha" para a caixa de outra
   * pessoa: com a sessão sequestrada, seria tomar a conta em definitivo, e o
   * dono descobriria só quando não conseguisse mais entrar.
   *
   * Quem ainda NÃO tem senha é o gestor cadastrado antes desta funcionalidade
   * existir: é justamente ele que precisa deste endpoint, e cobrar dele uma
   * senha que nunca teve seria trancá-lo do lado de fora para sempre.
   */
  async alterarEmail(user: JwtPayload, dto: AlterarEmailDto) {
    const u = await this.gestorDaSessao(user);
    if (u.senhaHash) {
      // 400 pelo mesmo motivo do método acima: a sessão está boa, o campo é
      // que não confere.
      if (!dto.senhaAtual || !verificarHash(dto.senhaAtual, u.senhaHash)) {
        throw new BadRequestException(
          "Informe sua senha atual para trocar o e-mail de recuperação",
        );
      }
    }
    const jaUsado = await this.prisma.usuario.findFirst({
      where: { email: dto.email, id: { not: u.id } },
    });
    if (jaUsado) {
      throw new ConflictException("Este e-mail já pertence a outra conta");
    }
    await this.prisma.usuario.update({
      where: { id: u.id },
      data: { email: dto.email },
    });
    return { email: dto.email };
  }
}
