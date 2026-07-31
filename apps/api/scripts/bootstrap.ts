/**
 * Bootstrap de um condomínio novo em produção (banco recém-migrado):
 * cria o condomínio e o primeiro síndico: a partir daí tudo se faz
 * pelo painel (equipe, unidades, import de moradores).
 *
 * O e-mail é obrigatório: o síndico entra no painel por senha, e é pelo
 * e-mail que ele define a primeira (não existe senha temporária). Sem ele, a
 * conta nasce sem caminho de entrada.
 *
 * Uso:
 *   pnpm --filter @pacotes/api exec ts-node scripts/bootstrap.ts \
 *     "Residencial Aurora" residencial-aurora "Sandra Lima" 41999990002 \
 *     sandra@exemplo.com
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const [nome, slug, nomeSindico, telefone, email] = process.argv.slice(2);
  if (!nome || !slug || !nomeSindico || !telefone || !email) {
    console.error(
      'Uso: ts-node scripts/bootstrap.ts "Nome do Condomínio" slug "Nome do Síndico" telefone email',
    );
    process.exit(1);
  }
  const emailNormalizado = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNormalizado)) {
    console.error(`E-mail inválido: ${email}`);
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
    update: { ativo: true, email: emailNormalizado },
    create: {
      condominioId: condominio.id,
      nome: nomeSindico,
      telefone: digitos,
      email: emailNormalizado,
      papel: "SINDICO",
    },
  });
  console.log(`Condomínio: ${condominio.nome} (${condominio.id})`);
  console.log(`Síndico: ${sindico.nome} · ${sindico.email}`);
  console.log(
    'Primeiro acesso: no painel, use "Esqueci a senha" com este e-mail para definir a senha.',
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
