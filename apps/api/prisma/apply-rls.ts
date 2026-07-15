import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const sql = readFileSync(join(__dirname, "sql", "rls.sql"), "utf8");
  await prisma.$executeRawUnsafe(sql);
  console.log("RLS aplicado com sucesso.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
