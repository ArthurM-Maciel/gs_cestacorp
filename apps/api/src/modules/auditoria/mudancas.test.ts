import { describe, expect, it } from 'vitest';

import { calcularMudancas, formatarValor, normalizarJson } from './mudancas.js';

/**
 * US09 — a comparação que vira "Quantidade: 12 → 15" na tela.
 *
 * Função pura: dá para cobrir cada caso sem subir HTTP nem tocar no banco.
 */

describe('calcularMudancas', () => {
  it('traz só o que mudou, com rótulo em português', () => {
    const mudancas = calcularMudancas(
      { quantidade: 12, status: 'PENDENTE', observacao: 'Entrega na portaria' },
      { quantidade: 15, status: 'PENDENTE', observacao: 'Entrega na portaria' },
    );

    expect(mudancas).toEqual([{ campo: 'quantidade', rotulo: 'Quantidade', de: '12', para: '15' }]);
  });

  it('traduz o status para texto de gente', () => {
    const mudancas = calcularMudancas({ status: 'PENDENTE' }, { status: 'APROVADO' });

    expect(mudancas).toEqual([
      { campo: 'status', rotulo: 'Situação', de: 'Pendente', para: 'Aprovado' },
    ]);
  });

  it('mostra situação e pontos antes do resto', () => {
    const mudancas = calcularMudancas(
      { observacao: 'a', quantidade: 1, pontosCalculados: 10, status: 'PENDENTE' },
      { observacao: 'b', quantidade: 2, pontosCalculados: 20, status: 'APROVADO' },
    );

    expect(mudancas.map((mudanca) => mudanca.campo)).toEqual([
      'status',
      'quantidade',
      'pontosCalculados',
      'observacao',
    ]);
  });

  it('na criação, lista os valores iniciais com "de" nulo', () => {
    const mudancas = calcularMudancas(null, { quantidade: 24, status: 'PENDENTE' });

    expect(mudancas).toEqual([
      { campo: 'status', rotulo: 'Situação', de: null, para: 'Pendente' },
      { campo: 'quantidade', rotulo: 'Quantidade', de: null, para: '24' },
    ]);
  });

  it('deixa de fora os identificadores, que não dizem nada na tela', () => {
    const mudancas = calcularMudancas(
      { tipoAcaoId: 'antigo', regraPontuacaoId: 'r1', equipeId: 'e1', quantidade: 1 },
      { tipoAcaoId: 'novo', regraPontuacaoId: 'r2', equipeId: 'e2', quantidade: 2 },
    );

    expect(mudancas.map((mudanca) => mudanca.campo)).toEqual(['quantidade']);
  });

  it('registra o motivo da recusa que aparece do nada', () => {
    const mudancas = calcularMudancas(
      { status: 'PENDENTE', motivoRecusa: null },
      { status: 'RECUSADO', motivoRecusa: 'Foto sem a etiqueta da ONG' },
    );

    expect(mudancas).toEqual([
      { campo: 'status', rotulo: 'Situação', de: 'Pendente', para: 'Recusado' },
      {
        campo: 'motivoRecusa',
        rotulo: 'Motivo da recusa',
        de: null,
        para: 'Foto sem a etiqueta da ONG',
      },
    ]);
  });

  it('devolve lista vazia quando não há nada comparável', () => {
    expect(calcularMudancas(null, null)).toEqual([]);
    expect(calcularMudancas('texto', 'outro texto')).toEqual([]);
  });

  it('não inventa mudança quando nada mudou', () => {
    expect(calcularMudancas({ quantidade: 3 }, { quantidade: 3 })).toEqual([]);
  });
});

describe('formatarValor', () => {
  it('converte booleano em Sim e Não', () => {
    expect(formatarValor(true)).toBe('Sim');
    expect(formatarValor(false)).toBe('Não');
  });

  it('mantém nulo como nulo, para a tela decidir o que exibir', () => {
    expect(formatarValor(null)).toBeNull();
    expect(formatarValor(undefined)).toBeNull();
  });

  it('serializa valor composto em vez de mostrar [object Object]', () => {
    expect(formatarValor({ a: 1 })).toBe('{"a":1}');
  });
});

describe('normalizarJson', () => {
  it('preserva nulo explícito e derruba undefined', () => {
    expect(normalizarJson({ a: null, b: undefined, c: 1 })).toEqual({ a: null, c: 1 });
  });

  it('atravessa listas e objetos aninhados', () => {
    expect(normalizarJson({ lista: [1, 'dois', { tres: true }] })).toEqual({
      lista: [1, 'dois', { tres: true }],
    });
  });

  it('devolve nulo para valor ausente', () => {
    expect(normalizarJson(undefined)).toBeNull();
  });
});
