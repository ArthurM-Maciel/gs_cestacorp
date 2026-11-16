import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Logo } from './Logo.js';

describe('Logo', () => {
  it('por padrão, mostra a arte com o nome "Cestacorp" no alt, para quem usa leitor de tela', () => {
    const { getByRole } = render(<Logo />);

    expect(getByRole('img', { name: 'Cestacorp' })).toBeVisible();
  });

  it('no modo somente símbolo, a imagem é decorativa (sem nome, fora da navegação por leitor de tela)', () => {
    const { container } = render(<Logo somenteSimbolo />);

    const imagem = container.querySelector('img');
    expect(imagem).toHaveAttribute('alt', '');
    expect(imagem).toHaveAttribute('aria-hidden', 'true');
  });

  it('troca a arte entre positiva e negativa', () => {
    const { getByRole, rerender } = render(<Logo tom="positiva" />);
    const srcPositiva = getByRole('img', { name: 'Cestacorp' }).getAttribute('src');

    rerender(<Logo tom="negativa" />);
    const srcNegativa = getByRole('img', { name: 'Cestacorp' }).getAttribute('src');

    expect(srcPositiva).not.toBe(srcNegativa);
  });

  it('troca a arte entre a variante vertical e a horizontal', () => {
    const { getByRole, rerender } = render(<Logo variante="vertical" />);
    const srcVertical = getByRole('img', { name: 'Cestacorp' }).getAttribute('src');

    rerender(<Logo variante="horizontal" />);
    const srcHorizontal = getByRole('img', { name: 'Cestacorp' }).getAttribute('src');

    expect(srcVertical).not.toBe(srcHorizontal);
  });
});
