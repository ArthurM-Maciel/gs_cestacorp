import type { UsuarioAutenticado } from '@gincana/contracts';
import { describe, expect, it } from 'vitest';

import { podeAtualizarGincana } from './policy.js';

function usuario(dados: Partial<UsuarioAutenticado>): UsuarioAutenticado {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    nome: 'Pessoa de teste',
    email: 'policy-gincana@teste.invalido',
    papel: 'COLABORADOR',
    equipeId: null,
    equipeLideradaId: null,
    ...dados,
  };
}

const admin = usuario({ papel: 'ADMIN' });
const lider = usuario({ papel: 'LIDER' });
const colaborador = usuario({});

describe('podeAtualizarGincana', () => {
  it('a administradora altera qualquer campo do cadastro', () => {
    expect(podeAtualizarGincana(admin, { nome: 'Gincana 2027' })).toBe(true);
    expect(podeAtualizarGincana(admin, { status: 'ENCERRADA' })).toBe(true);
    expect(podeAtualizarGincana(admin, { dataFim: '2027-11-30' })).toBe(true);
    expect(podeAtualizarGincana(admin, { placarVisivel: false })).toBe(true);
    expect(podeAtualizarGincana(admin, { placarVisivel: false, status: 'ATIVA' })).toBe(true);
  });

  it('o líder oculta e mostra o placar', () => {
    expect(podeAtualizarGincana(lider, { placarVisivel: false })).toBe(true);
    expect(podeAtualizarGincana(lider, { placarVisivel: true })).toBe(true);
  });

  it('o líder não mexe em nome, período ou situação, nem de carona no placar', () => {
    expect(podeAtualizarGincana(lider, { nome: 'Gincana do líder' })).toBe(false);
    expect(podeAtualizarGincana(lider, { status: 'ENCERRADA' })).toBe(false);
    expect(podeAtualizarGincana(lider, { dataInicio: '2027-01-01' })).toBe(false);
    expect(podeAtualizarGincana(lider, { dataFim: '2027-12-31' })).toBe(false);
    expect(podeAtualizarGincana(lider, { placarVisivel: false, status: 'ENCERRADA' })).toBe(false);
  });

  it('o colaborador não altera nada', () => {
    expect(podeAtualizarGincana(colaborador, { placarVisivel: false })).toBe(false);
    expect(podeAtualizarGincana(colaborador, { nome: 'Gincana qualquer' })).toBe(false);
  });
});
