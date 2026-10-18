import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { RotaProtegida } from './components/RotaProtegida.js';
import { SomenteVisitante } from './components/SomenteVisitante.js';
import { ErroInesperado, PaginaNaoEncontrada } from './components/TelasDeErroDeRota.js';
import { BoasVindas } from './features/acesso/BoasVindas.js';
import { CriarContaEmBreve } from './features/acesso/CriarContaEmBreve.js';
import { TelaDeLogin } from './features/acesso/TelaDeLogin.js';
import { EsqueletoDoPerfil } from './features/inicio/EsqueletoDoPerfil.js';

/**
 * Mapa de rotas. Cada história acrescenta as suas aqui, em poucas linhas, dentro do grupo
 * do perfil que pode abrir a tela.
 *
 * O guarda por perfil só decide o que a interface mostra. A autorização de verdade é da API.
 */
export const rotas: RouteObject[] = [
  {
    errorElement: <ErroInesperado />,
    children: [
      {
        // Públicas: quem já tem sessão é levado ao início do seu perfil.
        element: <SomenteVisitante />,
        children: [
          { path: '/', element: <BoasVindas /> },
          { path: '/entrar', element: <TelaDeLogin /> },
          { path: '/criar-conta', element: <CriarContaEmBreve /> },
        ],
      },
      {
        element: <RotaProtegida papeis={['COLABORADOR']} />,
        children: [
          {
            path: '/inicio',
            element: (
              <EsqueletoDoPerfil descricao="Em breve, aqui ficam a posição da sua equipe e os seus lançamentos." />
            ),
          },
        ],
      },
      {
        // A administradora também aprova qualquer lançamento.
        element: <RotaProtegida papeis={['LIDER', 'ADMIN']} />,
        children: [
          {
            path: '/aprovacoes',
            element: (
              <EsqueletoDoPerfil descricao="Em breve, aqui fica a fila de lançamentos para aprovar." />
            ),
          },
        ],
      },
      {
        element: <RotaProtegida papeis={['ADMIN']} />,
        children: [
          {
            path: '/painel',
            element: (
              <EsqueletoDoPerfil descricao="Em breve, aqui ficam o painel da gincana, as equipes e as regras." />
            ),
          },
        ],
      },
      { path: '*', element: <PaginaNaoEncontrada /> },
    ],
  },
];

export const criarRoteador = () => createBrowserRouter(rotas);
