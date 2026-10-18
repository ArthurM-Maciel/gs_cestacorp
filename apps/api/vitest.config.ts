import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Configuração mínima para subir o app em memória. O banco de teste é definido
    // pela integração contínua; aqui fica só o que permite o Express iniciar.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgresql://gincana:gincana@localhost:5432/gincana_test',
      JWT_SECRET: process.env.JWT_SECRET ?? 'segredo-de-teste-com-mais-de-32-caracteres-ok',
    },
  },
});
