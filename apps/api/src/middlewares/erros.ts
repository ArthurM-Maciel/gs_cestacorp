import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { logger } from '../logger.js';

/**
 * Erro previsto de negócio. Tudo que não for disso vira 500 e não vaza detalhe interno
 * para o cliente.
 */
export class ErroDaAplicacao extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly detalhes?: Record<string, string[]>,
  ) {
    super(mensagem);
    this.name = 'ErroDaAplicacao';
  }
}

export const naoAutenticado = (mensagem = 'Faça login para continuar.') =>
  new ErroDaAplicacao(401, 'NAO_AUTENTICADO', mensagem);

export const semPermissao = (mensagem = 'Você não tem permissão para esta ação.') =>
  new ErroDaAplicacao(403, 'SEM_PERMISSAO', mensagem);

export const naoEncontrado = (mensagem = 'Registro não encontrado.') =>
  new ErroDaAplicacao(404, 'NAO_ENCONTRADO', mensagem);

export const conflito = (codigo: string, mensagem: string) =>
  new ErroDaAplicacao(409, codigo, mensagem);

export function rotaNaoEncontrada(_req: Request, res: Response): void {
  res.status(404).json({
    erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: 'Esta rota não existe.' },
  });
}

/** Converte qualquer erro no formato único que o front espera. */
export function tratadorDeErros(
  erro: unknown,
  _req: Request,
  res: Response,
  proximo: NextFunction,
): void {
  if (res.headersSent) {
    proximo(erro);
    return;
  }

  if (erro instanceof ZodError) {
    const detalhes: Record<string, string[]> = {};
    for (const problema of erro.issues) {
      const campo = problema.path.join('.') || '_';
      (detalhes[campo] ??= []).push(problema.message);
    }
    res.status(400).json({
      erro: { codigo: 'DADOS_INVALIDOS', mensagem: 'Confira os campos informados.', detalhes },
    });
    return;
  }

  if (erro instanceof ErroDaAplicacao) {
    res.status(erro.status).json({
      erro: { codigo: erro.codigo, mensagem: erro.message, detalhes: erro.detalhes },
    });
    return;
  }

  logger.error({ erro }, 'Erro não tratado');
  res.status(500).json({
    erro: { codigo: 'ERRO_INTERNO', mensagem: 'Algo deu errado. Tente novamente.' },
  });
}
