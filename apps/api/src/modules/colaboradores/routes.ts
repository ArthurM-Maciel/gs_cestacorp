import type {
  AtualizarColaborador,
  Colaborador,
  CriarColaborador,
  ListarColaboradoresQuery,
} from '@gincana/contracts';
import {
  atualizarColaboradorSchema,
  criarColaboradorSchema,
  idSchema,
  listarColaboradoresQuerySchema,
} from '@gincana/contracts';
import { Router } from 'express';
import { z } from 'zod';

import { autenticacao, exigePapel, usuarioDaRequisicao } from '../../middlewares/auth.js';
import { consultaValidada, parametrosValidados, validar } from '../../middlewares/validar.js';

import { atualizarColaborador, criarColaborador, listarColaboradores } from './service.js';

export const colaboradoresRouter: Router = Router();

const parametroId = z.object({ id: idSchema });

/** US03 — a administradora cadastra os colaboradores que vão para as equipes. */
colaboradoresRouter.post<Record<string, string>, Colaborador, CriarColaborador>(
  '/colaboradores',
  autenticacao,
  exigePapel('ADMIN'),
  validar({ body: criarColaboradorSchema }),
  async (req, res) => {
    res.status(201).json(await criarColaborador(req.body));
  },
);

colaboradoresRouter.get<Record<string, string>, Colaborador[]>(
  '/colaboradores',
  autenticacao,
  exigePapel('ADMIN'),
  validar({ query: listarColaboradoresQuerySchema }),
  async (req, res) => {
    const filtros: ListarColaboradoresQuery = consultaValidada(req, listarColaboradoresQuerySchema);
    res.status(200).json(await listarColaboradores(usuarioDaRequisicao(req), filtros));
  },
);

colaboradoresRouter.patch<{ id: string }, Colaborador, AtualizarColaborador>(
  '/colaboradores/:id',
  autenticacao,
  exigePapel('ADMIN'),
  validar({ params: parametroId, body: atualizarColaboradorSchema }),
  async (req, res) => {
    const { id } = parametrosValidados(req, parametroId);
    const autor = usuarioDaRequisicao(req);
    res.status(200).json(await atualizarColaborador(id, req.body, autor.id));
  },
);
