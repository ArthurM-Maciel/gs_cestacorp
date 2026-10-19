import type { LinhaDoRanking } from '@gincana/contracts';

import { formatarNumero } from '../../lib/formatar-numero.js';
import { rotuloDaPosicao } from './posicao-da-equipe.js';

interface Props {
  /** As equipes na ordem do placar, da primeira em diante. Só as três primeiras entram. */
  linhas: readonly LinhaDoRanking[];
  minhaEquipeId: string | null;
  aoAbrir: (linha: LinhaDoRanking) => void;
}

/**
 * A ordem visual do pódio (2º à esquerda, 1º ao centro, 3º à direita) é só CSS. No DOM, e
 * portanto para o leitor de tela e para o Tab, a ordem é a do placar: primeiro, segundo,
 * terceiro. Classes escritas por extenso, porque o Tailwind só gera o que encontra no código.
 */
const ordemVisual = ['order-2', 'order-1', 'order-3'] as const;

/**
 * A altura do degrau e o tamanho do círculo seguem a POSIÇÃO, não o lugar na fila: duas
 * equipes empatadas em segundo têm degraus iguais, e o pódio não finge uma diferença que
 * o placar não tem.
 */
const alturaDoDegrau: Record<number, string> = { 1: 'h-24', 2: 'h-16', 3: 'h-12' };

export function Podio({ linhas, minhaEquipeId, aoAbrir }: Props) {
  const doPodio = linhas.slice(0, 3);
  const ultima = doPodio[doPodio.length - 1];

  // O pódio tem três degraus. Se a terceira equipe empata com outras que ficaram de fora,
  // dizemos isso: sem a nota, o pódio pareceria a lista completa dessa posição.
  const foraDoPodioNoEmpate =
    ultima === undefined
      ? 0
      : linhas.slice(3).filter((linha) => linha.posicao === ultima.posicao).length;

  return (
    <section
      aria-labelledby="titulo-do-podio"
      className="rounded-cartao bg-marca-900 px-3 pt-5 pb-4 text-superficie"
    >
      <h2 id="titulo-do-podio" className="sr-only">
        Pódio: as três primeiras equipes
      </h2>

      <ol className="flex items-end justify-center gap-2">
        {doPodio.map((linha, indice) => {
          const primeira = linha.posicao === 1;
          const minha = linha.equipeId === minhaEquipeId;

          return (
            <li key={linha.equipeId} className={`min-w-0 flex-1 ${ordemVisual[indice] ?? ''}`}>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => {
                  aoAbrir(linha);
                }}
                className="flex w-full flex-col items-center gap-1 rounded-xl px-1 pt-1 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-300"
              >
                {/* O que o leitor de tela ouve: "1º lugar, Ipê, sua equipe, 4.280 pontos". */}
                <span className="sr-only">
                  {rotuloDaPosicao(linha)}: Equipe {linha.equipe.nome}
                  {minha ? ', sua equipe' : ''}, {formatarNumero(linha.pontos)} pontos
                </span>

                <span
                  aria-hidden="true"
                  className={`grid place-items-center rounded-full font-bold text-marca-900 ${
                    primeira ? 'size-16 bg-marca-300 text-2xl' : 'size-12 bg-marca-100 text-xl'
                  }`}
                >
                  {linha.posicao}
                </span>
                {linha.empatada && (
                  <span aria-hidden="true" className="text-xs font-semibold text-marca-300">
                    empate
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={`w-full text-sm leading-tight break-words hyphens-auto ${
                    primeira ? 'font-bold' : 'font-semibold'
                  }`}
                >
                  {linha.equipe.nome}
                </span>
                {minha && (
                  <span
                    aria-hidden="true"
                    className="rounded-full bg-marca-100 px-2 py-0.5 text-xs font-semibold text-marca-900"
                  >
                    sua equipe
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={`grid w-full place-items-center rounded-t-xl text-lg font-bold ${
                    alturaDoDegrau[linha.posicao] ?? 'h-12'
                  } ${primeira ? 'bg-marca-300 text-marca-900' : 'bg-marca-700 text-superficie'}`}
                >
                  {formatarNumero(linha.pontos)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {foraDoPodioNoEmpate > 0 && ultima !== undefined && (
        <p className="mt-3 text-center text-sm text-marca-300">
          {foraDoPodioNoEmpate === 1
            ? `Mais uma equipe também está em ${String(ultima.posicao)}º lugar.`
            : `Mais ${String(foraDoPodioNoEmpate)} equipes também estão em ${String(ultima.posicao)}º lugar.`}{' '}
          Veja o ranking completo abaixo.
        </p>
      )}
    </section>
  );
}
