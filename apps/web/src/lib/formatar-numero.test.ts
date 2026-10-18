import { describe, expect, it } from 'vitest';

import {
  formatarNumero,
  formatarPontos,
  formatarPontosPorUnidade,
  formatarQuantidade,
  formatarTamanhoDeArquivo,
} from './formatar-numero.js';

describe('formatação de números', () => {
  it('usa o ponto de milhar e a vírgula decimal do português', () => {
    expect(formatarNumero(1250)).toBe('1.250');
    expect(formatarNumero(1.5)).toBe('1,5');
    expect(formatarPontos(120)).toBe('120 pts');
  });

  it('põe a unidade no singular ou no plural conforme a quantidade', () => {
    expect(formatarQuantidade(12, 'KG')).toBe('12 kg');
    expect(formatarQuantidade(1, 'CERTIFICADO')).toBe('1 certificado');
    expect(formatarQuantidade(8, 'PECA')).toBe('8 peças');
    expect(formatarQuantidade(2.5, 'UNIDADE')).toBe('2,5 unidades');
  });

  it('escreve o preço como a grade de ações mostra', () => {
    expect(formatarPontosPorUnidade(10, 'KG')).toBe('10 pts por kg');
    expect(formatarPontosPorUnidade(15, 'PECA')).toBe('15 pts por peça');
    expect(formatarPontosPorUnidade(7.5, 'UNIDADE')).toBe('7,5 pts por unidade');
  });

  it('escreve o tamanho do arquivo em KB ou MB', () => {
    expect(formatarTamanhoDeArquivo(340_000)).toBe('332 KB');
    expect(formatarTamanhoDeArquivo(100)).toBe('1 KB');
    expect(formatarTamanhoDeArquivo(1.5 * 1024 * 1024)).toBe('1,5 MB');
    expect(formatarTamanhoDeArquivo(5 * 1024 * 1024)).toBe('5 MB');
  });
});
