import type { LinhaDoRanking } from '@gincana/contracts';

import { formatarPontos } from '../../lib/formatar-numero.js';

const porExtenso = [
  'primeiro',
  'segundo',
  'terceiro',
  'quarto',
  'quinto',
  'sexto',
  'sétimo',
  'oitavo',
  'nono',
  'décimo',
] as const;

/** `2` → `segundo`; além do décimo, `11º`, que é como a pessoa lê. */
export function posicaoPorExtenso(posicao: number): string {
  return porExtenso[posicao - 1] ?? `${String(posicao)}º`;
}

/**
 * A posição como as telas a escrevem para quem lê em voz alta: `2º lugar` e, quando a API
 * marcou o empate, `2º lugar (empate)`. A posição é a que a API devolveu (1, 2, 2, 4):
 * duas equipes empatadas em segundo são as duas "2º lugar", nunca "2º" e "3º".
 */
export function rotuloDaPosicao(linha: Pick<LinhaDoRanking, 'posicao' | 'empatada'>): string {
  return `${String(linha.posicao)}º lugar${linha.empatada ? ' (empate)' : ''}`;
}

/** Nomes em lista: `Ipê`, `Ipê e Pitanga`, `Ipê, Pitanga e Figueira`. */
function listar(nomes: readonly string[]): string {
  return new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(nomes);
}

export interface PosicaoDaEquipe {
  linha: LinhaDoRanking;
  /**
   * As equipes imediatamente à frente: a que está logo acima no placar ou, se várias
   * estão empatadas ali, todas elas. Vazio quando a equipe já é a primeira.
   */
  aFrente: LinhaDoRanking[];
  /** Pontos que faltam para alcançar a equipe da frente. Zero quando não há ninguém à frente. */
  distancia: number;
  /** As outras equipes na mesma posição. */
  empatadasCom: LinhaDoRanking[];
}

/** Acha a equipe no placar e a distância dela para quem está logo à frente. */
export function posicaoDaEquipe(
  linhas: readonly LinhaDoRanking[],
  equipeId: string,
): PosicaoDaEquipe | null {
  const linha = linhas.find((candidata) => candidata.equipeId === equipeId);
  if (linha === undefined) {
    return null;
  }

  const melhores = linhas.filter((candidata) => candidata.posicao < linha.posicao);
  const posicaoDaFrente = Math.max(...melhores.map((candidata) => candidata.posicao));
  const aFrente = melhores.filter((candidata) => candidata.posicao === posicaoDaFrente);
  const primeiraDaFrente = aFrente[0];

  return {
    linha,
    aFrente,
    // Distância negativa não existe: a equipe da frente tem sempre mais pontos que ela.
    distancia: primeiraDaFrente === undefined ? 0 : primeiraDaFrente.pontos - linha.pontos,
    empatadasCom: linhas.filter(
      (candidata) => candidata.posicao === linha.posicao && candidata.equipeId !== equipeId,
    ),
  };
}

/** A frase grande do cartão: "Sua equipe está em segundo lugar!". */
export function tituloDaPosicao({ linha }: PosicaoDaEquipe): string {
  // Zero ponto empatado em primeiro é verdade, mas não é uma boa notícia para dar.
  if (linha.pontos === 0) {
    return 'Sua equipe ainda não pontuou';
  }
  return `Sua equipe está em ${posicaoPorExtenso(linha.posicao)} lugar!`;
}

/** "370 pts atrás da Equipe Ipê", ou o que dizer quando não há ninguém à frente. */
export function fraseDaDistancia(posicao: PosicaoDaEquipe): string {
  const { aFrente, distancia, linha } = posicao;

  if (aFrente.length === 0) {
    return linha.pontos === 0
      ? 'Nenhuma equipe pontuou ainda.'
      : 'Sua equipe está na frente do placar.';
  }

  const nomes = aFrente.map((equipe) => equipe.equipe.nome);
  // O nome já vem completo da API ("Equipe Araucária"); prefixar de novo duplicaria
  // a palavra, e no plural "das equipes Equipe A e Equipe B" fica impronunciável.
  const quem = nomes.length === 1 ? `da ${nomes.join('')}` : `de ${listar(nomes)}`;
  return `${formatarPontos(distancia)} atrás ${quem}`;
}

/** "Empatada com a Equipe Jacarandá.", ou `null` quando ninguém está na mesma posição. */
export function fraseDoEmpate({ empatadasCom }: PosicaoDaEquipe): string | null {
  if (empatadasCom.length === 0) {
    return null;
  }
  const nomes = empatadasCom.map((equipe) => equipe.equipe.nome);
  return nomes.length === 1
    ? `Empatada com a ${nomes.join('')}.`
    : `Empatada com as equipes ${listar(nomes)}.`;
}
