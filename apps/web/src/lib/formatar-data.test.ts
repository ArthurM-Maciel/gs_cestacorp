import { describe, expect, it } from 'vitest';

import { formatarData } from './formatar-data.js';

describe('formatarData', () => {
  it('troca AAAA-MM-DD por DD/MM/AAAA', () => {
    expect(formatarData('2026-10-28')).toBe('28/10/2026');
  });

  it('não escorrega um dia por causa do fuso do navegador', () => {
    // `new Date('2026-11-19')` é meia-noite UTC e viraria 18/11 em quem está no Brasil.
    expect(formatarData('2026-11-19')).toBe('19/11/2026');
  });

  it('aceita data com hora, ignorando a hora', () => {
    expect(formatarData('2026-11-19T00:00:00.000Z')).toBe('19/11/2026');
  });

  it('devolve o texto como veio quando não é uma data', () => {
    expect(formatarData('amanhã')).toBe('amanhã');
  });
});
