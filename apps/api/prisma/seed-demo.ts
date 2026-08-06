/**
 * Seed de DEMONSTRAÇÃO (apresentação ao síndico). Cria um Residencial Aurora
 * "vivo": adoção parcial do app, pacotes de hoje, pacotes parados há dias (que
 * acendem o alerta e o lembrete), histórico de entregas e variedade de
 * transportadoras (para o gráfico de relatórios). Idempotente por telefone/slug.
 *
 * Uso (no Shell do Render, após o bootstrap ou direto):
 *   SINDICO_TELEFONE=SEU_NUMERO SINDICO_NOME="Seu Nome" \
 *   pnpm --filter @pacotes/api exec ts-node prisma/seed-demo.ts
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import PDFDocument from "pdfkit";
import { gerarHash } from "../src/auth/senha.util";
import { StorageService } from "../src/uploads/storage.service";

const prisma = new PrismaClient();
// O mesmo backend que a API usa: R2 quando as credenciais existem, disco
// local caso contrário. Sem isto os documentos da demo apareceriam na lista e
// dariam erro ao abrir, que é pior do que não existirem.
const storage = new StorageService();

/** PDF de uma página, de verdade: a demo precisa abrir, não só listar. */
function pdfDemo(titulo: string, corpo: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const pedacos: Buffer[] = [];
    doc.on("data", (p: Buffer) => pedacos.push(p));
    doc.on("end", () => resolve(Buffer.concat(pedacos)));
    doc.on("error", reject);
    doc.fontSize(18).text(titulo);
    doc.moveDown();
    doc.fontSize(11).text(corpo, { align: "justify" });
    doc.moveDown(2);
    doc.fontSize(9).fillColor("#666").text(
      "Documento de demonstração do Convivar. Não tem valor legal.",
    );
    doc.end();
  });
}

// Números reais (do síndico/porteiro/morador da demo) são passados por ENV na
// hora de semear: NUNCA hardcoded (repo público). Defaults são placeholders.
const SINDICO_NOME = process.env.SINDICO_NOME ?? "Síndico Demo";
const SINDICO_TELEFONE = (process.env.SINDICO_TELEFONE ?? "51900000001").replace(/\D/g, "");
const PORTEIRO_TELEFONE = (process.env.PORTEIRO_TELEFONE ?? "51900000002").replace(/\D/g, "");
const MORADOR_DEMO_TELEFONE = (process.env.MORADOR_DEMO_TELEFONE ?? "51900000003").replace(/\D/g, "");
// O síndico da demo entra no painel por senha, então precisa de e-mail e de
// uma senha já definida: sem isso, abrir o painel local exigiria configurar
// um provedor de e-mail só para receber o link do primeiro acesso.
const SINDICO_EMAIL = (process.env.SINDICO_EMAIL ?? "sindico@convivar.demo").trim().toLowerCase();
const SINDICO_SENHA = process.env.SINDICO_SENHA ?? "convivar246810";

function diasAtras(dias: number, horas = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(horas, 0, 0, 0);
  return d;
}

async function main() {
  // Todos os módulos ligados: é uma demo, e módulo desligado esconde a porta
  // de entrada dele no app e no painel.
  const MODULOS_DEMO = [
    "comunicados",
    "documentos",
    "visitantes",
    "financeiro",
  ];
  const condominio = await prisma.condominio.upsert({
    where: { slug: "residencial-aurora" },
    update: { modulos: MODULOS_DEMO },
    create: {
      nome: "Residencial Aurora",
      slug: "residencial-aurora",
      plano: "ENTERPRISE",
      modulos: MODULOS_DEMO,
    },
  });
  const cid = condominio.id;

  // Unidades: 2 blocos, 4 andares, 2 por andar = 16.
  const unidadesData: { bloco: string; identificacao: string }[] = [];
  for (const bloco of ["A", "B"]) {
    for (let andar = 1; andar <= 4; andar++) {
      for (const final of ["01", "02"]) {
        unidadesData.push({ bloco, identificacao: `${andar}${final}` });
      }
    }
  }

  const porteiro = await prisma.usuario.upsert({
    where: { telefone: PORTEIRO_TELEFONE },
    update: { ativo: true },
    create: { condominioId: cid, nome: "Carlos Mendes", telefone: PORTEIRO_TELEFONE, papel: "PORTEIRO" },
  });
  const senhaDoSindico = gerarHash(SINDICO_SENHA);
  await prisma.usuario.upsert({
    where: { telefone: SINDICO_TELEFONE },
    update: {
      ativo: true,
      nome: SINDICO_NOME,
      email: SINDICO_EMAIL,
      senhaHash: senhaDoSindico,
      senhaTentativas: 0,
      senhaBloqueadaAte: null,
    },
    create: {
      condominioId: cid,
      nome: SINDICO_NOME,
      telefone: SINDICO_TELEFONE,
      email: SINDICO_EMAIL,
      senhaHash: senhaDoSindico,
      papel: "SINDICO",
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.condominio_id', ${cid}, true)`;
    await tx.unidade.createMany({
      data: unidadesData.map((u) => ({ ...u, condominioId: cid })),
      skipDuplicates: true,
    });
  });

  const unidades = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.condominio_id', ${cid}, true)`;
    return tx.unidade.findMany({ orderBy: [{ bloco: "asc" }, { identificacao: "asc" }] });
  });
  const porRotulo = new Map(unidades.map((u) => [`${u.bloco}-${u.identificacao}`, u]));
  const U = (r: string) => porRotulo.get(r)!;

  // 10 moradores; ~7 com app (device) => adoção ~70%. O morador demo tem app.
  const moradores: {
    nome: string; telefone: string; unidade: string; comApp: boolean; titular?: boolean;
  }[] = [
    { nome: "Marina Alves", telefone: MORADOR_DEMO_TELEFONE, unidade: "B-302", comApp: true },
    { nome: "Victor Oliveira", telefone: "51988880002", unidade: "A-101", comApp: true },
    { nome: "Ana Souza", telefone: "51988880003", unidade: "A-102", comApp: true },
    { nome: "Bruno Lima", telefone: "51988880004", unidade: "A-201", comApp: true },
    { nome: "Carla Mendes", telefone: "51988880005", unidade: "A-202", comApp: false },
    { nome: "Diego Rocha", telefone: "51988880006", unidade: "A-301", comApp: true },
    { nome: "Elisa Prado", telefone: "51988880007", unidade: "B-101", comApp: true },
    { nome: "Fábio Nunes", telefone: "51988880008", unidade: "B-201", comApp: false },
    { nome: "Gabi Torres", telefone: "51988880009", unidade: "B-401", comApp: true },
    { nome: "Heitor Dias", telefone: "51988880010", unidade: "A-401", comApp: false },
  ];

  for (const m of moradores) {
    const morador = await prisma.morador.upsert({
      where: { telefone: m.telefone },
      update: { nome: m.nome },
      create: { nome: m.nome, telefone: m.telefone },
    });
    await prisma.vinculo.upsert({
      where: { moradorId_unidadeId: { moradorId: morador.id, unidadeId: U(m.unidade).id } },
      update: { status: "ATIVO" },
      create: { moradorId: morador.id, unidadeId: U(m.unidade).id, condominioId: cid, status: "ATIVO" },
    });
    if (m.comApp) {
      await prisma.device.upsert({
        where: { pushToken: `ExponentPushToken[demo-${m.telefone}]` },
        update: { moradorId: morador.id },
        create: { moradorId: morador.id, pushToken: `ExponentPushToken[demo-${m.telefone}]`, plataforma: "ANDROID" },
      });
    }
  }

  // Pacotes: mistura de hoje, parados (alerta 3+ dias) e entregues (histórico).
  const transportadoras = ["Amazon", "Mercado Livre", "Shopee", "Correios", "Loggi"];
  type Spec = { unidade: string; transp: string; diasEntrada: number; entregue?: number; prateleira?: string };
  const specs: Spec[] = [
    // Parados há 3+ dias (acendem alerta no painel + lembrete no app)
    { unidade: "A-401", transp: "Shopee", diasEntrada: 5, prateleira: "C2" },
    { unidade: "B-201", transp: "Correios", diasEntrada: 4, prateleira: "A1" },
    { unidade: "A-301", transp: "Amazon", diasEntrada: 3, prateleira: "B3" },
    // Na portaria, recentes
    { unidade: "B-302", transp: "Amazon", diasEntrada: 0, prateleira: "B2" },
    { unidade: "B-302", transp: "Mercado Livre", diasEntrada: 1, prateleira: "B2" },
    { unidade: "A-101", transp: "Loggi", diasEntrada: 0, prateleira: "A2" },
    { unidade: "A-102", transp: "Shopee", diasEntrada: 1, prateleira: "C1" },
    { unidade: "B-101", transp: "Amazon", diasEntrada: 2, prateleira: "A3" },
    // Entregues (histórico + gráfico)
    { unidade: "B-302", transp: "Mercado Livre", diasEntrada: 6, entregue: 5, prateleira: "B2" },
    { unidade: "A-201", transp: "Amazon", diasEntrada: 7, entregue: 6, prateleira: "A1" },
    { unidade: "A-102", transp: "Correios", diasEntrada: 8, entregue: 7, prateleira: "C1" },
    { unidade: "B-101", transp: "Shopee", diasEntrada: 4, entregue: 3, prateleira: "A3" },
    { unidade: "A-101", transp: "Loggi", diasEntrada: 9, entregue: 8, prateleira: "A2" },
    { unidade: "B-401", transp: "Amazon", diasEntrada: 2, entregue: 1, prateleira: "B4" },
  ];

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.condominio_id', ${cid}, true)`;
    const jaTem = await tx.pacote.count();
    if (jaTem > 0) {
      console.log("Pacotes já existem, pulando criação para não duplicar.");
      return;
    }
    let seq = 100000;
    for (const s of specs) {
      const pacote = await tx.pacote.create({
        data: {
          condominioId: cid,
          unidadeId: U(s.unidade).id,
          transportadora: s.transp,
          codigoRastreio: `BR${seq++}XX`,
          localArmazenamento: s.prateleira,
          status: s.entregue !== undefined ? "ENTREGUE" : "ARMAZENADO",
          recebidoPorId: porteiro.id,
          recebidoEm: diasAtras(s.diasEntrada),
        },
      });
      if (s.entregue !== undefined) {
        await tx.retirada.create({
          data: {
            condominioId: cid,
            pacoteId: pacote.id,
            entreguePorId: porteiro.id,
            retiradoEm: diasAtras(s.entregue, 18),
          },
        });
      }
    }
  });

  // Leituras de medidores: 4 meses fechados + mês atual pela metade (mostra
  // progresso do zelador e histórico no painel). Consumos estáveis por
  // unidade, com um salto anômalo em A-202 no mês passado (acende o alerta,
  // que precisa de pelo menos 2 consumos de base antes do salto).
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.condominio_id', ${cid}, true)`;
    await tx.tarifaConsumo.upsert({
      where: { condominioId_tipo: { condominioId: cid, tipo: "AGUA" } },
      update: {},
      create: { condominioId: cid, tipo: "AGUA", valorPorM3: 8.65 },
    });
    await tx.tarifaConsumo.upsert({
      where: { condominioId_tipo: { condominioId: cid, tipo: "GAS" } },
      update: {},
      create: { condominioId: cid, tipo: "GAS", valorPorM3: 12.5 },
    });
  });

  const agora = new Date();
  const competencia = (mesesAtras: number) =>
    new Date(Date.UTC(agora.getFullYear(), agora.getMonth() - mesesAtras, 1));

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.condominio_id', ${cid}, true)`;
    const jaTem = await tx.leituraMedidor.count();
    if (jaTem > 0) {
      console.log("Leituras já existem, pulando criação para não duplicar.");
      return;
    }
    for (const [i, u] of unidades.entries()) {
      // Acumulados iniciais e consumos mensais variando por unidade.
      const baseAgua = 400 + i * 37;
      const baseGas = 80 + i * 11;
      const consumoAgua = 9 + (i % 5); // 9 a 13 m³/mês
      const consumoGas = 3 + (i % 3); // 3 a 5 m³/mês
      let acumAgua = baseAgua;
      let acumGas = baseGas;
      for (let m = 4; m >= 0; m--) {
        // Mês atual: só ~70% das unidades já lidas.
        if (m === 0 && i % 10 >= 7) continue;
        const anomalia = m === 1 && u.bloco === "A" && u.identificacao === "202" ? 28 : 0;
        acumAgua += consumoAgua + (m % 2) + anomalia;
        acumGas += consumoGas + (m % 2 === 0 ? 1 : 0);
        for (const [tipo, valor] of [
          ["AGUA", acumAgua],
          ["GAS", acumGas],
        ] as const) {
          await tx.leituraMedidor.create({
            data: {
              condominioId: cid,
              unidadeId: u.id,
              tipo,
              competencia: competencia(m),
              valor,
              lidoPorId: porteiro.id,
              lidoEm: new Date(Date.UTC(agora.getFullYear(), agora.getMonth() - m, 6, 13)),
            },
          });
        }
      }
    }
  });

  // Moradores por telefone, para amarrar leituras de comunicado e visitas.
  const moradorPorTelefone = new Map(
    (
      await prisma.morador.findMany({
        where: { telefone: { in: moradores.map((m) => m.telefone) } },
        select: { id: true, telefone: true },
      })
    ).map((m) => [m.telefone, m.id]),
  );
  const M = (tel: string) => moradorPorTelefone.get(tel)!;
  const sindico = await prisma.usuario.findUniqueOrThrow({
    where: { telefone: SINDICO_TELEFONE },
    select: { id: true },
  });

  // Comunicados: três publicados, com recibos de leitura parciais (é o "N de
  // M leram" que o síndico procura depois de publicar).
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.condominio_id', ${cid}, true)`;
    if ((await tx.comunicado.count()) > 0) {
      console.log("Comunicados já existem, pulando.");
      return;
    }
    const specs = [
      {
        titulo: "Manutenção da piscina",
        corpo:
          "A piscina fica fechada de 15 a 19 deste mês para troca do sistema de filtragem. A área de churrasqueiras segue aberta no período.",
        dias: 3,
        blocos: [] as string[],
        leram: ["51988880002", "51988880003", MORADOR_DEMO_TELEFONE],
      },
      {
        titulo: "Dedetização nos blocos A e B",
        corpo:
          "Na próxima quarta-feira, das 8h às 12h, haverá dedetização nas áreas comuns. Mantenha portas e janelas fechadas durante o procedimento.",
        dias: 10,
        blocos: [],
        leram: ["51988880002", "51988880004", "51988880007"],
      },
      {
        titulo: "Assembleia geral ordinária",
        corpo:
          "Convocamos todos os condôminos para a assembleia geral ordinária, no salão de festas. Pauta: prestação de contas e previsão orçamentária.",
        dias: 24,
        blocos: [],
        leram: [MORADOR_DEMO_TELEFONE, "51988880003", "51988880006", "51988880009"],
      },
    ];
    for (const s of specs) {
      const c = await tx.comunicado.create({
        data: {
          condominioId: cid,
          titulo: s.titulo,
          corpo: s.corpo,
          blocos: s.blocos,
          criadoPorUsuarioId: sindico.id,
          criadoEm: diasAtras(s.dias, 9),
        },
      });
      for (const tel of s.leram) {
        await tx.comunicadoLeitura.create({
          data: {
            condominioId: cid,
            comunicadoId: c.id,
            moradorId: M(tel),
            lidoEm: diasAtras(s.dias - 1, 20),
          },
        });
      }
    }
  });

  // Documentos: PDF de verdade em cada um, para a lista abrir.
  const jaTemDoc = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.condominio_id', ${cid}, true)`;
    return tx.documento.count();
  });
  if (jaTemDoc > 0) {
    console.log("Documentos já existem, pulando.");
  } else {
    const docs = [
      {
        titulo: "Ata da assembleia · junho",
        categoria: "ATA" as const,
        dias: 40,
        corpo:
          "Aos vinte dias do mês de junho reuniram-se os condôminos do Residencial Aurora em assembleia geral ordinária, para deliberar sobre a prestação de contas do exercício e a previsão orçamentária do período seguinte. Aprovadas ambas por maioria.",
      },
      {
        titulo: "Regimento interno",
        categoria: "REGIMENTO" as const,
        dias: 400,
        corpo:
          "Capítulo I - Do uso das áreas comuns. O salão de festas pode ser reservado na portaria com até trinta dias de antecedência. A piscina funciona das 8h às 22h. Capítulo II - Dos ruídos. É vedado o uso de equipamentos sonoros entre 22h e 8h.",
      },
      {
        titulo: "Convenção do condomínio",
        categoria: "CONVENCAO" as const,
        dias: 2200,
        corpo:
          "A presente convenção regula os direitos e deveres dos condôminos do Residencial Aurora, nos termos da Lei 4.591/64 e do Código Civil, e vincula todos os titulares de unidades autônomas, seus sucessores e ocupantes a qualquer título.",
      },
    ];
    for (const d of docs) {
      const buffer = await pdfDemo(d.titulo, d.corpo);
      const key = `${randomUUID()}.pdf`;
      await storage.salvar(key, buffer, "application/pdf");
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.condominio_id', ${cid}, true)`;
        await tx.documento.create({
          data: {
            condominioId: cid,
            titulo: d.titulo,
            categoria: d.categoria,
            arquivoKey: key,
            tamanhoBytes: buffer.length,
            criadoPorUsuarioId: sindico.id,
            criadoEm: diasAtras(d.dias, 11),
          },
        });
      });
    }
  }

  // Visitas: duas esperadas hoje, uma que já chegou e duas de dias passados.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.condominio_id', ${cid}, true)`;
    if ((await tx.visita.count()) > 0) {
      console.log("Visitas já existem, pulando.");
      return;
    }
    const dia = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    };
    const specs = [
      { nome: "Ricardo Alves", tel: MORADOR_DEMO_TELEFONE, uni: "B-302", dias: 0, ini: "14:00", fim: "22:00", status: "AUTORIZADA" as const },
      { nome: "Técnica Vivo", tel: "51988880002", uni: "A-101", dias: 0, ini: "14:00", fim: "18:00", status: "AUTORIZADA" as const },
      { nome: "Fernanda Lima", tel: "51988880007", uni: "B-101", dias: 0, ini: "09:00", fim: null, status: "CHEGOU" as const },
      { nome: "Paulo Ribeiro", tel: MORADOR_DEMO_TELEFONE, uni: "B-302", dias: 4, ini: "19:00", fim: null, status: "CHEGOU" as const },
      { nome: "Entrega de móveis", tel: "51988880003", uni: "A-102", dias: 9, ini: "08:00", fim: "12:00", status: "CHEGOU" as const },
    ];
    for (const [i, s] of specs.entries()) {
      await tx.visita.create({
        data: {
          condominioId: cid,
          unidadeId: U(s.uni).id,
          moradorId: M(s.tel),
          nomeVisitante: s.nome,
          // Mesmo padrão de `gerarCodigoVisita` no serviço, com número fixo
          // para a demo não trocar de código a cada semeadura.
          codigo: `V-${4200 + i * 137}`,
          dataPrevista: dia(s.dias),
          janelaInicio: s.ini,
          janelaFim: s.fim,
          status: s.status,
          chegadaEm: s.status === "CHEGOU" ? diasAtras(s.dias, 15) : null,
          baixaPorId: s.status === "CHEGOU" ? porteiro.id : null,
          criadoEm: diasAtras(s.dias + 1, 20),
        },
      });
    }
  });

  // Taxas por unidade: sem elas a tela "Valor por unidade" abre vazia e o
  // botão "Gerar cobranças" não geraria nada, porque o provedor exige valor,
  // nome e documento do responsável para emitir.
  //
  // Os CPFs são os de teste que a Receita publica (todos os dígitos iguais
  // com DV correto): passam na validação e não são de ninguém.
  const CPFS_DEMO = [
    "11111111111", "22222222222", "33333333333", "44444444444", "55555555555",
    "66666666666", "77777777777", "88888888888", "99999999999", "12345678909",
  ];
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.condominio_id', ${cid}, true)`;
    if ((await tx.taxaUnidade.count()) > 0) {
      console.log("Taxas já existem, pulando.");
      return;
    }
    for (const [i, m] of moradores.entries()) {
      await tx.taxaUnidade.create({
        data: {
          condominioId: cid,
          unidadeId: U(m.unidade).id,
          valorMensal: 480,
          responsavelNome: m.nome,
          responsavelCpfCnpj: CPFS_DEMO[i % CPFS_DEMO.length],
        },
      });
    }
  });

  // Cobranças: o mês corrente em aberto para todos, e três meses pagos atrás.
  // O morador da demo tem o histórico completo, que é a tela de Boletos.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.condominio_id', ${cid}, true)`;
    if ((await tx.cobranca.count()) > 0) {
      console.log("Cobranças já existem, pulando.");
      return;
    }
    const comMorador = moradores.map((m) => U(m.unidade).id);
    for (let m = 3; m >= 0; m--) {
      const competenciaMes = competencia(m);
      const venc = new Date(
        Date.UTC(competenciaMes.getUTCFullYear(), competenciaMes.getUTCMonth(), 10),
      );
      for (const unidadeId of comMorador) {
        // Mês corrente em aberto; meses fechados pagos, menos uma unidade que
        // fica devendo, para a inadimplência do painel não ser sempre zero.
        const inadimplente = unidadeId === U("A-401").id && m === 1;
        const paga = m > 0 && !inadimplente;
        await tx.cobranca.create({
          data: {
            condominioId: cid,
            unidadeId,
            competencia: competenciaMes,
            valor: 480,
            vencimento: venc,
            status: paga ? "PAGA" : inadimplente ? "VENCIDA" : "PENDENTE",
            // Sem provedor real: a linha digitável é de demonstração e o
            // "Copiar" copia isto mesmo. Nenhum banco reconhece.
            linhaDigitavel:
              "34191.79001 01043.510047 91020.150008 1 99999999999999",
            pagoEm: paga
              ? new Date(Date.UTC(venc.getUTCFullYear(), venc.getUTCMonth(), 8))
              : null,
            valorPago: paga ? 480 : null,
            criadoEm: new Date(
              Date.UTC(competenciaMes.getUTCFullYear(), competenciaMes.getUTCMonth(), 1, 9),
            ),
          },
        });
      }
    }
  });

  const totais = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.condominio_id', ${cid}, true)`;
    return {
      naPortaria: await tx.pacote.count({ where: { status: "ARMAZENADO" } }),
      entregues: await tx.pacote.count({ where: { status: "ENTREGUE" } }),
      comunicados: await tx.comunicado.count(),
      documentos: await tx.documento.count(),
      visitas: await tx.visita.count(),
      cobrancas: await tx.cobranca.count(),
      taxas: await tx.taxaUnidade.count(),
    };
  });

  console.log("Seed de demonstração concluído:");
  console.log(`  Condomínio: ${condominio.nome}`);
  console.log(`  Unidades: ${unidades.length} | Moradores: ${moradores.length} (7 com app ≈ 70% adoção)`);
  console.log(`  Pacotes: ${totais.naPortaria} na portaria (3 parados 3+ dias) | ${totais.entregues} entregues`);
  console.log("  Leituras: 4 meses fechados + mês atual ~70% lido (água e gás), tarifas definidas");
  console.log(
    `  Comunicados: ${totais.comunicados} | Documentos: ${totais.documentos} (PDF real) | Visitas: ${totais.visitas} | Cobranças: ${totais.cobrancas} (${totais.taxas} taxas)`,
  );
  console.log(`  Módulos ligados: ${MODULOS_DEMO.join(", ")}`);
  console.log(`  Síndico: ${SINDICO_TELEFONE} | Porteiro: ${PORTEIRO_TELEFONE} | Morador demo: ${MORADOR_DEMO_TELEFONE}`);
  console.log(`  Painel (senha): ${SINDICO_EMAIL} / ${SINDICO_SENHA}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
