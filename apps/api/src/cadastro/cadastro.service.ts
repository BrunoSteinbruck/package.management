import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type {
  Atividade,
  CategoriaDocumento,
  CriarUnidadesDto,
  CriarUsuarioDto,
  CriarVagasDto,
  ImportarMoradoresDto,
  JwtPayload,
  ModuloCondominio,
  SalvarModulosDto,
  UnidadePanorama,
  VisaoGeralPainel,
} from "@pacotes/shared";
import { MODULOS_CONDOMINIO, rotuloUnidade } from "@pacotes/shared";
import { registrarAcao } from "../common/auditoria.util";
import { nomeDaCompetencia } from "../financeiro/competencia.util";
import { PrismaService } from "../prisma/prisma.service";

/** Quem entra no painel por senha precisa do e-mail para recuperá-la. */
const PRECISA_DE_EMAIL: CriarUsuarioDto["papel"][] = ["SINDICO"];

/**
 * Teto do feed da Visão geral, e de cada fonte que o alimenta.
 *
 * Vale para as duas pontas: nenhuma consulta traz mais do que isto (buscar
 * tudo para descartar quase tudo é trabalho jogado fora), e o feed junto
 * corta no mesmo número depois de ordenado.
 */
const ATIVIDADE_MAX = 20;

const ROTULO_CATEGORIA: Record<CategoriaDocumento, string> = {
  ATA: "Ata",
  REGIMENTO: "Regimento",
  CONVENCAO: "Convenção",
  OUTRO: "Documento",
};

/** A competência é gravada como o dia 1 em UTC; o rótulo quer "2026-07". */
function competenciaDe(d: Date): string {
  return d.toISOString().slice(0, 7);
}

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

  /**
   * A tabela de unidades do painel: quem é o titular, quantos estão vinculados
   * e se alguém da unidade tem o app.
   *
   * Mesma trinca de queries de `adocao()` (unidades no tenant, vínculos ativos
   * pela coluna, devices por morador), só que devolvendo linha a linha em vez
   * de só o total. Continuam três queries independentes do tamanho do prédio:
   * `include` de morador dentro de cada unidade viraria N+1.
   */
  async panoramaUnidades(user: JwtPayload): Promise<UnidadePanorama[]> {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    const unidades = await this.prisma.withTenant(condominioId, (tx) =>
      tx.unidade.findMany({
        select: { id: true, bloco: true, identificacao: true },
        orderBy: [{ bloco: "asc" }, { identificacao: "asc" }],
      }),
    );
    const vinculos = await this.prisma.vinculo.findMany({
      where: { condominioId, status: "ATIVO" },
      select: {
        unidadeId: true,
        moradorId: true,
        morador: { select: { nome: true, telefone: true } },
      },
      orderBy: { criadoEm: "asc" },
    });
    const comApp = new Set(
      (
        await this.prisma.device.findMany({
          where: { moradorId: { in: vinculos.map((v) => v.moradorId) } },
          select: { moradorId: true },
        })
      ).map((d) => d.moradorId),
    );

    const porUnidade = new Map<string, typeof vinculos>();
    for (const v of vinculos) {
      const lista = porUnidade.get(v.unidadeId);
      if (lista) lista.push(v);
      else porUnidade.set(v.unidadeId, [v]);
    }

    return unidades.map((u) => {
      const dela = porUnidade.get(u.id) ?? [];
      return {
        unidadeId: u.id,
        bloco: u.bloco,
        identificacao: u.identificacao,
        // O primeiro a ser vinculado é o titular. Não há coluna que diga isso,
        // e inventar uma para uma tabela de leitura não se paga.
        titular: dela[0]
          ? { nome: dela[0].morador.nome, telefone: dela[0].morador.telefone }
          : null,
        vinculados: dela.length,
        temApp: dela.some((v) => comApp.has(v.moradorId)),
      };
    });
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
    /**
     * O registro precisa do `withTenant` PRÓPRIO.
     *
     * O `updateMany` acima roda fora de transação de tenant porque `vinculos`
     * é tabela global. Já `registros_acao` tem RLS com FORCE: um insert nela
     * sem `app.condominio_id` definido viola a policy `WITH CHECK` e devolve
     * erro cru de banco, não uma linha faltando em silêncio.
     */
    await this.prisma.withTenant(condominioId, (tx) =>
      registrarAcao(tx, {
        condominioId,
        usuarioId: user.sub,
        acao: "cadastro.aprovar_vinculo",
        detalhe: { vinculoId },
      }),
    );
    return { aprovado: true };
  }

  /**
   * Nega o pedido de vínculo. Espelha `aprovarVinculo`, inclusive o
   * `withTenant` próprio para o registro de auditoria.
   *
   * Vai para REMOVIDO e não some da tabela: quem pediu e foi recusado é
   * justamente o caso em que alguém vai perguntar depois o que aconteceu. E
   * como o par (morador, unidade) é único, apagar a linha e recriá-la no
   * pedido seguinte perderia essa história.
   *
   * Recusar não é banir: a importação por CSV e o convite reabrem o vínculo
   * como ATIVO no mesmo `upsert` de sempre.
   */
  async recusarVinculo(user: JwtPayload, vinculoId: string) {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);
    const { count } = await this.prisma.vinculo.updateMany({
      where: { id: vinculoId, status: "PENDENTE", condominioId },
      data: { status: "REMOVIDO", aprovadoPorId: user.sub },
    });
    if (count === 0) {
      throw new ForbiddenException("Vínculo não encontrado ou já tratado");
    }
    await this.prisma.withTenant(condominioId, (tx) =>
      registrarAcao(tx, {
        condominioId,
        usuarioId: user.sub,
        acao: "cadastro.recusar_vinculo",
        detalhe: { vinculoId },
      }),
    );
    return { recusado: true };
  }

  /**
   * O que a Visão geral do painel mostra e não tinha de onde vir.
   *
   * Uma requisição só: são todas do mesmo tenant, e a home do síndico não
   * pode abrir com meia dúzia de spinners. As consultas ficam dentro de UM
   * `withTenant` porque comunicados, documentos, avisos, visitas, cobranças e
   * a trilha têm RLS: fora do tenant voltariam vazias em silêncio, e a tela
   * mostraria um condomínio sem nada acontecendo.
   */
  async visaoGeral(user: JwtPayload): Promise<VisaoGeralPainel> {
    const condominioId = this.tenantDe(user);
    this.exigirGestor(user);

    // Morador é global e o vínculo é que pertence ao condomínio: contar
    // `morador` traria o banco inteiro. E é por PESSOA, não por vínculo:
    // quem tem duas unidades é um morador só.
    const vinculos = await this.prisma.vinculo.findMany({
      where: { condominioId, status: "ATIVO" },
      select: { moradorId: true },
    });
    const moradores = new Set(vinculos.map((v) => v.moradorId)).size;

    const funcionarios = await this.prisma.usuario.count({
      where: { condominioId, ativo: true },
    });

    const dados = await this.prisma.withTenant(condominioId, async (tx) => ({
      conciliacaoPendente: await tx.extratoItem.count({
        where: { conciliadoEm: null, ignoradoEm: null },
      }),
      cobrancasVencidas: await tx.cobranca.count({ where: { status: "VENCIDA" } }),
      // `take` em cada fonte porque o feed corta em ATIVIDADE_MAX no fim:
      // buscar tudo para descartar quase tudo seria trabalho jogado fora.
      pagas: await tx.cobranca.findMany({
        where: { pagoEm: { not: null } },
        orderBy: { pagoEm: "desc" },
        take: ATIVIDADE_MAX,
        include: { unidade: true },
      }),
      comunicados: await tx.comunicado.findMany({
        orderBy: { criadoEm: "desc" },
        take: ATIVIDADE_MAX,
        select: { titulo: true, criadoEm: true },
      }),
      documentos: await tx.documento.findMany({
        orderBy: { criadoEm: "desc" },
        take: ATIVIDADE_MAX,
        select: { titulo: true, categoria: true, criadoEm: true },
      }),
      relatos: await tx.aviso.findMany({
        where: { criadoPorMoradorId: { not: null } },
        orderBy: { criadoEm: "desc" },
        take: ATIVIDADE_MAX,
        include: { unidade: true },
      }),
      visitas: await tx.visita.findMany({
        where: { chegadaEm: { not: null } },
        orderBy: { chegadaEm: "desc" },
        take: ATIVIDADE_MAX,
        include: { unidade: true },
      }),
      geracoes: await tx.registroAcao.findMany({
        where: { acao: "financeiro.gerar_cobrancas" },
        orderBy: { criadoEm: "desc" },
        take: ATIVIDADE_MAX,
        select: { detalhe: true, criadoEm: true },
      }),
    }));

    const atividade: Atividade[] = [
      ...dados.pagas.map((c) => ({
        tipo: "cobranca_paga" as const,
        titulo: `Taxa de ${nomeDaCompetencia(competenciaDe(c.competencia))} paga`,
        detalhe: rotuloUnidade(c.unidade),
        quando: c.pagoEm!.toISOString(),
      })),
      ...dados.comunicados.map((c) => ({
        tipo: "comunicado" as const,
        titulo: c.titulo,
        detalhe: "comunicado publicado",
        quando: c.criadoEm.toISOString(),
      })),
      ...dados.documentos.map((d) => ({
        tipo: "documento" as const,
        titulo: d.titulo,
        detalhe: `${ROTULO_CATEGORIA[d.categoria]} publicada`,
        quando: d.criadoEm.toISOString(),
      })),
      ...dados.relatos.map((a) => ({
        tipo: "relato" as const,
        titulo: a.motivo,
        detalhe: rotuloUnidade(a.unidade),
        quando: a.criadoEm.toISOString(),
      })),
      ...dados.visitas.map((v) => ({
        tipo: "visita" as const,
        titulo: `${v.nomeVisitante} entrou`,
        detalhe: rotuloUnidade(v.unidade),
        quando: v.chegadaEm!.toISOString(),
      })),
      ...dados.geracoes.flatMap((g) => {
        // A trilha guarda Json livre: um registro antigo, ou de uma versão que
        // mudou o formato, não pode virar "undefined cobranças geradas".
        const criadas = (g.detalhe as { criadas?: unknown } | null)?.criadas;
        if (typeof criadas !== "number" || criadas === 0) return [];
        return [
          {
            tipo: "cobrancas_geradas" as const,
            titulo: `${criadas} cobrança${criadas === 1 ? "" : "s"} gerada${criadas === 1 ? "" : "s"}`,
            detalhe: null,
            quando: g.criadoEm.toISOString(),
          },
        ];
      }),
    ]
      .sort((a, b) => b.quando.localeCompare(a.quando))
      .slice(0, ATIVIDADE_MAX);

    return {
      moradores,
      funcionarios,
      conciliacaoPendente: dados.conciliacaoPendente,
      cobrancasVencidas: dados.cobrancasVencidas,
      atividade,
    };
  }
}
