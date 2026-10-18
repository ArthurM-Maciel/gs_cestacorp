import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { erroDaApi } from '../../simulacao-da-api.js';
import {
  cenarioDoCadastro,
  comSessaoDeAdmin,
  rotasDeLeitura,
  umColaborador,
} from '../../simulacao-do-cadastro.js';
import { renderizarNaRota } from '../../utilitarios-de-teste.js';

function corpoDa(chamada: ReturnType<typeof vi.fn>): unknown {
  const requisicao = chamada.mock.calls[0]?.[0] as InternalAxiosRequestConfig | undefined;
  return typeof requisicao?.data === 'string' ? JSON.parse(requisicao.data) : requisicao?.data;
}

function preencher(rotulo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

async function abrirColaboradores(caminho = '/colaboradores') {
  renderizarNaRota(caminho);
  return screen.findByRole('table', { name: 'Colaboradores cadastrados' });
}

function nomesNaLista(tabela: HTMLElement) {
  return within(tabela)
    .getAllByRole('row')
    .slice(1)
    .map((linha) => within(linha).getAllByRole('cell')[0]?.textContent ?? '');
}

describe('Colaboradores (US03)', () => {
  describe('lista e filtros', () => {
    it('mostra papel, equipe e situação de cada pessoa', async () => {
      const { estado } = cenarioDoCadastro();
      comSessaoDeAdmin(rotasDeLeitura(estado));

      const tabela = await abrirColaboradores();

      const linhas = within(tabela).getAllByRole('row').slice(1);
      expect(linhas).toHaveLength(5);
      expect(linhas[0]).toHaveTextContent('Ana Exemplo');
      expect(linhas[0]).toHaveTextContent('ana.exemplo@exemplo.com.br');
      expect(linhas[0]).toHaveTextContent('Líder de equipe');
      expect(linhas[0]).toHaveTextContent('Ipê');
      expect(linhas[2]).toHaveTextContent('Sem equipe');
      expect(linhas[4]).toHaveTextContent('Desativado');
      expect(screen.getByText('5 colaboradores cadastrados.')).toBeVisible();
    });

    it('filtra por equipe e por papel, e deixa limpar os filtros', async () => {
      const { estado } = cenarioDoCadastro();
      const lerLista = vi.fn((requisicao: InternalAxiosRequestConfig) => {
        const filtros = (requisicao.params ?? {}) as { equipeId?: string; papel?: string };
        const lista = estado.colaboradores.filter(
          (pessoa) =>
            (filtros.equipeId === undefined || pessoa.equipe?.id === filtros.equipeId) &&
            (filtros.papel === undefined || pessoa.papel === filtros.papel),
        );
        return { status: 200, dados: lista };
      });
      comSessaoDeAdmin({ ...rotasDeLeitura(estado), 'GET /colaboradores': lerLista });
      await abrirColaboradores();
      await screen.findByRole('option', { name: 'Ipê' });

      fireEvent.change(screen.getByLabelText('Equipe'), {
        target: { value: estado.equipes[0]?.id },
      });
      await waitFor(() => {
        expect(nomesNaLista(screen.getByRole('table'))).toHaveLength(2);
      });
      expect(nomesNaLista(screen.getByRole('table'))).toEqual([
        expect.stringContaining('Ana Exemplo'),
        expect.stringContaining('Bruno Exemplo'),
      ]);
      expect(screen.getByText('2 colaboradores neste filtro.')).toBeVisible();

      // Líder e equipe Ipê ao mesmo tempo: só a Ana.
      fireEvent.change(screen.getByLabelText('Papel'), { target: { value: 'LIDER' } });
      await waitFor(() => {
        expect(nomesNaLista(screen.getByRole('table'))).toHaveLength(1);
      });

      // Administradora na equipe Ipê: ninguém. A tela explica e oferece a saída.
      fireEvent.change(screen.getByLabelText('Papel'), { target: { value: 'ADMIN' } });
      expect(await screen.findByText('Nenhum colaborador neste filtro')).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));

      await waitFor(() => {
        expect(nomesNaLista(screen.getByRole('table'))).toHaveLength(5);
      });
      expect(screen.getByLabelText('Equipe')).toHaveValue('');
      expect(screen.getByLabelText('Papel')).toHaveValue('');
    });

    it('abre já filtrada quando o endereço traz o filtro', async () => {
      const { estado } = cenarioDoCadastro();
      comSessaoDeAdmin(rotasDeLeitura(estado));

      const tabela = await abrirColaboradores('/colaboradores?papel=LIDER');

      expect(nomesNaLista(tabela)).toEqual([
        expect.stringContaining('Ana Exemplo'),
        expect.stringContaining('Davi Exemplo'),
      ]);
      expect(screen.getByLabelText('Papel')).toHaveValue('LIDER');
    });

    it('ignora um filtro inválido do endereço em vez de quebrar a tela', async () => {
      const { estado } = cenarioDoCadastro();
      comSessaoDeAdmin(rotasDeLeitura(estado));

      const tabela = await abrirColaboradores('/colaboradores?papel=CHEFE');

      expect(nomesNaLista(tabela)).toHaveLength(5);
    });

    it('explica o que fazer quando ainda não há colaborador', async () => {
      const { estado } = cenarioDoCadastro();
      estado.colaboradores = [];
      comSessaoDeAdmin(rotasDeLeitura(estado));

      renderizarNaRota('/colaboradores');

      expect(await screen.findByText('Nenhum colaborador cadastrado ainda')).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Cadastrar o primeiro colaborador' }));
      expect(await screen.findByRole('dialog', { name: 'Novo colaborador' })).toBeVisible();
    });

    it('avisa em português quando a lista não carrega e permite tentar de novo', async () => {
      const { estado } = cenarioDoCadastro();
      let tentativas = 0;
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        'GET /colaboradores': () => {
          tentativas += 1;
          return tentativas === 1 ? { status: 500 } : { status: 200, dados: estado.colaboradores };
        },
      });

      renderizarNaRota('/colaboradores');

      expect(await screen.findByRole('alert')).toHaveTextContent(/servidor está com problemas/i);
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
      expect(await screen.findByRole('table', { name: 'Colaboradores cadastrados' })).toBeVisible();
    });
  });

  describe('criar', () => {
    it('cadastra a pessoa, confirma e atualiza a lista sozinha', async () => {
      const { estado, ipe } = cenarioDoCadastro();
      const criar = vi.fn((requisicao: InternalAxiosRequestConfig) => {
        const dados = JSON.parse(String(requisicao.data)) as { nome: string; email: string };
        const nova = umColaborador(dados.nome, {
          email: dados.email,
          equipe: { id: ipe.id, nome: ipe.nome },
        });
        estado.colaboradores.push(nova);
        return { status: 201, dados: nova };
      });
      comSessaoDeAdmin({ ...rotasDeLeitura(estado), 'POST /colaboradores': criar });
      await abrirColaboradores();

      fireEvent.click(screen.getByRole('button', { name: '+ Novo colaborador' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Novo colaborador' });
      expect(screen.getByLabelText('Nome completo')).toHaveFocus();
      await within(dialogo).findByRole('option', { name: 'Ipê' });

      preencher('Nome completo', 'Fábio Exemplo');
      preencher('E-mail', 'Fabio.Exemplo@Exemplo.com.br');
      preencher('Senha do primeiro acesso', 'senha-forte-1');
      fireEvent.change(within(dialogo).getByLabelText('Equipe'), { target: { value: ipe.id } });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Cadastrar' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Cadastro de Fábio Exemplo concluído.',
      );
      expect(corpoDa(criar)).toEqual({
        nome: 'Fábio Exemplo',
        email: 'fabio.exemplo@exemplo.com.br',
        senha: 'senha-forte-1',
        papel: 'COLABORADOR',
        equipeId: ipe.id,
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await screen.findByText('Fábio Exemplo')).toBeVisible();
    });

    it('recusa senha fora da regra do protótipo e aponta o campo, sem chamar a API', async () => {
      const { estado } = cenarioDoCadastro();
      const criar = vi.fn(() => ({ status: 201, dados: umColaborador('X') }));
      comSessaoDeAdmin({ ...rotasDeLeitura(estado), 'POST /colaboradores': criar });
      await abrirColaboradores();

      fireEvent.click(screen.getByRole('button', { name: '+ Novo colaborador' }));
      await screen.findByRole('dialog', { name: 'Novo colaborador' });
      preencher('Nome completo', 'Fábio Exemplo');
      preencher('E-mail', 'fabio.exemplo@exemplo.com.br');

      preencher('Senha do primeiro acesso', 'abc');
      fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));
      const senha = screen.getByLabelText('Senha do primeiro acesso');
      expect(senha).toBeInvalid();
      expect(senha).toHaveFocus();
      expect(senha).toHaveAccessibleDescription(
        expect.stringContaining('A senha precisa de pelo menos 8 caracteres.'),
      );

      preencher('Senha do primeiro acesso', 'abcdefghij');
      fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));
      expect(senha).toHaveAccessibleDescription(
        expect.stringContaining('A senha precisa de pelo menos um número.'),
      );
      expect(criar).not.toHaveBeenCalled();
    });

    it('deixa conferir a senha digitada antes de enviar', async () => {
      const { estado } = cenarioDoCadastro();
      comSessaoDeAdmin(rotasDeLeitura(estado));
      await abrirColaboradores();

      fireEvent.click(screen.getByRole('button', { name: '+ Novo colaborador' }));
      await screen.findByRole('dialog', { name: 'Novo colaborador' });
      const senha = screen.getByLabelText('Senha do primeiro acesso');
      expect(senha).toHaveAttribute('type', 'password');

      fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));

      expect(senha).toHaveAttribute('type', 'text');
      expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('aponta o e-mail já cadastrado no campo E-mail', async () => {
      const { estado } = cenarioDoCadastro();
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        'POST /colaboradores': () => ({
          status: 409,
          dados: erroDaApi('EMAIL_JA_CADASTRADO', 'Já existe um colaborador com este e-mail.'),
        }),
      });
      await abrirColaboradores();

      fireEvent.click(screen.getByRole('button', { name: '+ Novo colaborador' }));
      await screen.findByRole('dialog', { name: 'Novo colaborador' });
      preencher('Nome completo', 'Ana Exemplo');
      preencher('E-mail', 'ana.exemplo@exemplo.com.br');
      preencher('Senha do primeiro acesso', 'senha-forte-1');
      fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));

      const email = screen.getByLabelText('E-mail');
      await waitFor(() => {
        expect(email).toBeInvalid();
      });
      expect(email).toHaveAccessibleDescription(
        'Já existe um colaborador com este e-mail. Procure essa pessoa na lista de colaboradores.',
      );
      expect(email).toHaveFocus();
      expect(screen.getByLabelText('Nome completo')).toHaveValue('Ana Exemplo');
    });
  });

  describe('editar', () => {
    it('envia só o que mudou e não deixa trocar o e-mail', async () => {
      const { estado, bruno, araucaria } = cenarioDoCadastro();
      const atualizar = vi.fn(() => ({ status: 200, dados: bruno }));
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`PATCH /colaboradores/${bruno.id}`]: atualizar,
      });
      await abrirColaboradores();

      fireEvent.click(screen.getByRole('button', { name: 'Editar Bruno Exemplo' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Editar Bruno Exemplo' });
      await within(dialogo).findByRole('option', { name: 'Araucária' });
      expect(screen.getByLabelText('E-mail')).toBeDisabled();
      expect(screen.queryByLabelText('Senha do primeiro acesso')).not.toBeInTheDocument();

      fireEvent.change(within(dialogo).getByLabelText('Equipe'), {
        target: { value: araucaria.id },
      });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Dados de Bruno Exemplo atualizados.',
      );
      expect(corpoDa(atualizar)).toEqual({ equipeId: araucaria.id });
    });

    it('tira a pessoa da equipe quando se escolhe "Sem equipe"', async () => {
      const { estado, bruno } = cenarioDoCadastro();
      const atualizar = vi.fn(() => ({ status: 200, dados: bruno }));
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`PATCH /colaboradores/${bruno.id}`]: atualizar,
      });
      await abrirColaboradores();

      fireEvent.click(screen.getByRole('button', { name: 'Editar Bruno Exemplo' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Editar Bruno Exemplo' });
      await within(dialogo).findByRole('option', { name: 'Araucária' });
      expect(within(dialogo).getByLabelText('Equipe')).toHaveValue(bruno.equipe?.id);

      fireEvent.change(within(dialogo).getByLabelText('Equipe'), { target: { value: '' } });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

      await screen.findByRole('status');
      expect(corpoDa(atualizar)).toEqual({ equipeId: null });
    });

    it('explica o que fazer quando a API recusa mover quem lidera uma equipe', async () => {
      const { gincana, estado, ana, araucaria } = cenarioDoCadastro();
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`PATCH /colaboradores/${ana.id}`]: () => ({
          status: 409,
          dados: erroDaApi(
            'LIDERA_EQUIPE',
            'Ana Exemplo lidera a equipe Ipê. Troque o líder antes de mudar a equipe dela.',
          ),
        }),
      });
      await abrirColaboradores();

      fireEvent.click(screen.getByRole('button', { name: 'Editar Ana Exemplo' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Editar Ana Exemplo' });
      await within(dialogo).findByRole('option', { name: 'Araucária' });
      fireEvent.change(within(dialogo).getByLabelText('Equipe'), {
        target: { value: araucaria.id },
      });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

      const aviso = await within(dialogo).findByRole('alert');
      expect(aviso).toHaveTextContent(
        'Ana Exemplo lidera a equipe Ipê. Troque o líder antes de mudar a equipe dela.',
      );
      // Além de repetir a recusa, diz o que fazer e leva até lá.
      expect(aviso).toHaveTextContent('Troque o líder da equipe Ipê e tente de novo.');
      expect(within(aviso).getByRole('link', { name: 'Ir para Equipes' })).toHaveAttribute(
        'href',
        `/equipes?gincana=${gincana.id}`,
      );
    });
  });

  describe('desativar', () => {
    it('pede confirmação e só então desativa quem não lidera ninguém', async () => {
      const { estado, bruno } = cenarioDoCadastro();
      const desativar = vi.fn(() => {
        bruno.ativo = false;
        return { status: 200, dados: bruno };
      });
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`PATCH /colaboradores/${bruno.id}`]: desativar,
      });
      await abrirColaboradores();

      fireEvent.click(screen.getByRole('button', { name: 'Editar Bruno Exemplo' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Editar Bruno Exemplo' });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Desativar cadastro' }));

      const confirmacao = await screen.findByRole('dialog', { name: 'Desativar Bruno Exemplo?' });
      expect(within(confirmacao).getByRole('button', { name: 'Cancelar' })).toHaveFocus();

      // Desistir não grava nada.
      fireEvent.click(within(confirmacao).getByRole('button', { name: 'Cancelar' }));
      expect(desativar).not.toHaveBeenCalled();

      fireEvent.click(within(dialogo).getByRole('button', { name: 'Desativar cadastro' }));
      fireEvent.click(
        within(await screen.findByRole('dialog', { name: 'Desativar Bruno Exemplo?' })).getByRole(
          'button',
          { name: 'Desativar' },
        ),
      );

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Bruno Exemplo: cadastro desativado.',
      );
      expect(corpoDa(desativar)).toEqual({ ativo: false });
      const tabela = screen.getByRole('table', { name: 'Colaboradores cadastrados' });
      await waitFor(() => {
        expect(within(tabela).getAllByRole('row')[2]).toHaveTextContent('Desativado');
      });
    });

    it('avisa quem lidera uma equipe e diz o que fazer, em vez de só repetir o erro', async () => {
      const { gincana, estado, ana } = cenarioDoCadastro();
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`PATCH /colaboradores/${ana.id}`]: () => ({
          status: 409,
          dados: erroDaApi(
            'LIDERA_EQUIPE',
            'Ana Exemplo lidera a equipe Ipê. Troque o líder antes de desativar esta pessoa.',
          ),
        }),
      });
      await abrirColaboradores();

      fireEvent.click(screen.getByRole('button', { name: 'Editar Ana Exemplo' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Editar Ana Exemplo' });
      // As equipes carregam junto: é delas que a tela tira o nome da equipe no aviso.
      await within(dialogo).findByRole('option', { name: 'Ipê' });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Desativar cadastro' }));
      const confirmacao = await screen.findByRole('dialog', { name: 'Desativar Ana Exemplo?' });
      fireEvent.click(within(confirmacao).getByRole('button', { name: 'Desativar' }));

      const aviso = await within(confirmacao).findByRole('alert');
      expect(aviso).toHaveTextContent(
        'Ana Exemplo lidera a equipe Ipê. Troque o líder antes de desativar esta pessoa.',
      );
      expect(aviso).toHaveTextContent('Troque o líder da equipe Ipê e tente de novo.');
      expect(within(aviso).getByRole('link', { name: 'Ir para Equipes' })).toHaveAttribute(
        'href',
        `/equipes?gincana=${gincana.id}`,
      );
      // A pessoa continua ativa na lista e não há confirmação de sucesso.
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      const linhaDaAna = within(screen.getByRole('table')).getAllByRole('row')[1];
      expect(linhaDaAna).toHaveTextContent('Ana Exemplo');
      expect(linhaDaAna).not.toHaveTextContent('Desativado');
    });

    it('reativa um cadastro desativado', async () => {
      const { estado, elisa } = cenarioDoCadastro();
      const reativar = vi.fn(() => ({ status: 200, dados: { ...elisa, ativo: true } }));
      comSessaoDeAdmin({
        ...rotasDeLeitura(estado),
        [`PATCH /colaboradores/${elisa.id}`]: reativar,
      });
      await abrirColaboradores();

      fireEvent.click(screen.getByRole('button', { name: 'Editar Elisa Exemplo' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Editar Elisa Exemplo' });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Reativar cadastro' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Elisa Exemplo: cadastro reativado.',
      );
      expect(corpoDa(reativar)).toEqual({ ativo: true });
    });
  });
});
