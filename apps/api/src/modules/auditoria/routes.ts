import type { LinhaDoTempo, ListarAuditoriaQuery, PaginaDeAuditoria } from '@gincana/contracts';
import { idSchema, listarAuditoriaQuerySchema } from '@gincana/contracts';
import { Router } from 'express';
import { z } from 'zod';

import { autenticacao, exigePapel, usuarioDaRequisicao } from '../../middlewares/auth.js';
import { consultaValidada, parametrosValidados, validar } from '../../middlewares/validar.js';

import { linhaDoTempoDoLancamento, listarAuditoria } from './service.js';

export const auditoriaRouter: Router = Router();

const parametroId = z.object({ id: idSchema });

/**
 * US09 — a linha do tempo de um lançamento.
 *
 * Sem `exigePapel`: o escopo aqui não é de papel, é de alcance ao lançamento — dono,
 * líder da equipe dele e administradora. Quem decide isso é a policy dos lançamentos,
 * dentro do serviço.
 */
auditoriaRouter.get<{ id: string }, LinhaDoTempo>(
  '/lancamentos/:id/auditoria',
  autenticacao,
  validar({ params: parametroId }),
  async (req, res) => {
    const { id } = parametrosValidados(req, parametroId);
    res.status(200).json(await linhaDoTempoDoLancamento(usuarioDaRequisicao(req), id));
  },
);

/** US09 — o painel de evidência do PQCRS. Só a administradora consulta a trilha inteira. */
auditoriaRouter.get<Record<string, never>, PaginaDeAuditoria>(
  '/auditoria',
  autenticacao,
  exigePapel('ADMIN'),
  validar({ query: listarAuditoriaQuerySchema }),
  async (req, res) => {
    const filtros: ListarAuditoriaQuery = consultaValidada(req, listarAuditoriaQuerySchema);
    res.status(200).json(await listarAuditoria(filtros));
  },
);
