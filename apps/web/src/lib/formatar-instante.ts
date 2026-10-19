import { dataDeHoje, descreverDia } from './dia-relativo.js';

const doisDigitos = (numero: number) => String(numero).padStart(2, '0');

function lerInstante(iso: string): Date | null {
  const instante = new Date(iso);
  return Number.isNaN(instante.getTime()) ? null : instante;
}

/** `12:05`, na hora do aparelho de quem está olhando. */
function horaDe(instante: Date): string {
  return `${doisDigitos(instante.getHours())}:${doisDigitos(instante.getMinutes())}`;
}

/**
 * Um instante gravado pela API (`2026-11-02T15:05:00.000Z`) como a trilha de auditoria o
 * mostra: `02/11/2026 às 12:05`. A hora é a do aparelho, que é a que a pessoa conhece.
 *
 * Diferente de `formatarData`, que cuida de dias de calendário sem hora e por isso nunca
 * passa por `Date`: aqui existe um instante de verdade, e o fuso faz parte da resposta.
 */
export function formatarDataEHora(iso: string): string {
  const instante = lerInstante(iso);
  if (instante === null) {
    return iso;
  }
  const dia = `${doisDigitos(instante.getDate())}/${doisDigitos(instante.getMonth() + 1)}`;
  return `${dia}/${String(instante.getFullYear())} às ${horaDe(instante)}`;
}

/**
 * Como o placar diz quando foi apurado: `hoje, 10:15`, `ontem, 18:40` ou `12/11, 09:32`
 * (com o ano quando não é o atual).
 */
export function descreverInstante(iso: string, agora: Date = new Date()): string {
  const instante = lerInstante(iso);
  if (instante === null) {
    return iso;
  }
  return `${descreverDia(dataDeHoje(instante), agora)}, ${horaDe(instante)}`;
}
