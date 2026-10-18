import { unidades } from '@gincana/contracts';
import { describe, expect, it } from 'vitest';

import { estilosDaFamilia, familiaDoTipo } from './familias-de-acao.js';

describe('família da ação', () => {
  it('sai da unidade de medida, e não do nome da ação', () => {
    expect(familiaDoTipo({ unidade: 'PECA' })).toBe('roupas');
    expect(familiaDoTipo({ unidade: 'CERTIFICADO' })).toBe('curso');
    expect(familiaDoTipo({ unidade: 'KG' })).toBe('alimentos');
  });

  it('tem um padrão para o tipo que a tela não conhece (atividade extra)', () => {
    expect(familiaDoTipo({ unidade: 'UNIDADE' })).toBe('outra');
  });

  it('toda unidade existente cai numa família com estilo definido', () => {
    for (const unidade of unidades) {
      const estilo = estilosDaFamilia[familiaDoTipo({ unidade })];
      expect(estilo.fundo).toMatch(/^bg-acao-/);
      expect(estilo.tinta).toMatch(/^text-acao-/);
    }
  });
});
