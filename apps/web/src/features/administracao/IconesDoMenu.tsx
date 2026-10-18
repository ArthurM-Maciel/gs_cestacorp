import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;

/** Ícones de traço, 24x24. Herdam a cor do texto (`currentColor`) e são decorativos. */
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

export function IconePainel(props: Props) {
  return (
    <svg {...traco} {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  );
}

export function IconeGincanas(props: Props) {
  return (
    <svg {...traco} {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  );
}

export function IconeEquipes(props: Props) {
  return (
    <svg {...traco} {...props}>
      <circle cx="9" cy="8.5" r="3.25" />
      <path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 5.6a3.25 3.25 0 0 1 0 5.8M18 14.4c1.9.7 3 2.4 3 5.1" />
    </svg>
  );
}

export function IconeColaboradores(props: Props) {
  return (
    <svg {...traco} {...props}>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
    </svg>
  );
}

export function IconeRegras(props: Props) {
  return (
    <svg {...traco} {...props}>
      <path d="M8 6.5h12M8 12h12M8 17.5h12" />
      <path d="M4 6.5h.01M4 12h.01M4 17.5h.01" />
    </svg>
  );
}

export function IconeAprovacoes(props: Props) {
  return (
    <svg {...traco} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.3 2.8 2.8L16.2 9.5" />
    </svg>
  );
}

export function IconePlacar(props: Props) {
  return (
    <svg {...traco} {...props}>
      <path d="M5 20V12M12 20V4M19 20v-9" />
    </svg>
  );
}
