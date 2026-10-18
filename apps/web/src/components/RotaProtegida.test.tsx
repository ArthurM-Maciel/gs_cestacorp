import type { Papel } from '@gincana/contracts';
import { fireEvent, screen } from '@testing-library/react';
import type { InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { gravarToken } from '../lib/token.js';
import {
  erroDaApi,
  falhaDeRede,
  simularApi,
  usuarioDeTeste,
  type RespostaSimulada,
} from '../simulacao-da-api.js';
import { renderizarNaRota } from '../utilitarios-de-teste.js';

/** Finge que a pessoa já entrou em outro dia: há um token guardado no navegador. */
function comSessaoAntiga() {
  gravarToken('token-de-outro-dia');
}

const confirmarComo = (papel: Papel) => (): RespostaSimulada => ({
  status: 200,
  dados: usuarioDeTeste(papel),
});

describe('Rotas protegidas', () => {
  describe('sem sessão', () => {
    it('manda para o login quem tenta abrir uma tela de perfil', () => {
      renderizarNaRota('/inicio');

      expect(screen.getByRole('heading', { name: /que bom ver/i })).toBeVisible();
      expect(screen.queryByText(/olá/i)).not.toBeInTheDocument();
    });
  });

  describe('ao carregar a página com um token guardado', () => {
    it('mostra o carregamento, e não o login, enquanto o servidor confirma quem é a pessoa', async () => {
      comSessaoAntiga();
      let confirmar: () => void = () => undefined;
      const espera = new Promise<void>((resolver) => {
        confirmar = resolver;
      });
      simularApi({
        'GET /auth/me': async () => {
          await espera;
          return { status: 200, dados: usuarioDeTeste('COLABORADOR') };
        },
      });

      renderizarNaRota('/inicio');

      expect(screen.getByRole('status')).toHaveTextContent('Verificando sua sessão…');
      expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();

      confirmar();

      expect(await screen.findByRole('heading', { name: 'Olá, Pessoa Teste!' })).toBeVisible();
      expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();
    });

    it('apresenta o token ao servidor na revalidação', async () => {
      comSessaoAntiga();
      const chamada = vi.fn((requisicao: InternalAxiosRequestConfig) => {
        void requisicao;
        return { status: 200, dados: usuarioDeTeste('COLABORADOR') };
      });
      simularApi({ 'GET /auth/me': chamada });

      renderizarNaRota('/inicio');

      await screen.findByRole('heading', { name: 'Olá, Pessoa Teste!' });
      expect(chamada.mock.calls[0]?.[0].headers.get('Authorization')).toBe(
        'Bearer token-de-outro-dia',
      );
    });

    it('obedece ao papel atual do servidor, não ao que valia quando o token foi emitido', async () => {
      comSessaoAntiga();
      // O token nasceu quando a pessoa era administradora; hoje ela é colaboradora.
      simularApi({ 'GET /auth/me': confirmarComo('COLABORADOR') });

      renderizarNaRota('/painel');

      expect(
        await screen.findByRole('heading', { name: 'Você não tem acesso a esta página' }),
      ).toBeVisible();
    });

    it('leva ao login, avisando o motivo, quando o servidor recusa o token', async () => {
      comSessaoAntiga();
      const chamada = vi.fn(() => ({
        status: 401,
        dados: erroDaApi('NAO_AUTENTICADO', 'Faça login para continuar.'),
      }));
      simularApi({ 'GET /auth/me': chamada });

      const paginaAberta = renderizarNaRota('/inicio');

      expect(await screen.findByLabelText('E-mail')).toBeVisible();
      expect(screen.getByText(/sua sessão expirou/i)).toBeVisible();

      // Recarregar a página não insiste num token que o servidor já recusou.
      paginaAberta.unmount();
      renderizarNaRota('/inicio');
      expect(await screen.findByLabelText('E-mail')).toBeVisible();
      expect(chamada).toHaveBeenCalledTimes(1);
    });

    it('permite tentar de novo quando não dá para falar com o servidor, sem derrubar a sessão', async () => {
      comSessaoAntiga();
      let servidorNoAr = false;
      simularApi({
        'GET /auth/me': (requisicao) => {
          if (!servidorNoAr) {
            return falhaDeRede(requisicao);
          }
          return { status: 200, dados: usuarioDeTeste('COLABORADOR') };
        },
      });

      renderizarNaRota('/inicio');

      expect(await screen.findByRole('alert')).toHaveTextContent(/verifique sua internet/i);
      expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();

      servidorNoAr = true;
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

      expect(await screen.findByRole('heading', { name: 'Olá, Pessoa Teste!' })).toBeVisible();
    });

    it('permite sair quando não dá para confirmar o acesso', async () => {
      comSessaoAntiga();
      simularApi({ 'GET /auth/me': falhaDeRede });

      renderizarNaRota('/inicio');
      fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));

      expect(await screen.findByLabelText('E-mail')).toBeVisible();
    });

    it('tira do login quem já está autenticado', async () => {
      comSessaoAntiga();
      simularApi({ 'GET /auth/me': confirmarComo('LIDER') });

      renderizarNaRota('/entrar');

      expect(await screen.findByText(/fila de lançamentos/i)).toBeVisible();
      expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();
    });
  });

  describe('por perfil', () => {
    it.each<[Papel, string, boolean]>([
      ['COLABORADOR', '/inicio', true],
      ['COLABORADOR', '/aprovacoes', false],
      ['COLABORADOR', '/painel', false],
      ['LIDER', '/inicio', false],
      ['LIDER', '/aprovacoes', true],
      ['LIDER', '/painel', false],
      ['ADMIN', '/inicio', false],
      ['ADMIN', '/aprovacoes', true],
      ['ADMIN', '/painel', true],
    ])('%s abrindo %s: acesso liberado = %s', async (papel, caminho, liberado) => {
      comSessaoAntiga();
      simularApi({ 'GET /auth/me': confirmarComo(papel) });

      renderizarNaRota(caminho);

      const titulo = liberado ? 'Olá, Pessoa Teste!' : 'Você não tem acesso a esta página';
      expect(await screen.findByRole('heading', { name: titulo })).toBeVisible();
    });

    it('oferece o caminho de volta ao início do próprio perfil', async () => {
      comSessaoAntiga();
      simularApi({ 'GET /auth/me': confirmarComo('LIDER') });

      renderizarNaRota('/painel');
      fireEvent.click(await screen.findByRole('link', { name: 'Ir para o meu início' }));

      expect(await screen.findByText(/fila de lançamentos/i)).toBeVisible();
    });
  });

  describe('ao sair', () => {
    it('não deixa dados da pessoa guardados na memória do app', async () => {
      comSessaoAntiga();
      simularApi({ 'GET /auth/me': confirmarComo('COLABORADOR') });

      const { queryClient } = renderizarNaRota('/inicio');
      await screen.findByRole('heading', { name: 'Olá, Pessoa Teste!' });
      // Representa o que as telas das próximas histórias vão guardar (lançamentos, placar).
      queryClient.setQueryData(['lancamentos'], [{ id: 'dado-da-pessoa-anterior' }]);

      fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
      await screen.findByLabelText('E-mail');

      expect(queryClient.getQueryData(['lancamentos'])).toBeUndefined();
    });

    it('volta ao login e a próxima visita já não encontra a sessão', async () => {
      comSessaoAntiga();
      const confirmar = vi.fn(confirmarComo('COLABORADOR'));
      simularApi({ 'GET /auth/me': confirmar });

      const paginaAberta = renderizarNaRota('/inicio');
      fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));

      expect(await screen.findByLabelText('E-mail')).toBeVisible();
      // Sair é decisão da pessoa, não expiração: não há aviso de sessão vencida.
      expect(screen.queryByText(/sua sessão expirou/i)).not.toBeInTheDocument();

      paginaAberta.unmount();
      renderizarNaRota('/inicio');
      expect(await screen.findByLabelText('E-mail')).toBeVisible();
      expect(confirmar).toHaveBeenCalledTimes(1);
    });
  });
});
