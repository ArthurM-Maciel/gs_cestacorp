import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderizarNaRota } from './utilitarios-de-teste.js';

describe('App', () => {
  it('abre na tela de boas-vindas para quem não tem sessão', () => {
    renderizarNaRota('/');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Faça o bem e some pontos!' }),
    ).toBeInTheDocument();
  });

  it('leva ao login pelo botão Entrar', () => {
    renderizarNaRota('/');

    fireEvent.click(screen.getByRole('link', { name: 'Entrar' }));

    expect(screen.getByRole('heading', { level: 1, name: /que bom ver/i })).toBeInTheDocument();
  });

  it('leva a uma tela explicativa, e não a uma página quebrada, em Criar conta', () => {
    renderizarNaRota('/');

    fireEvent.click(screen.getByRole('link', { name: 'Criar conta' }));

    expect(screen.getByRole('heading', { level: 1, name: /criar conta/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para o login' })).toBeInTheDocument();
  });

  it('avisa quando a página não existe e oferece o caminho de volta', () => {
    renderizarNaRota('/nao-existe');

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
  });
});
