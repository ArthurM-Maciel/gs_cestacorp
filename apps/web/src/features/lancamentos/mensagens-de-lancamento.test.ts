import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';

import { erroDaApi } from '../../simulacao-da-api.js';
import { ErroDeEnvioDoArquivo } from '../evidencias/evidencias-api.js';
import { traduzirFalhaDeLancamento, type Operacao } from './mensagens-de-lancamento.js';

function falhaDaApi(status: number, corpo: unknown): AxiosError {
  const config = {} as InternalAxiosRequestConfig;
  const resposta = { data: corpo, status, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('falhou', 'ERR_BAD_REQUEST', config, undefined, resposta);
}

const conflito = (codigo: string) => falhaDaApi(409, erroDaApi(codigo, 'Mensagem da API.'));

describe('traduzirFalhaDeLancamento', () => {
  it.each<[string, Operacao, RegExp]>([
    ['EVIDENCIA_OBRIGATORIA', 'aprovar', /peça o comprovante ao colaborador ou recuse/i],
    ['EVIDENCIA_OBRIGATORIA', 'registrar', /anexe um comprovante e tente de novo/i],
    ['NAO_PODE_AVALIAR_PROPRIO_LANCAMENTO', 'aprovar', /a administradora avalia/i],
    ['LANCAMENTO_JA_AVALIADO', 'aprovar', /outra pessoa já avaliou/i],
    ['LANCAMENTO_JA_AVALIADO', 'recusar', /a lista foi atualizada/i],
    ['LANCAMENTO_JA_AVALIADO', 'corrigir', /não pode mais mudar por aqui/i],
    ['GINCANA_NAO_ESTA_ATIVA', 'registrar', /fale com a administradora/i],
    ['TIPO_DE_ACAO_INATIVO', 'registrar', /escolha outra ação/i],
    ['LIMITE_DE_COMPROVANTES', 'corrigir', /máximo de 10 comprovantes/i],
  ])('%s em "%s" diz o que fazer', (codigo, operacao, esperado) => {
    const { geral, campos } = traduzirFalhaDeLancamento(conflito(codigo), operacao);

    expect(geral).toMatch(esperado);
    expect(geral).not.toContain(codigo);
    expect(campos).toEqual({});
  });

  it('leva o erro de validação ao campo que a API apontou', () => {
    const erro = falhaDaApi(
      400,
      erroDaApi('DADOS_INVALIDOS', 'Confira os campos informados.', {
        quantidade: ['A quantidade precisa ser maior que zero.'],
      }),
    );

    const falha = traduzirFalhaDeLancamento(erro, 'registrar', {
      camposDoFormulario: ['quantidade', 'dataAcao'],
    });

    expect(falha).toEqual({
      campos: { quantidade: 'A quantidade precisa ser maior que zero.' },
      geral: null,
    });
  });

  it('amarra o conflito de período ao campo da data, com a orientação', () => {
    const erro = conflito('DATA_FORA_DO_PERIODO_DA_GINCANA');

    const falha = traduzirFalhaDeLancamento(erro, 'registrar', {
      camposDoFormulario: ['quantidade', 'dataAcao'],
      campoDaData: 'dataAcao',
    });

    expect(falha.campos.dataAcao).toBe('Mensagem da API. Escolha um dia dentro desse período.');
    expect(falha.geral).toBeNull();
  });

  it('usa a mensagem em português da própria API para o conflito que não conhece', () => {
    const falha = traduzirFalhaDeLancamento(conflito('COLABORADOR_SEM_EQUIPE'), 'registrar');

    expect(falha.geral).toBe('Mensagem da API.');
  });

  it('repassa a falha do envio do arquivo, que já vem em português', () => {
    const falha = traduzirFalhaDeLancamento(
      new ErroDeEnvioDoArquivo('Não foi possível enviar o comprovante.'),
      'registrar',
    );

    expect(falha.geral).toBe('Não foi possível enviar o comprovante.');
  });

  it('nunca mostra texto técnico quando o erro não é da API', () => {
    const falha = traduzirFalhaDeLancamento(new TypeError('x is undefined'), 'aprovar');

    expect(falha.geral).toBe('Algo deu errado. Tente novamente em instantes.');
  });
});
