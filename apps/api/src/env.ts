import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

// O .env vive na raiz do monorepo; a API roda a partir de apps/api. Em produção o
// arquivo não existe e as variáveis vêm do próprio ambiente — dotenv simplesmente
// ignora o caminho ausente.
dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

/**
 * Configuração do processo, validada na partida.
 *
 * Falhar aqui é melhor que descobrir uma variável faltando no meio de uma Sprint Review:
 * o erro aponta exatamente o que não foi configurado.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1, 'Informe a URL do banco.'),
  /** Segredo de assinatura do JWT. Em produção, vem do painel do serviço, nunca do código. */
  JWT_SECRET: z.string().min(32, 'O segredo do JWT precisa de pelo menos 32 caracteres.'),
  /** Origens liberadas no CORS, separadas por vírgula. */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((valor) =>
      valor
        .split(',')
        .map((origem) => origem.trim())
        .filter(Boolean),
    ),
});

const resultado = envSchema.safeParse(process.env);

if (!resultado.success) {
  const problemas = resultado.error.issues
    .map((problema) => `  - ${problema.path.join('.')}: ${problema.message}`)
    .join('\n');
  throw new Error(`Configuração inválida. Verifique o seu .env:\n${problemas}`);
}

export const env = resultado.data;
export type Env = typeof env;
