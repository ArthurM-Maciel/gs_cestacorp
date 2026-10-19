import type { MudancaAuditada } from '@gincana/contracts';
import { describe, expect, it } from 'vitest';

import { rotuloDaEntidade } from './apresentacao-da-auditoria.js';
import { prepararMudancas } from './descrever-mudanca.js';

const mudanca = (
  campo: string,
  rotulo: string,
  de: string | null,
  para: string | null,
): MudancaAuditada => ({ campo, rotulo, de, para });

describe('prepararMudancas', () => {
  describe('troca de valor', () => {
    it('põe a unidade do lançamento na quantidade: 12 kg → 15 kg', () => {
      const [linha] = prepararMudancas([mudanca('quantidade', 'Quantidade', '12', '15')], {
        acao: 'ALTERACAO',
        unidade: 'KG',
      });

      expect(linha).toMatchObject({
        rotulo: 'Quantidade',
        forma: 'troca',
        antes: '12 kg',
        depois: '15 kg',
      });
    });

    it('usa o singular e o plural da unidade', () => {
      const [um, varios] = prepararMudancas(
        [
          mudanca('quantidade', 'Quantidade', '1', '8'),
          mudanca('quantidade', 'Quantidade', '8', '1'),
        ],
        { acao: 'ALTERACAO', unidade: 'PECA' },
      );

      expect(um).toMatchObject({ antes: '1 peça', depois: '8 peças' });
      expect(varios).toMatchObject({ antes: '8 peças', depois: '1 peça' });
    });

    it('escreve o decimal à brasileira', () => {
      const [linha] = prepararMudancas([mudanca('quantidade', 'Quantidade', '12.5', '13')], {
        acao: 'ALTERACAO',
        unidade: 'KG',
      });

      expect(linha).toMatchObject({ antes: '12,5 kg', depois: '13 kg' });
    });

    it('sem a unidade, mostra o número sozinho em vez de arriscar a unidade errada', () => {
      const [linha] = prepararMudancas([mudanca('quantidade', 'Quantidade', '12', '15')], {
        acao: 'ALTERACAO',
      });

      expect(linha).toMatchObject({ antes: '12', depois: '15' });
    });

    it('escreve pontos com "pts", o preço por unidade e as datas no formato da tela', () => {
      const linhas = prepararMudancas(
        [
          mudanca('pontosCalculados', 'Pontos', '120', '150'),
          mudanca('pontosPorUnidadeAplicado', 'Pontos por unidade', '10', '12'),
          mudanca('dataAcao', 'Data da ação', '2026-11-02', '2026-11-03'),
          mudanca('status', 'Situação', 'Pendente', 'Aprovado'),
        ],
        { acao: 'ALTERACAO', unidade: 'KG' },
      );

      expect(linhas.map((linha) => [linha.antes, linha.depois])).toEqual([
        ['120 pts', '150 pts'],
        ['10 pts por kg', '12 pts por kg'],
        ['02/11/2026', '03/11/2026'],
        ['Pendente', 'Aprovado'],
      ]);
    });
  });

  describe('criação', () => {
    it('não tem valor anterior: vira "registro", nunca uma troca de nulo', () => {
      const linhas = prepararMudancas(
        [
          mudanca('status', 'Situação', null, 'Pendente'),
          mudanca('quantidade', 'Quantidade', null, '24'),
        ],
        { acao: 'CRIACAO', unidade: 'KG' },
      );

      expect(linhas).toEqual([
        { campo: 'status', rotulo: 'Situação', forma: 'registro', antes: null, depois: 'Pendente' },
        {
          campo: 'quantidade',
          rotulo: 'Quantidade',
          forma: 'registro',
          antes: null,
          depois: '24 kg',
        },
      ]);
    });
  });

  describe('valor que aparece ou some fora da criação', () => {
    it('um valor novo onde não havia é "definido"', () => {
      const [linha] = prepararMudancas(
        [mudanca('motivoRecusa', 'Motivo da recusa', null, 'Foto sem etiqueta')],
        { acao: 'RECUSA' },
      );

      expect(linha).toMatchObject({ forma: 'definido', antes: null, depois: 'Foto sem etiqueta' });
    });

    it('um valor que deixou de existir é "removido", e guarda o que era', () => {
      const [linha] = prepararMudancas(
        [mudanca('motivoRecusa', 'Motivo da recusa', 'Foto sem etiqueta', null)],
        { acao: 'ALTERACAO' },
      );

      expect(linha).toMatchObject({ forma: 'removido', antes: 'Foto sem etiqueta', depois: null });
    });
  });

  it('descarta a mudança sem valor nenhum dos dois lados', () => {
    expect(
      prepararMudancas([mudanca('observacao', 'Observação', null, null)], { acao: 'ALTERACAO' }),
    ).toEqual([]);
  });

  it('devolve lista vazia quando o servidor não achou nada comparável', () => {
    expect(prepararMudancas([], { acao: 'EXCLUSAO' })).toEqual([]);
  });
});

describe('rotuloDaEntidade', () => {
  it('traduz as entidades que a trilha conhece', () => {
    expect(rotuloDaEntidade('Lancamento')).toBe('Lançamento');
    expect(rotuloDaEntidade('RegraPontuacao')).toBe('Regra de pontuação');
  });

  it('mostra como veio uma entidade que a tela ainda não conhece', () => {
    expect(rotuloDaEntidade('Premio')).toBe('Premio');
    // Nomes que existem em todo objeto não podem ser tomados por uma entidade conhecida.
    expect(rotuloDaEntidade('toString')).toBe('toString');
  });
});
