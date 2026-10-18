import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

/**
 * Validação de entrada reutilizável por todos os módulos.
 *
 * O schema vem de `@gincana/contracts`: o mesmo objeto que valida a requisição aqui tipa
 * o formulário no front, então as duas pontas não podem divergir.
 *
 * `body` é reescrito com o valor já convertido pelo zod (datas, números, campos com
 * `default`). `params` e `query` ficam em `req.validado` porque no Express 5 `req.query`
 * é somente leitura e `req.params` é reescrito pelo roteador a cada camada.
 */
export interface DadosValidados {
  params?: unknown;
  query?: unknown;
}

declare module 'express-serve-static-core' {
  interface Request {
    validado?: DadosValidados;
  }
}

export interface EsquemasDeValidacao {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validar(esquemas: EsquemasDeValidacao): RequestHandler {
  return (req: Request, _res: Response, proximo: NextFunction): void => {
    try {
      if (esquemas.body) {
        req.body = esquemas.body.parse(req.body);
      }

      const validado: DadosValidados = { ...req.validado };
      if (esquemas.params) {
        validado.params = esquemas.params.parse(req.params);
      }
      if (esquemas.query) {
        validado.query = esquemas.query.parse(req.query);
      }
      req.validado = validado;

      proximo();
    } catch (erro) {
      // O tratador central converte ZodError em 400 com os detalhes por campo.
      proximo(erro);
    }
  };
}

/**
 * Lê o que `validar` guardou, já no tipo do schema. A conversão acontece só aqui, num
 * ponto único, e depende de a rota ter declarado o mesmo schema no middleware.
 */
export function parametrosValidados<T>(req: Request, _schema: ZodType<T>): T {
  return req.validado?.params as T;
}

export function consultaValidada<T>(req: Request, _schema: ZodType<T>): T {
  return req.validado?.query as T;
}
