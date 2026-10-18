import type { UsuarioAutenticado } from '@gincana/contracts';
import { describe, expect, it } from 'vitest';

import { montarFiltroDeColaboradores } from './policy.js';

const EQUIPE_A = '11111111-1111-4111-8111-111111111111';
const EQUIPE_B = '22222222-2222-4222-8222-222222222222';

function usuario(dados: Partial<UsuarioAutenticado>): UsuarioAutenticado {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    nome: 'Pessoa de teste',
    email: 'policy@teste.invalido',
    papel: 'COLABORADOR',
    equipeId: null,
    equipeLideradaId: null,
    ...dados,
  };
}

describe('montarFiltroDeColaboradores', () => {
  it('a administradora alcança todo mundo e usa os filtros que pediu', () => {
    const admin = usuario({ papel: 'ADMIN' });

    expect(montarFiltroDeColaboradores(admin, {})).toEqual({});
    expect(montarFiltroDeColaboradores(admin, { equipeId: EQUIPE_A, papel: 'LIDER' })).toEqual({
      equipeId: EQUIPE_A,
      papel: 'LIDER',
    });
  });

  it('o líder fica preso à própria equipe mesmo pedindo outra na URL', () => {
    const quemLidera = usuario({
      papel: 'LIDER',
      equipeId: EQUIPE_A,
      equipeLideradaId: EQUIPE_A,
    });

    expect(montarFiltroDeColaboradores(quemLidera, { equipeId: EQUIPE_B })).toEqual({
      equipeId: EQUIPE_A,
    });
  });

  it('o colaborador fica preso à equipe dele, não à que veio no parâmetro', () => {
    const pessoa = usuario({ equipeId: EQUIPE_A });

    expect(montarFiltroDeColaboradores(pessoa, { equipeId: EQUIPE_B })).toEqual({
      equipeId: EQUIPE_A,
    });
  });

  it('quem não tem equipe só alcança o próprio cadastro', () => {
    const pessoa = usuario({ equipeId: null });

    expect(montarFiltroDeColaboradores(pessoa, { equipeId: EQUIPE_B })).toEqual({ id: pessoa.id });
  });

  it('o filtro de papel vale para todos os perfis', () => {
    const pessoa = usuario({ equipeId: EQUIPE_A });

    expect(montarFiltroDeColaboradores(pessoa, { papel: 'ADMIN' })).toEqual({
      equipeId: EQUIPE_A,
      papel: 'ADMIN',
    });
  });
});
