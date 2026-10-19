import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  cenarioDeLancamentos,
  comSessaoDe,
  rotasDeLancamentos,
  umLancamento,
} from '../../simulacao-de-lancamentos.js';
import { renderizarNaRota } from '../../utilitarios-de-teste.js';

/** O menu lateral (computador) e o inferior (celular) existem na página; o CSS mostra um. */
const menuLateral = () => screen.getByRole('navigation', { name: 'Menu principal' });
const menuInferior = () => screen.getByRole('navigation', { name: 'Menu inferior' });

describe('Layout do colaborador e do líder', () => {
  describe('colaborador', () => {
    it('tem na barra do celular só destinos que existem: Início e Registrar', async () => {
      const { estado } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

      renderizarNaRota('/inicio');
      await screen.findByRole('heading', { level: 1, name: 'Olá, Pessoa Teste!' });

      const barra = within(menuInferior());
      expect(barra.getAllByRole('link').map((link) => link.textContent)).toEqual([
        'Início',
        'Registrar',
      ]);
      expect(barra.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page');
    });

    it('mostra o Placar como "Em breve", sem link, no menu lateral', async () => {
      const { estado } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

      renderizarNaRota('/inicio');
      await screen.findByRole('heading', { level: 1 });

      const menu = within(menuLateral());
      expect(menu.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/inicio');
      expect(menu.getByRole('link', { name: 'Registrar ação' })).toHaveAttribute(
        'href',
        '/registrar',
      );
      expect(menu.queryByRole('link', { name: /placar/i })).not.toBeInTheDocument();
      expect(menu.getByText('Placar')).toBeVisible();
      expect(menu.getByText('Em breve')).toBeVisible();
      expect(menu.queryByText(/aprova/i)).not.toBeInTheDocument();
    });

    it('mostra o nome e a equipe no rodapé do menu lateral', async () => {
      const { estado } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

      renderizarNaRota('/inicio');
      await screen.findByRole('heading', { level: 1 });

      const lateral = within(screen.getByRole('complementary'));
      expect(await lateral.findByText('Equipe Araucária')).toBeVisible();
      expect(lateral.getByText('Pessoa Teste')).toBeVisible();
    });

    it('marca "Registrar" como atual também na tela do formulário', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

      renderizarNaRota(`/registrar/${alimentos.id}`);
      await screen.findByRole('heading', { level: 2, name: 'Doação de alimentos' });

      expect(within(menuInferior()).getByRole('link', { name: 'Registrar' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('encerra a sessão pelo botão Sair do topo', async () => {
      const { estado } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));
      renderizarNaRota('/inicio');
      await screen.findByRole('heading', { level: 1 });

      const lateral = screen.getByRole('complementary');
      const sairDoTopo = screen
        .getAllByRole('button', { name: 'Sair' })
        .find((botao) => !lateral.contains(botao));
      fireEvent.click(sairDoTopo as HTMLElement);

      expect(await screen.findByLabelText('E-mail')).toBeVisible();
    });
  });

  describe('líder', () => {
    it('ganha "Aprovar" na barra do celular, com o número de pendentes no selo', async () => {
      const { estado, camila, equipe, alimentos, roupas } = cenarioDeLancamentos();
      estado.lancamentos = [
        umLancamento(alimentos, camila, equipe),
        umLancamento(roupas, camila, equipe, { quantidade: 8 }),
      ];
      comSessaoDe('LIDER', rotasDeLancamentos(estado));

      renderizarNaRota('/inicio');
      await screen.findByRole('heading', { level: 1 });

      const barra = within(menuInferior());
      expect(await barra.findByRole('link', { name: 'Aprovar, 2 pendentes' })).toHaveAttribute(
        'href',
        '/aprovacoes',
      );
      expect(barra.getAllByRole('link')).toHaveLength(3);
      expect(barra.getAllByRole('link')[0]).toHaveAccessibleName('Início');
      expect(barra.getAllByRole('link')[2]).toHaveAccessibleName('Registrar');
    });

    it('não conta como aprovação o lançamento da própria pessoa', async () => {
      const { estado, camila, euMesma, equipe, alimentos, roupas } = cenarioDeLancamentos();
      estado.lancamentos = [
        umLancamento(alimentos, camila, equipe),
        umLancamento(roupas, euMesma, equipe, { quantidade: 3 }),
      ];
      comSessaoDe('LIDER', rotasDeLancamentos(estado));

      renderizarNaRota('/inicio');
      await screen.findByRole('heading', { level: 1 });

      expect(
        await within(menuInferior()).findByRole('link', { name: 'Aprovar, 1 pendentes' }),
      ).toBeVisible();
    });

    it('lista Aprovações, Registrar ação e o Placar em breve no menu lateral', async () => {
      const { estado } = cenarioDeLancamentos();
      comSessaoDe('LIDER', rotasDeLancamentos(estado));

      renderizarNaRota('/inicio');
      await screen.findByRole('heading', { level: 1 });

      const menu = within(menuLateral());
      expect(menu.getAllByRole('link').map((link) => link.textContent)).toEqual([
        'Início',
        'Aprovações',
        'Registrar ação',
      ]);
      expect(menu.getByText('Em breve')).toBeVisible();
      expect(
        await within(screen.getByRole('complementary')).findByText('Líder da equipe Araucária'),
      ).toBeVisible();
    });

    it('sem pendências, o selo não aparece', async () => {
      const { estado } = cenarioDeLancamentos();
      comSessaoDe('LIDER', rotasDeLancamentos(estado));

      renderizarNaRota('/inicio');
      await screen.findByRole('heading', { level: 1 });

      expect(within(menuInferior()).getByRole('link', { name: 'Aprovar' })).toBeVisible();
    });
  });
});
