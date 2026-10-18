import { Prisma } from '../generated/prisma/client.js';

import type { ErroDaAplicacao } from './middlewares/erros.js';

/**
 * Violação de restrição de unicidade do banco (`P2002`).
 *
 * O banco é a única autoridade sobre unicidade: conferir antes com um `findUnique` reduz
 * o número de erros feios, mas não elimina a corrida entre duas requisições simultâneas.
 * Por isso a tradução acontece aqui, no caminho de escrita, e não só na checagem prévia.
 */
export function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
}

/**
 * Executa a escrita e troca a violação de unicidade por um erro de negócio em português.
 *
 * Sem isso, o ano de gincana repetido vira 500 com texto de Prisma na tela de quem usa.
 */
export async function comUnicidade<T>(
  operacao: () => Promise<T>,
  aoViolar: () => ErroDaAplicacao,
): Promise<T> {
  try {
    return await operacao();
  } catch (erro) {
    if (ehViolacaoDeUnicidade(erro)) {
      throw aoViolar();
    }
    throw erro;
  }
}
