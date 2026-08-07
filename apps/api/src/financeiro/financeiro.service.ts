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
import { mascararCpfCnpj, registrarAcao } from "../common/auditoria.util";
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
    await this.prisma.withTenant(cid, async (tx) => {
      await tx.configFinanceiro.upsert({
        where: { condominioId: cid },
        create: { condominioId: cid, ...dto },
        update: dto,
      });
      await registrarAcao(tx, {
        condominioId: cid,
        usuarioId: user.sub,
        acao: "financeiro.salvar_config",
        detalhe: { ...dto },
      });
    });
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
    await this.prisma.withTenant(cid, async (tx) => {
      await tx.integracaoFinanceira.upsert({
        where: { condominioId: cid },
        create: { condominioId: cid, ...dados },
        update: dados,
      });
      // SÓ o id da conta no provedor. A apiKey e o segredo do webhook nunca
      // entram aqui: a trilha existe para dizer quem trocou a credencial, e
      // guardá-la de novo em texto anularia a cifragem da tabela original.
      await registrarAcao(tx, {
        condominioId: cid,
        usuarioId: user.sub,
        acao: "financeiro.salvar_integracao",
        detalhe: { contaExternaId: dto.contaExternaId },
      });
    });
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
      // O que mudou de pagador, para a trilha. Só o par de documentos, e
      // mascarado: a auditoria precisa mostrar QUE trocou, não repetir o CPF
      // inteiro numa segunda tabela.
      const trocasDePagador: Array<{
        unidadeId: string;
        de: string | null;
        para: string | null;
      }> = [];
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
        if (mudouPagador) {
          trocasDePagador.push({
            unidadeId: t.unidadeId,
            de: mascararCpfCnpj(anterior?.responsavelCpfCnpj),
            para: mascararCpfCnpj(responsavel.responsavelCpfCnpj),
          });
        }
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
      await registrarAcao(tx, {
        condominioId: cid,
        usuarioId: user.sub,
        acao: "financeiro.salvar_taxas",
        detalhe: { unidades: dto.taxas.length, trocasDePagador },
      });
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
    const r = await this.gerarDoCondominio(cid, dto.competencia);
    /**
     * Registrado DEPOIS e fora da transação da geração, e não dentro.
     *
     * A geração fala com o provedor de cobrança no meio do caminho: prender
     * uma transação aberta durante chamadas de rede seguraria conexão do pool
     * pelo tempo do boleto mais lento. E é seguro registrar pós-fato porque a
     * geração é idempotente: repetir não duplica cobrança, então a trilha não
     * precisa ser a barreira.
     *
     * `gerarDoCondominio` também é chamado pelo worker, que não tem usuário:
     * por isso a auditoria mora aqui, no caminho que tem um humano atrás.
     */
    await this.prisma.withTenant(cid, (tx) =>
      registrarAcao(tx, {
        condominioId: cid,
        usuarioId: user.sub,
        acao: "financeiro.gerar_cobrancas",
        detalhe: {
          competencia: r.competencia,
          criadas: r.criadas,
          puladas: r.puladas,
          naoCobradas: r.naoCobradas.length,
          semBoleto: r.semBoleto,
        },
      }),
    );
    return r;
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

    /**
     * FASE 1: só banco, transação curta, nenhuma chamada de rede.
     *
     * Antes o `provider.criar` acontecia DENTRO desta transação, e isso
     * criava dois problemas de dinheiro:
     *
     * 1. Um erro de banco no meio do lote desfazia as linhas, mas NÃO os
     *    boletos já emitidos: eles ficavam órfãos no provedor e a rodada
     *    seguinte emitia outros para a mesma unidade e o mesmo mês. Cobrar
     *    duas vezes é o pior estrago possível deste módulo.
     * 2. A transação ficava aberta pelo tempo de todas as chamadas de rede
     *    somadas, segurando conexão do pool pelo boleto mais lento.
     *
     * Aqui só se decide o que fazer com cada unidade.
     */
    const { paraEmitir, criadas, puladas, naoCobradas } =
      await this.prisma.withTenant(condominioId, async (tx) => {
        const taxas = await tx.taxaUnidade.findMany({
          include: { unidade: true },
        });
        const jaExistem = await tx.cobranca.findMany({
          where: { competencia: inicio },
          select: { id: true, unidadeId: true, provedorCobrancaId: true },
        });
        const porUnidade = new Map(jaExistem.map((c) => [c.unidadeId, c]));

        const paraEmitir: Array<{
          cobrancaId: string;
          taxa: (typeof taxas)[number];
        }> = [];
        const naoCobradas: string[] = [];
        let criadas = 0;

        for (const taxa of taxas) {
          if (reais(taxa.valorMensal) <= 0) continue;

          const existente = porUnidade.get(taxa.unidadeId);
          if (existente) {
            /**
             * Cobrança que já existe mas está SEM boleto volta para a fila.
             *
             * Antes ela era pulada para sempre, apesar de o comentário aqui
             * prometer que "a próxima execução completa": a unidade já
             * constava como feita, então a emissão nunca era retentada. O
             * morador nunca recebia o boleto, e a régua depois anunciava
             * "Boleto vencido" de um boleto que jamais existiu.
             */
            if (!existente.provedorCobrancaId) {
              paraEmitir.push({ cobrancaId: existente.id, taxa });
            }
            continue;
          }

          // Com provedor real não existe boleto sem pagador: o Asaas exige
          // nome e CPF/CNPJ para criar o cliente. Falta de cadastro é
          // problema de DADO, que só o síndico resolve, então a unidade fica
          // sem linha nenhuma e volta na resposta. Falha do provedor é outra
          // coisa: essa vira linha e é retentada (fase 2).
          if (
            this.cobrancas.real &&
            !taxa.clienteExternoId &&
            (!taxa.responsavelNome || !taxa.responsavelCpfCnpj)
          ) {
            naoCobradas.push(rotuloUnidade(taxa.unidade));
            continue;
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
          criadas++;
          paraEmitir.push({ cobrancaId: cobranca.id, taxa });
        }
        return { paraEmitir, criadas, puladas: porUnidade.size, naoCobradas };
      });

    /**
     * FASE 2: a rede, com a transação já fechada.
     *
     * Cada boleto tem a sua própria escrita curta. Se o processo morrer no
     * meio, o que foi emitido está gravado e o que faltou é retentado na
     * próxima rodada, porque a linha sem `provedorCobrancaId` volta para a
     * fila na fase 1.
     *
     * A `referenciaExterna` agora é estável entre tentativas (a linha
     * persiste), o que dá ao provedor a chance de deduplicar sozinho.
     */
    let semBoleto = 0;
    for (const { cobrancaId, taxa } of paraEmitir) {
      try {
        let clienteExternoId = taxa.clienteExternoId;
        if (this.cobrancas.real && !clienteExternoId) {
          clienteExternoId = await this.cobrancas.provider.garantirCliente({
            apiKey,
            nome: taxa.responsavelNome ?? "",
            cpfCnpj: taxa.responsavelCpfCnpj ?? "",
            email: taxa.responsavelEmail ?? undefined,
            referenciaExterna: taxa.unidadeId,
          });
          await this.prisma.withTenant(condominioId, (tx) =>
            tx.taxaUnidade.update({
              where: { id: taxa.id },
              data: { clienteExternoId },
            }),
          );
        }

        const emitida = await this.cobrancas.provider.criar({
          apiKey,
          // O cliente do provedor, não o nosso uuid: o Asaas recusa um id
          // que não existe na subconta dele.
          clienteExternoId: clienteExternoId ?? taxa.unidadeId,
          valor: reais(taxa.valorMensal),
          vencimento,
          descricao: `Taxa condominial de ${nomeDaCompetencia(competencia)}`,
          referenciaExterna: `${condominioId}:${cobrancaId}`,
        });

        await this.prisma.withTenant(condominioId, async (tx) => {
          await tx.cobranca.update({
            where: { id: cobrancaId },
            data: {
              provedorCobrancaId: emitida.provedorCobrancaId,
              linhaDigitavel: emitida.linhaDigitavel,
              urlBoleto: emitida.urlBoleto,
              pixCopiaCola: emitida.pixCopiaCola,
            },
          });
          // O aviso sai junto com o boleto, e não com a linha: avisar
          // "Boleto disponível" antes de existir boleto manda o morador
          // procurar no app uma coisa que não está lá.
          await tx.notificacao.create({
            data: {
              condominioId,
              cobrancaId,
              canal: "PUSH",
              tipo: "COBRANCA_GERADA",
            },
          });
        });
      } catch (e) {
        semBoleto++;
        this.logger.error(
          `Cobranca ${cobrancaId} sem boleto: ${(e as Error).message.slice(0, 140)}`,
        );
      }
    }

    return {
      competencia,
      vencimento,
      criadas,
      puladas,
      // Unidades que ficaram de fora por falta de responsável cadastrado. O
      // painel mostra a lista, senão o síndico vê "criadas: 3" sem saber que
      // 13 ficaram de fora.
      naoCobradas,
      // Linhas gravadas cujo boleto o provedor não emitiu. Vai na resposta
      // porque "10 criadas" com 10 boletos faltando é uma mentira de
      // consequência direta: o morador não tem o que pagar.
      semBoleto,
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
