import type { Colaborador, Equipe } from '@gincana/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { erroDaApi } from '../../simulacao-da-api.js';
import {
  cenarioDoCadastro as cenario,
  comSessaoDeAdmin,
  rotasDeLeitura,
  umaEquipe,
  umaGincana,
} from '../../simulacao-do-cadastro.js';
import { pressionarEsc, renderizarNaRota } from '../../utilitarios-de-teste.js';

function corpoDa(chamada: ReturnType<typeof vi.fn>): unknown {
  const requisicao = chamada.mock.calls[0]?.[0] as InternalAxiosRequestConfig | undefined;
  return typeof requisicao?.data === 'string' ? JSON.parse(requisicao.data) : requisicao?.data;
}

async function abrirEquipes() {
  renderizarNaRota('/equipes');
  return screen.findByRole('table', { name: 'Equipes da gincana' });
}

describe('Equipes (US03)', () => {
  describe('lista', () => {
    it('mostra equipe, líder e número de colaboradores, sem inventar ações e pontos', async () => {
      const { estado } = cenario();
      comSessaoDeAdmin(rotasDeLeitura(estado));

      const tabela = await abrirEquipes();

      const linhas = within(tabela).getAllByRole('row').slice(1);
      expect(linhas).toHaveLength(2);
      // O banco devolve por ordem de nome; a tela mostra o que a API mandou.
      expect(linhas[0]).toHaveTextContent('Ipê');
      expect(linhas[0]).toHaveTextContent('Ana Exemplo');
      expect(linhas[1]).toHaveTextContent('Araucária');
      expect(
        within(tabela)
          .getAllByRole('columnheader')
          .map((c) => c.textContent),
      ).toEqual(['Equipe', 'Líder', 'Colaboradores', 'Ações']);
      expect(screen.getByText(/o total de colaboradores não conta o líder/i)).toBeVisible();
      expect(screen.getByText('Gincana 2026')).toBeVisible();
    });

    it('destaca a equipe que está sem líder', async () => {
      const { estado, ipe } = cenario();
      estado.equipes = [{ ...ipe, lider: null }];
      comSessaoDeAdmin(rotasDeLeitura(estado));

      const tabela = await abrirEquipes();

      expect(within(tabela).getByText('Sem líder')).toBeVisible();
    });

    it('explica o que fazer quando ainda não há equipe', async () => {
      const { estado } = cenario();
      estado.equipes = [];
      comSessaoDeAdmin(rotasDeLeitura(estado));

      renderizarNaRota('/equipes');

      expect(await screen.findByText('Nenhuma equipe ainda')).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Criar a primeira equipe' }));
      expect(await screen.findByRole('dialog', { name: 'Nova equipe' })).toBeVisible();
    });

    it('manda cadastrar a gincana quando ela ainda não existe', async () => {
      comSessaoDeAdmin(rotasDeLeitura({ gincanas: [], equipes: [], colaboradores: [] }));

      renderizarNaRota('/equipes');

      expect(await screen.findByText('Cadastre a gincana antes das equipes')).toBeVisible();
      expect(screen.getByRole('link', { name: 'Ir para Gincanas' })).toHaveAttribute(
        'href',
        '/gincanas',
      );
      expect(screen.queryByRole('button', { name: '+ Nova equipe' })).not.toBeInTheDocument();
    });

    it('avisa em português quando as equipes não carregam', async () => {
      const { gincana, estado } = cenario();
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`GET /gincanas/${gincana.id}/equipes`]: () => ({ status: 500 }),
      });

      renderizarNaRota('/equipes');

      expect(await screen.findByRole('alert')).toHaveTextContent(/servidor está com problemas/i);
      expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled();
    });
  });

  describe('criar equipe', () => {
    it('cria a equipe com líder, confirma e atualiza a lista sozinha', async () => {
      const { gincana, estado, carla } = cenario();
      const criar = vi.fn((requisicao: InternalAxiosRequestConfig) => {
        const dados = JSON.parse(String(requisicao.data)) as { nome: string; liderId: string };
        const nova = umaEquipe(gincana.id, dados.nome, {
          lider: { id: carla.id, nome: carla.nome },
        });
        estado.equipes.push(nova);
        return { status: 201, dados: nova };
      });
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`POST /gincanas/${gincana.id}/equipes`]: criar,
      });
      await abrirEquipes();

      fireEvent.click(screen.getByRole('button', { name: '+ Nova equipe' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Nova equipe' });
      expect(screen.getByLabelText('Nome da equipe')).toHaveFocus();
      fireEvent.change(screen.getByLabelText('Nome da equipe'), { target: { value: 'Jacarandá' } });
      fireEvent.change(await within(dialogo).findByLabelText('Líder da equipe'), {
        target: { value: carla.id },
      });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar equipe' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Equipe Jacarandá criada. Líder: Carla Exemplo.',
      );
      expect(corpoDa(criar)).toEqual({ nome: 'Jacarandá', liderId: carla.id });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      const tabela = screen.getByRole('table', { name: 'Equipes da gincana' });
      expect(await within(tabela).findByText('Jacarandá')).toBeVisible();
    });

    it('cria a equipe sem líder quando a administradora ainda não escolheu', async () => {
      const { gincana, estado } = cenario();
      const criar = vi.fn(() => ({
        status: 201,
        dados: umaEquipe(gincana.id, 'Figueira'),
      }));
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`POST /gincanas/${gincana.id}/equipes`]: criar,
      });
      await abrirEquipes();

      fireEvent.click(screen.getByRole('button', { name: '+ Nova equipe' }));
      await screen.findByRole('dialog', { name: 'Nova equipe' });
      fireEvent.change(screen.getByLabelText('Nome da equipe'), { target: { value: 'Figueira' } });
      fireEvent.click(screen.getByRole('button', { name: 'Criar equipe' }));

      expect(await screen.findByRole('status')).toHaveTextContent('Equipe Figueira criada.');
      expect(corpoDa(criar)).toEqual({ nome: 'Figueira', liderId: null });
    });

    it('exige o nome, aponta o campo e não chama a API', async () => {
      const { gincana, estado } = cenario();
      const criar = vi.fn(() => ({ status: 201, dados: umaEquipe(gincana.id, 'X') }));
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`POST /gincanas/${gincana.id}/equipes`]: criar,
      });
      await abrirEquipes();

      fireEvent.click(screen.getByRole('button', { name: '+ Nova equipe' }));
      await screen.findByRole('dialog', { name: 'Nova equipe' });
      fireEvent.click(screen.getByRole('button', { name: 'Criar equipe' }));

      const campo = screen.getByLabelText('Nome da equipe');
      expect(campo).toBeInvalid();
      expect(campo).toHaveAccessibleDescription('O nome precisa de pelo menos 2 caracteres.');
      expect(campo).toHaveFocus();
      expect(criar).not.toHaveBeenCalled();
    });

    it('aponta o nome repetido no campo Nome da equipe', async () => {
      const { gincana, estado } = cenario();
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`POST /gincanas/${gincana.id}/equipes`]: () => ({
          status: 409,
          dados: erroDaApi(
            'NOME_DE_EQUIPE_DUPLICADO',
            'Já existe uma equipe chamada "Ipê" nesta gincana.',
          ),
        }),
      });
      await abrirEquipes();

      fireEvent.click(screen.getByRole('button', { name: '+ Nova equipe' }));
      await screen.findByRole('dialog', { name: 'Nova equipe' });
      fireEvent.change(screen.getByLabelText('Nome da equipe'), { target: { value: 'Ipê' } });
      fireEvent.click(screen.getByRole('button', { name: 'Criar equipe' }));

      const campo = screen.getByLabelText('Nome da equipe');
      await waitFor(() => {
        expect(campo).toHaveAccessibleDescription(
          'Já existe uma equipe chamada "Ipê" nesta gincana. Escolha outro nome.',
        );
      });
      expect(campo).toHaveFocus();
    });
  });

  describe('trocar o líder', () => {
    it('troca o líder, explica o efeito antes de salvar e confirma depois', async () => {
      const { estado, ipe, ana, carla } = cenario();
      const atualizar = vi.fn(() => {
        estado.equipes[0] = { ...ipe, lider: { id: carla.id, nome: carla.nome } };
        return { status: 200, dados: estado.equipes[0] };
      });
      comSessaoDeAdmin({ ...rotasDeLeitura(estado), [`PATCH /equipes/${ipe.id}`]: atualizar });
      await abrirEquipes();

      fireEvent.click(screen.getByRole('button', { name: 'Editar equipe Ipê' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Editar equipe Ipê' });
      const lider = await within(dialogo).findByLabelText('Líder da equipe');
      await waitFor(() => {
        expect(lider).toHaveValue(ana.id);
      });

      fireEvent.change(lider, { target: { value: carla.id } });

      // Antes de salvar a tela diz o que acontece com Carla e com quem lidera hoje.
      expect(lider).toHaveAccessibleDescription(
        'Carla Exemplo passa a integrar esta equipe ao virar líder. Ana Exemplo deixa de liderar e continua na equipe.',
      );

      fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Carla Exemplo agora lidera a equipe Ipê.',
      );
      // Só o líder mudou: o nome não vai na requisição.
      expect(corpoDa(atualizar)).toEqual({ liderId: carla.id });
      const tabela = screen.getByRole('table', { name: 'Equipes da gincana' });
      await waitFor(() => {
        expect(within(tabela).getAllByRole('row')[1]).toHaveTextContent('Carla Exemplo');
      });
    });

    it('deixa a equipe sem líder quando a administradora escolhe "Sem líder"', async () => {
      const { estado, ipe, ana } = cenario();
      const atualizar = vi.fn(() => ({ status: 200, dados: { ...ipe, lider: null } }));
      comSessaoDeAdmin({ ...rotasDeLeitura(estado), [`PATCH /equipes/${ipe.id}`]: atualizar });
      await abrirEquipes();

      fireEvent.click(screen.getByRole('button', { name: 'Editar equipe Ipê' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Editar equipe Ipê' });
      const lider = await within(dialogo).findByLabelText('Líder da equipe');
      await waitFor(() => {
        expect(lider).toHaveValue(ana.id);
      });
      fireEvent.change(lider, { target: { value: '' } });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

      expect(await screen.findByRole('status')).toHaveTextContent('A equipe Ipê ficou sem líder.');
      expect(corpoDa(atualizar)).toEqual({ liderId: null });
    });

    it('não oferece quem já lidera outra equipe, e diz qual', async () => {
      const { estado } = cenario();
      comSessaoDeAdmin(rotasDeLeitura(estado));
      await abrirEquipes();

      fireEvent.click(screen.getByRole('button', { name: 'Editar equipe Ipê' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Editar equipe Ipê' });
      await within(dialogo).findByRole('option', { name: 'Carla Exemplo' });

      expect(
        within(dialogo).getByRole('option', {
          name: 'Davi Exemplo (já lidera a equipe Araucária)',
        }),
      ).toBeDisabled();
      expect(within(dialogo).getByRole('option', { name: 'Carla Exemplo' })).toBeEnabled();
      // Quem está desativado não pode liderar.
      expect(within(dialogo).queryByRole('option', { name: /Elisa/ })).not.toBeInTheDocument();
    });

    it('mostra no campo Líder a recusa da API quando a pessoa lidera uma equipe de outra gincana', async () => {
      const { estado, ipe, carla } = cenario();
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`PATCH /equipes/${ipe.id}`]: () => ({
          status: 409,
          dados: erroDaApi(
            'JA_LIDERA_OUTRA_EQUIPE',
            'Carla Exemplo já lidera a equipe "Pitanga". Troque o líder de lá antes de trazer esta pessoa.',
          ),
        }),
      });
      await abrirEquipes();

      fireEvent.click(screen.getByRole('button', { name: 'Editar equipe Ipê' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Editar equipe Ipê' });
      const lider = await within(dialogo).findByLabelText('Líder da equipe');
      await within(dialogo).findByRole('option', { name: 'Carla Exemplo' });
      fireEvent.change(lider, { target: { value: carla.id } });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

      await waitFor(() => {
        expect(lider).toBeInvalid();
      });
      expect(lider).toHaveAccessibleDescription(
        expect.stringContaining('Troque o líder de lá antes de trazer esta pessoa.'),
      );
      expect(lider).toHaveFocus();
    });
  });

  describe('vincular e remover colaboradores', () => {
    async function abrirColaboradoresDaIpe() {
      fireEvent.click(await screen.findByRole('button', { name: 'Colaboradores da equipe Ipê' }));
      return screen.findByRole('dialog', { name: 'Colaboradores da equipe Ipê' });
    }

    it('lista quem está na equipe e marca o líder, que não tem botão Remover', async () => {
      const { estado } = cenario();
      comSessaoDeAdmin(rotasDeLeitura(estado));
      await abrirEquipes();

      const dialogo = await abrirColaboradoresDaIpe();

      const lista = await within(dialogo).findByRole('list', {
        name: 'Colaboradores da equipe Ipê',
      });
      const itens = within(lista).getAllByRole('listitem');
      expect(itens).toHaveLength(2);
      expect(itens[0]).toHaveTextContent('Ana Exemplo');
      expect(itens[0]).toHaveTextContent('Líder');
      expect(itens[0]).toHaveTextContent('Para tirar da equipe, troque antes o líder.');
      expect(within(itens[0] as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
      expect(
        within(dialogo).getByRole('button', { name: 'Remover Bruno Exemplo da equipe' }),
      ).toBeVisible();
    });

    it('vincula um colaborador à equipe e ele aparece na lista', async () => {
      const { estado, ipe, carla } = cenario();
      const vincular = vi.fn((requisicao: InternalAxiosRequestConfig) => {
        const { colaboradorIds } = JSON.parse(String(requisicao.data)) as {
          colaboradorIds: string[];
        };
        const pessoa = estado.colaboradores.find((c) => c.id === colaboradorIds[0]) as Colaborador;
        pessoa.equipe = { id: ipe.id, nome: ipe.nome };
        return { status: 200, dados: { ...ipe, totalMembros: 2 } as Equipe };
      });
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`POST /equipes/${ipe.id}/membros`]: vincular,
      });
      await abrirEquipes();

      const dialogo = await abrirColaboradoresDaIpe();
      fireEvent.click(
        await within(dialogo).findByRole('button', { name: 'Vincular colaboradores' }),
      );

      // Só aparece quem pode entrar: Bruno já está, Elisa está desativada.
      const caixa = await within(dialogo).findByRole('checkbox', { name: 'Carla Exemplo' });
      expect(within(dialogo).queryByRole('checkbox', { name: /Bruno/ })).not.toBeInTheDocument();
      expect(within(dialogo).queryByRole('checkbox', { name: /Elisa/ })).not.toBeInTheDocument();
      expect(caixa).toHaveAccessibleDescription('Sem equipe.');

      fireEvent.click(caixa);
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Vincular 1' }));

      expect(await within(dialogo).findByRole('status')).toHaveTextContent(
        '1 colaborador vinculado à equipe Ipê.',
      );
      expect(corpoDa(vincular)).toEqual({ colaboradorIds: [carla.id] });
      // Voltou para a lista, já com Carla.
      const lista = await within(dialogo).findByRole('list', {
        name: 'Colaboradores da equipe Ipê',
      });
      await waitFor(() => {
        expect(within(lista).getByText('Carla Exemplo')).toBeVisible();
      });
    });

    it('mantém o foco dentro da janela ao alternar entre a lista e a escolha de quem entra', async () => {
      const { estado } = cenario();
      comSessaoDeAdmin(rotasDeLeitura(estado));
      await abrirEquipes();

      const dialogo = await abrirColaboradoresDaIpe();
      const vincular = await within(dialogo).findByRole('button', {
        name: 'Vincular colaboradores',
      });
      expect(vincular).toHaveFocus();

      fireEvent.click(vincular);

      // O botão que tinha o foco saiu da tela: o foco vai para a primeira caixa livre.
      const carla = await within(dialogo).findByRole('checkbox', { name: 'Carla Exemplo' });
      await waitFor(() => {
        expect(carla).toHaveFocus();
      });

      fireEvent.click(within(dialogo).getByRole('button', { name: 'Voltar' }));

      expect(
        await within(dialogo).findByRole('button', { name: 'Vincular colaboradores' }),
      ).toHaveFocus();
    });

    it('avisa de quem será movido e bloqueia quem lidera outra equipe', async () => {
      const { estado, bruno } = cenario();
      // Bruno sai da Ipê para o teste e fica na Araucária, de onde seria movido.
      bruno.equipe = { id: estado.equipes[1]?.id ?? '', nome: 'Araucária' };
      comSessaoDeAdmin(rotasDeLeitura(estado));
      await abrirEquipes();

      const dialogo = await abrirColaboradoresDaIpe();
      fireEvent.click(
        await within(dialogo).findByRole('button', { name: 'Vincular colaboradores' }),
      );

      const caixaDoBruno = await within(dialogo).findByRole('checkbox', { name: 'Bruno Exemplo' });
      expect(caixaDoBruno).toHaveAccessibleDescription(
        'Hoje na equipe Araucária; será movido para esta.',
      );
      const caixaDoDavi = within(dialogo).getByRole('checkbox', { name: 'Davi Exemplo' });
      expect(caixaDoDavi).toBeDisabled();
      expect(caixaDoDavi).toHaveAccessibleDescription(
        'Lidera a equipe Araucária. Troque o líder de lá antes de mover.',
      );
    });

    it('pede para selecionar alguém antes de vincular, sem chamar a API', async () => {
      const { estado, ipe } = cenario();
      const vincular = vi.fn(() => ({ status: 200, dados: ipe }));
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`POST /equipes/${ipe.id}/membros`]: vincular,
      });
      await abrirEquipes();

      const dialogo = await abrirColaboradoresDaIpe();
      fireEvent.click(
        await within(dialogo).findByRole('button', { name: 'Vincular colaboradores' }),
      );
      await within(dialogo).findByRole('checkbox', { name: 'Carla Exemplo' });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Vincular' }));

      expect(within(dialogo).getByRole('group')).toHaveAccessibleDescription(
        'Selecione ao menos um colaborador.',
      );
      expect(vincular).not.toHaveBeenCalled();
    });

    it('mostra a recusa da API e orienta quando alguém lidera outra equipe', async () => {
      const { estado, ipe } = cenario();
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`POST /equipes/${ipe.id}/membros`]: () => ({
          status: 409,
          dados: erroDaApi(
            'LIDERA_OUTRA_EQUIPE',
            'Carla Exemplo lidera outra equipe. Troque o líder de lá antes de mover.',
          ),
        }),
      });
      await abrirEquipes();

      const dialogo = await abrirColaboradoresDaIpe();
      fireEvent.click(
        await within(dialogo).findByRole('button', { name: 'Vincular colaboradores' }),
      );
      fireEvent.click(await within(dialogo).findByRole('checkbox', { name: 'Carla Exemplo' }));
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Vincular 1' }));

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
        'Desmarque essa pessoa ou troque o líder da equipe dela antes.',
      );
      // A seleção continua: a pessoa só precisa desmarcar quem causou o problema.
      expect(within(dialogo).getByRole('checkbox', { name: 'Carla Exemplo' })).toBeChecked();
    });

    it('só remove o vínculo depois da confirmação', async () => {
      const { estado, ipe, bruno } = cenario();
      const remover = vi.fn(() => {
        bruno.equipe = null;
        return { status: 204 };
      });
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`DELETE /equipes/${ipe.id}/membros/${bruno.id}`]: remover,
      });
      await abrirEquipes();

      const dialogo = await abrirColaboradoresDaIpe();
      fireEvent.click(
        await within(dialogo).findByRole('button', { name: 'Remover Bruno Exemplo da equipe' }),
      );

      const confirmacao = await screen.findByRole('dialog', {
        name: 'Remover Bruno Exemplo da equipe?',
      });
      expect(confirmacao).toHaveAccessibleDescription(
        'Bruno Exemplo continua cadastrado, mas deixa de fazer parte da equipe Ipê. Você pode vincular de novo quando quiser.',
      );
      // O foco começa em Cancelar: confirmar por engano não é o caminho mais curto.
      expect(within(confirmacao).getByRole('button', { name: 'Cancelar' })).toHaveFocus();

      fireEvent.click(within(confirmacao).getByRole('button', { name: 'Cancelar' }));
      expect(remover).not.toHaveBeenCalled();

      fireEvent.click(
        within(dialogo).getByRole('button', { name: 'Remover Bruno Exemplo da equipe' }),
      );
      fireEvent.click(
        within(
          await screen.findByRole('dialog', { name: 'Remover Bruno Exemplo da equipe?' }),
        ).getByRole('button', { name: 'Remover da equipe' }),
      );

      expect(await within(dialogo).findByRole('status')).toHaveTextContent(
        'Bruno Exemplo saiu da equipe Ipê.',
      );
      expect(remover).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(within(dialogo).queryByText('Bruno Exemplo')).not.toBeInTheDocument();
      });
    });

    it('com Esc na confirmação, fecha só a confirmação e deixa a lista de colaboradores aberta', async () => {
      const { estado } = cenario();
      comSessaoDeAdmin(rotasDeLeitura(estado));
      await abrirEquipes();

      const dialogo = await abrirColaboradoresDaIpe();
      fireEvent.click(
        await within(dialogo).findByRole('button', { name: 'Remover Bruno Exemplo da equipe' }),
      );
      const confirmacao = await screen.findByRole('dialog', {
        name: 'Remover Bruno Exemplo da equipe?',
      });

      pressionarEsc(confirmacao);

      expect(screen.queryByRole('dialog', { name: 'Remover Bruno Exemplo da equipe?' })).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Colaboradores da equipe Ipê' })).toBeVisible();
    });

    it('explica o que fazer quando a API recusa remover quem lidera a equipe', async () => {
      const { estado, ipe, bruno } = cenario();
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`DELETE /equipes/${ipe.id}/membros/${bruno.id}`]: () => ({
          status: 409,
          dados: erroDaApi(
            'LIDER_DA_EQUIPE',
            'Bruno Exemplo lidera a equipe Ipê. Troque o líder antes de remover.',
          ),
        }),
      });
      await abrirEquipes();

      const dialogo = await abrirColaboradoresDaIpe();
      fireEvent.click(
        await within(dialogo).findByRole('button', { name: 'Remover Bruno Exemplo da equipe' }),
      );
      const confirmacao = await screen.findByRole('dialog', {
        name: 'Remover Bruno Exemplo da equipe?',
      });
      fireEvent.click(within(confirmacao).getByRole('button', { name: 'Remover da equipe' }));

      expect(await within(confirmacao).findByRole('alert')).toHaveTextContent(
        'Bruno Exemplo lidera a equipe Ipê. Troque o líder antes de remover. Feche esta janela, use Editar na equipe e escolha outro líder.',
      );
    });
  });

  it('usa o identificador da gincana escolhida na barra de endereço', async () => {
    const { estado } = cenario();
    const antiga = umaGincana({ ano: 2025, nome: 'Gincana Solidária 2025', status: 'ENCERRADA' });
    estado.gincanas.push(antiga);
    const equipeAntiga = umaEquipe(antiga.id, 'Pitanga');
    estado.equipes.push(equipeAntiga);
    comSessaoDeAdmin(rotasDeLeitura(estado));

    renderizarNaRota(`/equipes?gincana=${antiga.id}`);

    const tabela = await screen.findByRole('table', { name: 'Equipes da gincana' });
    expect(within(tabela).getByText('Pitanga')).toBeVisible();
    expect(within(tabela).queryByText('Ipê')).not.toBeInTheDocument();
    expect(screen.getByText('Gincana 2025')).toBeVisible();
  });
});
