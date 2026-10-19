import type { Papel, RespostaLogin } from '@gincana/contracts';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { erroDaApi, falhaDeRede, simularApi, usuarioDeTeste } from '../../simulacao-da-api.js';
import { renderizarNaRota } from '../../utilitarios-de-teste.js';

const EMAIL = 'pessoa.teste@exemplo.com.br';
const SENHA = 'senha-de-teste-1';

function respostaDeLogin(papel: Papel): RespostaLogin {
  return { token: 'token-de-teste', usuario: usuarioDeTeste(papel) };
}

function preencher(rotulo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

function entrar() {
  fireEvent.click(screen.getByRole('button', { name: /^entra/i }));
}

describe('Tela de login', () => {
  it('apresenta o formulário com o aviso de acesso só para colaboradores', () => {
    renderizarNaRota('/entrar');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Que bom ver você de novo!' }),
    ).toBeVisible();
    expect(screen.getByLabelText('E-mail')).toBeVisible();
    expect(screen.getByLabelText('Senha')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
    expect(screen.getByText('Acesso só para colaboradores')).toBeVisible();
    expect(screen.getByText(/o login usa o seu e-mail corporativo/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/criar-conta',
    );
  });

  describe('validação', () => {
    it('exige um e-mail válido, aponta o campo e não chama a API', () => {
      const chamada = vi.fn(() => ({ status: 200, dados: respostaDeLogin('COLABORADOR') }));
      simularApi({ 'POST /auth/login': chamada });
      renderizarNaRota('/entrar');

      preencher('E-mail', 'isso-nao-e-um-email');
      preencher('Senha', SENHA);
      entrar();

      const campo = screen.getByLabelText('E-mail');
      expect(campo).toBeInvalid();
      expect(campo).toHaveAccessibleDescription('Informe um e-mail válido.');
      expect(campo).toHaveFocus();
      expect(chamada).not.toHaveBeenCalled();
    });

    it('exige a senha', () => {
      const chamada = vi.fn(() => ({ status: 200, dados: respostaDeLogin('COLABORADOR') }));
      simularApi({ 'POST /auth/login': chamada });
      renderizarNaRota('/entrar');

      preencher('E-mail', EMAIL);
      entrar();

      const campo = screen.getByLabelText('Senha');
      expect(campo).toBeInvalid();
      expect(campo).toHaveAccessibleDescription('Informe a senha.');
      expect(campo).toHaveFocus();
      expect(chamada).not.toHaveBeenCalled();
    });

    it('tira o aviso do campo assim que a pessoa volta a digitar nele', () => {
      renderizarNaRota('/entrar');

      entrar();
      expect(screen.getByLabelText('E-mail')).toBeInvalid();

      preencher('E-mail', EMAIL);

      expect(screen.getByLabelText('E-mail')).toBeValid();
      expect(screen.getByLabelText('E-mail')).toHaveValue(EMAIL);
    });
  });

  describe('erro da API', () => {
    it('explica que e-mail ou senha estão incorretos, sem sair do formulário', async () => {
      simularApi({
        'POST /auth/login': () => ({
          status: 401,
          dados: erroDaApi('NAO_AUTENTICADO', 'Faça login para continuar.'),
        }),
      });
      renderizarNaRota('/entrar');

      preencher('E-mail', EMAIL);
      preencher('Senha', 'senha-errada-1');
      entrar();

      expect(await screen.findByRole('alert')).toHaveTextContent(/e-mail ou senha incorretos/i);
      // Quem errou a senha não perde o que digitou e pode tentar de novo na hora.
      expect(screen.getByLabelText('E-mail')).toHaveValue(EMAIL);
      expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
    });

    it('mostra a mensagem que a API enviou quando o erro é outro', async () => {
      simularApi({
        'POST /auth/login': () => ({
          status: 429,
          dados: erroDaApi('MUITAS_TENTATIVAS', 'Muitas tentativas. Tente de novo em 15 minutos.'),
        }),
      });
      renderizarNaRota('/entrar');

      preencher('E-mail', EMAIL);
      preencher('Senha', SENHA);
      entrar();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Muitas tentativas. Tente de novo em 15 minutos.',
      );
    });

    it('liga ao campo o erro que a API apontou nele', async () => {
      simularApi({
        'POST /auth/login': () => ({
          status: 400,
          dados: erroDaApi('DADOS_INVALIDOS', 'Confira os campos informados.', {
            email: ['Use o e-mail da Cestacorp.'],
          }),
        }),
      });
      renderizarNaRota('/entrar');

      preencher('E-mail', EMAIL);
      preencher('Senha', SENHA);
      entrar();

      await waitFor(() => {
        expect(screen.getByLabelText('E-mail')).toHaveAccessibleDescription(
          'Use o e-mail da Cestacorp.',
        );
      });
      expect(screen.getByRole('alert')).toHaveTextContent('Confira os campos informados.');
    });

    it('fala em português simples quando o servidor está fora do ar', async () => {
      simularApi({ 'POST /auth/login': falhaDeRede });
      renderizarNaRota('/entrar');

      preencher('E-mail', EMAIL);
      preencher('Senha', SENHA);
      entrar();

      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent(/não foi possível conectar ao servidor/i);
      expect(alerta).not.toHaveTextContent(/network|axios|error/i);
    });

    it('esconde o erro técnico quando o servidor falha por dentro', async () => {
      simularApi({
        'POST /auth/login': () => ({
          status: 500,
          dados: erroDaApi('ERRO_INTERNO', 'PrismaClientKnownRequestError: P2002'),
        }),
      });
      renderizarNaRota('/entrar');

      preencher('E-mail', EMAIL);
      preencher('Senha', SENHA);
      entrar();

      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent(/o servidor está com problemas/i);
      expect(alerta).not.toHaveTextContent(/prisma/i);
    });
  });

  describe('envio', () => {
    it('desabilita o botão e mostra o andamento enquanto a API responde', async () => {
      let responder: () => void = () => undefined;
      const resposta = new Promise<void>((resolver) => {
        responder = resolver;
      });
      const chamada = vi.fn(async () => {
        await resposta;
        return { status: 200, dados: respostaDeLogin('COLABORADOR') };
      });
      simularApi({ 'POST /auth/login': chamada });
      renderizarNaRota('/entrar');

      preencher('E-mail', EMAIL);
      preencher('Senha', SENHA);
      entrar();

      const botao = await screen.findByRole<HTMLButtonElement>('button', { name: 'Entrando…' });
      expect(botao).toBeDisabled();

      // Um segundo toque no meio da espera não dispara outro login.
      fireEvent.click(botao);
      fireEvent.submit(botao.form as HTMLFormElement);
      expect(chamada).toHaveBeenCalledTimes(1);

      responder();
      expect(await screen.findByRole('heading', { name: /olá, pessoa teste/i })).toBeVisible();
    });

    it('volta a habilitar o botão quando a API recusa', async () => {
      simularApi({
        'POST /auth/login': () => ({
          status: 401,
          dados: erroDaApi('NAO_AUTENTICADO', 'Faça login para continuar.'),
        }),
      });
      renderizarNaRota('/entrar');

      preencher('E-mail', EMAIL);
      preencher('Senha', SENHA);
      entrar();

      await screen.findByText(/e-mail ou senha incorretos/i);
      expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
    });
  });

  describe('depois de entrar', () => {
    it.each<[Papel, string, string]>([
      ['COLABORADOR', 'Colaborador', 'seus lançamentos'],
      ['LIDER', 'Líder de equipe', 'fila de lançamentos'],
      ['ADMIN', 'Administradora', 'painel da gincana'],
    ])('leva o perfil %s à sua tela, com o nome e o papel', async (papel, rotulo, trecho) => {
      simularApi({ 'POST /auth/login': () => ({ status: 200, dados: respostaDeLogin(papel) }) });
      renderizarNaRota('/entrar');

      preencher('E-mail', EMAIL);
      preencher('Senha', SENHA);
      entrar();

      expect(await screen.findByRole('heading', { name: 'Olá, Pessoa Teste!' })).toBeVisible();
      expect(screen.getByText(rotulo)).toBeVisible();
      expect(screen.getByText(new RegExp(trecho))).toBeVisible();
      expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();
    });

    it('volta à página que a pessoa tentou abrir antes de ser mandada ao login', async () => {
      simularApi({ 'POST /auth/login': () => ({ status: 200, dados: respostaDeLogin('LIDER') }) });
      renderizarNaRota('/aprovacoes');

      // Sem sessão, a rota protegida manda para o login.
      expect(await screen.findByLabelText('E-mail')).toBeVisible();

      preencher('E-mail', EMAIL);
      preencher('Senha', SENHA);
      entrar();

      expect(await screen.findByText(/fila de lançamentos/i)).toBeVisible();
    });

    it('entra mesmo quando o navegador bloqueia o armazenamento (janela privada)', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Acesso negado', 'SecurityError');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Cota excedida', 'QuotaExceededError');
      });
      simularApi({
        'POST /auth/login': () => ({ status: 200, dados: respostaDeLogin('COLABORADOR') }),
      });
      renderizarNaRota('/entrar');

      preencher('E-mail', EMAIL);
      preencher('Senha', SENHA);
      entrar();

      expect(await screen.findByRole('heading', { name: 'Olá, Pessoa Teste!' })).toBeVisible();
    });
  });

  describe('senha', () => {
    it('mostra e oculta o que foi digitado', () => {
      renderizarNaRota('/entrar');
      preencher('Senha', SENHA);

      const campo = screen.getByLabelText('Senha');
      expect(campo).toHaveAttribute('type', 'password');

      fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
      expect(campo).toHaveAttribute('type', 'text');
      expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
      expect(campo).toHaveAttribute('type', 'password');
    });

    it('explica que a recuperação ainda não existe, sem fingir que é um link', () => {
      renderizarNaRota('/entrar');

      expect(screen.queryByRole('link', { name: /esqueci minha senha/i })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }));

      expect(screen.getByRole('status')).toHaveTextContent(/recuperação de senha/i);
    });
  });
});
