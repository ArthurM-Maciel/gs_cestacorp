import { rotulosDeUnidade, type Unidade } from '@gincana/contracts';

const formatador = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

/** `1250` → `1.250`; `1.5` → `1,5`. */
export function formatarNumero(valor: number): string {
  return formatador.format(valor);
}

export function formatarPontos(pontos: number): string {
  return `${formatarNumero(pontos)} pts`;
}

/** `12` + KG → `12 kg`; `1` + CERTIFICADO → `1 certificado`; `8` + PECA → `8 peças`. */
export function formatarQuantidade(quantidade: number, unidade: Unidade): string {
  const rotulo = rotulosDeUnidade[unidade];
  return `${formatarNumero(quantidade)} ${quantidade === 1 ? rotulo.singular : rotulo.plural}`;
}

/** `10` + KG → `10 pts por kg`: o preço que a tela de escolher ação mostra em cada tipo. */
export function formatarPontosPorUnidade(pontosPorUnidade: number, unidade: Unidade): string {
  return `${formatarPontos(pontosPorUnidade)} por ${rotulosDeUnidade[unidade].singular}`;
}

export function formatarTamanhoDeArquivo(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${formatador.format(Math.round((bytes / (1024 * 1024)) * 10) / 10)} MB`;
  }
  return `${formatador.format(Math.max(1, Math.round(bytes / 1024)))} KB`;
}
