import { describe, expect, it } from 'vitest';

import { classificar, umTotalDeEquipe } from '../../simulacao-do-placar.js';
import {
  fraseDaDistancia,
  fraseDoEmpate,
  posicaoDaEquipe,
  posicaoPorExtenso,
  rotuloDaPosicao,
  tituloDaPosicao,
} from './posicao-da-equipe.js';

const ipe = umTotalDeEquipe('Ipê', 4280);
const araucaria = umTotalDeEquipe('Araucária', 3910);
const jacaranda = umTotalDeEquipe('Jacarandá', 3355);
const paineira = umTotalDeEquipe('Paineira', 3120);

function posicaoDe(equipe: { equipeId: string }, ...todas: ReturnType<typeof umTotalDeEquipe>[]) {
  const posicao = posicaoDaEquipe(classificar(todas), equipe.equipeId);
  if (posicao === null) {
    throw new Error('A equipe do teste não está no placar.');
  }
  return posicao;
}

describe('posicaoDaEquipe', () => {
  it('mede a distância até a equipe logo à frente, não até a líder', () => {
    const posicao = posicaoDe(paineira, ipe, araucaria, jacaranda, paineira);

    expect(posicao.linha.posicao).toBe(4);
    expect(posicao.aFrente.map((equipe) => equipe.equipe.nome)).toEqual(['Jacarandá']);
    expect(posicao.distancia).toBe(235);
  });

  it('a primeira equipe não tem ninguém à frente e a distância é zero, nunca negativa', () => {
    const posicao = posicaoDe(ipe, ipe, araucaria, jacaranda);

    expect(posicao.aFrente).toEqual([]);
    expect(posicao.distancia).toBe(0);
  });

  it('com várias equipes empatadas logo à frente, devolve todas elas', () => {
    const figueira = umTotalDeEquipe('Figueira', 3355);
    const posicao = posicaoDe(paineira, ipe, jacaranda, figueira, paineira);

    expect(posicao.linha.posicao).toBe(4);
    expect(posicao.aFrente.map((equipe) => equipe.equipe.nome)).toEqual(['Figueira', 'Jacarandá']);
    expect(posicao.distancia).toBe(235);
  });

  it('lista as equipes que dividem a mesma posição', () => {
    const gemea = umTotalDeEquipe('Gêmea', 3910);
    const posicao = posicaoDe(araucaria, ipe, araucaria, gemea);

    expect(posicao.linha).toMatchObject({ posicao: 2, empatada: true });
    expect(posicao.empatadasCom.map((equipe) => equipe.equipe.nome)).toEqual(['Gêmea']);
    // A distância é para quem está acima do empate, a líder.
    expect(posicao.distancia).toBe(370);
  });

  it('devolve nulo quando a equipe não está no placar', () => {
    expect(posicaoDaEquipe(classificar([ipe]), araucaria.equipeId)).toBeNull();
  });
});

describe('frases do cartão de posição', () => {
  it('diz "Sua equipe está em segundo lugar!" e "370 pts atrás da Equipe Ipê"', () => {
    const posicao = posicaoDe(araucaria, ipe, araucaria, jacaranda);

    expect(tituloDaPosicao(posicao)).toBe('Sua equipe está em segundo lugar!');
    expect(fraseDaDistancia(posicao)).toBe('370 pts atrás da Equipe Ipê');
    expect(fraseDoEmpate(posicao)).toBeNull();
  });

  it('a líder diz que está na frente, sem calcular distância', () => {
    const posicao = posicaoDe(ipe, ipe, araucaria);

    expect(tituloDaPosicao(posicao)).toBe('Sua equipe está em primeiro lugar!');
    expect(fraseDaDistancia(posicao)).toBe('Sua equipe está na frente do placar.');
  });

  it('nomeia todas as equipes à frente quando elas estão empatadas', () => {
    const figueira = umTotalDeEquipe('Figueira', 3355);
    const posicao = posicaoDe(paineira, ipe, jacaranda, figueira, paineira);

    expect(fraseDaDistancia(posicao)).toBe('235 pts atrás das equipes Figueira e Jacarandá');
  });

  it('avisa o empate pelo nome da outra equipe', () => {
    const gemea = umTotalDeEquipe('Gêmea', 3910);
    const posicao = posicaoDe(araucaria, ipe, araucaria, gemea);

    expect(tituloDaPosicao(posicao)).toBe('Sua equipe está em segundo lugar!');
    expect(fraseDoEmpate(posicao)).toBe('Empatada com a Equipe Gêmea.');
  });

  it('equipe sem pontos não comemora um "primeiro lugar" que só existe porque ninguém pontuou', () => {
    const zerada = umTotalDeEquipe('Zerada', 0);
    const outra = umTotalDeEquipe('Outra', 0);
    const posicao = posicaoDe(zerada, zerada, outra);

    expect(tituloDaPosicao(posicao)).toBe('Sua equipe ainda não pontuou');
    expect(fraseDaDistancia(posicao)).toBe('Nenhuma equipe pontuou ainda.');
  });

  it('equipe sem pontos, com outra à frente, diz quanto falta', () => {
    const zerada = umTotalDeEquipe('Zerada', 0);
    const posicao = posicaoDe(zerada, ipe, zerada);

    expect(tituloDaPosicao(posicao)).toBe('Sua equipe ainda não pontuou');
    expect(fraseDaDistancia(posicao)).toBe('4.280 pts atrás da Equipe Ipê');
  });
});

describe('posição por extenso', () => {
  it('escreve de primeiro a décimo e, depois, o número', () => {
    expect(posicaoPorExtenso(1)).toBe('primeiro');
    expect(posicaoPorExtenso(6)).toBe('sexto');
    expect(posicaoPorExtenso(10)).toBe('décimo');
    expect(posicaoPorExtenso(11)).toBe('11º');
  });

  it('marca o empate no rótulo lido em voz alta, com a posição que a API deu', () => {
    expect(rotuloDaPosicao({ posicao: 2, empatada: false })).toBe('2º lugar');
    expect(rotuloDaPosicao({ posicao: 2, empatada: true })).toBe('2º lugar (empate)');
  });
});

describe('classificar (o duplo da API nos testes)', () => {
  it('numera como o contrato: 1, 2, 2, 4, com o empate marcado nas duas equipes', () => {
    const linhas = classificar([
      umTotalDeEquipe('Ipê', 4280),
      umTotalDeEquipe('Jacarandá', 3910),
      umTotalDeEquipe('Araucária', 3910),
      umTotalDeEquipe('Paineira', 3120),
    ]);

    expect(linhas.map((linha) => [linha.equipe.nome, linha.posicao, linha.empatada])).toEqual([
      ['Ipê', 1, false],
      ['Araucária', 2, true],
      ['Jacarandá', 2, true],
      ['Paineira', 4, false],
    ]);
  });
});
