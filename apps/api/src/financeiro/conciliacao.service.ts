import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AceitarConciliacaoDto,
  CriarDespesaDto,
  DespesaLinha,
  ExtratoLinha,
  IgnorarExtratoItemDto,
  ImportarExtratoDto,
  JwtPayload,
  PainelConciliacao,
  ResultadoImportacaoExtrato,
} from "@pacotes/shared";
import { registrarAcao } from "../common/auditoria.util";
import { PrismaService } from "../prisma/prisma.service";
import { conciliar, type Alvo, type LinhaExtrato } from "./conciliacao.util";
import { lerOfx } from "./ofx.parser";

/** Decimal do Prisma em centavos inteiros, que é a moeda do motor. */
function centavos(v: unknown): number {
  return Math.round(Number(v) * 100);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rotuloUnidade(u: { bloco: string | null; identificacao: string }): string {
  return u.bloco ? `${u.identificacao} · ${u.bloco}` : u.identificacao;
}

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function rotuloCompetencia(c: Date): string {
  return `${MES_CURTO[c.getUTCMonth()]}/${c.getUTCFullYear()}`;
}

/**
 * Conciliação bancária: o síndico importa o extrato (OFX), o motor casa cada
 * linha com uma cobrança paga ou uma despesa e explica o porquê, e o aceite
 * fica gravado com a justificativa. É a parte da prestação de contas que
 * hoje consome as horas dele.
 */
@Injectable()
export class ConciliacaoService {
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

  // ---------- Despesas ----------

  criarDespesa(user: JwtPayload, dto: CriarDespesaDto) {
    const cid = this.exigirGestor(user);
    return this.prisma.withTenant(cid, async (tx) => {
      const criada = await tx.despesa.create({
        data: {
          condominioId: cid,
          descricao: dto.descricao.trim(),
          valor: dto.valor,
          data: new Date(`${dto.data}T00:00:00.000Z`),
          criadoPorUsuarioId: user.sub,
        },
      });
      // A despesa já guarda o autor na própria linha, mas ela some quando é
      // removida. A trilha é o que sobrevive à remoção, e é nela que se lê a
      // sequência inteira de mexidas na prestação de contas.
      await registrarAcao(tx, {
        condominioId: cid,
        usuarioId: user.sub,
        acao: "financeiro.criar_despesa",
        detalhe: { descricao: criada.descricao, valor: Number(criada.valor), data: dto.data },
      });
      return criada;
    });
  }

  async listarDespesas(user: JwtPayload): Promise<DespesaLinha[]> {
    const cid = this.exigirGestor(user);
    const despesas = await this.prisma.withTenant(cid, (tx) =>
      tx.despesa.findMany({
        include: { extratoItens: { select: { id: true } } },
        orderBy: { data: "desc" },
        take: 300,
      }),
    );
    return despesas.map((d) => ({
      id: d.id,
      descricao: d.descricao,
      valor: Number(d.valor),
      data: iso(d.data),
      conciliada: d.extratoItens.length > 0,
    }));
  }

  async removerDespesa(user: JwtPayload, id: string) {
    const cid = this.exigirGestor(user);
    return this.prisma.withTenant(cid, async (tx) => {
      const despesa = await tx.despesa.findUnique({
        where: { id },
        include: { extratoItens: { select: { id: true } } },
      });
      if (!despesa) throw new NotFoundException("Despesa não encontrada");
      // Despesa conciliada é parte da prestação de contas: apagar por cima
      // deixaria uma linha do extrato apontando para o nada.
      if (despesa.extratoItens.length > 0) {
        throw new BadRequestException(
          "Despesa já conciliada com o extrato. Desfaça a conciliação antes.",
        );
      }
      await tx.despesa.delete({ where: { id } });
      await registrarAcao(tx, {
        condominioId: cid,
        usuarioId: user.sub,
        acao: "financeiro.remover_despesa",
        detalhe: {
          descricao: despesa.descricao,
          valor: Number(despesa.valor),
          data: iso(despesa.data),
        },
      });
      return { removida: true };
    });
  }

  // ---------- Extrato ----------

  async importarExtrato(
    user: JwtPayload,
    dto: ImportarExtratoDto,
  ): Promise<ResultadoImportacaoExtrato> {
    const cid = this.exigirGestor(user);
    const { lancamentos, ilegiveis } = lerOfx(dto.ofx);
    if (lancamentos.length === 0) {
      throw new BadRequestException(
        "Nenhum lançamento legível no arquivo. É um OFX exportado do banco?",
      );
    }
    return this.prisma.withTenant(cid, async (tx) => {
      // `skipDuplicates` sobre o par (condominio, fitid): reimportar o mesmo
      // arquivo, ou dois extratos com sobreposição de período, não duplica.
      const r = await tx.extratoItem.createMany({
        data: lancamentos.map((l) => ({
          condominioId: cid,
          fitid: l.fitid,
          data: new Date(`${l.data}T00:00:00.000Z`),
          valor: l.valorCentavos / 100,
          descricao: l.descricao.slice(0, 300),
        })),
        skipDuplicates: true,
      });
      return {
        importados: r.count,
        repetidos: lancamentos.length - r.count,
        ilegiveis,
      };
    });
  }

  // ---------- O painel de conciliação ----------

  async painel(user: JwtPayload): Promise<PainelConciliacao> {
    const cid = this.exigirGestor(user);
    const { pendentes, conciliadas, ignoradas, cobrancas, despesas } =
      await this.prisma.withTenant(cid, async (tx) => ({
        pendentes: await tx.extratoItem.findMany({
          where: { conciliadoEm: null, ignoradoEm: null },
          orderBy: { data: "asc" },
          take: 500,
        }),
        conciliadas: await tx.extratoItem.count({
          where: { conciliadoEm: { not: null } },
        }),
        ignoradas: await tx.extratoItem.count({
          where: { ignoradoEm: { not: null } },
        }),
        // Candidatas: cobranças pagas que nenhuma linha do extrato cobre.
        cobrancas: await tx.cobranca.findMany({
          where: { status: "PAGA", extratoItens: { none: {} } },
          include: { unidade: true },
          take: 500,
        }),
        despesas: await tx.despesa.findMany({
          where: { extratoItens: { none: {} } },
          take: 500,
        }),
      }));

    const linhas: LinhaExtrato[] = pendentes.map((p) => ({
      id: p.id,
      data: iso(p.data),
      valorCentavos: centavos(p.valor),
      descricao: p.descricao,
    }));
    const alvos: Alvo[] = [
      ...cobrancas.map((c) => ({
        id: c.id,
        tipo: "COBRANCA" as const,
        // O dia que deve bater com o extrato é o do pagamento confirmado;
        // sem ele (baixa manual antiga), o vencimento é a melhor âncora.
        data: iso(c.pagoEm ?? c.vencimento),
        valorCentavos: centavos(c.valorPago ?? c.valor),
        rotulo: `${rotuloUnidade(c.unidade)}, ${rotuloCompetencia(c.competencia)}`,
      })),
      ...despesas.map((d) => ({
        id: d.id,
        tipo: "DESPESA" as const,
        data: iso(d.data),
        valorCentavos: centavos(d.valor),
        rotulo: d.descricao,
      })),
    ];

    const r = conciliar(linhas, alvos);
    const linhaPorId = new Map(pendentes.map((p) => [p.id, p]));
    const alvoPorId = new Map(alvos.map((a) => [a.id, a]));
    const paraLinha = (p: (typeof pendentes)[number]): ExtratoLinha => ({
      id: p.id,
      data: iso(p.data),
      valor: Number(p.valor),
      descricao: p.descricao,
    });

    return {
      sugestoes: r.sugestoes.map((s) => {
        const alvo = alvoPorId.get(s.alvoId)!;
        return {
          extrato: paraLinha(linhaPorId.get(s.extratoItemId)!),
          alvoTipo: s.alvoTipo,
          alvoId: s.alvoId,
          alvoRotulo: alvo.rotulo,
          alvoData: alvo.data,
          alvoValor: alvo.valorCentavos / 100,
          confianca: s.confianca,
          motivo: s.motivo,
        };
      }),
      semPar: r.semPar.map((id) => paraLinha(linhaPorId.get(id)!)),
      alvosSemExtrato: r.alvosSemExtrato.map((id) => {
        const a = alvoPorId.get(id)!;
        return {
          tipo: a.tipo,
          rotulo: a.rotulo,
          data: a.data,
          valor: a.valorCentavos / 100,
        };
      }),
      conciliadas,
      ignoradas,
    };
  }

  // ---------- Aceite, ignorar, desfazer ----------

  async aceitar(user: JwtPayload, dto: AceitarConciliacaoDto) {
    const cid = this.exigirGestor(user);
    return this.prisma.withTenant(cid, async (tx) => {
      let aceitas = 0;
      for (const item of dto.itens) {
        // Revalida o par contra o banco: entre o GET e o aceite pode ter
        // entrado outro aceite; conciliar por cima duplicaria o vínculo.
        const linha = await tx.extratoItem.findUnique({
          where: { id: item.extratoItemId },
        });
        if (!linha || linha.conciliadoEm || linha.ignoradoEm) continue;
        if (item.alvoTipo === "COBRANCA") {
          const livre = await tx.cobranca.findFirst({
            where: { id: item.alvoId, extratoItens: { none: {} } },
          });
          if (!livre) continue;
        } else {
          const livre = await tx.despesa.findFirst({
            where: { id: item.alvoId, extratoItens: { none: {} } },
          });
          if (!livre) continue;
        }
        await tx.extratoItem.update({
          where: { id: item.extratoItemId },
          data: {
            conciliadoEm: new Date(),
            conciliadoObs: item.motivo.slice(0, 300),
            ...(item.alvoTipo === "COBRANCA"
              ? { cobrancaId: item.alvoId }
              : { despesaId: item.alvoId }),
          },
        });
        aceitas++;
      }
      await registrarAcao(tx, {
        condominioId: cid,
        usuarioId: user.sub,
        acao: "financeiro.aceitar_conciliacao",
        detalhe: { aceitas, recusadas: dto.itens.length - aceitas },
      });
      return { aceitas, recusadas: dto.itens.length - aceitas };
    });
  }

  /** Rendimento, estorno: linha que não pertence à prestação, com o porquê. */
  async ignorar(user: JwtPayload, id: string, dto: IgnorarExtratoItemDto) {
    const cid = this.exigirGestor(user);
    return this.prisma.withTenant(cid, async (tx) => {
      const { count } = await tx.extratoItem.updateMany({
        where: { id, conciliadoEm: null, ignoradoEm: null },
        data: { ignoradoEm: new Date(), ignoradoObs: dto.motivo.trim() },
      });
      if (count === 0) throw new NotFoundException("Linha não encontrada");
      await registrarAcao(tx, {
        condominioId: cid,
        usuarioId: user.sub,
        acao: "financeiro.ignorar_extrato",
        detalhe: { extratoItemId: id, motivo: dto.motivo },
      });
      return { ignorada: true };
    });
  }

  async desfazer(user: JwtPayload, id: string) {
    const cid = this.exigirGestor(user);
    return this.prisma.withTenant(cid, async (tx) => {
      const { count } = await tx.extratoItem.updateMany({
        where: { id },
        data: {
          conciliadoEm: null,
          conciliadoObs: null,
          ignoradoEm: null,
          ignoradoObs: null,
          cobrancaId: null,
          despesaId: null,
        },
      });
      if (count === 0) throw new NotFoundException("Linha não encontrada");
      return { desfeita: true };
    });
  }
}
