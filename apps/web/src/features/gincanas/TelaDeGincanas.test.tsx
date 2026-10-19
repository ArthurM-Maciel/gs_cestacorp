import type { Gincana } from '@gincana/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { erroDaApi, falhaDeRede } from '../../simulacao-da-api.js';
import {
  comSessaoDeAdmin,
  novoId,
  rotasDeLeitura,
  umaGincana,
} from '../../simulacao-do-cadastro.js';
import { pressionarEsc, renderizarNaRota } from '../../utilitarios-de-teste.js';

function preencher(rotulo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

async function abrirNovaGincana() {
  fireEvent.click(await screen.findByRole('button', { name: '+ Nova gincana' }));
  return screen.findByRole('dialog', { name: 'Nova gincana' });
}

function corpoDa(chamada: ReturnType<typeof vi.fn>): unknown {
  const requisicao = chamada.mock.calls[0]?.[0] as InternalAxiosRequestConfig | undefined;
  return typeof requisicao?.data === 'string' ? JSON.parse(requisicao.data) : requisicao?.data;
}

describe('Gincanas (US02)', () => {
  describe('lista', () => {
    it('mostra o carregamento enquanto a API responde', async () => {
      let responder: () => void = () => undefined;
      const espera = new Promise<void>((resolver) => {
        responder = resolver;
      });
      comSessaoDeAdmin({
        'GET /gincanas': async () => {
          await espera;
          return { status: 200, dados: [] };
        },
      });

      renderizarNaRota('/gincanas');

      expect(await screen.findByText('Carregando as gincanas…')).toBeVisible();
      responder();
      expect(await screen.findByText('Nenhuma gincana cadastrada ainda')).toBeVisible();
    });

    it('mostra ano, nome, período e situação de cada gincana', async () => {
      const atual = umaGincana();
      const passada = umaGincana({
        ano: 2025,
        nome: 'Gincana Solidária 2025',
        dataInicio: '2025-03-03',
        dataFim: '2025-04-04',
        status: 'ENCERRADA',
      });
      comSessaoDeAdmin(
        rotasDeLeitura({ gincanas: [atual, passada], equipes: [], colaboradores: [] }),
      );

      renderizarNaRota('/gincanas');

      const tabela = await screen.findByRole('table', { name: 'Gincanas cadastradas' });
      const linhas = within(tabela).getAllByRole('row').slice(1);
      expect(linhas).toHaveLength(2);
      expect(linhas[0]).toHaveTextContent('2026');
      expect(linhas[0]).toHaveTextContent('Gincana Solidária 2026');
      // A data aparece como no Brasil, sem passar por fuso horário.
      expect(linhas[0]).toHaveTextContent('28/10/2026 a 19/11/2026');
      expect(linhas[0]).toHaveTextContent('Ativa');
      expect(linhas[1]).toHaveTextContent('Encerrada');
    });

    it('explica o que fazer quando ainda não há gincana', async () => {
      comSessaoDeAdmin(rotasDeLeitura({ gincanas: [], equipes: [], colaboradores: [] }));

      renderizarNaRota('/gincanas');

      expect(await screen.findByText('Nenhuma gincana cadastrada ainda')).toBeVisible();
      expect(screen.getByText(/cadastre a gincana do ano com o período/i)).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: 'Cadastrar a primeira gincana' }));
      expect(await screen.findByRole('dialog', { name: 'Nova gincana' })).toBeVisible();
    });

    it('avisa em português quando a lista não carrega e permite tentar de novo', async () => {
      let tentativas = 0;
      comSessaoDeAdmin({
        'GET /gincanas': (requisicao) => {
          tentativas += 1;
          return tentativas === 1
            ? falhaDeRede(requisicao)
            : { status: 200, dados: [umaGincana()] };
        },
      });

      renderizarNaRota('/gincanas');

      expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível conectar/i);
      expect(screen.queryByText(/network error/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

      expect(await screen.findByText('Gincana Solidária 2026')).toBeVisible();
    });
  });

  describe('criar', () => {
    it('cadastra a gincana, fecha o formulário, confirma e atualiza a lista sozinha', async () => {
      const estado = { gincanas: [umaGincana()], equipes: [], colaboradores: [] };
      const criar = vi.fn((requisicao: InternalAxiosRequestConfig) => {
        const dados = JSON.parse(String(requisicao.data)) as Omit<Gincana, 'id' | 'status'>;
        estado.gincanas.unshift({ id: novoId(), status: 'PLANEJADA', ...dados });
        return { status: 201, dados: estado.gincanas[0] };
      });
      comSessaoDeAdmin({ ...rotasDeLeitura(estado), 'POST /gincanas': criar });
      renderizarNaRota('/gincanas');
      await screen.findByText('Gincana Solidária 2026');

      const dialogo = await abrirNovaGincana();
      preencher('Ano', '2027');
      preencher('Nome da gincana', 'Gincana Solidária 2027');
      preencher('Data de início', '2027-10-27');
      preencher('Data de término', '2027-11-18');
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar gincana' }));

      expect(await screen.findByRole('status')).toHaveTextContent('Gincana de 2027 cadastrada.');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(corpoDa(criar)).toEqual({
        ano: 2027,
        nome: 'Gincana Solidária 2027',
        dataInicio: '2027-10-27',
        dataFim: '2027-11-18',
      });
      // A lista nova veio da invalidação, sem recarregar a página.
      expect(await screen.findByText('Gincana Solidária 2027')).toBeVisible();
    });

    it('aponta o ano duplicado no campo Ano e mantém o que foi digitado', async () => {
      comSessaoDeAdmin({
        ...rotasDeLeitura({ gincanas: [umaGincana()], equipes: [], colaboradores: [] }),
        'POST /gincanas': () => ({
          status: 409,
          dados: erroDaApi(
            'ANO_JA_CADASTRADO',
            'Já existe uma gincana cadastrada para o ano de 2026.',
          ),
        }),
      });
      renderizarNaRota('/gincanas');

      const dialogo = await abrirNovaGincana();
      preencher('Ano', '2026');
      preencher('Nome da gincana', 'Outra gincana');
      preencher('Data de início', '2026-10-28');
      preencher('Data de término', '2026-11-19');
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar gincana' }));

      const campo = await screen.findByLabelText('Ano');
      await waitFor(() => {
        expect(campo).toBeInvalid();
      });
      // O erro é do campo, não um aviso solto no topo: o leitor de tela o lê junto do campo.
      expect(campo).toHaveAccessibleDescription(
        'Já existe uma gincana cadastrada para o ano de 2026. Edite a gincana desse ano na lista ou escolha outro ano.',
      );
      expect(campo).toHaveFocus();
      expect(screen.getByLabelText('Nome da gincana')).toHaveValue('Outra gincana');
      expect(screen.getByRole('dialog', { name: 'Nova gincana' })).toBeVisible();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('aponta o período invertido no campo Data de término, sem chamar a API', async () => {
      const criar = vi.fn(() => ({ status: 201, dados: umaGincana() }));
      comSessaoDeAdmin({
        ...rotasDeLeitura({ gincanas: [], equipes: [], colaboradores: [] }),
        'POST /gincanas': criar,
      });
      renderizarNaRota('/gincanas');

      await abrirNovaGincana();
      preencher('Nome da gincana', 'Gincana Solidária 2026');
      preencher('Data de início', '2026-11-19');
      preencher('Data de término', '2026-10-28');
      fireEvent.click(screen.getByRole('button', { name: 'Criar gincana' }));

      const termino = screen.getByLabelText('Data de término');
      expect(termino).toBeInvalid();
      expect(termino).toHaveAccessibleDescription(
        'A data de término não pode ser anterior à de início.',
      );
      expect(termino).toHaveFocus();
      expect(screen.getByLabelText('Data de início')).toBeValid();
      expect(criar).not.toHaveBeenCalled();
    });

    it('mostra no campo de término o erro de período que só a API percebe', async () => {
      // Outra pessoa mudou a data de início depois de a lista carregar: no navegador o
      // período parece válido, mas o servidor conhece a data nova e recusa.
      const gincana = umaGincana();
      comSessaoDeAdmin({
        ...rotasDeLeitura({ gincanas: [gincana], equipes: [], colaboradores: [] }),
        [`PATCH /gincanas/${gincana.id}`]: () => ({
          status: 400,
          dados: erroDaApi('DADOS_INVALIDOS', 'Confira os campos informados.', {
            dataFim: ['A data de término não pode ser anterior à de início.'],
          }),
        }),
      });
      renderizarNaRota('/gincanas');

      fireEvent.click(await screen.findByRole('button', { name: 'Editar gincana 2026' }));
      preencher('Data de término', '2026-11-20');
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

      const termino = await screen.findByLabelText('Data de término');
      await waitFor(() => {
        expect(termino).toHaveAccessibleDescription(
          'A data de término não pode ser anterior à de início.',
        );
      });
      expect(termino).toHaveFocus();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('pede o que falta nos campos obrigatórios, um aviso em cada campo', async () => {
      const criar = vi.fn(() => ({ status: 201, dados: umaGincana() }));
      comSessaoDeAdmin({
        ...rotasDeLeitura({ gincanas: [], equipes: [], colaboradores: [] }),
        'POST /gincanas': criar,
      });
      renderizarNaRota('/gincanas');

      await abrirNovaGincana();
      preencher('Ano', '');
      fireEvent.click(screen.getByRole('button', { name: 'Criar gincana' }));

      expect(screen.getByLabelText('Ano')).toHaveAccessibleDescription(
        'Informe o ano da gincana, só com números.',
      );
      expect(screen.getByLabelText('Nome da gincana')).toHaveAccessibleDescription(
        'O nome precisa de pelo menos 3 caracteres.',
      );
      expect(screen.getByLabelText('Data de início')).toHaveAccessibleDescription(
        'Informe uma data válida.',
      );
      expect(screen.getByLabelText('Data de término')).toHaveAccessibleDescription(
        'Informe uma data válida.',
      );
      expect(criar).not.toHaveBeenCalled();
    });

    it('avisa em português, dentro do formulário, quando a rede cai ao salvar', async () => {
      comSessaoDeAdmin({
        ...rotasDeLeitura({ gincanas: [], equipes: [], colaboradores: [] }),
        'POST /gincanas': falhaDeRede,
      });
      renderizarNaRota('/gincanas');

      await abrirNovaGincana();
      preencher('Nome da gincana', 'Gincana Solidária 2026');
      preencher('Data de início', '2026-10-28');
      preencher('Data de término', '2026-11-19');
      fireEvent.click(screen.getByRole('button', { name: 'Criar gincana' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível conectar/i);
      // Quem perdeu a conexão não perde o que digitou e pode tentar de novo.
      expect(screen.getByLabelText('Nome da gincana')).toHaveValue('Gincana Solidária 2026');
      expect(screen.getByRole('button', { name: 'Criar gincana' })).toBeEnabled();
    });
  });

  describe('editar', () => {
    it('envia só o que mudou e mantém o ano travado', async () => {
      const gincana = umaGincana();
      const atualizar = vi.fn(() => ({
        status: 200,
        dados: { ...gincana, nome: 'Gincana do Bem 2026' },
      }));
      comSessaoDeAdmin({
        ...rotasDeLeitura({ gincanas: [gincana], equipes: [], colaboradores: [] }),
        [`PATCH /gincanas/${gincana.id}`]: atualizar,
      });
      renderizarNaRota('/gincanas');

      fireEvent.click(await screen.findByRole('button', { name: 'Editar gincana 2026' }));

      const ano = screen.getByLabelText('Ano');
      expect(ano).toBeDisabled();
      expect(ano).toHaveValue(2026);
      expect(screen.getByLabelText('Nome da gincana')).toHaveFocus();

      preencher('Nome da gincana', 'Gincana do Bem 2026');
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

      expect(await screen.findByRole('status')).toHaveTextContent('Gincana de 2026 atualizada.');
      expect(corpoDa(atualizar)).toEqual({ nome: 'Gincana do Bem 2026' });
    });

    it('fecha sem chamar a API quando nada mudou', async () => {
      const gincana = umaGincana();
      const atualizar = vi.fn(() => ({ status: 200, dados: gincana }));
      comSessaoDeAdmin({
        ...rotasDeLeitura({ gincanas: [gincana], equipes: [], colaboradores: [] }),
        [`PATCH /gincanas/${gincana.id}`]: atualizar,
      });
      renderizarNaRota('/gincanas');

      fireEvent.click(await screen.findByRole('button', { name: 'Editar gincana 2026' }));
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(atualizar).not.toHaveBeenCalled();
    });
  });

  describe('fechar o formulário', () => {
    it('fecha com o botão Fechar e com Esc, sem gravar nada', async () => {
      const criar = vi.fn(() => ({ status: 201, dados: umaGincana() }));
      comSessaoDeAdmin({
        ...rotasDeLeitura({ gincanas: [umaGincana()], equipes: [], colaboradores: [] }),
        'POST /gincanas': criar,
      });
      renderizarNaRota('/gincanas');
      await screen.findByText('Gincana Solidária 2026');

      const dialogo = await abrirNovaGincana();
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Fechar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      pressionarEsc(await abrirNovaGincana());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(criar).not.toHaveBeenCalled();
    });

    it('devolve o foco ao botão que abriu o formulário, para quem navega pelo teclado', async () => {
      comSessaoDeAdmin(
        rotasDeLeitura({ gincanas: [umaGincana()], equipes: [], colaboradores: [] }),
      );
      renderizarNaRota('/gincanas');
      const abrir = await screen.findByRole('button', { name: '+ Nova gincana' });

      for (const botao of ['Cancelar', 'Fechar']) {
        abrir.focus();
        fireEvent.click(abrir);
        const dialogo = await screen.findByRole('dialog', { name: 'Nova gincana' });
        fireEvent.click(within(dialogo).getByRole('button', { name: botao }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(abrir).toHaveFocus();
        abrir.blur();
      }
    });

    it('não deixa fechar enquanto a gravação está em andamento', async () => {
      let responder: () => void = () => undefined;
      const espera = new Promise<void>((resolver) => {
        responder = resolver;
      });
      comSessaoDeAdmin({
        ...rotasDeLeitura({ gincanas: [], equipes: [], colaboradores: [] }),
        'POST /gincanas': async () => {
          await espera;
          return { status: 201, dados: umaGincana() };
        },
      });
      renderizarNaRota('/gincanas');

      const dialogo = await abrirNovaGincana();
      preencher('Nome da gincana', 'Gincana Solidária 2026');
      preencher('Data de início', '2026-10-28');
      preencher('Data de término', '2026-11-19');
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar gincana' }));

      expect(await within(dialogo).findByRole('button', { name: 'Salvando…' })).toBeDisabled();
      pressionarEsc(dialogo);
      expect(screen.getByRole('dialog', { name: 'Nova gincana' })).toBeVisible();

      responder();
      expect(await screen.findByRole('status')).toHaveTextContent('Gincana de 2026 cadastrada.');
    });
  });
});
