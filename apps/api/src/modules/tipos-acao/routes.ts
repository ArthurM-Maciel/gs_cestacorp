import type {
  AtualizarTipoAcao,
  CriarTipoAcao,
  ListarTiposAcaoQuery,
  NovaRegra,
  RegraPontuacao,
  TipoAcao,
  TipoAcaoComHistorico,
} from '@gincana/contracts';
import {
  atualizarTipoAcaoSchema,
  criarTipoAcaoSchema,
  idSchema,
  listarTiposAcaoQuerySchema,
  novaRegraSchema,
} from '@gincana/contracts';
import { Router } from 'express';
import { z } from 'zod';

import { autenticacao, exigePapel, usuarioDaRequisicao } from '../../middlewares/auth.js';
import { consultaValidada, parametrosValidados, validar } from '../../middlewares/validar.js';

import {
  atualizarTipoAcao,
  buscarTipoAcao,
  criarTipoAcao,
  listarRegras,
  listarTiposAcao,
  registrarNovaRegra,
} from './service.js';

export const tiposAcaoRouter: Router = Router();

const parametroGincana = z.object({ gincanaId: idSchema });
const parametroId = z.object({ id: idSchema });

/** US04 — cadastrar tipo de ação com a sua primeira regra de pontuação. */
tiposAcaoRouter.post<{ gincanaId: string }, TipoAcaoComHistorico, CriarTipoAcao>(
  '/gincanas/:gincanaId/tipos-acao',
  autenticacao,
  exigePapel('ADMIN'),
  validar({ params: parametroGincana, body: criarTipoAcaoSchema }),
  async (req, res) => {
    const { gincanaId } = parametrosValidados(req, parametroGincana);
    const autor = usuarioDaRequisicao(req);
    res.status(201).json(await criarTipoAcao(gincanaId, req.body, autor.id));
  },
);

/**
 * Todo perfil autenticado lista os tipos: é o catálogo do formulário de registrar ação.
 * Quem não é administradora só enxerga os ativos — a decisão mora na `policy.ts`.
 */
tiposAcaoRouter.get<{ gincanaId: string }, TipoAcao[]>(
  '/gincanas/:gincanaId/tipos-acao',
  autenticacao,
  validar({ params: parametroGincana, query: listarTiposAcaoQuerySchema }),
  async (req, res) => {
    const { gincanaId } = parametrosValidados(req, parametroGincana);
    const filtros: ListarTiposAcaoQuery = consultaValidada(req, listarTiposAcaoQuerySchema);
    res.status(200).json(await listarTiposAcao(usuarioDaRequisicao(req), gincanaId, filtros));
  },
);

tiposAcaoRouter.get<{ id: string }, TipoAcaoComHistorico>(
  '/tipos-acao/:id',
  autenticacao,
  validar({ params: parametroId }),
  async (req, res) => {
    const { id } = parametrosValidados(req, parametroId);
    res.status(200).json(await buscarTipoAcao(usuarioDaRequisicao(req), id));
  },
);

/** Muda a identidade do tipo de ação. A pontuação tem rota própria, logo abaixo. */
tiposAcaoRouter.patch<{ id: string }, TipoAcaoComHistorico, AtualizarTipoAcao>(
  '/tipos-acao/:id',
  autenticacao,
  exigePapel('ADMIN'),
  validar({ params: parametroId, body: atualizarTipoAcaoSchema }),
  async (req, res) => {
    const { id } = parametrosValidados(req, parametroId);
    const autor = usuarioDaRequisicao(req);
    res.status(200).json(await atualizarTipoAcao(id, req.body, autor.id));
  },
);

/** A troca de pontuação: fecha a vigência atual e abre a nova, com auditoria. */
tiposAcaoRouter.post<{ id: string }, TipoAcaoComHistorico, NovaRegra>(
  '/tipos-acao/:id/regras',
  autenticacao,
  exigePapel('ADMIN'),
  validar({ params: parametroId, body: novaRegraSchema }),
  async (req, res) => {
    const { id } = parametrosValidados(req, parametroId);
    const autor = usuarioDaRequisicao(req);
    res.status(201).json(await registrarNovaRegra(id, req.body, autor.id));
  },
);

/** Histórico de vigências: a administradora audita, o líder confere o que avaliou. */
tiposAcaoRouter.get<{ id: string }, RegraPontuacao[]>(
  '/tipos-acao/:id/regras',
  autenticacao,
  exigePapel('ADMIN', 'LIDER'),
  validar({ params: parametroId }),
  async (req, res) => {
    const { id } = parametrosValidados(req, parametroId);
    res.status(200).json(await listarRegras(id));
  },
);
