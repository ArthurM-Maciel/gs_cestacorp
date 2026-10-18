/** `AAAA-MM-DD` de um instante, no dia do calendário de quem está olhando (fuso do aparelho). */
export function dataDeHoje(agora: Date = new Date()): string {
  const ano = String(agora.getFullYear());
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Como a lista chama o dia da ação: "hoje", "ontem" ou a data ("12/11"; com o ano quando
 * não é o atual). A conta é feita nos números do calendário, sem `Date` sobre a data da
 * ação, pelo mesmo motivo de `formatarData`: aplicar fuso faria o dia escorregar.
 */
export function descreverDia(dataIso: string, agora: Date = new Date()): string {
  const dia = dataIso.slice(0, 10);
  if (dia === dataDeHoje(agora)) {
    return 'hoje';
  }

  const ontem = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1);
  if (dia === dataDeHoje(ontem)) {
    return 'ontem';
  }

  const [ano, mes, diaDoMes] = dia.split('-');
  if (ano === undefined || mes === undefined || diaDoMes === undefined) {
    return dataIso;
  }
  return ano === String(agora.getFullYear()) ? `${diaDoMes}/${mes}` : `${diaDoMes}/${mes}/${ano}`;
}
