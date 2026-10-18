import type { AtualizarGincana, CriarGincana, Gincana } from '@gincana/contracts';
import { atualizarGincanaSchema, criarGincanaSchema, idSchema } from '@gincana/contracts';
import { Router } from 'express';
import { z } from 'zod';

import { autenticacao, exigePapel } from '../../middlewares/auth.js';
import { parametrosValidados, validar } from '../../middlewares/validar.js';

import { atualizarGincana, buscarGincana, criarGincana, listarGincanas } from './service.js';

export const gincanasRouter: Router = Router();

const parametroId = z.object({ id: idSchema });

/** US02 — cadastrar a gincana do ano. Só a administradora cadastra. */
gincanasRouter.post<Record<string, string>, Gincana, CriarGincana>(
  '/gincanas',
  autenticacao,
  exigePapel('ADMIN'),
  validar({ body: criarGincanaSchema }),
  async (req, res) => {
    res.status(201).json(await criarGincana(req.body));
  },
);

/** Todo mundo precisa saber qual é a gincana vigente para lançar ação e ver placar. */
gincanasRouter.get<Record<string, string>, Gincana[]>(
  '/gincanas',
  autenticacao,
  async (_req, res) => {
    res.status(200).json(await listarGincanas());
  },
);

gincanasRouter.get(
  '/gincanas/:id',
  autenticacao,
  validar({ params: parametroId }),
  async (req, res) => {
    const { id } = parametrosValidados(req, parametroId);
    res.status(200).json(await buscarGincana(id));
  },
);

gincanasRouter.patch<Record<string, string>, Gincana, AtualizarGincana>(
  '/gincanas/:id',
  autenticacao,
  exigePapel('ADMIN'),
  validar({ params: parametroId, body: atualizarGincanaSchema }),
  async (req, res) => {
    const { id } = parametrosValidados(req, parametroId);
    res.status(200).json(await atualizarGincana(id, req.body));
  },
);
