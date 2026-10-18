import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// O .env vive na raiz do monorepo, e os comandos do Prisma rodam a partir de apps/api.
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

/**
 * Configuração do Prisma.
 *
 * A partir do Prisma 7 a URL de conexão não fica mais no `schema.prisma`: o schema
 * descreve só o modelo, e a credencial vive aqui, lida do ambiente. Ninguém do time
 * precisa mexer neste arquivo — ele existe para que `prisma migrate` saiba onde conectar.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
