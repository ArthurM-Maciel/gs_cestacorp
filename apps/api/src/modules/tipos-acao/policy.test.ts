import type { UsuarioAutenticado } from '@gincana/contracts';
import { describe, expect, it } from 'vitest';

import {
  escopoDaListaDeTiposAcao,
  escopoDoTipoAcao,
  enxergaTipoPausado,
  podeAtualizarTipoAcao,
} from './policy.js';

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

  it('o líder também usa o filtro como pediu: ele precisa achar o que vai reativar', () => {
    expect(escopoDaListaDeTiposAcao(lider, GINCANA, {})).toEqual({ gincanaId: GINCANA });
    expect(escopoDaListaDeTiposAcao(lider, GINCANA, { ativo: false })).toEqual({
      gincanaId: GINCANA,
      ativo: false,
    });
  });

  it('o colaborador só alcança tipo ativo, mesmo pedindo os pausados na URL', () => {
    expect(escopoDaListaDeTiposAcao(colaborador, GINCANA, { ativo: false })).toEqual({
      gincanaId: GINCANA,
      ativo: true,
    });
    expect(escopoDaListaDeTiposAcao(colaborador, GINCANA, {})).toEqual({
      gincanaId: GINCANA,
      ativo: true,
    });
  });
});

describe('escopoDoTipoAcao', () => {
  it('administradora e líder alcançam o tipo pausado pelo identificador', () => {
    expect(escopoDoTipoAcao(admin, TIPO)).toEqual({ id: TIPO });
    expect(escopoDoTipoAcao(lider, TIPO)).toEqual({ id: TIPO });
  });

  it('o colaborador carrega `ativo: true` dentro do próprio where', () => {
    expect(escopoDoTipoAcao(colaborador, TIPO)).toEqual({ id: TIPO, ativo: true });
  });
});

describe('enxergaTipoPausado', () => {
  it('vale para quem conduz a gincana, e não para quem registra ação', () => {
    expect(enxergaTipoPausado(admin)).toBe(true);
    expect(enxergaTipoPausado(lider)).toBe(true);
    expect(enxergaTipoPausado(colaborador)).toBe(false);
  });
});

describe('podeAtualizarTipoAcao', () => {
  it('a administradora altera qualquer campo do cadastro', () => {
    expect(podeAtualizarTipoAcao(admin, { ativo: false })).toBe(true);
    expect(podeAtualizarTipoAcao(admin, { nome: 'Outro nome' })).toBe(true);
    expect(podeAtualizarTipoAcao(admin, { nome: 'Outro nome', ativo: true })).toBe(true);
    expect(podeAtualizarTipoAcao(admin, { descricao: null, exigeEvidencia: true })).toBe(true);
  });

  it('o líder pausa e reativa', () => {
    expect(podeAtualizarTipoAcao(lider, { ativo: false })).toBe(true);
    expect(podeAtualizarTipoAcao(lider, { ativo: true })).toBe(true);
  });

  it('o líder não mexe na identidade do tipo, nem de carona junto do `ativo`', () => {
    expect(podeAtualizarTipoAcao(lider, { nome: 'Outro nome' })).toBe(false);
    expect(podeAtualizarTipoAcao(lider, { descricao: 'Nova descrição' })).toBe(false);
    expect(podeAtualizarTipoAcao(lider, { exigeEvidencia: false })).toBe(false);
    expect(podeAtualizarTipoAcao(lider, { ativo: false, nome: 'Outro nome' })).toBe(false);
  });

  it('o colaborador não altera nada', () => {
    expect(podeAtualizarTipoAcao(colaborador, { ativo: false })).toBe(false);
    expect(podeAtualizarTipoAcao(colaborador, { nome: 'Outro nome' })).toBe(false);
  });
});
