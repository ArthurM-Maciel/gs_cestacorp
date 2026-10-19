import type {
  ExtratoDaEquipe,
  Gincana,
  LinhaDoExtrato,
  LinhaDoRanking,
  PeriodoDoRankingQuery,
  Ranking,
  Unidade,
} from '@gincana/contracts';
import type { InternalAxiosRequestConfig } from 'axios';

import type { Simulacao } from './simulacao-da-api.js';
import { novoId } from './simulacao-do-cadastro.js';

/**
 * Dados e rotas de mentira para as telas do placar. Nomes fictícios: nenhum dado de
 * colaborador real entra em teste.
 */

/** O que a API soma de uma equipe, antes de numerar as posições. */
export interface TotalDaEquipe {
  equipeId: string;
  nome: string;
  lider: { id: string; nome: string } | null;
  pontos: number;
  acoesAprovadas: number;
  totalColaboradores: number;
}

/**
 * O nome já vem completo, como no banco: as equipes da Cestacorp se chamam
 * "Equipe Araucária", não "Araucária". Passar só "Ipê" aqui mascarava um defeito —
 * a tela prefixava "Equipe" e, com os dados reais, exibia "Equipe Equipe Araucária".
 */
export function umTotalDeEquipe(
  nomeCurtoOuCompleto: string,
  pontos: number,
  sobrepor: Partial<TotalDaEquipe> = {},
): TotalDaEquipe {
  const nome = nomeCurtoOuCompleto.startsWith('Equipe ')
    ? nomeCurtoOuCompleto
    : `Equipe ${nomeCurtoOuCompleto}`;

  return {
    equipeId: novoId(),
    nome,
    lider: { id: novoId(), nome: `Líder da ${nome}` },
    pontos,
    acoesAprovadas: pontos === 0 ? 0 : Math.max(1, Math.round(pontos / 50)),
    totalColaboradores: 2,
    ...sobrepor,
  };
}

/**
 * Numera como a API: do maior para o menor, contagem olímpica no empate (1, 2, 2, 4) e
 * ordem alfabética dentro dele. É um duplo do `classificarEquipes` da API (que vive em
 * `apps/api` e não é importável aqui), então o teste do empate confere esta função contra
 * os valores do contrato antes de confiar nela.
 */
export function classificar(totais: readonly TotalDaEquipe[]): LinhaDoRanking[] {
  const ordenadas = totais.toSorted(
    (a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, 'pt-BR'),
  );

  return ordenadas.map((total) => ({
    // Quem empata fica na posição do primeiro da faixa: 1, 2, 2, 4.
    posicao: ordenadas.findIndex((outra) => outra.pontos === total.pontos) + 1,
    empatada: ordenadas.filter((outra) => outra.pontos === total.pontos).length > 1,
    equipeId: total.equipeId,
    equipe: { id: total.equipeId, nome: total.nome },
    lider: total.lider,
    pontos: total.pontos,
    acoesAprovadas: total.acoesAprovadas,
    totalColaboradores: total.totalColaboradores,
  }));
}

/** Uma linha do extrato: o que a equipe fez de um tipo de ação. */
export function umaLinhaDoExtrato(
  nome: string,
  unidade: Unidade,
  quantidade: number,
  acoesAprovadas: number,
  pontos: number,
): LinhaDoExtrato {
  const id = novoId();
  return {
    tipoAcaoId: id,
    tipoAcao: { id, nome, unidade },
    quantidade,
    acoesAprovadas,
    pontos,
  };
}

/** A hora em que o placar "foi apurado": 12/11/2026, 10:15, na hora do aparelho. */
export const APURADO_EM = new Date(2026, 10, 12, 10, 15).toISOString();

export function umRanking(
  gincana: Gincana,
  linhas: LinhaDoRanking[],
  periodo: PeriodoDoRankingQuery = {},
): Ranking {
  return {
    gincanaId: gincana.id,
    gincana: { id: gincana.id, nome: gincana.nome, ano: gincana.ano },
    desde: periodo.desde ?? null,
    ate: periodo.ate ?? null,
    apuradoEm: APURADO_EM,
    linhas,
  };
}

/** `desde` e `ate` que a tela mandou na consulta. */
export function periodoDa(requisicao: InternalAxiosRequestConfig): PeriodoDoRankingQuery {
  return (requisicao.params ?? {}) as PeriodoDoRankingQuery;
}

/**
 * As rotas do placar e do extrato de cada equipe. `totaisDo` responde pelo período pedido,
 * então um teste faz "Esta semana" devolver outro placar que o "Geral". Cada consulta
 * recebida fica em `chamadas` (placar) e `chamadasDoExtrato`, para o teste conferir o que a
 * tela mandou à API.
 */
export function rotasDoPlacar(
  gincana: Gincana,
  totaisDo: (periodo: PeriodoDoRankingQuery) => TotalDaEquipe[],
  extratos: Record<string, LinhaDoExtrato[]> = {},
) {
  const chamadas: PeriodoDoRankingQuery[] = [];
  const chamadasDoExtrato: PeriodoDoRankingQuery[] = [];

  const rotas: Record<string, Simulacao> = {
    [`GET /gincanas/${gincana.id}/ranking`]: (requisicao) => {
      const periodo = periodoDa(requisicao);
      chamadas.push(periodo);
      return { status: 200, dados: umRanking(gincana, classificar(totaisDo(periodo)), periodo) };
    },
  };

  for (const total of totaisDo({})) {
    rotas[`GET /gincanas/${gincana.id}/ranking/equipes/${total.equipeId}`] = (requisicao) => {
      const periodo = periodoDa(requisicao);
      chamadasDoExtrato.push(periodo);
      const linha = classificar(totaisDo(periodo)).find(
        (candidata) => candidata.equipeId === total.equipeId,
      );
      if (linha === undefined) {
        return { status: 404 };
      }
      const extrato: ExtratoDaEquipe = {
        gincanaId: gincana.id,
        desde: periodo.desde ?? null,
        ate: periodo.ate ?? null,
        apuradoEm: APURADO_EM,
        equipe: linha.equipe,
        lider: linha.lider,
        posicao: linha.posicao,
        empatada: linha.empatada,
        pontos: linha.pontos,
        acoesAprovadas: linha.acoesAprovadas,
        totalColaboradores: linha.totalColaboradores,
        linhas: extratos[total.equipeId] ?? [],
      };
      return { status: 200, dados: extrato };
    };
  }

  return { rotas, chamadas, chamadasDoExtrato };
}
