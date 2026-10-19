import { describe, expect, it } from 'vitest';

import { descreverInstante, formatarDataEHora } from './formatar-instante.js';

/**
 * Os instantes são montados com os números do calendário local (`new Date(ano, mês, ...)`),
 * então o teste dá o mesmo resultado em qualquer fuso em que a máquina esteja.
 */
const instante = (ano: number, mes: number, dia: number, hora: number, minuto: number) =>
  new Date(ano, mes - 1, dia, hora, minuto).toISOString();

describe('formatarDataEHora', () => {
  it('escreve dia, mês, ano e hora com dois dígitos', () => {
    expect(formatarDataEHora(instante(2026, 11, 2, 9, 5))).toBe('02/11/2026 às 09:05');
  });

  it('devolve o texto original quando o instante não é uma data válida', () => {
    expect(formatarDataEHora('ontem à tarde')).toBe('ontem à tarde');
  });
});

describe('descreverInstante', () => {
  const agora = new Date(2026, 10, 12, 16, 0);

  it('chama de "hoje" o que aconteceu no mesmo dia', () => {
    expect(descreverInstante(instante(2026, 11, 12, 10, 15), agora)).toBe('hoje, 10:15');
  });

  it('chama de "ontem" o dia anterior', () => {
    expect(descreverInstante(instante(2026, 11, 11, 18, 40), agora)).toBe('ontem, 18:40');
  });

  it('usa dia e mês para datas mais antigas, e o ano quando não é o atual', () => {
    expect(descreverInstante(instante(2026, 11, 3, 9, 32), agora)).toBe('03/11, 09:32');
    expect(descreverInstante(instante(2025, 12, 20, 8, 0), agora)).toBe('20/12/2025, 08:00');
  });
});
