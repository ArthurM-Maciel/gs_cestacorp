/**
 * Classes dos botões do protótipo. Alvo de toque de 48px (o mínimo da equipe é 44px) e
 * foco visível por contorno, que aparece só na navegação por teclado.
 */
const base =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-6 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600 disabled:cursor-not-allowed disabled:opacity-60';

export const botaoPrimario = `${base} bg-marca-600 text-superficie hover:bg-marca-800`;

export const botaoContorno = `${base} border-2 border-marca-600 bg-superficie text-marca-600 hover:bg-marca-50`;

/** Ação que não se desfaz sozinha (desativar, remover): a cor avisa antes de a pessoa ler. */
export const botaoPerigo = `${base} bg-recusado text-superficie hover:opacity-90 focus-visible:outline-recusado`;

export const botaoContornoPerigo = `${base} border-2 border-recusado bg-superficie text-recusado hover:bg-recusado-fundo focus-visible:outline-recusado`;

/**
 * Ação dentro de uma linha de lista (Editar, Remover). Não ocupa a largura toda, mas
 * mantém os 44px de alvo de toque.
 */
const baseDeLinha =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

export const botaoDeLinha = `${baseDeLinha} border-2 border-marca-100 text-marca-600 hover:bg-marca-50 focus-visible:outline-marca-600 lg:border-transparent`;

export const botaoDeLinhaPerigo = `${baseDeLinha} border-2 border-recusado-fundo text-recusado hover:bg-recusado-fundo focus-visible:outline-recusado lg:border-transparent`;
