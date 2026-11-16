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

export function IconeEmail(props: Props) {
  return (
    <svg {...traco} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 8 8 5.5L20 8" />
    </svg>
  );
}

export function IconeCadeado(props: Props) {
  return (
    <svg {...traco} {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function IconeOlho(props: Props) {
  return (
    <svg {...traco} {...props}>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconeOlhoCortado(props: Props) {
  return (
    <svg {...traco} {...props}>
      <path d="M10.6 5.2A10.5 10.5 0 0 1 12 5.1c6.5 0 10 6.9 10 6.9a17 17 0 0 1-3.2 4.1M6.6 6.6A16.7 16.7 0 0 0 2 12s3.5 6.9 10 6.9a9.8 9.8 0 0 0 4.3-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

export function IconeSetaEsquerda(props: Props) {
  return (
    <svg {...traco} {...props}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

export function IconeConfirmar(props: Props) {
  return (
    <svg {...traco} strokeWidth={2.25} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
