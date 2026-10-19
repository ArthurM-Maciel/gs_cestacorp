import type { PeriodoDoRankingQuery } from '@gincana/contracts';

import { dataDeHoje } from '../../lib/dia-relativo.js';

/** As duas opções do filtro do protótipo: "Geral" e "Esta semana". */
export type PeriodoDoPlacar = 'geral' | 'semana';

export const periodosDoPlacar: readonly { valor: PeriodoDoPlacar; rotulo: string }[] = [
  { valor: 'geral', rotulo: 'Geral' },
  { valor: 'semana', rotulo: 'Esta semana' },
];

/** Qualquer coisa que não seja um período conhecido (endereço editado à mão) vira o geral. */
export function lerPeriodo(valor: string | null): PeriodoDoPlacar {
  return periodosDoPlacar.find((periodo) => periodo.valor === valor)?.valor ?? 'geral';
}

/**
 * A semana de segunda a domingo que contém `agora`, em dias de calendário (`AAAA-MM-DD`).
 *
 * A conta usa os números do calendário local, sem somar milissegundos: somar 24 horas
 * erraria o dia numa mudança de horário de verão. O domingo é o fim da semana inteira, não
 * "hoje"; como a API recusa lançamento com data futura, o resultado é o mesmo, e a tela
 * pode dizer o período completo ("26/10 a 01/11").
 */
export function janelaDaSemana(agora: Date = new Date()): Required<PeriodoDoRankingQuery> {
  const diasDesdeSegunda = (agora.getDay() + 6) % 7;
  const segunda = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate() - diasDesdeSegunda,
  );
  const domingo = new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + 6);
  return { desde: dataDeHoje(segunda), ate: dataDeHoje(domingo) };
}

/**
 * O que a consulta manda à API. "Geral" não manda data nenhuma: sem limite nas duas pontas,
 * o placar é o da gincana inteira.
 */
export function consultaDoPeriodo(
  periodo: PeriodoDoPlacar,
  agora: Date = new Date(),
): PeriodoDoRankingQuery {
  return periodo === 'semana' ? janelaDaSemana(agora) : {};
}
