import 'dotenv/config';
import { defineConfig } from 'prisma/config';

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
