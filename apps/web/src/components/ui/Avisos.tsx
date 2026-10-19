import type { ReactNode } from 'react';

interface PropsDoAviso {
  children: ReactNode;
  /** Ações logo abaixo da mensagem (um link para resolver o problema, por exemplo). */
  acoes?: ReactNode;
}

/** Falha: anunciada na hora para leitor de tela e sempre dizendo o que fazer em seguida. */
export function AvisoDeErro({ children, acoes }: PropsDoAviso) {
  return (
    <div
      role="alert"
      className="rounded-xl border-2 border-recusado bg-recusado-fundo p-4 text-sm text-recusado"
    >
      <div className="font-medium">{children}</div>
      {acoes !== undefined && <div className="mt-3 flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

interface PropsDoSucesso {
  children: ReactNode;
  aoDispensar?: () => void;
}

/** Confirmação de que deu certo. Fica na tela até a pessoa dispensar: não some sozinha. */
export function AvisoDeSucesso({ children, aoDispensar }: PropsDoSucesso) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-xl bg-aprovado-fundo p-4 text-sm font-medium text-aprovado"
    >
      <p>{children}</p>
      {aoDispensar !== undefined && (
        <button
          type="button"
          onClick={aoDispensar}
          className="min-h-11 shrink-0 rounded-xl px-3 font-semibold hover:bg-superficie focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600"
        >
          Dispensar
        </button>
      )}
    </div>
  );
}
