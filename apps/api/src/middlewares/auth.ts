import type { Papel, UsuarioAutenticado } from '@gincana/contracts';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { carregarUsuarioAutenticado } from '../modules/auth/service.js';
import { verificarToken } from '../modules/auth/token.js';

import { naoAutenticado, semPermissao } from './erros.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Preenchido pelo middleware `autenticacao`. Antes dele, é sempre `undefined`. */
    usuario?: UsuarioAutenticado;
  }
}

/** Extrai o token de `Authorization: Bearer <token>`. */
function lerToken(req: Request): string | null {
  const cabecalho = req.header('authorization');
  if (!cabecalho) {
    return null;
  }

  const [esquema, valor, ...sobra] = cabecalho.trim().split(/\s+/);
  if (sobra.length > 0 || esquema?.toLowerCase() !== 'bearer' || !valor) {
    return null;
  }

  return valor;
}

/**
 * Exige um token válido e recarrega o colaborador do banco.
 *
 * O conteúdo do token nunca é a última palavra: papel e equipe mudam durante a gincana e
 * um token emitido antes da mudança continua com assinatura válida.
 */
export const autenticacao: RequestHandler = (
  req: Request,
  _res: Response,
  proximo: NextFunction,
): void => {
  const token = lerToken(req);
  if (!token) {
    proximo(naoAutenticado());
    return;
  }

  const conteudo = verificarToken(token);
  if (!conteudo) {
    proximo(naoAutenticado('Sua sessão expirou. Entre novamente.'));
    return;
  }

  carregarUsuarioAutenticado(conteudo.sub)
    .then((usuario) => {
      req.usuario = usuario;
      proximo();
    })
    .catch(proximo);
};

/**
 * Papel grosso, no middleware. A regra fina — líder avalia só a própria equipe — mora na
 * `policy.ts` de cada módulo, onde dá para testar sem HTTP.
 */
export function exigePapel(...papeis: readonly Papel[]): RequestHandler {
  return (req: Request, _res: Response, proximo: NextFunction): void => {
    if (!req.usuario) {
      proximo(naoAutenticado());
      return;
    }

    if (!papeis.includes(req.usuario.papel)) {
      proximo(semPermissao());
      return;
    }

    proximo();
  };
}

/**
 * Lê o usuário já autenticado. Existe para as rotas não precisarem de `!` nem de
 * conversão de tipo depois do middleware.
 */
export function usuarioDaRequisicao(req: Request): UsuarioAutenticado {
  if (!req.usuario) {
    throw naoAutenticado();
  }

  return req.usuario;
}
