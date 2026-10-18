import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  cenarioDeLancamentos,
  comSessaoDe,
  rotasDeLancamentos,
  umLancamento,
} from '../../simulacao-de-lancamentos.js';
import { renderizarNaRota } from '../../utilitarios-de-teste.js';

async function abrirInicio() {
  renderizarNaRota('/inicio');
  return screen.findByRole('table', { name: 'Meus lançamentos' });
}

describe('Início do colaborador (US10)', () => {
  describe('meus lançamentos', () => {
    it('mostra ação, quantidade, dia, pontos e o status de cada lançamento', async () => {
      const { estado, euMesma, equipe, alimentos, tampinhas, roupas } = cenarioDeLancamentos();
      estado.lancamentos = [
        umLancamento(tampinhas, euMesma, equipe, {
          quantidade: 3,
          status: 'APROVADO',
          dataAcao: '2026-11-12',
          avaliadoPor: { id: '5e6d7a14-0000-4000-8000-000000000001', nome: 'Bruno Exemplo' },
        }),
        umLancamento(alimentos, euMesma, equipe, { quantidade: 12 }),
        umLancamento(roupas, euMesma, equipe, {
          quantidade: 1,
          status: 'RECUSADO',
          motivoRecusa: 'Foto sem etiqueta da ONG',
        }),
      ];
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

      const tabela = await abrirInicio();

      // A API entrega o mais novo primeiro; a tela mostra na ordem em que chegou.
      const linhas = within(tabela).getAllByRole('row').slice(1);
      expect(linhas).toHaveLength(3);
      expect(linhas[0]).toHaveTextContent('Doação de roupas');
      expect(linhas[0]).toHaveTextContent('1 peça');
      expect(linhas[0]).toHaveTextContent('Recusado');
      expect(linhas[1]).toHaveTextContent('Doação de alimentos');
      expect(linhas[1]).toHaveTextContent('12 kg');
      expect(linhas[1]).toHaveTextContent('hoje');
      expect(linhas[1]).toHaveTextContent('+120 pts');
      expect(linhas[1]).toHaveTextContent('Pendente');
      expect(linhas[2]).toHaveTextContent('Doação de tampinhas');
      expect(linhas[2]).toHaveTextContent('12/11');
      expect(linhas[2]).toHaveTextContent('+30 pts');
      expect(linhas[2]).toHaveTextContent('Aprovado');
    });

    it('só pede à API os lançamentos da própria pessoa', async () => {
      const { estado, euMesma, camila, equipe, alimentos } = cenarioDeLancamentos();
      estado.lancamentos = [
        umLancamento(alimentos, euMesma, equipe, { quantidade: 2 }),
        umLancamento(alimentos, camila, equipe, { quantidade: 99 }),
      ];
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

      const tabela = await abrirInicio();

      expect(within(tabela).getAllByRole('row').slice(1)).toHaveLength(1);
      expect(within(tabela).queryByText(/99 kg/)).not.toBeInTheDocument();
    });

    it('mostra o motivo da recusa e oferece corrigir e reenviar', async () => {
      const { estado, euMesma, equipe, roupas } = cenarioDeLancamentos();
      const recusado = umLancamento(roupas, euMesma, equipe, {
        status: 'RECUSADO',
        motivoRecusa: 'Foto sem etiqueta da ONG',
      });
      estado.lancamentos = [recusado];
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

      const tabela = await abrirInicio();

      expect(within(tabela).getByText(/Foto sem etiqueta da ONG/)).toBeVisible();
      expect(
        within(tabela).getByRole('link', { name: 'Corrigir e reenviar Doação de roupas' }),
      ).toHaveAttribute('href', `/lancamentos/${recusado.id}/corrigir`);
      // Recusado não soma ponto: a tela não promete "+180 pts".
      expect(within(tabela).queryByText(/\+\d+ pts/)).not.toBeInTheDocument();
    });

    it('avisa quando falta o comprovante que a ação exige e oferece anexá-lo', async () => {
      const { estado, euMesma, equipe, alimentos } = cenarioDeLancamentos();
      const semComprovante = umLancamento(alimentos, euMesma, equipe, { evidencias: [] });
      estado.lancamentos = [semComprovante];
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

      const tabela = await abrirInicio();

      expect(within(tabela).getByText(/falta o comprovante que esta ação exige/i)).toBeVisible();
      expect(
        within(tabela).getByRole('link', { name: 'Anexar comprovante a Doação de alimentos' }),
      ).toHaveAttribute('href', `/lancamentos/${semComprovante.id}/corrigir`);
    });

    it('não oferece correção para o lançamento já aprovado', async () => {
      const { estado, euMesma, equipe, alimentos } = cenarioDeLancamentos();
      estado.lancamentos = [umLancamento(alimentos, euMesma, equipe, { status: 'APROVADO' })];
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

      const tabela = await abrirInicio();

      expect(within(tabela).queryByRole('link')).not.toBeInTheDocument();
    });

    it('traz mais lançamentos sob demanda', async () => {
      const { estado, euMesma, equipe, alimentos } = cenarioDeLancamentos();
      estado.lancamentos = Array.from({ length: 12 }, (_, indice) =>
        umLancamento(alimentos, euMesma, equipe, { quantidade: indice + 1 }),
      );
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

      const tabela = await abrirInicio();
      expect(within(tabela).getAllByRole('row').slice(1)).toHaveLength(10);

      fireEvent.click(screen.getByRole('button', { name: 'Ver mais lançamentos' }));

      expect(await screen.findByText('1 kg · hoje')).toBeVisible();
      expect(within(tabela).getAllByRole('row').slice(1)).toHaveLength(12);
      expect(
        screen.queryByRole('button', { name: 'Ver mais lançamentos' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('estados da tela', () => {
    it('mostra o carregamento enquanto a lista não chega', async () => {
      const { estado } = cenarioDeLancamentos();
      let liberar: () => void = () => undefined;
      const espera = new Promise<void>((resolver) => {
        liberar = resolver;
      });
      const rotas = rotasDeLancamentos(estado);
      comSessaoDe('COLABORADOR', {
        ...rotas,
        'GET /lancamentos': async (requisicao) => {
          await espera;
          return (rotas['GET /lancamentos'] as NonNullable<(typeof rotas)[string]>)(requisicao);
        },
      });

      renderizarNaRota('/inicio');

      expect(await screen.findByText('Carregando os seus lançamentos…')).toBeVisible();
      liberar();
      expect(await screen.findByText('Você ainda não registrou nenhuma ação')).toBeVisible();
    });

    it('explica o que fazer quando ainda não há lançamento', async () => {
      const { estado } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

      renderizarNaRota('/inicio');

      expect(await screen.findByText('Você ainda não registrou nenhuma ação')).toBeVisible();
      expect(screen.getByRole('link', { name: 'Registrar a primeira ação' })).toHaveAttribute(
        'href',
        '/registrar',
      );
    });

    it('avisa em português quando a lista não carrega e deixa tentar de novo', async () => {
      const { estado, euMesma, equipe, alimentos } = cenarioDeLancamentos();
      estado.lancamentos = [umLancamento(alimentos, euMesma, equipe)];
      const rotas = rotasDeLancamentos(estado);
      const lista = rotas['GET /lancamentos'] as NonNullable<(typeof rotas)[string]>;
      const falhar = vi.fn(() => ({ status: 500 }));
      let funcionando = false;
      comSessaoDe('COLABORADOR', {
        ...rotas,
        'GET /lancamentos': (requisicao) => (funcionando ? lista(requisicao) : falhar()),
      });

      renderizarNaRota('/inicio');

      expect(await screen.findByRole('alert')).toHaveTextContent(/servidor está com problemas/i);

      funcionando = true;
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

      expect(await screen.findByRole('table', { name: 'Meus lançamentos' })).toBeVisible();
    });
  });

  describe('resumo', () => {
    it('conta os lançamentos aguardando e os aprovados, sem inventar a posição da equipe', async () => {
      const { estado, euMesma, equipe, alimentos, roupas } = cenarioDeLancamentos();
      estado.lancamentos = [
        umLancamento(alimentos, euMesma, equipe),
        umLancamento(alimentos, euMesma, equipe, { quantidade: 5 }),
        umLancamento(roupas, euMesma, equipe, { status: 'APROVADO' }),
      ];
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

      await abrirInicio();

      expect(screen.getByText('Aguardando aprovação').nextElementSibling).toHaveTextContent('2');
      expect(screen.getByText('Aprovados').nextElementSibling).toHaveTextContent('1');
      expect(screen.getByText(/posição da sua equipe no placar chega em breve/i)).toBeVisible();
      expect(screen.queryByText(/lugar/i)).not.toBeInTheDocument();
    });
  });

  it('leva o botão "+ Registrar ação" à escolha da ação', async () => {
    const { estado } = cenarioDeLancamentos();
    comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));
    renderizarNaRota('/inicio');

    fireEvent.click(await screen.findByRole('link', { name: '+ Registrar ação' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Qual ação você fez?' }),
    ).toBeVisible();
  });
});
