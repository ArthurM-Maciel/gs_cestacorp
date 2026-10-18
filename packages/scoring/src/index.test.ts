import { describe, expect, it } from 'vitest';

import {
  ErroDeCalculo,
  calcularPontos,
  calcularPontosNaData,
  selecionarRegraVigente,
  type RegraPontuacao,
} from './index.js';

const regra = (
  id: string,
  pontosPorUnidade: number,
  inicio: string,
  fim: string | null = null,
): RegraPontuacao => ({
  id,
  pontosPorUnidade,
  vigenciaInicio: new Date(inicio),
  vigenciaFim: fim === null ? null : new Date(fim),
});

describe('US05 · calcularPontos', () => {
  it('reproduz os exemplos reais da planilha da Cestacorp', () => {
    expect(calcularPontos(24, 10)).toBe(240); // 24 kg de tampinhas
    expect(calcularPontos(3, 15)).toBe(45); // 3 peças de roupa infantil
    expect(calcularPontos(1, 50)).toBe(50); // 1 certificado de curso
  });

  it('aceita quantidade fracionada, como meio quilo de tampinhas', () => {
    expect(calcularPontos(1.5, 10)).toBe(15);
    expect(calcularPontos(0.5, 10)).toBe(5);
  });

  it('arredonda para o ponto inteiro mais próximo, com meio ponto subindo', () => {
    expect(calcularPontos(2.33, 10)).toBe(23);
    expect(calcularPontos(2.37, 10)).toBe(24);
    expect(calcularPontos(2.45, 10)).toBe(25);
  });

  it('recusa quantidade zerada ou negativa', () => {
    expect(() => calcularPontos(0, 10)).toThrow(ErroDeCalculo);
    expect(() => calcularPontos(-5, 10)).toThrow(/maior que zero/);
  });

  it('recusa entrada que não é número', () => {
    expect(() => calcularPontos(Number.NaN, 10)).toThrow(ErroDeCalculo);
    expect(() => calcularPontos(5, Number.POSITIVE_INFINITY)).toThrow(ErroDeCalculo);
  });

  it('recusa pontuação negativa, que tiraria pontos de quem doou', () => {
    expect(() => calcularPontos(5, -10)).toThrow(/negativ/);
  });

  it('aceita regra que vale zero ponto, usada para ação simbólica', () => {
    expect(calcularPontos(3, 0)).toBe(0);
  });
});

describe('US04 · selecionarRegraVigente', () => {
  const tampinhasAntiga = regra('r1', 8, '2026-01-01', '2026-06-01');
  const tampinhasAtual = regra('r2', 10, '2026-06-01');

  it('escolhe a regra que vigia na data da ação', () => {
    expect(selecionarRegraVigente([tampinhasAntiga, tampinhasAtual], new Date('2026-03-10'))?.id)
      .toBe('r1');
    expect(selecionarRegraVigente([tampinhasAntiga, tampinhasAtual], new Date('2026-09-10'))?.id)
      .toBe('r2');
  });

  it('trata a troca de regra sem buraco nem sobreposição', () => {
    // A vigência é fechada no início e aberta no fim: no instante exato da virada,
    // já vale a regra nova.
    expect(selecionarRegraVigente([tampinhasAntiga, tampinhasAtual], new Date('2026-06-01'))?.id)
      .toBe('r2');
  });

  it('devolve nulo quando nenhuma regra cobre a data', () => {
    expect(selecionarRegraVigente([tampinhasAtual], new Date('2026-01-10'))).toBeNull();
    expect(selecionarRegraVigente([], new Date('2026-01-10'))).toBeNull();
  });

  it('em cadastro inconsistente, vence a regra de início mais recente', () => {
    const sobreposta = regra('r3', 12, '2026-07-01');
    expect(selecionarRegraVigente([tampinhasAtual, sobreposta], new Date('2026-08-01'))?.id)
      .toBe('r3');
  });

  it('recusa data inválida', () => {
    expect(() => selecionarRegraVigente([tampinhasAtual], new Date('x'))).toThrow(ErroDeCalculo);
  });
});

describe('US05 · calcularPontosNaData', () => {
  const regras = [regra('r1', 8, '2026-01-01', '2026-06-01'), regra('r2', 10, '2026-06-01')];

  it('aplica a regra da época da ação, não a de hoje', () => {
    // O mesmo lançamento vale menos se a ação aconteceu quando a regra era de 8 pontos.
    expect(calcularPontosNaData(24, regras, new Date('2026-03-10'))).toMatchObject({
      pontos: 192,
      regra: { id: 'r1' },
    });
    expect(calcularPontosNaData(24, regras, new Date('2026-09-10'))).toMatchObject({
      pontos: 240,
      regra: { id: 'r2' },
    });
  });

  it('devolve a regra aplicada, para que o lançamento congele o valor usado', () => {
    const { regra: aplicada } = calcularPontosNaData(3, regras, new Date('2026-09-10'));
    expect(aplicada.pontosPorUnidade).toBe(10);
  });

  it('falha quando não há regra vigente, em vez de pontuar zero em silêncio', () => {
    expect(() => calcularPontosNaData(10, regras, new Date('2025-12-31'))).toThrow(
      /Nenhuma regra de pontuação vigente/,
    );
  });
});
