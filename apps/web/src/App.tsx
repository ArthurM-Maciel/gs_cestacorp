import { RouterProvider } from 'react-router-dom';

import type { criarRoteador } from './routes.js';
import { SessaoProvider } from './lib/sessao.js';

interface Props {
  roteador: ReturnType<typeof criarRoteador>;
}

/**
 * Raiz da aplicação. O roteador chega de fora para que o teste use um roteador em
 * memória, com as mesmas rotas, sem tocar no histórico do navegador.
 */
export function App({ roteador }: Props) {
  return (
    <SessaoProvider>
      <RouterProvider router={roteador} />
    </SessaoProvider>
  );
}
