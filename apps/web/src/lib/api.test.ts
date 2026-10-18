import type { InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { erroDaApi, falhaDeRede, simularApi } from '../simulacao-da-api.js';
import { aoExpirarSessao, api, detalhesDoErro, mensagemDeErro } from './api.js';
import { gravarToken, lerToken } from './token.js';

/** Executa a chamada e devolve o erro que o axios produziu, para a tradução ser testada. */
async function erroDe(chamada: Promise<unknown>): Promise<unknown> {
  try {
    await chamada;
  } catch (erro) {
    return erro;
  }
  throw new Error('A chamada deveria ter falhado.');
}

describe('Chamadas à API', () => {
  describe('token', () => {
    it('acompanha cada chamada de quem tem sessão', async () => {
      gravarToken('token-de-teste');
      const chamada = vi.fn((_requisicao: InternalAxiosRequestConfig) => ({ status: 200 }));
      simularApi({ 'GET /qualquer': chamada });

      await api.get('/qualquer');

      expect(chamada.mock.calls[0]?.[0].headers.get('Authorization')).toBe('Bearer token-de-teste');
    });

    it('não envia cabeçalho de autorização a quem não tem sessão', async () => {
      const chamada = vi.fn((_requisicao: InternalAxiosRequestConfig) => ({ status: 200 }));
      simularApi({ 'GET /qualquer': chamada });

      await api.get('/qualquer');

      expect(chamada.mock.calls[0]?.[0].headers.has('Authorization')).toBe(false);
    });
  });

  describe('quando o servidor recusa o token (401)', () => {
    it('encerra a sessão e avisa quem escuta, uma única vez', async () => {
      gravarToken('token-vencido');
      const aviso = vi.fn();
      const parar = aoExpirarSessao(aviso);
      simularApi({ 'GET /a': () => ({ status: 401 }), 'GET /b': () => ({ status: 401 }) });

      await Promise.allSettled([api.get('/a'), api.get('/b')]);
      parar();

      expect(lerToken()).toBeNull();
      expect(aviso).toHaveBeenCalledTimes(1);
    });

    it('não confunde senha incorreta no login com sessão expirada', async () => {
      gravarToken('token-valido');
      const aviso = vi.fn();
      const parar = aoExpirarSessao(aviso);
      simularApi({ 'POST /auth/login': () => ({ status: 401 }) });

      await Promise.allSettled([api.post('/auth/login', {})]);
      parar();

      expect(lerToken()).toBe('token-valido');
      expect(aviso).not.toHaveBeenCalled();
    });

    it('não avisa ninguém quando não havia sessão', async () => {
      const aviso = vi.fn();
      const parar = aoExpirarSessao(aviso);
      simularApi({ 'GET /a': () => ({ status: 401 }) });

      await Promise.allSettled([api.get('/a')]);
      parar();

      expect(aviso).not.toHaveBeenCalled();
    });

    it('deixa de avisar quem cancelou o registro', async () => {
      gravarToken('token-vencido');
      const aviso = vi.fn();
      aoExpirarSessao(aviso)();
      simularApi({ 'GET /a': () => ({ status: 401 }) });

      await Promise.allSettled([api.get('/a')]);

      expect(aviso).not.toHaveBeenCalled();
    });
  });
});

describe('mensagemDeErro', () => {
  it('usa a mensagem que a API escreveu para erros 4xx', async () => {
    simularApi({
      'GET /a': () => ({ status: 409, dados: erroDaApi('CONFLITO', 'Esta equipe já tem líder.') }),
    });

    expect(mensagemDeErro(await erroDe(api.get('/a')))).toBe('Esta equipe já tem líder.');
  });

  it('deixa a tela trocar o texto de um status específico', async () => {
    simularApi({
      'GET /a': () => ({ status: 401, dados: erroDaApi('NAO_AUTENTICADO', 'Faça login.') }),
    });

    expect(mensagemDeErro(await erroDe(api.get('/a')), { 401: 'Senha incorreta.' })).toBe(
      'Senha incorreta.',
    );
  });

  it('traduz por status quando a resposta não segue o formato da API', async () => {
    simularApi({ 'GET /a': () => ({ status: 403, dados: '<html>Forbidden</html>' }) });

    expect(mensagemDeErro(await erroDe(api.get('/a')))).toBe(
      'Você não tem permissão para esta ação.',
    );
  });

  it('não repassa texto de erro do servidor (5xx)', async () => {
    simularApi({
      'GET /a': () => ({
        status: 500,
        dados: erroDaApi('ERRO_INTERNO', 'stack trace: at db.ts:42'),
      }),
    });

    const mensagem = mensagemDeErro(await erroDe(api.get('/a')));

    expect(mensagem).toBe(
      'O servidor está com problemas no momento. Tente novamente em instantes.',
    );
  });

  it('orienta a verificar a internet quando não há resposta', async () => {
    simularApi({ 'GET /a': falhaDeRede });

    expect(mensagemDeErro(await erroDe(api.get('/a')))).toBe(
      'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.',
    );
  });

  it('nunca devolve texto técnico para um erro que não veio da API', () => {
    expect(mensagemDeErro(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(
      'Algo deu errado. Tente novamente em instantes.',
    );
  });
});

describe('detalhesDoErro', () => {
  it('devolve os erros por campo enviados pela API', async () => {
    simularApi({
      'GET /a': () => ({
        status: 400,
        dados: erroDaApi('DADOS_INVALIDOS', 'Confira os campos.', { email: ['E-mail inválido.'] }),
      }),
    });

    expect(detalhesDoErro(await erroDe(api.get('/a')))).toEqual({ email: ['E-mail inválido.'] });
  });

  it('devolve vazio quando não há detalhes', async () => {
    simularApi({ 'GET /a': () => ({ status: 404, dados: erroDaApi('NAO_ENCONTRADO', 'Nada.') }) });

    expect(detalhesDoErro(await erroDe(api.get('/a')))).toEqual({});
  });
});
