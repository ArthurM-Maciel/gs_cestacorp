import { describe, expect, it } from 'vitest';

import { consultaDoPeriodo, janelaDaSemana, lerPeriodo } from './periodo-do-placar.js';

describe('janelaDaSemana', () => {
  it('vai da segunda ao domingo da semana de uma quarta-feira', () => {
    // 28/10/2026 é uma quarta-feira.
    expect(janelaDaSemana(new Date(2026, 9, 28, 14, 30))).toEqual({
      desde: '2026-10-26',
      ate: '2026-11-01',
    });
  });

  it('na segunda-feira, a semana começa no próprio dia', () => {
    expect(janelaDaSemana(new Date(2026, 10, 2, 0, 5))).toEqual({
      desde: '2026-11-02',
      ate: '2026-11-08',
    });
  });

  it('no domingo, a semana ainda é a que terminou nele, e não a próxima', () => {
    expect(janelaDaSemana(new Date(2026, 10, 8, 23, 59))).toEqual({
      desde: '2026-11-02',
      ate: '2026-11-08',
    });
  });

  it('atravessa a virada do ano', () => {
    // 01/01/2027 é uma sexta-feira.
    expect(janelaDaSemana(new Date(2027, 0, 1, 12, 0))).toEqual({
      desde: '2026-12-28',
      ate: '2027-01-03',
    });
  });
});

describe('consultaDoPeriodo', () => {
  const quarta = new Date(2026, 9, 28, 14, 30);

  it('o geral não manda data nenhuma', () => {
    expect(consultaDoPeriodo('geral', quarta)).toEqual({});
  });

  it('"esta semana" manda a janela calculada no aparelho', () => {
    expect(consultaDoPeriodo('semana', quarta)).toEqual({
      desde: '2026-10-26',
      ate: '2026-11-01',
    });
  });
});

describe('lerPeriodo', () => {
  it('reconhece os dois períodos e cai no geral para qualquer outra coisa', () => {
    expect(lerPeriodo('semana')).toBe('semana');
    expect(lerPeriodo('geral')).toBe('geral');
    expect(lerPeriodo(null)).toBe('geral');
    expect(lerPeriodo('ano-passado')).toBe('geral');
  });
});
