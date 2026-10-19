import { loginSchema } from '@gincana/contracts';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { botaoPrimario } from '../../components/ui/estilos-de-botao.js';
import { detalhesDoErro, mensagemDeErro } from '../../lib/api.js';
import { postarLogin } from '../../lib/autenticacao.js';
import { useSessao } from '../../lib/sessao.js';
import { CampoDeTexto } from '../../components/ui/CampoDeTexto.js';
import { IconeCadeado, IconeConfirmar, IconeEmail, IconeOlho, IconeOlhoCortado } from './Icones.js';
import { LayoutDeAcesso } from './LayoutDeAcesso.js';

const MENSAGEM_CREDENCIAIS = 'E-mail ou senha incorretos. Confira os dados e tente de novo.';

// Texto provisório: a recuperação de senha não faz parte desta história. Confirmar com a PO.
const MENSAGEM_SENHA_ESQUECIDA =
  'A recuperação de senha ainda não está disponível. Procure a administradora da gincana para redefinir o seu acesso.';

type Campo = 'email' | 'senha';
type ErrosDeCampo = Partial<Record<Campo, string>>;

const ehCampo = (valor: unknown): valor is Campo => valor === 'email' || valor === 'senha';

export function TelaDeLogin() {
  const { entrar, sessaoExpirada } = useSessao();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [ajudaDeSenhaAberta, setAjudaDeSenhaAberta] = useState(false);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});

  const campoEmail = useRef<HTMLInputElement>(null);
  const campoSenha = useRef<HTMLInputElement>(null);

  const login = useMutation({
    mutationFn: postarLogin,
    // Entrar muda a sessão; quem navega é o guarda da rota (SomenteVisitante).
    onSuccess: entrar,
    onError: (erro) => {
      // Se a API apontou campos específicos, o erro aparece junto do campo.
      const doServidor: ErrosDeCampo = {};
      for (const [campo, mensagens] of Object.entries(detalhesDoErro(erro))) {
        const primeira = mensagens[0];
        if (ehCampo(campo) && primeira !== undefined) {
          doServidor[campo] = primeira;
        }
      }
      setErrosDeCampo(doServidor);
    },
  });

  // Depois do sucesso o botão continua travado até a navegação acontecer: sem isso, um
  // segundo toque dispararia outro login.
  const enviando = login.isPending || login.isSuccess;

  const erroGeral = login.isError
    ? mensagemDeErro(login.error, { 401: MENSAGEM_CREDENCIAIS })
    : null;

  function limparErro(campo: Campo) {
    setErrosDeCampo((atuais) => ({ ...atuais, [campo]: undefined }));
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) {
      return;
    }

    const resultado = loginSchema.safeParse({ email, senha });

    if (!resultado.success) {
      const encontrados: ErrosDeCampo = {};
      for (const problema of resultado.error.issues) {
        const campo = problema.path[0];
        if (ehCampo(campo) && encontrados[campo] === undefined) {
          encontrados[campo] = problema.message;
        }
      }
      setErrosDeCampo(encontrados);
      // Leva o foco ao primeiro campo com problema: quem usa teclado ou leitor de tela
      // não precisa procurar onde errou.
      (encontrados.email !== undefined ? campoEmail : campoSenha).current?.focus();
      return;
    }

    setErrosDeCampo({});
    login.mutate(resultado.data);
  }

  return (
    <LayoutDeAcesso voltarPara="/">
      <h1 className="mt-8 text-3xl leading-tight font-bold tracking-tight lg:mt-0">
        Que bom ver <span className="block text-marca-600">você de novo!</span>
      </h1>
      <p className="mt-2 text-texto-suave">Use o e-mail da Cestacorp para entrar.</p>

      {sessaoExpirada && (
        <p
          role="status"
          className="mt-6 rounded-2xl bg-pendente-fundo p-4 text-sm font-medium text-pendente"
        >
          Sua sessão expirou. Entre novamente para continuar.
        </p>
      )}

      <form
        onSubmit={aoEnviar}
        noValidate
        aria-busy={enviando}
        className="mt-8 flex flex-col gap-5"
      >
        {/* A região existe desde o início: é a inserção de texto nela que o leitor de
            tela anuncia. */}
        <div
          role="alert"
          className={
            erroGeral === null
              ? 'sr-only'
              : 'rounded-2xl bg-recusado-fundo p-4 text-sm font-medium text-recusado'
          }
        >
          {erroGeral}
        </div>

        <CampoDeTexto
          ref={campoEmail}
          rotulo="E-mail"
          icone={<IconeEmail className="size-5" />}
          erro={errosDeCampo.email}
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="nome@cestacorp.com.br"
          value={email}
          onChange={(evento) => {
            setEmail(evento.target.value);
            limparErro('email');
          }}
        />

        <div>
          <CampoDeTexto
            ref={campoSenha}
            rotulo="Senha"
            icone={<IconeCadeado className="size-5" />}
            erro={errosDeCampo.senha}
            type={senhaVisivel ? 'text' : 'password'}
            name="senha"
            autoComplete="current-password"
            placeholder="Sua senha"
            value={senha}
            onChange={(evento) => {
              setSenha(evento.target.value);
              limparErro('senha');
            }}
            acaoFinal={
              <button
                type="button"
                aria-label="Mostrar senha"
                aria-pressed={senhaVisivel}
                onClick={() => {
                  setSenhaVisivel((visivel) => !visivel);
                }}
                className="grid size-11 place-items-center rounded-xl text-texto-suave focus-visible:outline-2 focus-visible:outline-marca-600"
              >
                {senhaVisivel ? (
                  <IconeOlhoCortado className="size-5" />
                ) : (
                  <IconeOlho className="size-5" />
                )}
              </button>
            }
          />

          <div className="mt-1 flex justify-end">
            {/* Botão, não link: a recuperação ainda não tem destino, e link sem destino
                parece quebrado. */}
            <button
              type="button"
              aria-expanded={ajudaDeSenhaAberta}
              onClick={() => {
                setAjudaDeSenhaAberta((aberta) => !aberta);
              }}
              className="inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-semibold text-marca-600 focus-visible:outline-2 focus-visible:outline-marca-600"
            >
              Esqueci minha senha
            </button>
          </div>
          <div role="status">
            {ajudaDeSenhaAberta && (
              <p className="rounded-2xl bg-fundo p-4 text-sm text-texto-suave">
                {MENSAGEM_SENHA_ESQUECIDA}
              </p>
            )}
          </div>
        </div>

        <button type="submit" disabled={enviando} className={botaoPrimario}>
          {enviando && (
            <span
              aria-hidden="true"
              className="size-5 animate-spin rounded-full border-2 border-superficie/40 border-t-superficie motion-reduce:animate-none"
            />
          )}
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>

        <div className="flex items-start gap-3 rounded-2xl bg-marca-100 p-4 text-sm">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-superficie text-marca-600">
            <IconeConfirmar className="size-4" />
          </span>
          <p>
            <strong className="block font-semibold">Acesso só para colaboradores</strong>O login usa
            o seu e-mail corporativo.
          </p>
        </div>
      </form>

      <p className="mt-auto pt-8 text-center text-sm text-texto-suave lg:mt-6 lg:pt-0 lg:text-left">
        Ainda não tem conta?{' '}
        <Link
          to="/criar-conta"
          className="inline-flex min-h-11 items-center rounded-lg px-1 font-semibold text-marca-600 focus-visible:outline-2 focus-visible:outline-marca-600"
        >
          Criar conta
        </Link>
      </p>
    </LayoutDeAcesso>
  );
}
