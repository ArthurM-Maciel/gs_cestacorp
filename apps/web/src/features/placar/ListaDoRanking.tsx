import type { LinhaDoRanking } from '@gincana/contracts';

import { Etiqueta } from '../../components/ui/Etiqueta.js';
import { formatarNumero, formatarPontos } from '../../lib/formatar-numero.js';
import { rotuloDaPosicao } from './posicao-da-equipe.js';

interface Props {
  linhas: readonly LinhaDoRanking[];
  minhaEquipeId: string | null;
  aoAbrir: (linha: LinhaDoRanking) => void;
}

/**
 * As colunas do computador. No celular a linha tem três colunas (posição, equipe com líder e
 * ações por baixo, pontos); a partir de `lg` o líder e as ações ganham a própria coluna, como
 * na tabela do protótipo. É o mesmo conjunto de elementos nos dois tamanhos: só o CSS muda.
 */
const colunas =
  'grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 lg:grid-cols-[3rem_minmax(0,2fr)_minmax(0,1.5fr)_5rem_7rem] lg:gap-x-4';

/**
 * O que o leitor de tela diz da linha: "2º lugar (empate), Equipe Araucária, sua equipe, Líder:
 * Arthur, 69 ações, 3.910 pts". É um `aria-label` composto, e não pedaços escondidos dentro da
 * linha, porque o nome montado a partir de vários trechos perde os espaços entre eles
 * ("2ºlugar", "Líder:Arthur"). Todo texto visível da linha está no nome.
 */
function nomeDaLinha(linha: LinhaDoRanking, minha: boolean): string {
  const partes = [
    rotuloDaPosicao(linha),
    `Equipe ${linha.equipe.nome}`,
    ...(minha ? ['sua equipe'] : []),
    linha.lider === null ? 'Sem líder' : `Líder: ${linha.lider.nome}`,
    `${formatarNumero(linha.acoesAprovadas)} ${linha.acoesAprovadas === 1 ? 'ação' : 'ações'}`,
    formatarPontos(linha.pontos),
  ];
  return partes.join(', ');
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="size-4 shrink-0 text-texto-suave"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/**
 * O ranking completo: toda equipe da gincana, inclusive a que ainda não pontuou. Cada linha
 * é um botão que abre o extrato daquela equipe.
 */
export function ListaDoRanking({ linhas, minhaEquipeId, aoAbrir }: Props) {
  return (
    <div className="overflow-hidden rounded-cartao bg-superficie shadow-sm">
      {/* Cabeçalho só visual, só no computador: cada linha já se descreve inteira. */}
      <div
        aria-hidden="true"
        className={`${colunas} hidden border-b border-fundo px-5 py-3 text-xs font-semibold tracking-wide text-texto-suave uppercase lg:grid`}
      >
        <span>#</span>
        <span>Equipe</span>
        <span>Líder</span>
        <span className="text-right">Ações</span>
        <span className="text-right">Pontos</span>
      </div>

      <ol aria-label="Ranking completo">
        {linhas.map((linha) => {
          const minha = linha.equipeId === minhaEquipeId;
          return (
            <li key={linha.equipeId} className="not-last:border-b not-last:border-fundo">
              <button
                type="button"
                aria-label={nomeDaLinha(linha, minha)}
                aria-haspopup="dialog"
                onClick={() => {
                  aoAbrir(linha);
                }}
                className={`${colunas} min-h-16 w-full px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-marca-600 lg:px-5 ${
                  minha ? 'bg-marca-100' : 'hover:bg-marca-50'
                }`}
              >
                <span className="row-span-2 self-center text-lg font-bold lg:row-span-1">
                  {linha.posicao}º
                </span>

                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold lg:font-semibold">
                  Equipe {linha.equipe.nome}
                  {linha.empatada && <Etiqueta tom="neutro">empate</Etiqueta>}
                  {minha && <Etiqueta tom="sucesso">sua equipe</Etiqueta>}
                </span>

                {/* No celular, líder e ações ficam empilhados sob o nome, cada um na sua linha:
                    juntos numa linha só, o nome do líder quebraria no meio e deixaria um "·"
                    órfão. No computador o `contents` desfaz esta caixa e cada um vira uma
                    coluna, com o título no cabeçalho: por isso o "Líder:" e o "ações" somem
                    (`lg:hidden`). */}
                <span className="col-start-2 flex min-w-0 flex-col text-sm break-words text-texto-suave lg:contents">
                  <span className="lg:text-base lg:text-texto">
                    {linha.lider === null ? (
                      'Sem líder'
                    ) : (
                      <>
                        <span className="lg:hidden">Líder: </span>
                        {linha.lider.nome}
                      </>
                    )}
                  </span>
                  <span className="lg:text-right lg:text-base lg:text-texto">
                    {formatarNumero(linha.acoesAprovadas)}
                    <span className="lg:hidden">
                      {linha.acoesAprovadas === 1 ? ' ação' : ' ações'}
                    </span>
                  </span>
                </span>

                {/* Os pontos: no celular o número fica sobre o "pts", que cede a largura ao
                    nome da equipe; no computador os dois vão lado a lado. */}
                <span className="col-start-3 row-span-2 row-start-1 flex items-center justify-end gap-2 lg:col-start-5 lg:row-span-1 lg:row-start-auto">
                  <span className="flex flex-col items-end text-lg leading-tight font-bold lg:flex-row lg:items-baseline lg:gap-1">
                    <span>{formatarNumero(linha.pontos)}</span>{' '}
                    <span className="text-xs font-normal text-texto-suave lg:text-base lg:font-bold lg:text-texto">
                      pts
                    </span>
                  </span>
                  <Chevron />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
