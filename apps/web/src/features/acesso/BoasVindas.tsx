import { Link } from 'react-router-dom';

import { botaoContorno, botaoPrimario } from '../../components/estilos-de-botao.js';
import { IconeMaos } from './Icones.js';
import { PainelDaMarca } from './PainelDaMarca.js';

/**
 * Tela de abertura (`01-acesso-mobile.png`). No celular: faixa verde com a marca e uma
 * folha branca com as duas ações. No computador o protótipo não tem esta tela, então ela
 * reaproveita a divisão do login, com o painel verde à esquerda.
 */
export function BoasVindas() {
  return (
    <div className="flex min-h-dvh flex-col bg-marca-600 lg:grid lg:grid-cols-2 lg:bg-superficie">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden py-10 lg:hidden">
        <span
          aria-hidden="true"
          className="absolute -top-10 -left-14 size-44 rounded-full bg-superficie/10"
        />
        <span
          aria-hidden="true"
          className="absolute top-12 right-10 size-8 rounded-full bg-superficie/20"
        />
        <span
          aria-hidden="true"
          className="absolute -right-16 -bottom-10 size-56 rounded-full bg-superficie/10"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-16 left-10 size-4 rounded-full bg-superficie/20"
        />
        <span className="relative grid size-36 place-items-center rounded-4xl bg-marca-900 text-superficie">
          <IconeMaos className="size-24" />
        </span>
      </div>

      <PainelDaMarca className="hidden min-h-dvh lg:flex lg:flex-col" />

      <main className="pb-seguro rounded-t-4xl bg-superficie px-6 pt-8 lg:flex lg:flex-col lg:justify-center lg:rounded-none lg:px-12">
        <div className="mx-auto w-full max-w-md text-center lg:max-w-sm lg:text-left">
          <h1 className="text-3xl leading-tight font-bold tracking-tight">
            Faça o bem e <span className="block text-marca-600">some pontos!</span>
          </h1>
          <p className="mt-3 text-texto-suave">
            Registre suas ações solidárias, envie o comprovante e acompanhe sua equipe.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link to="/entrar" className={botaoPrimario}>
              Entrar
            </Link>
            <Link to="/criar-conta" className={botaoContorno}>
              Criar conta
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
