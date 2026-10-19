import { describe, expect, it } from 'vitest';

import { caminhoInicial, destinoAposEntrar } from './destinos.js';

describe('caminhoInicial', () => {
  it('dá a cada perfil a sua primeira tela', () => {
    expect(caminhoInicial('COLABORADOR')).toBe('/inicio');
    expect(caminhoInicial('LIDER')).toBe('/aprovacoes');
    expect(caminhoInicial('ADMIN')).toBe('/painel');
  });
});

describe('destinoAposEntrar', () => {
  it('volta à página que a pessoa tentou abrir', () => {
    expect(destinoAposEntrar({ de: '/aprovacoes?aba=recusados' }, 'LIDER')).toBe(
      '/aprovacoes?aba=recusados',
    );
  });

  it('usa o início do perfil quando não há página de origem', () => {
    expect(destinoAposEntrar(null, 'ADMIN')).toBe('/painel');
    expect(destinoAposEntrar({}, 'COLABORADOR')).toBe('/inicio');
  });

  it.each(['//outro-site.com', 'https://outro-site.com/inicio', 'javascript:alert(1)', '', 42])(
    'ignora a origem %j, que não é um caminho interno',
    (de) => {
      expect(destinoAposEntrar({ de }, 'COLABORADOR')).toBe('/inicio');
    },
  );
});
