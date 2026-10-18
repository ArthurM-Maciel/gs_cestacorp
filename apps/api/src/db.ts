import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

import { env } from './env.js';

/**
 * Cliente único do banco.
 *
 * O adapter recebe a URL do ambiente: a partir do Prisma 7 a conexão não vem mais do
 * `schema.prisma`. Em desenvolvimento, guardamos a instância no escopo global para que o
 * recarregamento automático não abra uma conexão nova a cada alteração de arquivo.
 */
const criarCliente = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

const globalComPrisma = globalThis as unknown as { prisma?: ReturnType<typeof criarCliente> };

export const prisma = globalComPrisma.prisma ?? criarCliente();

if (env.NODE_ENV !== 'production') {
  globalComPrisma.prisma = prisma;
}

/** Tipo da transação, para os serviços que recebem `tx` em vez do cliente. */
export type Transacao = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
