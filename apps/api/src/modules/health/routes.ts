import { Router } from 'express';

export const healthRouter: Router = Router();

/**
 * Usado pelo monitoramento e para acordar a API em homologação antes de uma demonstração:
 * o plano gratuito hiberna por inatividade.
 */
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', emFuncionamento: true, instante: new Date().toISOString() });
});
