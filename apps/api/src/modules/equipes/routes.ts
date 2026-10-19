import type { AtualizarEquipe, CriarEquipe, Equipe, VincularMembros } from '@gincana/contracts';
import {
  atualizarEquipeSchema,
  criarEquipeSchema,
  idSchema,
  vincularMembrosSchema,
} from '@gincana/contracts';
import { Router } from 'express';
import { z } from 'zod';

import { autenticacao, exigePapel, usuarioDaRequisicao } from '../../middlewares/auth.js';
import { parametrosValidados, validar } from '../../middlewares/validar.js';

import {
  atualizarEquipe,
  criarEquipe,
  listarEquipes,
  removerMembro,
  vincularMembros,
} from './service.js';

export const equipesRouter: Router = Router();

const parametroGincana = z.object({ gincanaId: idSchema });
const parametroId = z.object({ id: idSchema });
const parametroMembro = z.object({ id: idSchema, colaboradorId: idSchema });

/** US03 — cadastrar equipes da gincana. */
equipesRouter.post<{ gincanaId: string }, Equipe, CriarEquipe>(
  '/gincanas/:gincanaId/equipes',
  autenticacao,
  exigePapel('ADMIN'),
  validar({ params: parametroGincana, body: criarEquipeSchema }),
  async (req, res) => {
    const { gincanaId } = parametrosValidados(req, parametroGincana);
    const autor = usuarioDaRequisicao(req);
    res.status(201).json(await criarEquipe(gincanaId, req.body, autor.id));
  },
);

/** Todo perfil autenticado enxerga as equipes: é a base do placar. */
equipesRouter.get(
  '/gincanas/:gincanaId/equipes',
  autenticacao,
  validar({ params: parametroGincana }),
  async (req, res) => {
    const { gincanaId } = parametrosValidados(req, parametroGincana);
    res.status(200).json(await listarEquipes(gincanaId));
  },
);

equipesRouter.patch<{ id: string }, Equipe, AtualizarEquipe>(
  '/equipes/:id',
  autenticacao,
  exigePapel('ADMIN'),
  validar({ params: parametroId, body: atualizarEquipeSchema }),
  async (req, res) => {
    const { id } = parametrosValidados(req, parametroId);
    const autor = usuarioDaRequisicao(req);
    res.status(200).json(await atualizarEquipe(id, req.body, autor.id));
  },
);

equipesRouter.post<{ id: string }, Equipe, VincularMembros>(
  '/equipes/:id/membros',
  autenticacao,
  exigePapel('ADMIN'),
  validar({ params: parametroId, body: vincularMembrosSchema }),
  async (req, res) => {
    const { id } = parametrosValidados(req, parametroId);
    const autor = usuarioDaRequisicao(req);
    res.status(200).json(await vincularMembros(id, req.body.colaboradorIds, autor.id));
  },
);

equipesRouter.delete(
  '/equipes/:id/membros/:colaboradorId',
  autenticacao,
  exigePapel('ADMIN'),
  validar({ params: parametroMembro }),
  async (req, res) => {
    const { id, colaboradorId } = parametrosValidados(req, parametroMembro);
    const autor = usuarioDaRequisicao(req);
    await removerMembro(id, colaboradorId, autor.id);
    res.status(204).send();
  },
);
