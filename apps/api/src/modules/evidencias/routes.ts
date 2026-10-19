import type {
  AssinaturaDeUpload,
  Lancamento,
  RegistrarEvidencia,
  RespostaDeAssinatura,
} from '@gincana/contracts';
import { assinaturaDeUploadSchema, idSchema, registrarEvidenciaSchema } from '@gincana/contracts';
import { Router } from 'express';
import { z } from 'zod';

import { autenticacao, usuarioDaRequisicao } from '../../middlewares/auth.js';
import { parametrosValidados, validar } from '../../middlewares/validar.js';

import { assinarEnvioDeEvidencia, registrarEvidencia, removerEvidencia } from './service.js';

export const evidenciasRouter: Router = Router();

const parametroLancamento = z.object({ id: idSchema });
const parametroEvidencia = z.object({ id: idSchema, evidenciaId: idSchema });

/**
 * US07 — o que o navegador precisa para enviar o arquivo direto ao armazenamento.
 *
 * O arquivo não passa pela API. O segredo do armazenamento também não sai daqui: o que
 * volta é uma assinatura derivada, válida por poucos minutos e amarrada a um
 * identificador sorteado no servidor.
 */
evidenciasRouter.post<Record<string, never>, RespostaDeAssinatura, AssinaturaDeUpload>(
  '/evidencias/assinatura',
  autenticacao,
  validar({ body: assinaturaDeUploadSchema }),
  (req, res) => {
    res.status(201).json(assinarEnvioDeEvidencia(usuarioDaRequisicao(req), req.body));
  },
);

/**
 * Registra o arquivo que já subiu.
 *
 * Tipo e tamanho são validados aqui de novo, pelo contrato: a validação do navegador é
 * conforto de quem usa, não controle de acesso.
 */
evidenciasRouter.post<{ id: string }, Lancamento, RegistrarEvidencia>(
  '/lancamentos/:id/evidencias',
  autenticacao,
  validar({ params: parametroLancamento, body: registrarEvidenciaSchema }),
  async (req, res) => {
    const { id } = parametrosValidados(req, parametroLancamento);
    res.status(201).json(await registrarEvidencia(usuarioDaRequisicao(req), id, req.body));
  },
);

/** Remover comprovante anexado por engano: só o dono, e só enquanto pendente. */
evidenciasRouter.delete<{ id: string; evidenciaId: string }, Lancamento>(
  '/lancamentos/:id/evidencias/:evidenciaId',
  autenticacao,
  validar({ params: parametroEvidencia }),
  async (req, res) => {
    const { id, evidenciaId } = parametrosValidados(req, parametroEvidencia);
    res.status(200).json(await removerEvidencia(usuarioDaRequisicao(req), id, evidenciaId));
  },
);
