import type { UsuarioAutenticado } from '@gincana/contracts';
import { describe, expect, it } from 'vitest';

import {
  donoDoNovoLancamento,
  ehAutoAvaliacao,
  escopoDeLeituraDeLancamentos,
  filtrosDaConsulta,
  podeAvaliarLancamento,
  podeEditarLancamento,
  podeMexerNasEvidencias,
  type LancamentoParaPolicy,
} from './policy.js';

/**
 * A autorização dos lançamentos coberta sem HTTP, sem banco e sem subir o Express.
 *
 * Estas são as decisões que, se saírem erradas, deixam um colaborador ver lançamento
 * alheio ou um líder aprovar os pontos de outra equipe. Testá-las aqui é o que permite
 * cobrir todas as combinações sem montar um cenário de banco para cada uma.
 */

const EQUIPE_A = '11111111-1111-4111-8111-111111111111';
const EQUIPE_B = '22222222-2222-4222-8222-222222222222';

const usuario = (dados: Partial<UsuarioAutenticado> & { id: string }): UsuarioAutenticado => ({
  nome: 'Pessoa de teste',
  email: 'pessoa@teste.invalido',
  papel: 'COLABORADOR',
  equipeId: null,
  equipeLideradaId: null,
  ...dados,
});

const lancamento = (dados: Partial<LancamentoParaPolicy> = {}): LancamentoParaPolicy => ({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  colaboradorId: 'dono',
  equipeId: EQUIPE_A,
  status: 'PENDENTE',
  ...dados,
});

describe('escopoDeLeituraDeLancamentos', () => {
  it('não restringe nada para a administradora', () => {
    expect(escopoDeLeituraDeLancamentos(usuario({ id: 'marieri', papel: 'ADMIN' }))).toEqual({});
  });

  it('prende o colaborador aos próprios lançamentos', () => {
    expect(escopoDeLeituraDeLancamentos(usuario({ id: 'pessoa', equipeId: EQUIPE_A }))).toEqual({
      colaboradorId: 'pessoa',
    });
  });

  it('dá ao líder a equipe que ele lidera e os lançamentos dele', () => {
    const escopo = escopoDeLeituraDeLancamentos(
      usuario({ id: 'lider', papel: 'LIDER', equipeId: EQUIPE_B, equipeLideradaId: EQUIPE_A }),
    );

    expect(escopo).toEqual({ OR: [{ equipeId: EQUIPE_A }, { colaboradorId: 'lider' }] });
  });

  it('não abre nada para quem tem papel de líder sem equipe atribuída', () => {
    expect(escopoDeLeituraDeLancamentos(usuario({ id: 'lider', papel: 'LIDER' }))).toEqual({
      colaboradorId: 'lider',
    });
  });

  it('nunca devolve o identificador pedido na consulta: isso é filtro, não escopo', () => {
    // O escopo não conhece a consulta. É o `AND` do serviço que impede alguém de
    // alcançar lançamento alheio escrevendo `colaboradorId` na barra de endereço.
    const escopo = escopoDeLeituraDeLancamentos(usuario({ id: 'pessoa' }));
    const filtros = filtrosDaConsulta({ colaboradorId: 'outra-pessoa' });

    expect(escopo).toEqual({ colaboradorId: 'pessoa' });
    expect(filtros).toEqual({ colaboradorId: 'outra-pessoa' });
  });
});

describe('podeAvaliarLancamento', () => {
  it('deixa a administradora avaliar qualquer equipe', () => {
    const marieri = usuario({ id: 'marieri', papel: 'ADMIN' });

    expect(podeAvaliarLancamento(marieri, lancamento({ equipeId: EQUIPE_A }))).toBe(true);
    expect(podeAvaliarLancamento(marieri, lancamento({ equipeId: EQUIPE_B }))).toBe(true);
  });

  it('deixa o líder avaliar só a própria equipe', () => {
    const lider = usuario({ id: 'lider', papel: 'LIDER', equipeLideradaId: EQUIPE_A });

    expect(podeAvaliarLancamento(lider, lancamento({ equipeId: EQUIPE_A }))).toBe(true);
    expect(podeAvaliarLancamento(lider, lancamento({ equipeId: EQUIPE_B }))).toBe(false);
  });

  it('não deixa o colaborador avaliar, nem o da própria equipe', () => {
    const pessoa = usuario({ id: 'pessoa', equipeId: EQUIPE_A });

    expect(podeAvaliarLancamento(pessoa, lancamento({ equipeId: EQUIPE_A }))).toBe(false);
  });

  it('não deixa avaliar quem tem papel de líder sem equipe atribuída', () => {
    const lider = usuario({ id: 'lider', papel: 'LIDER' });

    expect(podeAvaliarLancamento(lider, lancamento())).toBe(false);
  });
});

describe('ehAutoAvaliacao', () => {
  it('reconhece o líder avaliando o próprio lançamento', () => {
    const lider = usuario({ id: 'lider', papel: 'LIDER', equipeLideradaId: EQUIPE_A });

    expect(ehAutoAvaliacao(lider, lancamento({ colaboradorId: 'lider' }))).toBe(true);
  });

  it('reconhece a administradora avaliando o próprio lançamento', () => {
    const marieri = usuario({ id: 'marieri', papel: 'ADMIN' });

    expect(ehAutoAvaliacao(marieri, lancamento({ colaboradorId: 'marieri' }))).toBe(true);
    expect(ehAutoAvaliacao(marieri, lancamento({ colaboradorId: 'outra' }))).toBe(false);
  });
});

describe('podeEditarLancamento', () => {
  it('deixa o dono corrigir enquanto está pendente', () => {
    const dono = usuario({ id: 'dono' });

    expect(podeEditarLancamento(dono, lancamento({ status: 'PENDENTE' }))).toBe(true);
  });

  it('deixa o dono corrigir o que foi recusado, para reenviar', () => {
    const dono = usuario({ id: 'dono' });

    expect(podeEditarLancamento(dono, lancamento({ status: 'RECUSADO' }))).toBe(true);
  });

  it('não deixa o dono mexer depois de aprovado', () => {
    const dono = usuario({ id: 'dono' });

    expect(podeEditarLancamento(dono, lancamento({ status: 'APROVADO' }))).toBe(false);
  });

  it('deixa a administradora alterar mesmo o que já foi aprovado', () => {
    const marieri = usuario({ id: 'marieri', papel: 'ADMIN' });

    expect(podeEditarLancamento(marieri, lancamento({ status: 'APROVADO' }))).toBe(true);
  });

  it('não deixa o líder reescrever o lançamento de quem ele avalia', () => {
    const lider = usuario({ id: 'lider', papel: 'LIDER', equipeLideradaId: EQUIPE_A });

    expect(podeEditarLancamento(lider, lancamento({ equipeId: EQUIPE_A }))).toBe(false);
  });
});

describe('podeMexerNasEvidencias', () => {
  it('é só do dono, nem o líder nem a administradora anexam no lugar dele', () => {
    expect(podeMexerNasEvidencias(usuario({ id: 'dono' }), lancamento())).toBe(true);
    expect(podeMexerNasEvidencias(usuario({ id: 'marieri', papel: 'ADMIN' }), lancamento())).toBe(
      false,
    );
    expect(
      podeMexerNasEvidencias(
        usuario({ id: 'lider', papel: 'LIDER', equipeLideradaId: EQUIPE_A }),
        lancamento(),
      ),
    ).toBe(false);
  });
});

describe('donoDoNovoLancamento', () => {
  it('deixa a administradora lançar em nome de outra pessoa', () => {
    const marieri = usuario({ id: 'marieri', papel: 'ADMIN' });

    expect(donoDoNovoLancamento(marieri, 'outra-pessoa')).toBe('outra-pessoa');
    expect(donoDoNovoLancamento(marieri)).toBe('marieri');
  });

  it('ignora o colaboradorId do corpo quando quem lança não é a administradora', () => {
    const lider = usuario({ id: 'lider', papel: 'LIDER', equipeLideradaId: EQUIPE_A });
    const pessoa = usuario({ id: 'pessoa' });

    expect(donoDoNovoLancamento(lider, 'outra-pessoa')).toBe('lider');
    expect(donoDoNovoLancamento(pessoa, 'outra-pessoa')).toBe('pessoa');
  });
});

describe('filtrosDaConsulta', () => {
  it('deixa de fora o que não veio, para não virar `undefined` no where', () => {
    expect(filtrosDaConsulta({ status: 'PENDENTE' })).toEqual({ status: 'PENDENTE' });
    expect(filtrosDaConsulta({})).toEqual({});
  });
});
