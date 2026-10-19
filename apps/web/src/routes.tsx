import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { LayoutPorPapel } from './components/LayoutPorPapel.js';
import { RotaProtegida } from './components/RotaProtegida.js';
import { SomenteVisitante } from './components/SomenteVisitante.js';
import { ErroInesperado, PaginaNaoEncontrada } from './components/TelasDeErroDeRota.js';
import { BoasVindas } from './features/acesso/BoasVindas.js';
import { CriarContaEmBreve } from './features/acesso/CriarContaEmBreve.js';
import { TelaDeLogin } from './features/acesso/TelaDeLogin.js';
import { LayoutDaAdministradora } from './features/administracao/LayoutDaAdministradora.js';
import { TelaDeAprovacoes } from './features/aprovacoes/TelaDeAprovacoes.js';
import { TelaDeAuditoria } from './features/auditoria/TelaDeAuditoria.js';
import { TelaDeColaboradores } from './features/colaboradores/TelaDeColaboradores.js';
import { LayoutDoColaborador } from './features/colaborador/LayoutDoColaborador.js';
import { TelaDeEquipes } from './features/equipes/TelaDeEquipes.js';
import { TelaDeGincanas } from './features/gincanas/TelaDeGincanas.js';
import { TelaDeInicio } from './features/inicio/TelaDeInicio.js';
import { TelaDeCorrigir } from './features/lancamentos/TelaDeCorrigir.js';
import { TelaDeDetalhe } from './features/lancamentos/TelaDeDetalhe.js';
import { TelaDeRegistrar } from './features/lancamentos/TelaDeRegistrar.js';
import { PainelEmBreve } from './features/painel/PainelEmBreve.js';
import { TelaDoPlacar } from './features/placar/TelaDoPlacar.js';

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
        // O líder também participa da gincana: registra as próprias ações e acompanha o status.
        element: <RotaProtegida papeis={['COLABORADOR', 'LIDER']} />,
        children: [
          {
            element: <LayoutDoColaborador />,
            children: [
              { path: '/inicio', element: <TelaDeInicio /> },
              { path: '/registrar', element: <TelaDeRegistrar /> },
              { path: '/registrar/:tipoAcaoId', element: <TelaDeRegistrar /> },
              { path: '/lancamentos/:id/corrigir', element: <TelaDeCorrigir /> },
            ],
          },
        ],
      },
      {
        // Telas dos três perfis: o placar (US11) e o detalhe de um lançamento com o histórico
        // dele (US09). Cada perfil as vê dentro do próprio menu; quem pode abrir qual
        // lançamento é decisão da API, que devolve 404 para o que a pessoa não alcança.
        element: <RotaProtegida />,
        children: [
          {
            element: <LayoutPorPapel />,
            children: [
              { path: '/placar', element: <TelaDoPlacar /> },
              { path: '/lancamentos/:id', element: <TelaDeDetalhe /> },
            ],
          },
        ],
      },
      {
        // A administradora também aprova qualquer lançamento, dentro do menu dela.
        element: <RotaProtegida papeis={['LIDER', 'ADMIN']} />,
        children: [
          {
            element: <LayoutPorPapel />,
            children: [{ path: '/aprovacoes', element: <TelaDeAprovacoes /> }],
          },
        ],
      },
      {
        element: <RotaProtegida papeis={['ADMIN']} />,
        children: [
          {
            // Menu e topo da administradora; cada história acrescenta a sua tela aqui.
            element: <LayoutDaAdministradora />,
            children: [
              { path: '/painel', element: <PainelEmBreve /> },
              { path: '/gincanas', element: <TelaDeGincanas /> },
              { path: '/equipes', element: <TelaDeEquipes /> },
              { path: '/colaboradores', element: <TelaDeColaboradores /> },
              { path: '/auditoria', element: <TelaDeAuditoria /> },
            ],
          },
        ],
      },
      { path: '*', element: <PaginaNaoEncontrada /> },
    ],
  },
];

export const criarRoteador = () => createBrowserRouter(rotas);
