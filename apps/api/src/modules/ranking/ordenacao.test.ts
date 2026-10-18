import { describe, expect, it } from 'vitest';

import { classificarEquipes, type TotalDaEquipe } from './ordenacao.js';

/**
 * US11 — a ordem do pódio e o empate, sem banco e sem HTTP.
 *
 * O protótipo mostra 1º, 2º e 3º e não diz o que fazer no empate. A decisão tomada aqui é
 * a contagem olímpica: empate divide a posição e a seguinte pula. Este arquivo é onde
 * essa decisão fica provada.
 */

const equipe = (nome: string, pontos: number): TotalDaEquipe => ({
  equipeId: `id-${nome}`,
  nome,
  lider: null,
  pontos,
  acoesAprovadas: 0,
  totalColaboradores: 0,
});

describe('classificarEquipes', () => {
  it('ordena por pontos decrescente', () => {
    const classificadas = classificarEquipes([
      equipe('Beta', 120),
      equipe('Alfa', 480),
      equipe('Gama', 300),
    ]);

    expect(classificadas.map((linha) => [linha.nome, linha.posicao])).toEqual([
      ['Alfa', 1],
      ['Gama', 2],
      ['Beta', 3],
    ]);
  });

  it('divide a posição no empate e pula a seguinte: 1, 2, 2, 4', () => {
    const classificadas = classificarEquipes([
      equipe('Delta', 100),
      equipe('Alfa', 500),
      equipe('Beta', 300),
      equipe('Gama', 300),
    ]);

    expect(classificadas.map((linha) => [linha.nome, linha.posicao, linha.empatada])).toEqual([
      ['Alfa', 1, false],
      ['Beta', 2, true],
      ['Gama', 2, true],
      ['Delta', 4, false],
    ]);
  });

  it('empata também no topo e no zero', () => {
    const classificadas = classificarEquipes([
      equipe('Alfa', 500),
      equipe('Beta', 500),
      equipe('Gama', 0),
      equipe('Delta', 0),
    ]);

    expect(classificadas.map((linha) => [linha.nome, linha.posicao, linha.empatada])).toEqual([
      ['Alfa', 1, true],
      ['Beta', 1, true],
      ['Delta', 3, true],
      ['Gama', 3, true],
    ]);
  });

  it('desempata a exibição pelo nome, sem mudar a posição', () => {
    const classificadas = classificarEquipes([equipe('Zulu', 10), equipe('Alfa', 10)]);

    expect(classificadas.map((linha) => linha.nome)).toEqual(['Alfa', 'Zulu']);
    expect(classificadas.every((linha) => linha.posicao === 1)).toBe(true);
  });

  it('não altera a lista recebida', () => {
    const entrada = [equipe('Beta', 1), equipe('Alfa', 2)];
    classificarEquipes(entrada);
    expect(entrada.map((linha) => linha.nome)).toEqual(['Beta', 'Alfa']);
  });

  it('devolve lista vazia quando a gincana ainda não tem equipes', () => {
    expect(classificarEquipes([])).toEqual([]);
  });
});
