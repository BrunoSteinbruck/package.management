/**
 * Backup do Postgres para o R2.
 *
 * Roda como Cron Job do Render (ver render.yaml). Faz `pg_dump` no formato
 * custom (-Fc, comprimido e restaurável com pg_restore), envia para o bucket
 * sob `backups/` e apaga os mais antigos que a janela de retenção.
 *
 * Existe mesmo com o backup do plano pago do Render: aquele fica na mesma
 * conta e no mesmo fornecedor do banco. Um dump em outro provedor é o que
 * salva de conta suspensa, engano de operação ou apagão do fornecedor.
 *
 * ATENÇÃO: precisa de BACKUP_DATABASE_URL com a role `backup_ro`, criada por
 * prisma/sql/backup-role.sql. Com a role normal da API o pg_dump FALHA: as
 * tabelas usam FORCE ROW LEVEL SECURITY e o dump roda com row_security=off.
 * Não dá para simplesmente dar BYPASSRLS à role da API: isso desliga o
 * isolamento entre condomínios em todas as conexões dela. Ver o SQL.
 *
 * Uso manual (restaurar):
 *   pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" backup.dump
 */
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { spawn } from "node:child_process";
import { readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PREFIXO = "backups/";
const RETENCAO_DIAS = Number(process.env.BACKUP_RETENCAO_DIAS ?? 30);

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`${nome} é obrigatório para o backup`);
  return valor;
}

/** pg_dump escrevendo direto no arquivo; stderr só aparece se falhar. */
function pgDump(databaseUrl: string, destino: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-acl", "--file", destino, databaseUrl],
      { stdio: ["ignore", "inherit", "pipe"] },
    );
    let erro = "";
    proc.stderr.on("data", (d) => (erro += d.toString()));
    proc.on("error", (e) =>
      reject(new Error(`pg_dump não pôde ser executado: ${e.message}`)),
    );
    proc.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`pg_dump saiu com código ${code}: ${erro.trim()}`)),
    );
  });
}

async function main() {
  // Cai para DATABASE_URL só para permitir teste local; em produção a role
  // dedicada é obrigatória, senão o pg_dump falha nas tabelas com RLS.
  const databaseUrl =
    process.env.BACKUP_DATABASE_URL || exigir("DATABASE_URL");
  const bucket = exigir("R2_BUCKET");
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${exigir("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: exigir("R2_ACCESS_KEY_ID"),
      secretAccessKey: exigir("R2_SECRET_ACCESS_KEY"),
    },
  });

  // Nome ordenável por data: a listagem do bucket já sai cronológica.
  const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
  const local = join(tmpdir(), `backup-${carimbo}.dump`);

  try {
    await pgDump(databaseUrl, local);
    const { size } = await stat(local);
    // Um dump vazio ou minúsculo é falha silenciosa: melhor gritar agora do
    // que descobrir na hora de restaurar.
    if (size < 1024) {
      throw new Error(`dump suspeito: apenas ${size} bytes`);
    }

    const key = `${PREFIXO}${carimbo}.dump`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: await readFile(local),
        ContentType: "application/octet-stream",
      }),
    );
    console.log(`Backup enviado: ${key} (${(size / 1024 / 1024).toFixed(1)} MB)`);

    await limpar(s3, bucket);
  } finally {
    await rm(local, { force: true });
  }
}

/** Apaga backups mais velhos que a retenção: só depois de um envio bem-sucedido. */
async function limpar(s3: S3Client, bucket: string) {
  const limite = Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000;
  const lista = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIXO }),
  );
  const velhos = (lista.Contents ?? []).filter(
    (o) => o.Key && o.LastModified && o.LastModified.getTime() < limite,
  );
  if (velhos.length === 0) return;

  await s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: velhos.map((o) => ({ Key: o.Key! })) },
    }),
  );
  console.log(`${velhos.length} backup(s) além de ${RETENCAO_DIAS} dias removido(s).`);
}

main().catch((e) => {
  // Sai diferente de zero para o Render marcar o job como falho e alertar.
  console.error("BACKUP FALHOU:", (e as Error).message);
  process.exit(1);
});
