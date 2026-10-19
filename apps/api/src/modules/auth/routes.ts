import type { Login, RespostaLogin, UsuarioAutenticado } from '@gincana/contracts';
import { loginSchema } from '@gincana/contracts';
import { Router } from 'express';

import { autenticacao, usuarioDaRequisicao } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';

import { autenticar } from './service.js';

export const authRouter: Router = Router();

/** US01 — entrar com perfil de colaborador, líder de equipe ou administradora. */
authRouter.post<Record<string, string>, RespostaLogin, Login>(
  '/auth/login',
  validar({ body: loginSchema }),
  async (req, res) => {
    const resposta = await autenticar(req.body);
    res.status(200).json(resposta);
  },
);

/**
 * Usada pelo front para restaurar a sessão ao recarregar a página. O usuário vem do
 * banco, não do token: o middleware já recarregou o registro atual.
 */
authRouter.get<Record<string, string>, UsuarioAutenticado>('/auth/me', autenticacao, (req, res) => {
  res.status(200).json(usuarioDaRequisicao(req));
});
