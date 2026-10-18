import type { ReactNode } from 'react';

import { botaoContorno } from './estilos-de-botao.js';

/** Carregando: o `role="status"` faz o leitor de tela anunciar sem roubar o foco. */
export function EstadoCarregando({ mensagem }: { mensagem: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-texto-suave">
      <span
        aria-hidden="true"
        className="size-6 animate-spin rounded-full border-4 border-marca-100 border-t-marca-600 motion-reduce:animate-none"
      />
      <p>{mensagem}</p>
    </div>
  );
}

interface PropsDoVazio {
  titulo: string;
  /** Explica o que fazer: um estado vazio sem próximo passo é só uma tela em branco. */
  descricao: string;
  children?: ReactNode;
}

export function EstadoVazio({ titulo, descricao, children }: PropsDoVazio) {
  return (
    <div className="rounded-cartao bg-superficie p-6 text-center shadow-sm">
      <h2 className="text-lg font-bold text-balance">{titulo}</h2>
      <p className="mx-auto mt-2 max-w-md text-texto-suave">{descricao}</p>
      {children !== undefined && (
        <div className="mx-auto mt-5 flex max-w-xs flex-col gap-3">{children}</div>
      )}
    </div>
  );
}

interface PropsDoErro {
  /** Já traduzida para português por `mensagemDeErro`. */
  mensagem: string;
  aoTentarDeNovo: () => void;
}

export function EstadoDeErro({ mensagem, aoTentarDeNovo }: PropsDoErro) {
  return (
    <div className="rounded-cartao bg-superficie p-6 text-center shadow-sm">
      <h2 className="text-lg font-bold text-balance">Não foi possível carregar</h2>
      <p role="alert" className="mx-auto mt-2 max-w-md text-texto-suave">
        {mensagem}
      </p>
      <div className="mx-auto mt-5 flex max-w-xs flex-col gap-3">
        <button type="button" onClick={aoTentarDeNovo} className={botaoContorno}>
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
