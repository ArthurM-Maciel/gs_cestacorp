/**
 * Cálculo de pontos da gincana.
 *
 * Este módulo é puro de propósito: nada aqui conhece banco, HTTP ou Prisma. É o
 * componente mais crítico do sistema — a inception exige que ele seja coberto por
 * testes desde a primeira sprint — e é importado tanto pela API quanto pelo front,
 * para que a prévia mostrada no formulário nunca divirja do valor gravado.
 */

/** Regra de pontuação vigente num intervalo de tempo. */
export interface RegraPontuacao {
  readonly id: string;
  /** Pontos concedidos por unidade da ação (ex.: 10 pontos por quilo de tampinha). */
  readonly pontosPorUnidade: number;
  readonly vigenciaInicio: Date;
  /** Nulo quando a regra é a vigente. */
  readonly vigenciaFim: Date | null;
}

export class ErroDeCalculo extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeCalculo';
  }
}

/**
 * Calcula os pontos de um lançamento.
 *
 * O resultado é inteiro: a gincana sempre foi apurada em pontos cheios, e meio ponto
 * não tem significado para a cliente. Frações de 0,5 sobem (24,5 vira 25).
 *
 * @example calcularPontos(24, 10) // 240 — 24 kg de tampinhas
 * @example calcularPontos(3, 15)  // 45  — 3 peças de roupa infantil
 */
export function calcularPontos(quantidade: number, pontosPorUnidade: number): number {
  if (!Number.isFinite(quantidade)) {
    throw new ErroDeCalculo('A quantidade precisa ser um número.');
  }
  if (!Number.isFinite(pontosPorUnidade)) {
    throw new ErroDeCalculo('Os pontos por unidade precisam ser um número.');
  }
  if (quantidade <= 0) {
    throw new ErroDeCalculo('A quantidade precisa ser maior que zero.');
  }
  if (pontosPorUnidade < 0) {
    throw new ErroDeCalculo('Os pontos por unidade não podem ser negativos.');
  }

  return Math.round(quantidade * pontosPorUnidade);
}

/**
 * Devolve a regra vigente numa data, ou `null` quando nenhuma vigia.
 *
 * A vigência é fechada no início e aberta no fim: uma regra que termina às 10h não vale
 * mais às 10h. Assim, trocar a pontuação é encerrar a regra atual e abrir a próxima no
 * mesmo instante, sem buraco nem sobreposição.
 *
 * Quando mais de uma regra cobre a data — o que indica cadastro inconsistente — vence a
 * de início mais recente, para que a última decisão da administradora prevaleça.
 */
export function selecionarRegraVigente(
  regras: readonly RegraPontuacao[],
  data: Date,
): RegraPontuacao | null {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) {
    throw new ErroDeCalculo('A data de referência é inválida.');
  }

  const momento = data.getTime();

  const vigentes = regras.filter((regra) => {
    const inicio = regra.vigenciaInicio.getTime();
    const fim = regra.vigenciaFim?.getTime() ?? Number.POSITIVE_INFINITY;
    return inicio <= momento && momento < fim;
  });

  if (vigentes.length === 0) {
    return null;
  }

  return vigentes.reduce((maisRecente, atual) =>
    atual.vigenciaInicio.getTime() > maisRecente.vigenciaInicio.getTime() ? atual : maisRecente,
  );
}

/**
 * Calcula os pontos de um lançamento na data em que a ação aconteceu, usando a regra que
 * vigia naquele momento.
 *
 * Devolve também a regra aplicada: quem grava o lançamento precisa congelar o `id` e o
 * valor usado, para que uma mudança futura de pontuação não altere o placar já apurado.
 */
export function calcularPontosNaData(
  quantidade: number,
  regras: readonly RegraPontuacao[],
  dataAcao: Date,
): { pontos: number; regra: RegraPontuacao } {
  const regra = selecionarRegraVigente(regras, dataAcao);

  if (regra === null) {
    throw new ErroDeCalculo(
      'Nenhuma regra de pontuação vigente para esta ação na data informada.',
    );
  }

  return { pontos: calcularPontos(quantidade, regra.pontosPorUnidade), regra };
}
