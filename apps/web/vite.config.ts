import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Em desenvolvimento o front fala com a API pelo mesmo endereço, o que evita
    // configurar CORS na máquina de cada pessoa.
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
        rewrite: (caminho) => caminho.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setup-testes.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
