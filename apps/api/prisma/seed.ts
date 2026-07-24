import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Condominios não tem RLS; o resto exige o tenant setado na transação.
  const condominio = await prisma.condominio.upsert({
    where: { slug: "residencial-aurora" },
    update: {},
    create: {
      nome: "Residencial Aurora",
      slug: "residencial-aurora",
      plano: "ENTERPRISE",
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.condominio_id', ${condominio.id}, true)`;

    const unidades = [];
    for (const bloco of ["A", "B"]) {
      for (let andar = 1; andar <= 4; andar++) {
        for (const final of ["01", "02"]) {
          unidades.push({ bloco, identificacao: `${andar}${final}` });
        }
      }
    }
    await tx.unidade.createMany({
      data: unidades.map((u) => ({ ...u, condominioId: condominio.id })),
      skipDuplicates: true,
    });
    const todasUnidades = await tx.unidade.findMany({
      orderBy: [{ bloco: "asc" }, { identificacao: "asc" }],
    });

    const porteiro = await tx.usuario.upsert({
      where: { telefone: "41999990001" },
      update: {},
      create: {
        condominioId: condominio.id,
        nome: "Carlos Porteiro",
        telefone: "41999990001",
        papel: "PORTEIRO",
      },
    });
    await tx.usuario.upsert({
      where: { telefone: "41999990002" },
      update: {},
      create: {
        condominioId: condominio.id,
        nome: "Sandra Síndica",
        telefone: "41999990002",
        papel: "SINDICO",
      },
    });

    const nomes = [
      ["Ana Souza", "41988880001"],
      ["Bruno Lima", "41988880002"],
      ["Carla Mendes", "41988880003"],
      ["Diego Alves", "41988880004"],
      ["Elisa Rocha", "41988880005"],
    ] as const;
    for (let i = 0; i < nomes.length; i++) {
      const [nome, telefone] = nomes[i];
      const morador = await tx.morador.upsert({
        where: { telefone },
        update: {},
        create: { nome, telefone },
      });
      await tx.vinculo.upsert({
        where: {
          moradorId_unidadeId: {
            moradorId: morador.id,
            unidadeId: todasUnidades[i].id,
          },
        },
        update: {},
        create: {
          moradorId: morador.id,
          unidadeId: todasUnidades[i].id,
          condominioId: condominio.id,
          status: "ATIVO",
        },
      });
    }

    const transportadoras = ["Mercado Livre", "Amazon", "Shopee", "Correios"];
    const jaTem = await tx.pacote.count();
    if (jaTem === 0) {
      for (let i = 0; i < 6; i++) {
        await tx.pacote.create({
          data: {
            condominioId: condominio.id,
            unidadeId: todasUnidades[i % 3].id,
            transportadora: transportadoras[i % transportadoras.length],
            codigoRastreio: `BR${String(100000 + i)}XX`,
            recebidoPorId: porteiro.id,
          },
        });
      }
    }

    // Vagas e veículos para o módulo de avisos (Via 1 por placa/vaga).
    // Vaga "42" e placa "ABC1D23" apontam para a unidade 101-A (índice 0).
    await tx.vaga.upsert({
      where: { condominioId_identificacao: { condominioId: condominio.id, identificacao: "42" } },
      update: { unidadeId: todasUnidades[0].id },
      create: { condominioId: condominio.id, identificacao: "42", unidadeId: todasUnidades[0].id },
    });
    await tx.veiculo.upsert({
      where: { condominioId_placa: { condominioId: condominio.id, placa: "ABC1D23" } },
      update: { unidadeId: todasUnidades[0].id },
      create: {
        condominioId: condominio.id,
        placa: "ABC1D23",
        modelo: "Fiat Argo",
        cor: "Prata",
        unidadeId: todasUnidades[0].id,
      },
    });

    console.log("Seed concluído:");
    console.log(`  Condomínio: ${condominio.nome}`);
    console.log(`  Unidades: ${todasUnidades.length} | Moradores: ${nomes.length} | Pacotes: 6`);
    console.log("  Vaga 42 e placa ABC1D23 → unidade 101-A (para testar avisos)");
    console.log("  Login operador (OTP no log da API): 41999990001");
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
