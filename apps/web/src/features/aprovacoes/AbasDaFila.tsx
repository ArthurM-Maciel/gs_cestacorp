import type { KeyboardEvent } from 'react';

export type Aba = 'pendentes' | 'aprovados' | 'recusados';

interface Props {
  abas: readonly { chave: Aba; rotulo: string }[];
  ativa: Aba;
  aoEscolher: (aba: Aba) => void;
}

export const idDoPainelDaFila = 'painel-da-fila';
export const idDaAba = (aba: Aba) => `aba-${aba}`;

/**
 * Pendentes, Aprovados e Recusados. Segue o padrão de abas do teclado: Tab entra na aba
 * ativa, e as setas, Home e End trocam de aba (cada troca já mostra o conteúdo dela).
 */
export function AbasDaFila({ abas, ativa, aoEscolher }: Props) {
  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    const indice = abas.findIndex((aba) => aba.chave === ativa);
    const destinos: Record<string, number> = {
      ArrowRight: (indice + 1) % abas.length,
      ArrowLeft: (indice - 1 + abas.length) % abas.length,
      Home: 0,
      End: abas.length - 1,
    };
    const destino = destinos[evento.key];
    const aba = destino === undefined ? undefined : abas[destino];
    if (aba === undefined) {
      return;
    }
    evento.preventDefault();
    aoEscolher(aba.chave);
    document.getElementById(idDaAba(aba.chave))?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Situação dos lançamentos"
      onKeyDown={aoTeclar}
      className="flex flex-wrap gap-2"
    >
      {abas.map((aba) => {
        const selecionada = aba.chave === ativa;
        return (
          <button
            key={aba.chave}
            id={idDaAba(aba.chave)}
            type="button"
            role="tab"
            aria-selected={selecionada}
            aria-controls={idDoPainelDaFila}
            tabIndex={selecionada ? 0 : -1}
            onClick={() => {
              aoEscolher(aba.chave);
            }}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600 ${
              selecionada
                ? 'bg-marca-600 text-superficie'
                : 'bg-marca-100 text-texto hover:bg-marca-300'
            }`}
          >
            {aba.rotulo}
          </button>
        );
      })}
    </div>
  );
}
