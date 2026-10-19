import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  titulo: string;
  descricao?: string;
  /** Chamado ao fechar por Esc ou pelo botão Fechar. Precisa ser seguro de chamar duas vezes. */
  aoFechar: () => void;
  /**
   * Enquanto uma gravação está em andamento, fechar faria a pessoa perder o resultado da
   * ação sem saber se ela valeu. Bloqueia Esc e o botão Fechar.
   */
  ocupado?: boolean;
  /**
   * `painel`: tela cheia no celular e painel à direita no computador (como "Nova regra" no
   * protótipo). `confirmacao`: janela pequena no centro, para perguntas de sim ou não.
   */
  variante?: 'painel' | 'confirmacao';
  children: ReactNode;
}

const classesPorVariante = {
  painel:
    'm-0 ml-auto h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-texto backdrop:bg-marca-900/60 lg:max-w-lg',
  confirmacao:
    'm-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm rounded-cartao bg-superficie p-0 text-texto shadow-xl backdrop:bg-marca-900/60',
} as const;

/**
 * Diálogo modal sobre o elemento `<dialog>` nativo. O navegador cuida do que é difícil de
 * acertar à mão: prende o foco dentro da janela, deixa o resto da página inerte, fecha com
 * Esc e devolve o foco ao botão que abriu.
 *
 * Quem usa renderiza o componente só enquanto ele está aberto, então o estado do formulário
 * nasce limpo a cada abertura.
 */
export function Dialogo({
  titulo,
  descricao,
  aoFechar,
  ocupado = false,
  variante = 'painel',
  children,
}: Props) {
  const elemento = useRef<HTMLDialogElement>(null);
  const idDoTitulo = useId();
  const idDaDescricao = useId();

  useEffect(() => {
    const dialogo = elemento.current;
    if (dialogo === null) {
      return;
    }

    // Quem abriu a janela: é para onde o foco volta quando ela fecha.
    const abridor = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!dialogo.open) {
      dialogo.showModal();
    }

    // O navegador foca o primeiro controle da janela, que seria o botão Fechar. Quem
    // preenche formulário quer começar pelo primeiro campo.
    dialogo.querySelector<HTMLElement>('[data-foco-inicial]')?.focus();

    return () => {
      if (dialogo.open) {
        dialogo.close();
      }
      // Com Esc o navegador devolve o foco sozinho. Quando é o React que remove a janela
      // (botão Cancelar ou Fechar), o elemento já saiu da página e o foco cairia no
      // <body>: quem usa o teclado perderia o lugar onde estava.
      if (abridor?.isConnected === true) {
        abridor.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={elemento}
      aria-labelledby={idDoTitulo}
      aria-describedby={descricao === undefined ? undefined : idDaDescricao}
      onCancel={(evento) => {
        if (ocupado) {
          evento.preventDefault();
        }
      }}
      onClose={() => {
        // No StrictMode do desenvolvimento o efeito roda duas vezes: o `close()` da primeira
        // limpeza dispara este evento quando a janela já foi reaberta. Só vale se ela está fechada.
        if (elemento.current?.open !== true) {
          aoFechar();
        }
      }}
      className={classesPorVariante[variante]}
    >
      {/* O layout vive neste div: um `display` no próprio <dialog> faria a janela fechada
          aparecer na página. */}
      <div className="flex h-full max-h-[inherit] flex-col bg-superficie">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0 flex-1">
            <h2 id={idDoTitulo} className="text-2xl font-bold tracking-tight text-balance">
              {titulo}
            </h2>
            {descricao !== undefined && (
              <p id={idDaDescricao} className="mt-1 text-texto-suave">
                {descricao}
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={ocupado}
            onClick={aoFechar}
            className="-mr-2 min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-texto-suave hover:bg-fundo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Fechar
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** Área que rola quando o conteúdo passa da altura da tela, com o rodapé sempre à vista. */
export function CorpoDoDialogo({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-3">{children}</div>
  );
}

/**
 * Botões de decisão, fixos no pé da janela e acima do indicador de gesto do iPhone. Ficam
 * lado a lado em 360px; sem reduzir o respiro lateral dos botões, rótulos como "Remover da
 * equipe" quebrariam em duas linhas.
 */
export function RodapeDoDialogo({ children }: { children: ReactNode }) {
  return (
    <div className="pb-seguro grid grid-cols-2 gap-3 border-t border-fundo bg-superficie px-5 pt-4 [&>button]:px-3">
      {children}
    </div>
  );
}
