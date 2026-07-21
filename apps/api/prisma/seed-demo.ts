/**
 * Seed de DEMONSTRAÇÃO (apresentação ao síndico). Cria um Residencial Aurora
 * "vivo": adoção parcial do app, pacotes de hoje, pacotes parados há dias (que
 * acendem o alerta e o lembrete), histórico de entregas e variedade de
 * transportadoras (para o gráfico de relatórios). Idempotente por telefone/slug.
 *
 * Uso (no Shell do Render, após o bootstrap ou direto):
 *   SINDICO_TELEFONE=51900000001 SINDICO_NOME="Bruno Steinbruck" \
 *   pnpm --filter @pacotes/api exec ts-node prisma/seed-demo.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Números reais (do síndico/porteiro/morador da demo) são passados por ENV na
// hora de semear — NUNCA hardcoded (repo público). Defaults são placeholders.
const SINDICO_NOME = process.env.SINDICO_NOME ?? "Síndico Demo";
const SINDICO_TELEFONE = (process.env.SINDICO_TELEFONE ?? "51900000001").replace(/\D/g, "");
const PORTEIRO_TELEFONE = (process.env.PORTEIRO_TELEFONE ?? "51900000002").replace(/\D/g, "");
const MORADOR_DEMO_TELEFONE = (process.env.MORADOR_DEMO_TELEFONE ?? "51900000003").replace(/\D/g, "");

function diasAtras(dias: number, horas = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(horas, 0, 0, 0);
  return d;
}

async function main() {
  const condominio = await prisma.condominio.upsert({
    where: { slug: "residencial-aurora" },
    update: {},
    create: { nome: "Residencial Aurora", slug: "residencial-aurora", plano: "ENTERPRISE" },
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
  await prisma.usuario.upsert({
    where: { telefone: SINDICO_TELEFONE },
    update: { ativo: true, nome: SINDICO_NOME },
    create: { condominioId: cid, nome: SINDICO_NOME, telefone: SINDICO_TELEFONE, papel: "SINDICO" },
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
      console.log("Pacotes já existem — pulando criação para não duplicar.");
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

  const totais = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.condominio_id', ${cid}, true)`;
    return {
      naPortaria: await tx.pacote.count({ where: { status: "ARMAZENADO" } }),
      entregues: await tx.pacote.count({ where: { status: "ENTREGUE" } }),
    };
  });

  console.log("Seed de demonstração concluído:");
  console.log(`  Condomínio: ${condominio.nome}`);
  console.log(`  Unidades: ${unidades.length} | Moradores: ${moradores.length} (7 com app ≈ 70% adoção)`);
  console.log(`  Pacotes: ${totais.naPortaria} na portaria (3 parados 3+ dias) | ${totais.entregues} entregues`);
  console.log(`  Síndico: ${SINDICO_TELEFONE} | Porteiro: ${PORTEIRO_TELEFONE} | Morador demo: ${MORADOR_DEMO_TELEFONE}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
