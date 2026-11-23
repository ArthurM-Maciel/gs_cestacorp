import type { UsuarioAutenticado } from '@gincana/contracts';
import { describe, expect, it } from 'vitest';

import { podeVerPlacar } from './policy.js';

function usuario(dados: Partial<UsuarioAutenticado>): UsuarioAutenticado {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    nome: 'Pessoa de teste',
    email: 'policy-placar@teste.invalido',
    papel: 'COLABORADOR',
    equipeId: null,
    equipeLideradaId: null,
    ...dados,
  };
}

const admin = usuario({ papel: 'ADMIN' });
const lider = usuario({ papel: 'LIDER' });
const colaborador = usuario({});

const visivel = { placarVisivel: true };
const oculto = { placarVisivel: false };

describe('podeVerPlacar', () => {
  it('com o placar visível, todo perfil alcança', () => {
    expect(podeVerPlacar(admin, visivel)).toBe(true);
    expect(podeVerPlacar(lider, visivel)).toBe(true);
    expect(podeVerPlacar(colaborador, visivel)).toBe(true);
  });

  it('com o placar oculto, administradora e líder continuam vendo', () => {
    expect(podeVerPlacar(admin, oculto)).toBe(true);
    expect(podeVerPlacar(lider, oculto)).toBe(true);
  });

  it('com o placar oculto, o colaborador não alcança', () => {
    expect(podeVerPlacar(colaborador, oculto)).toBe(false);
  });

  it('o líder sem equipe atribuída também vê: o interruptor é da gincana, não da equipe', () => {
    expect(podeVerPlacar(usuario({ papel: 'LIDER', equipeLideradaId: null }), oculto)).toBe(true);
  });
});
