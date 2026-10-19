import {
  extratoDaEquipeSchema,
  rankingSchema,
  type ExtratoDaEquipe,
  type PeriodoDoRankingQuery,
  type Ranking,
} from '@gincana/contracts';
import { useQuery } from '@tanstack/react-query';

import { api } from '../../lib/api.js';
import { chaveDoRanking } from '../../lib/chaves-de-consulta.js';

async function buscarRanking(gincanaId: string, periodo: PeriodoDoRankingQuery): Promise<Ranking> {
  const { data } = await api.get<unknown>(`/gincanas/${gincanaId}/ranking`, { params: periodo });
  return rankingSchema.parse(data);
}

async function buscarExtrato(
  gincanaId: string,
  equipeId: string,
  periodo: PeriodoDoRankingQuery,
): Promise<ExtratoDaEquipe> {
  const { data } = await api.get<unknown>(`/gincanas/${gincanaId}/ranking/equipes/${equipeId}`, {
    params: periodo,
  });
  return extratoDaEquipeSchema.parse(data);
}

/**
 * O placar da gincana, no período pedido. Qualquer perfil autenticado o consulta: são totais
 * por equipe, sem dado de outra pessoa.
 *
 * A chave leva as duas datas, então "Geral" e "Esta semana" são consultas diferentes: trocar
 * o filtro refaz a chamada em vez de reaproveitar o que a outra opção guardou. Volta a
 * consultar ao reabrir a aba, porque o placar fica aberto enquanto os líderes aprovam.
 */
export function useRanking(gincanaId: string | null, periodo: PeriodoDoRankingQuery) {
  return useQuery({
    queryKey: [...chaveDoRanking, gincanaId, periodo.desde ?? null, periodo.ate ?? null],
    queryFn: () => buscarRanking(gincanaId ?? '', periodo),
    enabled: gincanaId !== null,
    refetchOnWindowFocus: true,
  });
}

/** A pontuação de uma equipe aberta por tipo de ação. Só roda com o extrato aberto. */
export function useExtratoDaEquipe(
  gincanaId: string,
  equipeId: string,
  periodo: PeriodoDoRankingQuery,
) {
  return useQuery({
    queryKey: [
      ...chaveDoRanking,
      'extrato',
      gincanaId,
      equipeId,
      periodo.desde ?? null,
      periodo.ate ?? null,
    ],
    queryFn: () => buscarExtrato(gincanaId, equipeId, periodo),
  });
}
