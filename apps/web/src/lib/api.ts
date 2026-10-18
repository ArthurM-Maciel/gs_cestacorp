import { erroSchema } from '@gincana/contracts';
import axios, { isAxiosError } from 'axios';

import { lerToken, limparToken } from './token.js';

/**
 * Em desenvolvimento o Vite encaminha `/api` para a API local. Em outro ambiente a URL
 * vem de `VITE_API_URL`. Variável `VITE_*` é pública no navegador: aqui só entra endereço,
 * nunca segredo.
 */
const urlConfigurada: unknown = import.meta.env.VITE_API_URL;
const baseURL =
  typeof urlConfigurada === 'string' && urlConfigurada.trim() !== '' ? urlConfigurada : '/api';

export const ROTA_DE_LOGIN = '/auth/login';

export const api = axios.create({
  baseURL,
  // Sem limite, uma rede ruim deixa o botão "Entrando…" girando para sempre.
  timeout: 15_000,
  headers: { Accept: 'application/json' },
});

type OuvinteDeSessaoExpirada = () => void;

const ouvintes = new Set<OuvinteDeSessaoExpirada>();

/**
 * Registra quem precisa saber que o servidor recusou o token. Devolve a função que cancela
 * o registro. O roteamento fica com a sessão: este arquivo não conhece o roteador.
 */
export function aoExpirarSessao(ouvinte: OuvinteDeSessaoExpirada): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

api.interceptors.request.use((config) => {
  const token = lerToken();
  if (token !== null) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (resposta) => resposta,
  (erro: unknown) => {
    const recusouOToken =
      isAxiosError(erro) &&
      erro.response?.status === 401 &&
      // No login, 401 significa "e-mail ou senha incorretos": a tela mostra o erro.
      erro.config?.url !== ROTA_DE_LOGIN &&
      // Sem token guardado não havia sessão a encerrar. Também evita avisar duas vezes
      // quando várias chamadas em voo recebem 401 juntas.
      lerToken() !== null;

    if (recusouOToken) {
      limparToken();
      ouvintes.forEach((ouvinte) => {
        ouvinte();
      });
    }

    return Promise.reject(erro);
  },
);

const MENSAGEM_GENERICA = 'Algo deu errado. Tente novamente em instantes.';

const mensagensPorStatus: Record<number, string> = {
  400: 'Confira os campos informados e tente novamente.',
  401: 'Sua sessão expirou. Entre novamente.',
  403: 'Você não tem permissão para esta ação.',
  404: 'Não encontramos o que você procurava.',
  429: 'Muitas tentativas seguidas. Aguarde um pouco e tente de novo.',
};

/**
 * Traduz um erro de chamada à API na mensagem que a tela mostra. Nunca devolve texto
 * técnico: quem lê é um colaborador, não quem desenvolve.
 *
 * Para erros 4xx a mensagem da própria API tem prioridade, porque ela conhece a regra que
 * falhou. `porStatus` deixa a tela trocar o texto de um status específico quando o contexto
 * muda o significado (um 401 no login é "senha incorreta", não "sessão expirada").
 */
export function mensagemDeErro(
  erro: unknown,
  porStatus: Partial<Record<number, string>> = {},
): string {
  if (!isAxiosError(erro)) {
    return MENSAGEM_GENERICA;
  }

  if (erro.response === undefined) {
    return erro.code === 'ECONNABORTED' || erro.code === 'ETIMEDOUT'
      ? 'O servidor demorou para responder. Tente novamente.'
      : 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
  }

  const { status, data } = erro.response;

  if (status >= 500) {
    return 'O servidor está com problemas no momento. Tente novamente em instantes.';
  }

  const personalizada = porStatus[status];
  if (personalizada !== undefined) {
    return personalizada;
  }

  const corpo = erroSchema.safeParse(data);
  if (corpo.success) {
    return corpo.data.erro.mensagem;
  }

  return mensagensPorStatus[status] ?? MENSAGEM_GENERICA;
}

/** Erros por campo (`detalhes` do formato de erro da API), ou vazio se não houver. */
export function detalhesDoErro(erro: unknown): Record<string, string[]> {
  if (!isAxiosError(erro)) {
    return {};
  }
  const corpo = erroSchema.safeParse(erro.response?.data);
  return corpo.success ? (corpo.data.erro.detalhes ?? {}) : {};
}
