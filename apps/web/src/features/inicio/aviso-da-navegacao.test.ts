import { describe, expect, it } from 'vitest';

import { lerAvisoDaNavegacao } from './aviso-da-navegacao.js';

describe('lerAvisoDaNavegacao', () => {
  it('lê um aviso de sucesso ou de erro bem formado', () => {
    expect(lerAvisoDaNavegacao({ aviso: { tipo: 'sucesso', texto: 'Deu certo.' } })).toEqual({
      tipo: 'sucesso',
      texto: 'Deu certo.',
    });
    expect(lerAvisoDaNavegacao({ aviso: { tipo: 'erro', texto: 'Falhou.' } })?.tipo).toBe('erro');
  });

  it.each([
    null,
    undefined,
    'texto',
    {},
    { aviso: null },
    { aviso: { tipo: 'alerta', texto: 'x' } },
    { aviso: { tipo: 'sucesso', texto: 42 } },
    { aviso: { tipo: 'sucesso' } },
  ])('ignora o que não tem o formato esperado: %j', (estado) => {
    expect(lerAvisoDaNavegacao(estado)).toBeNull();
  });
});
