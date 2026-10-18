import type { UsuarioAutenticado } from '@gincana/contracts';
import { describe, expect, it } from 'vitest';

import { escopoDaListaDeTiposAcao, escopoDoTipoAcao, enxergaTipoPausado } from './policy.js';

const GINCANA = '11111111-1111-4111-8111-111111111111';
const TIPO = '22222222-2222-4222-8222-222222222222';

function usuario(dados: Partial<UsuarioAutenticado>): UsuarioAutenticado {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    nome: 'Pessoa de teste',
    email: 'policy-tipo@teste.invalido',
    papel: 'COLABORADOR',
    equipeId: null,
    equipeLideradaId: null,
    ...dados,
  };
}

const admin = usuario({ papel: 'ADMIN' });
const lider = usuario({ papel: 'LIDER' });
const colaborador = usuario({});

describe('escopoDaListaDeTiposAcao', () => {
  it('a administradora vê tudo quando não pede filtro', () => {
    expect(escopoDaListaDeTiposAcao(admin, GINCANA, {})).toEqual({ gincanaId: GINCANA });
  });

  it('a administradora usa o filtro de ativo como pediu, inclusive para ver os pausados', () => {
    expect(escopoDaListaDeTiposAcao(admin, GINCANA, { ativo: false })).toEqual({
      gincanaId: GINCANA,
      ativo: false,
    });
    expect(escopoDaListaDeTiposAcao(admin, GINCANA, { ativo: true })).toEqual({
      gincanaId: GINCANA,
      ativo: true,
    });
  });

  it('líder e colaborador só alcançam tipo ativo, mesmo pedindo os pausados na URL', () => {
    for (const pessoa of [lider, colaborador]) {
      expect(escopoDaListaDeTiposAcao(pessoa, GINCANA, { ativo: false })).toEqual({
        gincanaId: GINCANA,
        ativo: true,
      });
      expect(escopoDaListaDeTiposAcao(pessoa, GINCANA, {})).toEqual({
        gincanaId: GINCANA,
        ativo: true,
      });
    }
  });
});

describe('escopoDoTipoAcao', () => {
  it('a administradora alcança o tipo pausado pelo identificador', () => {
    expect(escopoDoTipoAcao(admin, TIPO)).toEqual({ id: TIPO });
  });

  it('os demais perfis carregam `ativo: true` dentro do próprio where', () => {
    expect(escopoDoTipoAcao(colaborador, TIPO)).toEqual({ id: TIPO, ativo: true });
    expect(escopoDoTipoAcao(lider, TIPO)).toEqual({ id: TIPO, ativo: true });
  });
});

describe('enxergaTipoPausado', () => {
  it('é privilégio da administradora', () => {
    expect(enxergaTipoPausado(admin)).toBe(true);
    expect(enxergaTipoPausado(lider)).toBe(false);
    expect(enxergaTipoPausado(colaborador)).toBe(false);
  });
});
