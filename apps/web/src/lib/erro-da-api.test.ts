import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';

import {
  codigoDoErro,
  errosDoSchema,
  focarPrimeiroComErro,
  traduzirErroDoFormulario,
} from './erro-da-api.js';

function erroHttp(status: number, dados: unknown): AxiosError {
  const config = {} as InternalAxiosRequestConfig;
  return new AxiosError('falha', AxiosError.ERR_BAD_REQUEST, config, undefined, {
    status,
    data: dados,
    statusText: '',
    headers: {},
    config,
  });
}

const corpo = (codigo: string, mensagem: string, detalhes?: Record<string, string[]>) => ({
  erro: { codigo, mensagem, detalhes },
});

const CAMPOS = ['ano', 'nome'] as const;

describe('codigoDoErro', () => {
  it('lê o código de negócio da resposta da API', () => {
    expect(codigoDoErro(erroHttp(409, corpo('ANO_JA_CADASTRADO', 'x')))).toBe('ANO_JA_CADASTRADO');
  });

  it('devolve null quando não é um erro da API', () => {
    expect(codigoDoErro(new Error('qualquer coisa'))).toBeNull();
    expect(codigoDoErro(erroHttp(502, '<html>Bad Gateway</html>'))).toBeNull();
  });
});

describe('traduzirErroDoFormulario', () => {
  it('põe o conflito conhecido no campo certo, com a orientação depois da mensagem da API', () => {
    const erro = erroHttp(409, corpo('ANO_JA_CADASTRADO', 'Já existe uma gincana de 2026.'));

    const resultado = traduzirErroDoFormulario(erro, CAMPOS, {
      ANO_JA_CADASTRADO: { campo: 'ano', orientacao: 'Escolha outro ano.' },
    });

    expect(resultado).toEqual({
      campos: { ano: 'Já existe uma gincana de 2026. Escolha outro ano.' },
      geral: null,
    });
  });

  it('põe cada erro de validação no campo que a API apontou', () => {
    const erro = erroHttp(
      400,
      corpo('DADOS_INVALIDOS', 'Confira os campos informados.', {
        nome: ['O nome precisa de pelo menos 3 caracteres.'],
        campoQueATelaNaoTem: ['ignorado'],
      }),
    );

    const resultado = traduzirErroDoFormulario(erro, CAMPOS);

    expect(resultado).toEqual({
      campos: { nome: 'O nome precisa de pelo menos 3 caracteres.' },
      geral: null,
    });
  });

  it('quando o registro sumiu, diz que a lista foi atualizada', () => {
    const erro = erroHttp(404, corpo('NAO_ENCONTRADO', 'Equipe não encontrada.'));

    const resultado = traduzirErroDoFormulario(erro, CAMPOS);

    expect(resultado.campos).toEqual({});
    expect(resultado.geral).toBe(
      'Equipe não encontrada. Feche esta janela e confira a lista, que já foi atualizada.',
    );
  });

  it('usa um aviso geral em português para qualquer outra falha, sem texto técnico', () => {
    const resultado = traduzirErroDoFormulario(erroHttp(500, undefined), CAMPOS);

    expect(resultado.campos).toEqual({});
    expect(resultado.geral).toMatch(/servidor está com problemas/i);
  });

  it('trata falha que não é HTTP (resposta fora do contrato) como erro genérico', () => {
    const resultado = traduzirErroDoFormulario(new Error('invalid_type'), CAMPOS);

    expect(resultado.geral).toBe('Algo deu errado. Tente novamente em instantes.');
  });
});

describe('errosDoSchema', () => {
  it('guarda só a primeira mensagem de cada campo e ignora o que a tela não tem', () => {
    const resultado = errosDoSchema(
      [
        { path: ['nome'], message: 'primeira' },
        { path: ['nome'], message: 'segunda' },
        { path: ['ano'], message: 'do ano' },
        { path: ['outro'], message: 'de um campo que a tela não tem' },
      ],
      CAMPOS,
    );

    expect(resultado).toEqual({ nome: 'primeira', ano: 'do ano' });
  });
});

describe('focarPrimeiroComErro', () => {
  function montarFormulario() {
    const formulario = document.createElement('form');
    formulario.innerHTML = '<input name="ano" /><input name="nome" />';
    document.body.append(formulario);
    return formulario;
  }

  it('leva o foco ao primeiro campo com erro na ordem do formulário', () => {
    const formulario = montarFormulario();

    focarPrimeiroComErro(formulario, CAMPOS, { nome: 'erro', ano: 'erro' });

    expect(document.activeElement).toBe(formulario.elements.namedItem('ano'));
    formulario.remove();
  });

  it('não muda o foco quando não há erro', () => {
    const formulario = montarFormulario();

    focarPrimeiroComErro(formulario, CAMPOS, {});

    expect(document.activeElement).toBe(document.body);
    formulario.remove();
  });
});
