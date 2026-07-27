import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import type {
  ConsumosResposta,
  EstadoLeituras,
  ExportLeiturasDto,
  HistoricoConsumoMes,
  JwtPayload,
  LeituraRegistrada,
  RegistrarLeituraDto,
  SalvarTarifaDto,
  TarifaLinha,
  TipoMedidor,
} from "@pacotes/shared";
import { CompetenciaSchema, TIPOS_MEDIDOR } from "@pacotes/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  competenciaParaData,
  dataParaCompetencia,
  somarMeses,
} from "./competencia.util";
import {
  agruparPorUnidade,
  alertaPara,
  consumosDerivados,
  r2,
  r3,
} from "./consumo.util";
import { DadosExport, ExportService, MesExport } from "./export.service";

/** Token curto que autoriza UM download de relatório (nunca o JWT de sessão em URL). */
export interface ExportTokenPayload {
  tipo: "export";
  condominioId: string;
  formato: "xlsx" | "pdf";
  escopo: "mes" | "geral";
  tipoMedidor: TipoMedidor;
  competencia: string;
}

@Injectable()
export class LeiturasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly exportService: ExportService,
  ) {}

  private tenantEquipe(user: JwtPayload): string {
    if (user.tipo !== "usuario" || !user.condominioId) {
      throw new ForbiddenException("Apenas equipe do condomínio");
    }
    return user.condominioId;
  }

  /** Quem registra leitura é quem anda com o celular: porteiro/apoio. */
  private exigirLeitor(user: JwtPayload): string {
    const cid = this.tenantEquipe(user);
    if (user.papel !== "PORTEIRO" && user.papel !== "APOIO") {
      throw new ForbiddenException("Apenas porteiro ou apoio registram leituras");
    }
    return cid;
  }

  private exigirGestor(user: JwtPayload): string {
    const cid = this.tenantEquipe(user);
    if (user.papel !== "SINDICO" && user.papel !== "ADMIN") {
      throw new ForbiddenException("Apenas síndico ou admin");
    }
    return cid;
  }

  private parseFiltros(tipo?: string, competencia?: string) {
    if (!tipo || !(TIPOS_MEDIDOR as readonly string[]).includes(tipo)) {
      throw new BadRequestException("tipo deve ser AGUA ou GAS");
    }
    const parsed = CompetenciaSchema.safeParse(competencia);
    if (!parsed.success) {
      throw new BadRequestException("competencia deve ser YYYY-MM");
    }
    return {
      tipo: tipo as TipoMedidor,
      compStr: parsed.data,
      comp: competenciaParaData(parsed.data),
    };
  }

  async registrar(
    user: JwtPayload,
    dto: RegistrarLeituraDto,
  ): Promise<LeituraRegistrada> {
    const cid = this.exigirLeitor(user);
    const comp = competenciaParaData(dto.competencia);
    const valor = new Prisma.Decimal(dto.valor.toFixed(3));
    return this.prisma.withTenant(cid, async (tx) => {
      // O RLS filtra por tenant: unidade de outro condomínio volta null.
      const unidade = await tx.unidade.findUnique({ where: { id: dto.unidadeId } });
      if (!unidade) {
        throw new BadRequestException("Unidade não encontrada neste condomínio");
      }
      await tx.leituraMedidor.upsert({
        where: {
          unidadeId_tipo_competencia: {
            unidadeId: dto.unidadeId,
            tipo: dto.tipo,
            competencia: comp,
          },
        },
        create: {
          condominioId: cid,
          unidadeId: dto.unidadeId,
          tipo: dto.tipo,
          competencia: comp,
          valor,
          fotoKey: dto.fotoKey,
          lidoPorId: user.sub,
        },
        // Reenvio corrige o valor. fotoKey ausente NÃO apaga a foto já
        // registrada: a fila offline drena a operação sem a key quando o
        // upload da foto falhou por motivo não-rede.
        update: { valor, fotoKey: dto.fotoKey ?? undefined, lidoPorId: user.sub },
      });
      const anteriores = await tx.leituraMedidor.findMany({
        where: { unidadeId: dto.unidadeId, tipo: dto.tipo, competencia: { lt: comp } },
        orderBy: { competencia: "desc" },
        take: 7,
      });
      const anterior = anteriores[0] ?? null;
      const consumo = anterior ? r3(Number(valor.minus(anterior.valor))) : null;
      return {
        anterior: anterior
          ? {
              competencia: dataParaCompetencia(anterior.competencia),
              valor: Number(anterior.valor),
            }
          : null,
        consumo,
        alerta: alertaPara(consumo, consumosDerivados(anteriores)),
      };
    });
  }

  /** Progresso do mês + leitura anterior por unidade: o fetch único do app do zelador. */
  async estado(
    user: JwtPayload,
    tipoQ?: string,
    competenciaQ?: string,
  ): Promise<EstadoLeituras> {
    const cid = this.tenantEquipe(user);
    const { tipo, comp, compStr } = this.parseFiltros(tipoQ, competenciaQ);
    return this.prisma.withTenant(cid, async (tx) => {
      const unidades = await tx.unidade.findMany({
        orderBy: [{ bloco: "asc" }, { identificacao: "asc" }],
      });
      const leituras = await tx.leituraMedidor.findMany({
        where: { tipo, competencia: { lte: comp } },
        orderBy: { competencia: "desc" },
      });
      const porUnidade = agruparPorUnidade(leituras);
      const linhas = unidades.map((u) => {
        const doMedidor = porUnidade.get(u.id) ?? [];
        const atual =
          doMedidor[0]?.competencia.getTime() === comp.getTime() ? doMedidor[0] : null;
        const anterior = doMedidor.find((l) => l.competencia < comp) ?? null;
        return {
          unidadeId: u.id,
          bloco: u.bloco,
          identificacao: u.identificacao,
          anterior: anterior
            ? {
                competencia: dataParaCompetencia(anterior.competencia),
                valor: Number(anterior.valor),
              }
            : null,
          atual: atual ? Number(atual.valor) : null,
        };
      });
      return {
        competencia: compStr,
        tipo,
        total: linhas.length,
        lidas: linhas.filter((l) => l.atual !== null).length,
        unidades: linhas,
      };
    });
  }

  /** A tabela do painel do síndico (web e app). */
  async consumos(
    user: JwtPayload,
    tipoQ?: string,
    competenciaQ?: string,
  ): Promise<ConsumosResposta> {
    const cid = this.exigirGestor(user);
    const { tipo, comp, compStr } = this.parseFiltros(tipoQ, competenciaQ);
    // A transação fica só com as queries; a assinatura dos foto-tokens (um
    // por unidade com foto, centenas num condomínio grande) roda depois,
    // para não prender a conexão do pool com trabalho de CPU.
    const { unidades, porUnidade, tarifa } = await this.prisma.withTenant(
      cid,
      async (tx) => {
        const unidades = await tx.unidade.findMany({
          orderBy: [{ bloco: "asc" }, { identificacao: "asc" }],
        });
        const leituras = await tx.leituraMedidor.findMany({
          where: { tipo, competencia: { lte: comp } },
          orderBy: { competencia: "desc" },
          include: { lidoPor: { select: { nome: true } } },
        });
        const tarifaRow = await tx.tarifaConsumo.findUnique({
          where: { condominioId_tipo: { condominioId: cid, tipo } },
        });
        return {
          unidades,
          porUnidade: agruparPorUnidade(leituras),
          tarifa: tarifaRow ? Number(tarifaRow.valorPorM3) : null,
        };
      },
    );

    const linhas = await Promise.all(
      unidades.map(async (u) => {
        const doMedidor = porUnidade.get(u.id) ?? [];
        const atual =
          doMedidor[0]?.competencia.getTime() === comp.getTime()
            ? doMedidor[0]
            : null;
        const anteriores = doMedidor.filter((l) => l.competencia < comp);
        const anterior = anteriores[0] ?? null;
        const consumo =
          atual && anterior ? r3(Number(atual.valor.minus(anterior.valor))) : null;
        return {
          unidadeId: u.id,
          bloco: u.bloco,
          identificacao: u.identificacao,
          anterior: anterior
            ? {
                competencia: dataParaCompetencia(anterior.competencia),
                valor: Number(anterior.valor),
              }
            : null,
          atual: atual
            ? {
                valor: Number(atual.valor),
                lidoEm: atual.lidoEm.toISOString(),
                lidoPor: atual.lidoPor.nome,
                fotoRef: atual.fotoKey
                  ? {
                      key: atual.fotoKey,
                      token: await this.jwt.signAsync(
                        { tipo: "foto", key: atual.fotoKey },
                        { expiresIn: "1h" },
                      ),
                    }
                  : null,
              }
            : null,
          consumo,
          valorReais:
            consumo !== null && tarifa !== null && consumo >= 0
              ? r2(consumo * tarifa)
              : null,
          alerta: alertaPara(consumo, consumosDerivados(anteriores)),
        };
      }),
    );

    // Consumo negativo é erro a conferir (medidor trocado, leitura errada):
    // fica na linha com alerta, mas fora de TODO total. Sem isso o total de
    // m³ encolheria enquanto o de R$ (que já ignora negativos) não.
    const consumoTotal = r3(
      linhas.reduce(
        (soma, l) => soma + (l.consumo !== null && l.consumo >= 0 ? l.consumo : 0),
        0,
      ),
    );
    return {
      competencia: compStr,
      tipo,
      tarifa,
      linhas,
      totais: {
        lidas: linhas.filter((l) => l.atual !== null).length,
        totalUnidades: linhas.length,
        consumo: consumoTotal,
        valorReais:
          tarifa !== null
            ? r2(linhas.reduce((soma, l) => soma + (l.valorReais ?? 0), 0))
            : null,
      },
    };
  }

  /** Série mensal agregada do condomínio, ancorada na competência do cliente. */
  async historico(
    user: JwtPayload,
    tipoQ?: string,
    competenciaQ?: string,
    mesesQ?: string,
  ): Promise<HistoricoConsumoMes[]> {
    const cid = this.exigirGestor(user);
    const { tipo, comp, compStr } = this.parseFiltros(tipoQ, competenciaQ);
    const meses = Math.min(36, Math.max(1, parseInt(mesesQ ?? "12", 10) || 12));
    return this.prisma.withTenant(cid, async (tx) => {
      const leituras = await tx.leituraMedidor.findMany({
        where: { tipo, competencia: { lte: comp } },
        orderBy: [{ unidadeId: "asc" }, { competencia: "asc" }],
      });
      const tarifaRow = await tx.tarifaConsumo.findUnique({
        where: { condominioId_tipo: { condominioId: cid, tipo } },
      });
      const tarifa = tarifaRow ? Number(tarifaRow.valorPorM3) : null;

      const consumoPorMes = new Map<string, number>();
      const lidasPorMes = new Map<string, number>();
      for (let i = 0; i < leituras.length; i++) {
        const atual = leituras[i];
        const chave = dataParaCompetencia(atual.competencia);
        lidasPorMes.set(chave, (lidasPorMes.get(chave) ?? 0) + 1);
        const anterior = leituras[i - 1];
        if (anterior && anterior.unidadeId === atual.unidadeId) {
          const consumo = Number(atual.valor.minus(anterior.valor));
          // Negativo é erro a conferir: fora dos totais, como em consumos().
          if (consumo >= 0) {
            consumoPorMes.set(chave, (consumoPorMes.get(chave) ?? 0) + consumo);
          }
        }
      }

      const serie: HistoricoConsumoMes[] = [];
      for (let m = meses - 1; m >= 0; m--) {
        const chave = somarMeses(compStr, -m);
        const consumoTotal = r3(consumoPorMes.get(chave) ?? 0);
        serie.push({
          competencia: chave,
          consumoTotal,
          valorTotal: tarifa !== null ? r2(consumoTotal * tarifa) : null,
          unidadesLidas: lidasPorMes.get(chave) ?? 0,
        });
      }
      return serie;
    });
  }

  async tarifas(user: JwtPayload): Promise<TarifaLinha[]> {
    const cid = this.exigirGestor(user);
    return this.prisma.withTenant(cid, async (tx) => {
      const rows = await tx.tarifaConsumo.findMany({ orderBy: { tipo: "asc" } });
      return rows.map((t) => ({
        tipo: t.tipo,
        valorPorM3: Number(t.valorPorM3),
        atualizadoEm: t.atualizadoEm.toISOString(),
      }));
    });
  }

  async salvarTarifa(user: JwtPayload, dto: SalvarTarifaDto): Promise<TarifaLinha> {
    const cid = this.exigirGestor(user);
    const valor = new Prisma.Decimal(dto.valorPorM3.toFixed(2));
    return this.prisma.withTenant(cid, async (tx) => {
      const row = await tx.tarifaConsumo.upsert({
        where: { condominioId_tipo: { condominioId: cid, tipo: dto.tipo } },
        create: { condominioId: cid, tipo: dto.tipo, valorPorM3: valor },
        update: { valorPorM3: valor },
      });
      return {
        tipo: row.tipo,
        valorPorM3: Number(row.valorPorM3),
        atualizadoEm: row.atualizadoEm.toISOString(),
      };
    });
  }

  /** Emite o token curto de download. A URL final quem monta é o cliente. */
  async exportToken(
    user: JwtPayload,
    dto: ExportLeiturasDto,
  ): Promise<{ token: string }> {
    const cid = this.exigirGestor(user);
    const payload: ExportTokenPayload = {
      tipo: "export",
      condominioId: cid,
      formato: dto.formato,
      escopo: dto.escopo,
      tipoMedidor: dto.tipo,
      competencia: dto.competencia,
    };
    return { token: await this.jwt.signAsync(payload, { expiresIn: "10m" }) };
  }

  /** Monta o arquivo do relatório a partir de um token JÁ verificado. */
  async gerarExport(
    payload: ExportTokenPayload,
  ): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    const condominio = await this.prisma.condominio.findUnique({
      where: { id: payload.condominioId },
    });
    if (!condominio) throw new BadRequestException("Condomínio não encontrado");

    const tipo = payload.tipoMedidor;
    const comp = competenciaParaData(payload.competencia);
    const dados = await this.prisma.withTenant(
      payload.condominioId,
      async (tx): Promise<DadosExport> => {
        const unidades = await tx.unidade.findMany({
          orderBy: [{ bloco: "asc" }, { identificacao: "asc" }],
        });
        const leituras = await tx.leituraMedidor.findMany({
          where: {
            tipo,
            ...(payload.escopo === "mes" ? { competencia: { lte: comp } } : {}),
          },
          orderBy: { competencia: "desc" },
        });
        const tarifaRow = await tx.tarifaConsumo.findUnique({
          where: { condominioId_tipo: { condominioId: payload.condominioId, tipo } },
        });
        const tarifa = tarifaRow ? Number(tarifaRow.valorPorM3) : null;
        const porUnidade = agruparPorUnidade(leituras);

        const competencias =
          payload.escopo === "mes"
            ? [payload.competencia]
            : [...new Set(leituras.map((l) => dataParaCompetencia(l.competencia)))];
        // Sem nenhuma leitura, o "geral" ainda precisa de uma aba/página: um
        // xlsx sem aba nenhuma é arquivo inválido para o Excel.
        if (competencias.length === 0) competencias.push(payload.competencia);

        const meses: MesExport[] = competencias.map((compStr) => {
          const compData = competenciaParaData(compStr);
          const linhas = unidades.map((u) => {
            const doMedidor = porUnidade.get(u.id) ?? [];
            const atual =
              doMedidor.find((l) => l.competencia.getTime() === compData.getTime()) ??
              null;
            const anterior =
              doMedidor.find((l) => l.competencia < compData) ?? null;
            const consumo =
              atual && anterior
                ? r3(Number(atual.valor.minus(anterior.valor)))
                : null;
            return {
              unidade: u.bloco ? `${u.bloco} ${u.identificacao}` : u.identificacao,
              anterior: anterior ? Number(anterior.valor) : null,
              atual: atual ? Number(atual.valor) : null,
              consumo,
              valorReais:
                consumo !== null && tarifa !== null && consumo >= 0
                  ? r2(consumo * tarifa)
                  : null,
            };
          });
          const consumoTotal = r3(
            linhas.reduce(
              (soma, l) =>
                soma + (l.consumo !== null && l.consumo >= 0 ? l.consumo : 0),
              0,
            ),
          );
          return {
            competencia: compStr,
            linhas,
            totais: {
              lidas: linhas.filter((l) => l.atual !== null).length,
              totalUnidades: linhas.length,
              consumo: consumoTotal,
              valorReais:
                tarifa !== null
                  ? r2(linhas.reduce((soma, l) => soma + (l.valorReais ?? 0), 0))
                  : null,
            },
          };
        });

        return { condominio: condominio.nome, tipo, tarifa, meses };
      },
    );

    const sufixo = payload.escopo === "mes" ? payload.competencia : "geral";
    const filename = `consumo-${tipo === "AGUA" ? "agua" : "gas"}-${sufixo}.${payload.formato}`;
    if (payload.formato === "xlsx") {
      return {
        buffer: await this.exportService.gerarXlsx(dados),
        filename,
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }
    return {
      buffer: await this.exportService.gerarPdf(dados),
      filename,
      mime: "application/pdf",
    };
  }
}
