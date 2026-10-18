/**
 * `AAAA-MM-DD` → `DD/MM/AAAA`, sem passar por `Date`.
 *
 * A gincana começa e termina num dia do calendário, não num instante. Converter para `Date`
 * aplicaria o fuso do navegador e faria o dia escorregar para o anterior em quem está a
 * oeste do UTC.
 */
export function formatarData(dataIso: string): string {
  const [ano, mes, dia] = dataIso.slice(0, 10).split('-');
  if (ano === undefined || mes === undefined || dia === undefined) {
    return dataIso;
  }
  return `${dia}/${mes}/${ano}`;
}
