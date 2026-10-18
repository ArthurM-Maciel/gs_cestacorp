import type { Papel } from '@gincana/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { gravarToken } from '../../lib/token.js';
import { simularApi, usuarioDeTeste } from '../../simulacao-da-api.js';
import { comSessaoDeAdmin, rotasDeLeitura, umaGincana } from '../../simulacao-do-cadastro.js';
import { renderizarNaRota } from '../../utilitarios-de-teste.js';

const semDados = { gincanas: [umaGincana()], equipes: [], colaboradores: [] };

/** O menu lateral (computador) e o inferior (celular) existem na página; o CSS mostra um. */
const menuLateral = () => screen.getByRole('navigation', { name: 'Menu principal' });
const menuInferior = () => screen.getByRole('navigation', { name: 'Menu inferior' });

describe('Layout da administradora', () => {
  describe('menu lateral', () => {
    it('leva às telas que existem e mostra as futuras como "Em breve", sem link', async () => {
      comSessaoDeAdmin(rotasDeLeitura(semDados));
      renderizarNaRota('/painel');
      await screen.findByRole('heading', { level: 1 });

      const menu = within(menuLateral());
      expect(menu.getByRole('link', { name: 'Painel' })).toHaveAttribute('href', '/painel');
      expect(menu.getByRole('link', { name: 'Gincanas' })).toHaveAttribute('href', '/gincanas');
      expect(menu.getByRole('link', { name: 'Equipes' })).toHaveAttribute('href', '/equipes');
      expect(menu.getByRole('link', { name: 'Colaboradores' })).toHaveAttribute(
        'href',
        '/colaboradores',
      );

      // A fila de aprovações (US08) é da administradora também: ela aprova de todas as equipes.
      expect(menu.getByRole('link', { name: 'Aprovações' })).toHaveAttribute('href', '/aprovacoes');

      // Nenhum link leva a lugar nenhum: o que ainda não existe só aparece como aviso.
      for (const futuro of ['Regras', 'Placar']) {
        expect(menu.queryByRole('link', { name: new RegExp(futuro) })).not.toBeInTheDocument();
        expect(menu.getByText(futuro)).toBeVisible();
      }
      expect(menu.getAllByText('Em breve')).toHaveLength(2);
    });

    it('mostra o nome da usuária e o perfil no rodapé do menu', async () => {
      comSessaoDeAdmin(rotasDeLeitura(semDados));
      renderizarNaRota('/painel');
      await screen.findByRole('heading', { level: 1 });

      const lateral = within(screen.getByRole('complementary'));
      expect(lateral.getByText('Pessoa Teste')).toBeVisible();
      expect(lateral.getByText('Administradora')).toBeVisible();
    });

    it('navega entre as telas e marca a atual', async () => {
      comSessaoDeAdmin(rotasDeLeitura(semDados));
      renderizarNaRota('/painel');
      await screen.findByRole('heading', { level: 1, name: 'Olá, Pessoa Teste!' });
      expect(within(menuLateral()).getByRole('link', { name: 'Painel' })).toHaveAttribute(
        'aria-current',
        'page',
      );

      fireEvent.click(within(menuLateral()).getByRole('link', { name: 'Equipes' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Equipes' })).toBeVisible();
      expect(within(menuLateral()).getByRole('link', { name: 'Equipes' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(menuLateral()).getByRole('link', { name: 'Painel' })).not.toHaveAttribute(
        'aria-current',
      );
    });

    it('encerra a sessão pelo botão Sair do rodapé', async () => {
      comSessaoDeAdmin(rotasDeLeitura(semDados));
      renderizarNaRota('/gincanas');
      await screen.findByRole('heading', { level: 1, name: 'Gincanas' });

      fireEvent.click(
        within(screen.getByRole('complementary')).getByRole('button', { name: 'Sair' }),
      );

      expect(await screen.findByLabelText('E-mail')).toBeVisible();
    });
  });

  describe('navegação do celular', () => {
    it('tem só destinos que existem, para o polegar nunca cair numa tela vazia', async () => {
      comSessaoDeAdmin(rotasDeLeitura(semDados));
      renderizarNaRota('/colaboradores');
      await screen.findByRole('heading', { level: 1, name: 'Colaboradores' });

      const barra = within(menuInferior());
      expect(barra.getAllByRole('link').map((link) => link.textContent)).toEqual([
        'Painel',
        'Gincanas',
        'Equipes',
        'Colaboradores',
        'Aprovar',
      ]);
      expect(barra.getByRole('link', { name: 'Colaboradores' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(barra.queryByText('Em breve')).not.toBeInTheDocument();
    });

    it('mostra o nome e o botão Sair no topo', async () => {
      comSessaoDeAdmin(rotasDeLeitura(semDados));
      renderizarNaRota('/painel');
      await screen.findByRole('heading', { level: 1 });

      // O "Sair" do topo é o que não está dentro do menu lateral.
      const lateral = screen.getByRole('complementary');
      const sairDoTopo = screen
        .getAllByRole('button', { name: 'Sair' })
        .find((botao) => !lateral.contains(botao));
      expect(sairDoTopo).toBeDefined();
      expect(sairDoTopo?.parentElement).toHaveTextContent('Pessoa Teste');

      fireEvent.click(sairDoTopo as HTMLElement);
      expect(await screen.findByLabelText('E-mail')).toBeVisible();
    });
  });

  describe('painel provisório', () => {
    it('diz por onde começar, com um link para cada passo', async () => {
      comSessaoDeAdmin(rotasDeLeitura(semDados));
      renderizarNaRota('/painel');

      const passos = await screen.findByRole('list', { name: 'Por onde começar' });

      expect(
        within(passos).getByRole('link', { name: /cadastre a gincana do ano/i }),
      ).toHaveAttribute('href', '/gincanas');
      expect(
        within(passos).getByRole('link', { name: /cadastre os colaboradores/i }),
      ).toHaveAttribute('href', '/colaboradores');
      expect(within(passos).getByRole('link', { name: /monte as equipes/i })).toHaveAttribute(
        'href',
        '/equipes',
      );
    });
  });

  describe('quem não é administradora', () => {
    it.each<[Papel, string]>([
      ['COLABORADOR', '/gincanas'],
      ['COLABORADOR', '/equipes'],
      ['COLABORADOR', '/colaboradores'],
      ['LIDER', '/gincanas'],
      ['LIDER', '/equipes'],
      ['LIDER', '/colaboradores'],
    ])('%s não abre %s nem vê o menu da administradora', async (papel, caminho) => {
      gravarToken('token-de-teste');
      simularApi({ 'GET /auth/me': () => ({ status: 200, dados: usuarioDeTeste(papel) }) });

      renderizarNaRota(caminho);

      expect(
        await screen.findByRole('heading', { name: 'Você não tem acesso a esta página' }),
      ).toBeVisible();
      expect(screen.queryByRole('navigation', { name: 'Menu principal' })).not.toBeInTheDocument();
    });
  });
});
