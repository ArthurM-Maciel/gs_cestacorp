import type {
  AprovarLancamento,
  AtualizarLancamento,
  CriarLancamento,
  FilaDePendentesQuery,
  Lancamento,
  ListarLancamentosQuery,
  PaginaDeLancamentos,
  PreviaDeLancamento,
  RecusarLancamento,
  ResultadoDaPrevia,
} from '@gincana/contracts';
import {
  aprovarLancamentoSchema,
  atualizarLancamentoSchema,
  criarLancamentoSchema,
  filaDePendentesQuerySchema,
  idSchema,
  listarLancamentosQuerySchema,
  previaDeLancamentoSchema,
  recusarLancamentoSchema,
} from '@gincana/contracts';
import { Router } from 'express';
import { z } from 'zod';

import { autenticacao, exigePapel, usuarioDaRequisicao } from '../../middlewares/auth.js';
import { consultaValidada, parametrosValidados, validar } from '../../middlewares/validar.js';

import {
  aprovarLancamento,
  atualizarLancamento,
  buscarLancamento,
  criarLancamento,
  listarLancamentos,
  listarPendentes,
  preverLancamento,
  recusarLancamento,
} from './service.js';

export const lancamentosRouter: Router = Router();

const parametroId = z.object({ id: idSchema });

/**
 * US06 — a prévia de pontos do formulário ("+120 pts").
 *
 * É `POST` por carregar corpo, não por mudar estado: nada é gravado. O cálculo sai do
 * mesmo `@gincana/scoring` que grava o lançamento, para que a tela nunca prometa um
 * número diferente do que vai para o placar.
 */
lancamentosRouter.post<Record<string, never>, ResultadoDaPrevia, PreviaDeLancamento>(
  '/lancamentos/preview',
  autenticacao,
  validar({ body: previaDeLancamentoSchema }),
  async (req, res) => {
    res.status(200).json(await preverLancamento(req.body));
  },
);

/**
 * US08 — a fila do avaliador.
 *
 * Declarada antes de `/lancamentos/:id` de propósito: o Express casa na ordem, e
 * "pendentes" seria lido como identificador se viesse depois.
 */
lancamentosRouter.get<Record<string, never>, PaginaDeLancamentos>(
  '/lancamentos/pendentes',
  autenticacao,
  exigePapel('LIDER', 'ADMIN'),
  validar({ query: filaDePendentesQuerySchema }),
  async (req, res) => {
    const filtros: FilaDePendentesQuery = consultaValidada(req, filaDePendentesQuerySchema);
    res.status(200).json(await listarPendentes(usuarioDaRequisicao(req), filtros));
  },
);

/** US06 — registrar a ação. A administradora pode registrar em nome de outra pessoa. */
lancamentosRouter.post<Record<string, never>, Lancamento, CriarLancamento>(
  '/lancamentos',
  autenticacao,
  validar({ body: criarLancamentoSchema }),
  async (req, res) => {
    res.status(201).json(await criarLancamento(usuarioDaRequisicao(req), req.body));
  },
);

/** A lista, escopada pelo papel dentro do serviço — nunca pelo que vem na consulta. */
lancamentosRouter.get<Record<string, never>, PaginaDeLancamentos>(
  '/lancamentos',
  autenticacao,
  validar({ query: listarLancamentosQuerySchema }),
  async (req, res) => {
    const filtros: ListarLancamentosQuery = consultaValidada(req, listarLancamentosQuerySchema);
    res.status(200).json(await listarLancamentos(usuarioDaRequisicao(req), filtros));
  },
);

lancamentosRouter.get<{ id: string }, Lancamento>(
  '/lancamentos/:id',
  autenticacao,
  validar({ params: parametroId }),
  async (req, res) => {
    const { id } = parametrosValidados(req, parametroId);
    res.status(200).json(await buscarLancamento(usuarioDaRequisicao(req), id));
  },
);

/** US06 — corrigir o lançamento. O status não muda por aqui; ver `atualizarLancamentoSchema`. */
lancamentosRouter.patch<{ id: string }, Lancamento, AtualizarLancamento>(
  '/lancamentos/:id',
  autenticacao,
  validar({ params: parametroId, body: atualizarLancamentoSchema }),
  async (req, res) => {
    const { id } = parametrosValidados(req, parametroId);
    res.status(200).json(await atualizarLancamento(usuarioDaRequisicao(req), id, req.body));
  },
);

/**
 * US08 — aprovar e recusar.
 *
 * O middleware barra o colaborador pelo papel; quem confere se o líder é desta equipe —
 * e se ninguém está avaliando o próprio lançamento — é a `policy.ts`, dentro do serviço.
 */
lancamentosRouter.post<{ id: string }, Lancamento, AprovarLancamento>(
  '/lancamentos/:id/aprovar',
  autenticacao,
  exigePapel('LIDER', 'ADMIN'),
  validar({ params: parametroId, body: aprovarLancamentoSchema }),
  async (req, res) => {
    const { id } = parametrosValidados(req, parametroId);
    res.status(200).json(await aprovarLancamento(usuarioDaRequisicao(req), id, req.body));
  },
);

lancamentosRouter.post<{ id: string }, Lancamento, RecusarLancamento>(
  '/lancamentos/:id/recusar',
  autenticacao,
  exigePapel('LIDER', 'ADMIN'),
  validar({ params: parametroId, body: recusarLancamentoSchema }),
  async (req, res) => {
    const { id } = parametrosValidados(req, parametroId);
    res.status(200).json(await recusarLancamento(usuarioDaRequisicao(req), id, req.body));
  },
);
