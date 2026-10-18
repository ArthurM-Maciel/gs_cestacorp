import { defineConfig } from 'vitest/config';

/**
 * Os testes rodam sempre contra `DATABASE_URL_TEST`, nunca contra `DATABASE_URL`.
 *
 * A separação é deliberada: muita gente exporta `DATABASE_URL` no shell para usar o
 * `prisma migrate dev`, e se a suíte respeitasse essa variável ela apagaria o banco de
 * desenvolvimento — justamente a carga que a cliente vê na Sprint Review.
 */
const URL_DO_TESTE =
  process.env.DATABASE_URL_TEST ?? 'postgresql://gincana:gincana@localhost:5432/gincana_test';

export default defineConfig({
  test: {
    include: ['**/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: ['./src/testes/guarda-de-banco.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: URL_DO_TESTE,
      JWT_SECRET: process.env.JWT_SECRET ?? 'segredo-de-teste-com-mais-de-32-caracteres-ok',
    },
  },
});
