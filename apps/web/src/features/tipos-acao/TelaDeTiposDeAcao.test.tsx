import type { TipoAcao } from '@gincana/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { comSessaoDe } from '../../simulacao-de-lancamentos.js';
import { erroDaApi } from '../../simulacao-da-api.js';
import {
  cenarioDeTiposDeAcao as cenario,
  rotasDeTiposDeAcao,
  umTipoDeAcao,
} from '../../simulacao-de-tipos-acao.js';
import { comSessaoDeAdmin } from '../../simulacao-do-cadastro.js';
import { renderizarNaRota } from '../../utilitarios-de-teste.js';

function corpoDa(chamada: ReturnType<typeof vi.fn>, indice = 0): unknown {
  const requisicao = chamada.mock.calls[indice]?.[0] as InternalAxiosRequestConfig | undefined;
  return typeof requisicao?.data === 'string' ? JSON.parse(requisicao.data) : requisicao?.data;
}

async function abrirTiposDeAcao() {
  renderizarNaRota('/tipos-acao');
  return screen.findByRole('table', { name: 'Tipos de ação da gincana' });
}

describe('Tipos de ação (US04)', () => {
  describe('lista', () => {
    it('mostra os pontos por unidade, a unidade e a situação de cada tipo', async () => {
      const { estado } = cenario();
      comSessaoDeAdmin(rotasDeTiposDeAcao(estado));

      const tabela = await abrirTiposDeAcao();

      expect(
        within(tabela)
          .getAllByRole('columnheader')
          .map((c) => c.textContent),
      ).toEqual(['Ação', 'Unidade', 'Pontos por unidade', 'Comprovante', 'Status', 'Ações']);

      const linhas = within(tabela).getAllByRole('row').slice(1);
      expect(linhas).toHaveLength(4);
      // A tela mostra a ordem que a API devolveu, sem reordenar por conta própria.
      expect(linhas[0]).toHaveTextContent('Doação de alimentos');
      expect(linhas[0]).toHaveTextContent('kg');
      expect(linhas[0]).toHaveTextContent('10 pts');
      expect(linhas[0]).toHaveTextContent('Ativa');
      expect(linhas[0]).toHaveTextContent('Sim');
      const linhaDoCurso = linhas.find((linha) => linha.textContent?.includes('Curso ou PDI'));
      expect(linhaDoCurso).toHaveTextContent('certificado');
      expect(linhaDoCurso).toHaveTextContent('50 pts');
      expect(linhaDoCurso).toHaveTextContent('Pausada');
      expect(screen.getByText(/mudanças valem só para lançamentos novos/i)).toBeVisible();
    });

    it('explica o que fazer quando ainda não há tipo de ação', async () => {
      const { estado } = cenario();
      estado.tipos = [];
      comSessaoDeAdmin(rotasDeTiposDeAcao(estado));

      renderizarNaRota('/tipos-acao');

      expect(await screen.findByText('Nenhum tipo de ação ainda')).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Criar o primeiro tipo de ação' }));
      expect(await screen.findByRole('dialog', { name: 'Novo tipo de ação' })).toBeVisible();
    });
  });

  describe('criar tipo de ação', () => {
    it('cadastra um tipo novo, fecha o diálogo e mostra o sucesso', async () => {
      const { gincana, estado } = cenario();
      const criar = vi.fn((requisicao: InternalAxiosRequestConfig) => {
        const dados = JSON.parse(String(requisicao.data)) as {
          nome: string;
          unidade: 'KG' | 'UNIDADE' | 'PECA' | 'CERTIFICADO';
          pontosPorUnidade: number;
          exigeEvidencia: boolean;
        };
        const novo = umTipoDeAcao(gincana.id, dados.nome, dados.unidade, dados.pontosPorUnidade);
        estado.tipos.push(novo);
        return { status: 201, dados: { ...novo, regras: [novo.regraVigente] } };
      });
      comSessaoDeAdmin({
        ...rotasDeTiposDeAcao(estado),
        [`POST /gincanas/${gincana.id}/tipos-acao`]: criar,
      });
      await abrirTiposDeAcao();

      fireEvent.click(screen.getByRole('button', { name: '+ Novo tipo de ação' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Novo tipo de ação' });
      expect(screen.getByLabelText('Nome da ação')).toHaveFocus();

      fireEvent.change(screen.getByLabelText('Nome da ação'), {
        target: { value: 'Doação de brinquedos' },
      });
      fireEvent.change(within(dialogo).getByLabelText('Unidade'), {
        target: { value: 'PECA' },
      });
      fireEvent.change(within(dialogo).getByLabelText('Pontos por unidade'), {
        target: { value: '8' },
      });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar tipo de ação' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Tipo de ação "Doação de brinquedos" cadastrado.',
      );
      expect(corpoDa(criar)).toEqual({
        nome: 'Doação de brinquedos',
        descricao: null,
        unidade: 'PECA',
        exigeEvidencia: true,
        pontosPorUnidade: 8,
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      const tabela = screen.getByRole('table', { name: 'Tipos de ação da gincana' });
      expect(await within(tabela).findByText('Doação de brinquedos')).toBeVisible();
    });

    it('exige o nome, aponta o campo e não chama a API', async () => {
      const { gincana, estado } = cenario();
      const criar = vi.fn(() => ({ status: 201, dados: {} }));
      comSessaoDeAdmin({
        ...rotasDeTiposDeAcao(estado),
        [`POST /gincanas/${gincana.id}/tipos-acao`]: criar,
      });
      await abrirTiposDeAcao();

      fireEvent.click(screen.getByRole('button', { name: '+ Novo tipo de ação' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Novo tipo de ação' });
      fireEvent.change(within(dialogo).getByLabelText('Pontos por unidade'), {
        target: { value: '10' },
      });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar tipo de ação' }));

      const campo = screen.getByLabelText('Nome da ação');
      expect(campo).toBeInvalid();
      expect(campo).toHaveAccessibleDescription('O nome precisa de pelo menos 2 caracteres.');
      expect(campo).toHaveFocus();
      expect(criar).not.toHaveBeenCalled();
    });

    it('aponta o nome repetido no campo Nome da ação', async () => {
      const { gincana, estado } = cenario();
      comSessaoDeAdmin({
        ...rotasDeTiposDeAcao(estado),
        [`POST /gincanas/${gincana.id}/tipos-acao`]: () => ({
          status: 409,
          dados: erroDaApi(
            'NOME_DE_TIPO_DUPLICADO',
            'Já existe um tipo de ação chamado "Doação de alimentos" nesta gincana.',
          ),
        }),
      });
      await abrirTiposDeAcao();

      fireEvent.click(screen.getByRole('button', { name: '+ Novo tipo de ação' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Novo tipo de ação' });
      fireEvent.change(screen.getByLabelText('Nome da ação'), {
        target: { value: 'Doação de alimentos' },
      });
      fireEvent.change(within(dialogo).getByLabelText('Pontos por unidade'), {
        target: { value: '10' },
      });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar tipo de ação' }));

      const campo = screen.getByLabelText('Nome da ação');
      await waitFor(() => {
        expect(campo).toHaveAccessibleDescription(
          'Já existe um tipo de ação chamado "Doação de alimentos" nesta gincana. Escolha outro nome.',
        );
      });
      expect(campo).toHaveFocus();
    });
  });

  describe('editar tipo de ação', () => {
    it('não mostra unidade nem pontos por unidade: a edição não muda o preço', async () => {
      const { estado, alimentos } = cenario();
      comSessaoDeAdmin(rotasDeTiposDeAcao(estado));
      await abrirTiposDeAcao();

      fireEvent.click(
        screen.getByRole('button', { name: `Editar tipo de ação ${alimentos.nome}` }),
      );
      const dialogo = await screen.findByRole('dialog', {
        name: `Editar tipo de ação ${alimentos.nome}`,
      });

      expect(within(dialogo).queryByLabelText('Unidade')).not.toBeInTheDocument();
      expect(within(dialogo).queryByLabelText('Pontos por unidade')).not.toBeInTheDocument();
    });

    it('edita o nome e a descrição e mostra o sucesso', async () => {
      const { estado, alimentos } = cenario();
      const atualizar = vi.fn((requisicao: InternalAxiosRequestConfig) => {
        const dados = JSON.parse(String(requisicao.data)) as {
          nome?: string;
          descricao?: string | null;
        };
        const atualizado = { ...alimentos, ...dados };
        estado.tipos[0] = atualizado;
        return { status: 200, dados: { ...atualizado, regras: [atualizado.regraVigente] } };
      });
      comSessaoDeAdmin({
        ...rotasDeTiposDeAcao(estado),
        [`PATCH /tipos-acao/${alimentos.id}`]: atualizar,
      });
      await abrirTiposDeAcao();

      fireEvent.click(
        screen.getByRole('button', { name: `Editar tipo de ação ${alimentos.nome}` }),
      );
      const dialogo = await screen.findByRole('dialog', {
        name: `Editar tipo de ação ${alimentos.nome}`,
      });

      fireEvent.change(within(dialogo).getByLabelText('Nome da ação'), {
        target: { value: 'Doação de alimentos não perecíveis' },
      });
      fireEvent.change(within(dialogo).getByLabelText('Descrição (opcional)'), {
        target: { value: 'Itens de cesta básica.' },
      });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Dados do tipo de ação "Doação de alimentos não perecíveis" atualizados.',
      );
      expect(corpoDa(atualizar)).toEqual({
        nome: 'Doação de alimentos não perecíveis',
        descricao: 'Itens de cesta básica.',
      });
    });
  });

  describe('pausar e reativar', () => {
    it('pausa um tipo ativo e depois reativa, sem modal de confirmação', async () => {
      const { estado, alimentos } = cenario();
      const atualizar = vi.fn((requisicao: InternalAxiosRequestConfig) => {
        const { ativo } = JSON.parse(String(requisicao.data)) as { ativo: boolean };
        const atual = estado.tipos[0] ?? alimentos;
        const atualizado: TipoAcao = { ...atual, ativo };
        estado.tipos[0] = atualizado;
        return { status: 200, dados: { ...atualizado, regras: [atualizado.regraVigente] } };
      });
      comSessaoDeAdmin({
        ...rotasDeTiposDeAcao(estado),
        [`PATCH /tipos-acao/${alimentos.id}`]: atualizar,
      });
      await abrirTiposDeAcao();

      fireEvent.click(
        screen.getByRole('button', { name: `Editar tipo de ação ${alimentos.nome}` }),
      );
      const dialogo = await screen.findByRole('dialog', {
        name: `Editar tipo de ação ${alimentos.nome}`,
      });
      // Sem modal: o botão age direto.
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Pausar tipo de ação' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        `O tipo de ação "${alimentos.nome}" foi pausado`,
      );
      expect(corpoDa(atualizar)).toEqual({ ativo: false });
      const tabela = screen.getByRole('table', { name: 'Tipos de ação da gincana' });
      await waitFor(() => {
        const linha = within(tabela)
          .getAllByRole('row')
          .find((row) => row.textContent?.includes(alimentos.nome));
        expect(linha).toHaveTextContent('Pausada');
      });

      fireEvent.click(
        screen.getByRole('button', { name: `Editar tipo de ação ${alimentos.nome}` }),
      );
      const dialogoDeNovo = await screen.findByRole('dialog', {
        name: `Editar tipo de ação ${alimentos.nome}`,
      });
      fireEvent.click(within(dialogoDeNovo).getByRole('button', { name: 'Reativar tipo de ação' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        `O tipo de ação "${alimentos.nome}" voltou a aceitar`,
      );
      expect(corpoDa(atualizar, 1)).toEqual({ ativo: true });
    });
  });

  describe('trocar a pontuação', () => {
    it('troca a pontuação e mostra o sucesso com o novo preço', async () => {
      const { estado, tampinhas } = cenario();
      const novaRegra = vi.fn((requisicao: InternalAxiosRequestConfig) => {
        const dados = JSON.parse(String(requisicao.data)) as {
          pontosPorUnidade: number;
          motivo?: string;
        };
        const regraAtual = tampinhas.regraVigente;
        const atualizado: TipoAcao = {
          ...tampinhas,
          regraVigente:
            regraAtual === null
              ? null
              : { ...regraAtual, pontosPorUnidade: dados.pontosPorUnidade },
        };
        estado.tipos[1] = atualizado;
        return { status: 201, dados: { ...atualizado, regras: [atualizado.regraVigente] } };
      });
      comSessaoDeAdmin({
        ...rotasDeTiposDeAcao(estado),
        [`POST /tipos-acao/${tampinhas.id}/regras`]: novaRegra,
      });
      await abrirTiposDeAcao();

      fireEvent.click(screen.getByRole('button', { name: `Nova pontuação de ${tampinhas.nome}` }));
      const dialogo = await screen.findByRole('dialog', {
        name: `Nova pontuação de ${tampinhas.nome}`,
      });

      const campo = within(dialogo).getByLabelText('Pontos por unidade');
      expect(campo).toHaveFocus();
      expect(within(dialogo).getByText(/3 kg de doação de tampinhas = 30 pts/i)).toBeVisible();

      fireEvent.change(campo, { target: { value: '12' } });
      expect(within(dialogo).getByText(/3 kg de doação de tampinhas = 36 pts/i)).toBeVisible();

      fireEvent.change(within(dialogo).getByLabelText('Motivo da mudança (opcional)'), {
        target: { value: 'Campanha reforçou a doação de tampinhas.' },
      });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar nova pontuação' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Nova pontuação de "Doação de tampinhas": 12 pts por kg.',
      );
      expect(corpoDa(novaRegra)).toEqual({
        pontosPorUnidade: 12,
        motivo: 'Campanha reforçou a doação de tampinhas.',
      });
    });

    it('mostra como aviso geral quando a vigência é anterior à regra atual', async () => {
      const { estado, tampinhas } = cenario();
      comSessaoDeAdmin({
        ...rotasDeTiposDeAcao(estado),
        [`POST /tipos-acao/${tampinhas.id}/regras`]: () => ({
          status: 409,
          dados: erroDaApi(
            'VIGENCIA_ANTERIOR_A_REGRA_ATUAL',
            'A nova pontuação não pode começar antes da regra que está valendo.',
          ),
        }),
      });
      await abrirTiposDeAcao();

      fireEvent.click(screen.getByRole('button', { name: `Nova pontuação de ${tampinhas.nome}` }));
      const dialogo = await screen.findByRole('dialog', {
        name: `Nova pontuação de ${tampinhas.nome}`,
      });
      fireEvent.change(within(dialogo).getByLabelText('Pontos por unidade'), {
        target: { value: '12' },
      });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar nova pontuação' }));

      const aviso = await within(dialogo).findByRole('alert');
      expect(aviso).toHaveTextContent(
        'A nova pontuação não pode começar antes da regra que está valendo.',
      );
      // O campo em si não é marcado como inválido: a recusa é uma decisão de negócio, não
      // um erro de preenchimento.
      expect(within(dialogo).getByLabelText('Pontos por unidade')).toBeValid();
    });
  });

  describe('líder', () => {
    it('não vê "+ Novo tipo de ação" nem "Nova pontuação", mas pausa um tipo ativo', async () => {
      const { estado, alimentos } = cenario();
      const atualizar = vi.fn((requisicao: InternalAxiosRequestConfig) => {
        const { ativo } = JSON.parse(String(requisicao.data)) as { ativo: boolean };
        const atualizado: TipoAcao = { ...alimentos, ativo };
        estado.tipos[0] = atualizado;
        return { status: 200, dados: { ...atualizado, regras: [atualizado.regraVigente] } };
      });
      comSessaoDe('LIDER', {
        ...rotasDeTiposDeAcao(estado),
        [`PATCH /tipos-acao/${alimentos.id}`]: atualizar,
      });

      await abrirTiposDeAcao();

      expect(screen.queryByRole('button', { name: '+ Novo tipo de ação' })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: `Nova pontuação de ${alimentos.nome}` }),
      ).not.toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('button', { name: `Ver situação do tipo de ação ${alimentos.nome}` }),
      );
      const dialogo = await screen.findByRole('dialog', {
        name: `Editar tipo de ação ${alimentos.nome}`,
      });

      // Identidade desabilitada, não oculta: o líder precisa ver o que está pausando.
      expect(within(dialogo).getByLabelText('Nome da ação')).toBeDisabled();
      expect(within(dialogo).getByLabelText('Descrição (opcional)')).toBeDisabled();
      expect(within(dialogo).getByRole('checkbox', { name: /exige comprovante/i })).toBeDisabled();
      expect(within(dialogo).queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
      expect(within(dialogo).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();

      fireEvent.click(within(dialogo).getByRole('button', { name: 'Pausar tipo de ação' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        `O tipo de ação "${alimentos.nome}" foi pausado`,
      );
      expect(corpoDa(atualizar)).toEqual({ ativo: false });
      // A ação conclui e fecha o diálogo sozinha, sem precisar do botão "Fechar".
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      const tabela = screen.getByRole('table', { name: 'Tipos de ação da gincana' });
      await waitFor(() => {
        const linha = within(tabela)
          .getAllByRole('row')
          .find((row) => row.textContent?.includes(alimentos.nome));
        expect(linha).toHaveTextContent('Pausada');
      });
    });

    it('a administradora segue vendo "+ Novo tipo de ação" e "Nova pontuação"', async () => {
      const { estado } = cenario();
      comSessaoDeAdmin(rotasDeTiposDeAcao(estado));

      await abrirTiposDeAcao();

      expect(screen.getByRole('button', { name: '+ Novo tipo de ação' })).toBeVisible();
    });
  });
});
