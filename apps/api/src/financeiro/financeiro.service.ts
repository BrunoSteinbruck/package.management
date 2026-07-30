import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import type {
  CobrancaGestor,
  CobrancaMorador,
  ConfigFinanceiro,
  GerarCobrancasDto,
  JwtPayload,
  ResumoFinanceiro,
  SalvarConfigFinanceiroDto,
  SalvarIntegracaoDto,
  SalvarTaxasDto,
  TaxaLinha,
} from "@pacotes/shared";
import { CompetenciaSchema, soDigitos } from "@pacotes/shared";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CobrancaProviderService } from "./cobranca.provider";
import { cifrar, criptoConfigurado, decifrar } from "./cripto.util";
import {
  competenciaAtual,
  hojeNoFuso,
  inicioDaCompetencia,
  nomeDaCompetencia,
  vencimentoDa,
} from "./competencia.util";

type LinhaCobranca = {
  id: string;
  competencia: Date;
  valor: unknown;
  vencimento: Date;
  status: "PENDENTE" | "PAGA" | "VENCIDA" | "CANCELADA";
  linhaDigitavel: string | null;
  urlBoleto: string | null;
  pixCopiaCola: string | null;
  pagoEm: Date | null;
  unidade: { bloco: string | null; identificacao: string };
};

/** Decimal do Prisma para número, sem passar por string solta. */
function reais(v: unknown): number {
  return Number(v);
}

/** Como a unidade aparece para o síndico na lista de pendências. */
function rotuloUnidade(u: { bloco: string | null; identificacao: string }): string {
  return u.bloco ? `${u.identificacao} · ${u.bloco}` : u.identificacao;
}

function paraMorador(c: LinhaCobranca): CobrancaMorador {
  return {
    id: c.id,
    // Colunas DATE fatiadas do ISO: converter por Date deslocaria o dia no
    // fuso do servidor, e vencimento errado por um dia gera multa indevida.
    competencia: c.competencia.toISOString().slice(0, 7),
    valor: reais(c.valor),
    vencimento: c.vencimento.toISOString().slice(0, 10),
    status: c.status,
    linhaDigitavel: c.linhaDigitavel,
    urlBoleto: c.urlBoleto,
    pixCopiaCola: c.pixCopiaCola,
    pagoEm: c.pagoEm?.toISOString() ?? null,
    unidade: {
      bloco: c.unidade.bloco,
      identificacao: c.unidade.identificacao,
    },
  };
}

@Injectable()
export class FinanceiroService {
  private readonly logger = new Logger(FinanceiroService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cobrancas: CobrancaProviderService,
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

  // ---------- Configuração ----------

  async config(user: JwtPayload): Promise<ConfigFinanceiro> {
    const cid = this.exigirGestor(user);
    // Dentro do tenant: `config_financeiro` e `integracoes_financeiras` têm
    // RLS, e ler fora da transação devolveria null em silêncio (a policy
    // filtra a linha), fazendo a tela mostrar os padrões como se nada
    // estivesse configurado.
    const { cfg, integracao } = await this.prisma.withTenant(cid, async (tx) => ({
      cfg: await tx.configFinanceiro.findUnique({ where: { condominioId: cid } }),
      integracao: await tx.integracaoFinanceira.findUnique({
        where: { condominioId: cid },
        select: { ativo: true },
      }),
    }));
    return {
      diaVencimento: cfg?.diaVencimento ?? 10,
      geracaoAutomatica: cfg?.geracaoAutomatica ?? false,
      reguaAtiva: cfg?.reguaAtiva ?? true,
      integrado: integracao?.ativo === true,
      emissaoReal: this.cobrancas.real,
    };
  }

  async salvarConfig(user: JwtPayload, dto: SalvarConfigFinanceiroDto) {
    const cid = this.exigirGestor(user);
    await this.prisma.withTenant(cid, (tx) =>
      tx.configFinanceiro.upsert({
        where: { condominioId: cid },
        create: { condominioId: cid, ...dto },
        update: dto,
      }),
    );
    return this.config(user);
  }

  /**
   * Liga a subconta do condomínio no provedor.
   *
   * Devolve o segredo do webhook UMA vez, para o síndico colar na
   * configuração do provedor. Ele é gerado aqui e sempre exigido depois: sem
   * ele, qualquer um que descobrisse a URL poderia marcar cobranças como
   * pagas, que é o pior estrago possível neste módulo.
   */
  async salvarIntegracao(user: JwtPayload, dto: SalvarIntegracaoDto) {
    const cid = this.exigirGestor(user);
    if (!criptoConfigurado()) {
      throw new BadRequestException(
        "Servidor sem FINANCEIRO_CRIPTO_CHAVE: a credencial não pode ser guardada com segurança.",
      );
    }
    const webhookSegredo = randomBytes(24).toString("base64url");
    const dados = {
      contaExternaId: dto.contaExternaId,
      apiKeyCifrada: cifrar(dto.apiKey),
      webhookSegredo,
      ativo: true,
    };
    await this.prisma.withTenant(cid, (tx) =>
      tx.integracaoFinanceira.upsert({
        where: { condominioId: cid },
        create: { condominioId: cid, ...dados },
        update: dados,
      }),
    );
    // A apiKey NUNCA volta na resposta; o segredo do webhook volta uma vez
    // porque não há outro jeito de o síndico configurá-lo no provedor.
    return { webhookSegredo, emissaoReal: this.cobrancas.real };
  }

  /** Valor mensal de cada unidade, incluindo as que ainda não têm. */
  async taxas(user: JwtPayload): Promise<TaxaLinha[]> {
    const cid = this.exigirGestor(user);
    return this.prisma.withTenant(cid, async (tx) => {
      const unidades = await tx.unidade.findMany({
        orderBy: [{ bloco: "asc" }, { identificacao: "asc" }],
      });
      const taxas = await tx.taxaUnidade.findMany();
      const porUnidade = new Map(taxas.map((t) => [t.unidadeId, t]));
      return unidades.map((u) => {
        const t = porUnidade.get(u.id);
        return {
          unidadeId: u.id,
          unidade: { bloco: u.bloco, identificacao: u.identificacao },
          valorMensal: t ? reais(t.valorMensal) : null,
          responsavelNome: t?.responsavelNome ?? null,
          responsavelCpfCnpj: t?.responsavelCpfCnpj ?? null,
          responsavelEmail: t?.responsavelEmail ?? null,
          /** Já existe no provedor: a unidade está pronta para ser cobrada. */
          clienteCriado: !!t?.clienteExternoId,
        };
      });
    });
  }

  async salvarTaxas(user: JwtPayload, dto: SalvarTaxasDto) {
    const cid = this.exigirGestor(user);
    return this.prisma.withTenant(cid, async (tx) => {
      // Confere que as unidades são deste condomínio ANTES de gravar: o RLS
      // já barraria a escrita, mas o erro sairia como falha de banco em vez
      // de dizer o que está errado.
      const validas = await tx.unidade.count({
        where: { id: { in: dto.taxas.map((t) => t.unidadeId) } },
      });
      if (validas !== new Set(dto.taxas.map((t) => t.unidadeId)).size) {
        throw new BadRequestException("Unidade inexistente na lista de taxas");
      }
      for (const t of dto.taxas) {
        const responsavel = {
          responsavelNome: t.responsavelNome?.trim() || null,
          responsavelCpfCnpj: t.responsavelCpfCnpj
            ? soDigitos(t.responsavelCpfCnpj)
            : null,
          responsavelEmail: t.responsavelEmail?.trim() || null,
        };
        // Trocar o responsável invalida o cliente já criado no provedor: ele
        // foi aberto com o CPF de outra pessoa, e reusar o id cobraria em
        // nome de quem não é mais o responsável. Zerar força criar outro.
        const anterior = await tx.taxaUnidade.findUnique({
          where: { unidadeId: t.unidadeId },
        });
        const mudouPagador =
          anterior?.responsavelCpfCnpj !== responsavel.responsavelCpfCnpj;
        await tx.taxaUnidade.upsert({
          where: { unidadeId: t.unidadeId },
          create: {
            condominioId: cid,
            unidadeId: t.unidadeId,
            valorMensal: t.valorMensal,
            ...responsavel,
          },
          update: {
            valorMensal: t.valorMensal,
            ...responsavel,
            ...(mudouPagador ? { clienteExternoId: null } : {}),
          },
        });
      }
      return { salvas: dto.taxas.length };
    });
  }

  // ---------- Geração ----------

  /**
   * Gera as cobranças de uma competência.
   *
   * Idempotente por construção: `@@unique([unidadeId, competencia])` no banco
   * impede a segunda cobrança do mesmo mês, e a checagem prévia evita chamar
   * o provedor à toa. É a proteção que importa aqui, porque rodar duas vezes
   * (worker + clique do síndico, ou um deploy no meio) é o cenário provável e
   * o prejuízo é cobrar em duplicidade.
   */
  async gerar(user: JwtPayload, dto: GerarCobrancasDto) {
    const cid = this.exigirGestor(user);
    return this.gerarDoCondominio(cid, dto.competencia);
  }

  async gerarDoCondominio(condominioId: string, competencia: string) {
    // Config e integração vivem em tabelas com RLS: fora do tenant voltariam
    // nulas e a geração usaria o dia de vencimento padrão sem ninguém notar.
    const { cfg, integracao } = await this.prisma.withTenant(
      condominioId,
      async (tx) => ({
        cfg: await tx.configFinanceiro.findUnique({ where: { condominioId } }),
        integracao: await tx.integracaoFinanceira.findUnique({
          where: { condominioId },
        }),
      }),
    );
    const diaVencimento = cfg?.diaVencimento ?? 10;
    const vencimento = vencimentoDa(competencia, diaVencimento);
    const inicio = inicioDaCompetencia(competencia);

    // `decifrar` lança cru se a FINANCEIRO_CRIPTO_CHAVE do servidor não for
    // mais a que cifrou a credencial (troca de chave, restauração de backup em
    // outra máquina). Sem isto o síndico clicava "Gerar boletos" e recebia um
    // 500 com texto de biblioteca de cripto, que não diz a ninguém o que
    // fazer. O dado no banco está intacto: falta a chave.
    let apiKey = "sem-credencial";
    if (integracao?.ativo) {
      try {
        apiKey = decifrar(integracao.apiKeyCifrada);
      } catch {
        throw new ServiceUnavailableException(
          "A credencial de cobrança não pôde ser lida: a chave de criptografia do servidor mudou. " +
            "Cadastre a credencial do provedor novamente em Financeiro.",
        );
      }
    }

    const { criadas, puladas, naoCobradas } = await this.prisma.withTenant(
      condominioId,
      async (tx) => {
        const taxas = await tx.taxaUnidade.findMany({
          include: { unidade: true },
        });
        const jaExistem = await tx.cobranca.findMany({
          where: { competencia: inicio },
          select: { unidadeId: true },
        });
        const feitas = new Set(jaExistem.map((c) => c.unidadeId));
        let criadas = 0;
        const naoCobradas: string[] = [];
        for (const taxa of taxas) {
          if (feitas.has(taxa.unidadeId)) continue;
          if (reais(taxa.valorMensal) <= 0) continue;

          // Com provedor real não existe boleto sem pagador: o Asaas exige
          // nome e CPF/CNPJ para criar o cliente. Sem isso a unidade é PULADA
          // e volta na resposta, em vez de gerar uma cobrança órfã que nunca
          // viraria boleto e ficaria inadimplente para sempre no painel.
          if (this.cobrancas.real && !taxa.clienteExternoId) {
            if (!taxa.responsavelNome || !taxa.responsavelCpfCnpj) {
              naoCobradas.push(rotuloUnidade(taxa.unidade));
              continue;
            }
            try {
              const clienteId = await this.cobrancas.provider.garantirCliente({
                apiKey,
                nome: taxa.responsavelNome,
                cpfCnpj: taxa.responsavelCpfCnpj,
                email: taxa.responsavelEmail ?? undefined,
                referenciaExterna: taxa.unidadeId,
              });
              await tx.taxaUnidade.update({
                where: { id: taxa.id },
                data: { clienteExternoId: clienteId },
              });
              taxa.clienteExternoId = clienteId;
            } catch (e) {
              this.logger.error(
                `Cliente da unidade ${taxa.unidadeId} nao criado: ${(e as Error).message.slice(0, 140)}`,
              );
              naoCobradas.push(rotuloUnidade(taxa.unidade));
              continue;
            }
          }

          const cobranca = await tx.cobranca.create({
            data: {
              condominioId,
              unidadeId: taxa.unidadeId,
              competencia: inicio,
              valor: taxa.valorMensal,
              vencimento: new Date(`${vencimento}T00:00:00.000Z`),
            },
          });
          // O provedor é chamado DEPOIS da linha existir: se a chamada falhar,
          // a cobrança fica sem boleto e a próxima execução completa, em vez
          // de a linha sumir e o morador ser cobrado duas vezes.
          try {
            const emitida = await this.cobrancas.provider.criar({
              apiKey,
              // O cliente do provedor, não o nosso uuid: o Asaas recusa um id
              // que não existe na subconta dele.
              clienteExternoId: taxa.clienteExternoId ?? taxa.unidadeId,
              valor: reais(taxa.valorMensal),
              vencimento,
              descricao: `Taxa condominial de ${nomeDaCompetencia(competencia)}`,
              referenciaExterna: `${condominioId}:${cobranca.id}`,
            });
            await tx.cobranca.update({
              where: { id: cobranca.id },
              data: {
                provedorCobrancaId: emitida.provedorCobrancaId,
                linhaDigitavel: emitida.linhaDigitavel,
                urlBoleto: emitida.urlBoleto,
                pixCopiaCola: emitida.pixCopiaCola,
              },
            });
            await tx.notificacao.create({
              data: {
                condominioId,
                cobrancaId: cobranca.id,
                canal: "PUSH",
                tipo: "COBRANCA_GERADA",
              },
            });
          } catch (e) {
            this.logger.error(
              `Cobranca ${cobranca.id} sem boleto: ${(e as Error).message.slice(0, 120)}`,
            );
          }
          criadas++;
        }
        return { criadas, puladas: feitas.size, naoCobradas };
      },
    );

    return {
      competencia,
      vencimento,
      criadas,
      puladas,
      // Unidades que ficaram de fora: sem responsável cadastrado OU com
      // falha ao preparar o pagador no provedor. O painel mostra a lista,
      // senão o síndico vê "criadas: 3" sem saber que 13 ficaram de fora.
      naoCobradas,
      emissaoReal: this.cobrancas.real,
    };
  }

  // ---------- Consulta ----------

  /**
   * A competência da querystring é texto livre. Sem validar, "xx" ou
   * "2026-99" viravam `new Date("xx-01T00:00:00Z")` = Invalid Date, e o
   * Prisma respondia 500. O mesmo valor NO CORPO já era validado pelo
   * `GerarCobrancasSchema`: era só a porta da query que estava aberta.
   */
  private competenciaValida(competencia: string | undefined, timezone: string): string {
    if (competencia === undefined) return competenciaAtual(timezone);
    const parsed = CompetenciaSchema.safeParse(competencia);
    if (!parsed.success) {
      throw new BadRequestException("competencia deve ser YYYY-MM");
    }
    return parsed.data;
  }

  async doGestor(user: JwtPayload, competencia?: string): Promise<CobrancaGestor[]> {
    const cid = this.exigirGestor(user);
    const condominio = await this.prisma.condominio.findUniqueOrThrow({
      where: { id: cid },
      select: { timezone: true },
    });
    const alvo = this.competenciaValida(competencia, condominio.timezone);
    const linhas = await this.prisma.withTenant(cid, (tx) =>
      tx.cobranca.findMany({
        where: { competencia: inicioDaCompetencia(alvo) },
        include: { unidade: true },
        orderBy: [{ status: "asc" }, { unidade: { identificacao: "asc" } }],
      }),
    );
    const hoje = hojeNoFuso(condominio.timezone);
    return linhas.map((c) => {
      const base = paraMorador(c);
      const atraso =
        base.status === "PAGA" || base.status === "CANCELADA"
          ? 0
          : Math.max(
              0,
              Math.round(
                (Date.parse(`${hoje}T00:00:00.000Z`) -
                  Date.parse(`${base.vencimento}T00:00:00.000Z`)) /
                  86_400_000,
              ),
            );
      return { ...base, diasAtraso: atraso };
    });
  }

  async resumo(user: JwtPayload, competencia?: string): Promise<ResumoFinanceiro> {
    const linhas = await this.doGestor(user, competencia);
    const pagas = linhas.filter((c) => c.status === "PAGA");
    const totalCobrado = linhas.reduce((s, c) => s + c.valor, 0);
    const totalPago = pagas.reduce((s, c) => s + c.valor, 0);
    return {
      competencia: linhas[0]?.competencia ?? (competencia ?? ""),
      totalCobrado,
      totalPago,
      inadimplencia: totalCobrado - totalPago,
      unidadesCobradas: linhas.length,
      unidadesPagas: pagas.length,
      emissaoReal: this.cobrancas.real,
    };
  }

  /** As cobranças das unidades do morador: a segunda via no app. */
  async doMorador(user: JwtPayload): Promise<CobrancaMorador[]> {
    if (user.tipo !== "morador") throw new ForbiddenException("Apenas moradores");
    const vinculos = await this.prisma.vinculo.findMany({
      where: { moradorId: user.sub, status: "ATIVO" },
      select: { condominioId: true, unidadeId: true },
    });
    const porCondominio = new Map<string, string[]>();
    for (const v of vinculos) {
      porCondominio.set(v.condominioId, [
        ...(porCondominio.get(v.condominioId) ?? []),
        v.unidadeId,
      ]);
    }
    const listas = await Promise.all(
      [...porCondominio].map(([cid, unidadeIds]) =>
        this.prisma.withTenant(cid, (tx) =>
          tx.cobranca.findMany({
            // Só as unidades DELE: uma consulta por condomínio traria a
            // cobrança do vizinho, que o RLS não filtra (mesmo tenant).
            where: { unidadeId: { in: unidadeIds } },
            include: { unidade: true },
            orderBy: { competencia: "desc" },
            take: 24,
          }),
        ),
      ),
    );
    return listas.flat().map(paraMorador);
  }
}
