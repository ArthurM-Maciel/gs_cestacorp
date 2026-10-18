import type { ReactNode } from 'react';

interface Props {
  titulo: string;
  descricao: string;
  /** Quando é uma falha, a descrição é anunciada na hora para leitor de tela. */
  alerta?: boolean;
  /** Ações da tela (botões, links), empilhadas embaixo da mensagem. */
  children?: ReactNode;
}

/** Tela de uma mensagem só, com ações opcionais. Serve a erro, ausência e bloqueio. */
export function CartaoDeMensagem({ titulo, descricao, alerta = false, children }: Props) {
  return (
    <main className="grid min-h-dvh place-items-center bg-fundo px-4 py-12">
      <div className="w-full max-w-sm rounded-cartao bg-superficie p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-balance">{titulo}</h1>
        <p role={alerta ? 'alert' : undefined} className="mt-2 text-texto-suave">
          {descricao}
        </p>
        {children !== undefined && <div className="mt-6 flex flex-col gap-3">{children}</div>}
      </div>
    </main>
  );
}
