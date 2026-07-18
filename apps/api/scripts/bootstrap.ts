/**
 * Bootstrap de um condomínio novo em produção (banco recém-migrado):
 * cria o condomínio e o primeiro síndico — a partir daí tudo se faz
 * pelo painel (equipe, unidades, import de moradores).
 *
 * Uso:
 *   pnpm --filter @pacotes/api exec ts-node scripts/bootstrap.ts \
 *     "Residencial Aurora" residencial-aurora "Sandra Lima" 41999990002
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const [nome, slug, nomeSindico, telefone] = process.argv.slice(2);
  if (!nome || !slug || !nomeSindico || !telefone) {
    console.error(
      'Uso: ts-node scripts/bootstrap.ts "Nome do Condomínio" slug "Nome do Síndico" telefone',
    );
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const condominio = await prisma.condominio.upsert({
    where: { slug },
    update: {},
    create: { nome, slug },
  });
  const digitos = telefone.replace(/\D/g, "");
  const sindico = await prisma.usuario.upsert({
    where: { telefone: digitos },
    update: { ativo: true },
    create: {
      condominioId: condominio.id,
      nome: nomeSindico,
      telefone: digitos,
      papel: "SINDICO",
    },
  });
  console.log(`Condomínio: ${condominio.nome} (${condominio.id})`);
  console.log(`Síndico: ${sindico.nome} · ${sindico.telefone} — já pode logar no painel.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
