/**
 * Classes dos botões do protótipo. Alvo de toque de 48px (o mínimo da equipe é 44px) e
 * foco visível por contorno, que aparece só na navegação por teclado.
 */
const base =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-6 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600 disabled:cursor-not-allowed disabled:opacity-60';

export const botaoPrimario = `${base} bg-marca-600 text-superficie hover:bg-marca-800`;

export const botaoContorno = `${base} border-2 border-marca-600 bg-superficie text-marca-600 hover:bg-marca-50`;
