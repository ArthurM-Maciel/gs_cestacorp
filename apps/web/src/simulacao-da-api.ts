import type { Papel, UsuarioAutenticado } from '@gincana/contracts';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { api } from './lib/api.js';

/**
 * Simula o servidor trocando só o adaptador de rede do axios. Os interceptores, a
 * tradução de erro e o resto do código de produção rodam de verdade: o teste enxerga
 * a tela como a pessoa enxergaria, sem saber como a chamada é feita por dentro.
 */
const adaptadorOriginal = api.defaults.adapter;

export interface RespostaSimulada {
  status: number;
  dados?: unknown;
}

/** Recebe a requisição (para conferir cabeçalhos ou corpo) e devolve a resposta do servidor. */
export type Simulacao = (
  requisicao: InternalAxiosRequestConfig,
) => RespostaSimulada | Promise<RespostaSimulada>;

/** As chaves têm o formato `MÉTODO /caminho`, por exemplo `POST /auth/login`. */
export function simularApi(simulacoes: Record<string, Simulacao>): void {
  api.defaults.adapter = async (config) => {
    const chave = `${config.method?.toUpperCase() ?? 'GET'} ${config.url ?? ''}`;
    const simulacao = simulacoes[chave];

    if (simulacao === undefined) {
      throw new Error(`Chamada sem simulação no teste: ${chave}`);
    }

    const { status, dados } = await simulacao(config);
    const resposta: AxiosResponse = { data: dados, status, statusText: '', headers: {}, config };

    if (status >= 200 && status < 300) {
      return resposta;
    }

    throw new AxiosError(
      `Request failed with status code ${status}`,
      status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      undefined,
      resposta,
    );
  };
}

export function falhaDeRede(config: InternalAxiosRequestConfig): never {
  throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
}

export function restaurarApi(): void {
  api.defaults.adapter = adaptadorOriginal;
}

export function erroDaApi(codigo: string, mensagem: string, detalhes?: Record<string, string[]>) {
  return { erro: { codigo, mensagem, detalhes } };
}

/** Pessoa fictícia: nenhum dado de colaborador real entra em teste. */
export function usuarioDeTeste(papel: Papel): UsuarioAutenticado {
  const equipeId = '22222222-2222-4222-8222-222222222222';
  return {
    id: '11111111-1111-4111-8111-111111111111',
    nome: 'Pessoa Teste',
    email: 'pessoa.teste@exemplo.com.br',
    papel,
    equipeId: papel === 'ADMIN' ? null : equipeId,
    equipeLideradaId: papel === 'LIDER' ? equipeId : null,
  };
}
