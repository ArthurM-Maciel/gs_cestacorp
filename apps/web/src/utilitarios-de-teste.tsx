import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router-dom';

import { App } from './App.js';
import { rotas } from './routes.js';

/**
 * Monta a aplicação inteira (sessão, guardas e rotas reais) numa rota inicial, com um
 * roteador em memória. Chamar de novo com outro caminho equivale a recarregar a página:
 * o cache do servidor começa vazio, e só o que está no armazenamento do navegador resta.
 */
export function renderizarNaRota(caminho: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const roteador = createMemoryRouter(rotas, { initialEntries: [caminho] });

  const resultado = render(
    <QueryClientProvider client={queryClient}>
      <App roteador={roteador} />
    </QueryClientProvider>,
  );

  return { ...resultado, roteador, queryClient };
}
