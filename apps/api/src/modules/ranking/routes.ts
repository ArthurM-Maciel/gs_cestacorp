import type { ExtratoDaEquipe, PeriodoDoRankingQuery, Ranking } from '@gincana/contracts';
import { idSchema, periodoDoRankingQuerySchema } from '@gincana/contracts';
import { Router } from 'express';
import { z } from 'zod';

import { autenticacao } from '../../middlewares/auth.js';
import { consultaValidada, parametrosValidados, validar } from '../../middlewares/validar.js';

import { montarExtratoDaEquipe, montarRanking } from './service.js';

export const rankingRouter: Router = Router();

const parametroGincana = z.object({ gincanaId: idSchema });
const parametroEquipe = z.object({ gincanaId: idSchema, equipeId: idSchema });

/**
 * US11 — o placar por equipe.
 *
 * Só `autenticacao`, sem `exigePapel`: o placar é da gincana inteira e o protótipo o
 * mostra a todos os perfis. Não há dado de outra pessoa aqui — são totais por equipe.
 */
rankingRouter.get<{ gincanaId: string }, Ranking>(
  '/gincanas/:gincanaId/ranking',
  autenticacao,
  validar({ params: parametroGincana, query: periodoDoRankingQuerySchema }),
  async (req, res) => {
    const { gincanaId } = parametrosValidados(req, parametroGincana);
    const periodo: PeriodoDoRankingQuery = consultaValidada(req, periodoDoRankingQuerySchema);
    res.status(200).json(await montarRanking(gincanaId, periodo));
  },
);

/** US11 — o extrato por tipo de ação, para a tela de detalhe da equipe. */
rankingRouter.get<{ gincanaId: string; equipeId: string }, ExtratoDaEquipe>(
  '/gincanas/:gincanaId/ranking/equipes/:equipeId',
  autenticacao,
  validar({ params: parametroEquipe, query: periodoDoRankingQuerySchema }),
  async (req, res) => {
    const { gincanaId, equipeId } = parametrosValidados(req, parametroEquipe);
    const periodo: PeriodoDoRankingQuery = consultaValidada(req, periodoDoRankingQuerySchema);
    res.status(200).json(await montarExtratoDaEquipe(gincanaId, equipeId, periodo));
  },
);
