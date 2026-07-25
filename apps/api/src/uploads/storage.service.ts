import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Armazenamento das fotos (comprovante de entrada/retirada e de ocorrência).
 *
 * Em produção precisa ser objeto remoto: o disco do Render é EFÊMERO — cada
 * deploy recria a máquina e levaria junto todo o comprovante já registrado,
 * que é a promessa central do produto.
 *
 * Dois backends, escolhidos por env:
 *  - R2 (Cloudflare, S3-compatível) quando as credenciais existem;
 *  - disco local caso contrário, para o dev não precisar de conta em nuvem.
 *
 * As fotos continuam sendo servidas PELA API (`GET /uploads/:key?t=token`),
 * não por URL pública do bucket: o foto-token curto e preso à key já é o
 * modelo auditado, e o bucket fica totalmente privado. Trocar por URL
 * assinada direto do R2 é otimização de banda para depois — hoje o volume
 * (algumas centenas de fotos/dia) não justifica mexer no contrato do app.
 */
@Injectable()
export class StorageService {
  private readonly log = new Logger(StorageService.name);
  private readonly dir = join(process.cwd(), "uploads");
  private readonly bucket = process.env.R2_BUCKET ?? "";
  private readonly s3 = this.criarCliente();

  constructor() {
    if (!this.s3) {
      mkdirSync(this.dir, { recursive: true });
      this.log.warn(
        "Fotos em disco local. Em produção configure R2_* — o disco do Render é efêmero e as fotos somem a cada deploy.",
      );
    }
  }

  private criarCliente(): S3Client | null {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    // Falha fechada: sem o conjunto completo, cai no disco em vez de subir
    // com um cliente pela metade que só quebraria no primeiro upload.
    if (!accountId || !accessKeyId || !secretAccessKey || !this.bucket) {
      return null;
    }
    return new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async salvar(key: string, corpo: Buffer, mimetype: string): Promise<void> {
    if (!this.s3) {
      await writeFile(join(this.dir, key), corpo);
      return;
    }
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: corpo,
        ContentType: mimetype,
      }),
    );
  }

  async ler(key: string): Promise<{ corpo: Buffer; mimetype?: string }> {
    if (!this.s3) {
      const caminho = join(this.dir, key);
      if (!existsSync(caminho)) throw new NotFoundException("Foto não encontrada");
      return { corpo: await readFile(caminho) };
    }
    try {
      const res = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const corpo = Buffer.from(await res.Body!.transformToByteArray());
      return { corpo, mimetype: res.ContentType };
    } catch (e) {
      if ((e as { name?: string }).name === "NoSuchKey") {
        throw new NotFoundException("Foto não encontrada");
      }
      throw e;
    }
  }
}
