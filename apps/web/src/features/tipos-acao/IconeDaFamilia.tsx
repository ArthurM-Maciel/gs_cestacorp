import type { ReactElement, SVGProps } from 'react';

import { estilosDaFamilia, type FamiliaDeAcao } from './familias-de-acao.js';

const traco = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

type Props = SVGProps<SVGSVGElement>;

function Cesta(props: Props) {
  return (
    <svg {...traco} {...props}>
      <path d="M6 7.5h12l-1.4 12h-9.2Z" />
      <path d="M5 7.5h14" />
    </svg>
  );
}

function Alvo(props: Props) {
  return (
    <svg {...traco} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.75" />
    </svg>
  );
}

function Camiseta(props: Props) {
  return (
    <svg {...traco} {...props}>
      <path d="M9 4 4 6.5 6 10.5l2.5-1V20h7V9.5l2.5 1 2-4L15 4a3.2 3.2 0 0 1-6 0Z" />
    </svg>
  );
}

function Capelo(props: Props) {
  return (
    <svg {...traco} {...props}>
      <path d="M2.5 9 12 4.5 21.5 9 12 13.5Z" />
      <path d="M6.5 11.5V16c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.5" />
    </svg>
  );
}

function Mais(props: Props) {
  return (
    <svg {...traco} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

const desenhos: Record<FamiliaDeAcao, (props: Props) => ReactElement> = {
  alimentos: Cesta,
  tampinhas: Alvo,
  roupas: Camiseta,
  curso: Capelo,
  outra: Mais,
};

interface PropsDoIcone {
  familia: FamiliaDeAcao;
  /**
   * `pequeno`: quadrado nas listas. `grande`: círculo branco sobre o fundo da família (a
   * grade de escolher ação). `cabecalho`: círculo da cor da família, para fundo escuro.
   */
  tamanho?: 'pequeno' | 'grande' | 'cabecalho';
}

/**
 * O ícone da família num quadrado ou círculo da cor dela. É decorativo: o nome da ação
 * sempre está escrito ao lado, e a cor nunca é a única forma de reconhecer o tipo.
 */
export function IconeDaFamilia({ familia, tamanho = 'pequeno' }: PropsDoIcone) {
  const Desenho = desenhos[familia];
  const estilo = estilosDaFamilia[familia];

  if (tamanho === 'pequeno') {
    return (
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${estilo.fundo}`}>
        <Desenho className={`size-5 ${estilo.tinta}`} />
      </span>
    );
  }

  const fundo = tamanho === 'grande' ? 'bg-superficie' : estilo.fundo;
  return (
    <span className={`grid size-14 shrink-0 place-items-center rounded-full ${fundo}`}>
      <Desenho className={`size-7 ${estilo.tinta}`} />
    </span>
  );
}
