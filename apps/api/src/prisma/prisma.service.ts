import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Toda query tenant-scoped DEVE passar por withTenant(): a transação define
 * app.condominio_id na sessão e as policies de RLS do Postgres filtram as
 * linhas. Fora de withTenant(), tabelas com RLS retornam vazio (não vazam).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  withTenant<T>(
    condominioId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.condominio_id', ${condominioId}, true)`;
      return fn(tx);
    });
  }
}
