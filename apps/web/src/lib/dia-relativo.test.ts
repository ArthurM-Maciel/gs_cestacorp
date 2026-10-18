import { describe, expect, it } from 'vitest';

import { dataDeHoje, descreverDia } from './dia-relativo.js';

// 12/11/2026, 09:32 no fuso do próprio aparelho: o teste não depende do fuso da máquina.
const agora = new Date(2026, 10, 12, 9, 32);

describe('dataDeHoje', () => {
  it('é o dia do calendário de quem olha, com zeros à esquerda', () => {
    expect(dataDeHoje(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dataDeHoje(agora)).toBe('2026-11-12');
  });
});

describe('descreverDia', () => {
  it('chama o dia de hoje e de ontem pelo nome', () => {
    expect(descreverDia('2026-11-12', agora)).toBe('hoje');
    expect(descreverDia('2026-11-11', agora)).toBe('ontem');
  });

  it('ontem atravessa o fim do mês', () => {
    expect(descreverDia('2026-10-31', new Date(2026, 10, 1, 8, 0))).toBe('ontem');
  });

  it('mostra dia e mês no ano atual e inclui o ano nos outros', () => {
    expect(descreverDia('2026-11-02', agora)).toBe('02/11');
    expect(descreverDia('2025-12-31', agora)).toBe('31/12/2025');
  });

  it('devolve o texto como veio quando não é uma data', () => {
    expect(descreverDia('ontem', agora)).toBe('ontem');
  });
});
