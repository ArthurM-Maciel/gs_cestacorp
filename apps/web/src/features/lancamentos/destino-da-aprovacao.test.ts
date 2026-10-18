import { describe, expect, it } from 'vitest';

import { umaEquipe } from '../../simulacao-do-cadastro.js';
import { usuarioDeTeste } from '../../simulacao-da-api.js';
import { descreverDestinoDaAprovacao } from './destino-da-aprovacao.js';

const equipe = umaEquipe('00000000-0000-4000-8000-0000000000f1', 'Araucária', {
  lider: { id: '00000000-0000-4000-8000-0000000000f2', nome: 'Bruno Exemplo' },
});

describe('descreverDestinoDaAprovacao', () => {
  it('diz o nome do líder da equipe', () => {
    expect(descreverDestinoDaAprovacao(usuarioDeTeste('COLABORADOR'), equipe)).toBe(
      'Vai para aprovação de Bruno Exemplo, líder da equipe.',
    );
  });

  it('quem lidera a equipe não aprova o que lançou: quem aprova é a administradora', () => {
    expect(descreverDestinoDaAprovacao(usuarioDeTeste('LIDER'), equipe)).toMatch(/administradora/);
  });

  it('equipe sem líder também cai na administradora', () => {
    expect(
      descreverDestinoDaAprovacao(usuarioDeTeste('COLABORADOR'), { ...equipe, lider: null }),
    ).toMatch(/ainda não tem líder.*administradora/);
  });

  it('sem saber a equipe, usa um texto que continua verdadeiro', () => {
    expect(descreverDestinoDaAprovacao(usuarioDeTeste('COLABORADOR'), null)).toBe(
      'Vai para aprovação do líder da sua equipe.',
    );
  });
});
