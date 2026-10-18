import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import { criarRoteador } from './routes.js';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

// Criado uma vez, fora de qualquer componente, para não ser recriado a cada renderização.
const roteador = criarRoteador();

const raiz = document.getElementById('root');

if (raiz === null) {
  throw new Error('Elemento #root não encontrado no index.html.');
}

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App roteador={roteador} />
    </QueryClientProvider>
  </StrictMode>,
);
