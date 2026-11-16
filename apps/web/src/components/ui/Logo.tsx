import logoHorizontalNegativa from '../../assets/marca/logo-horizontal-negativa.png';
import logoHorizontalPositiva from '../../assets/marca/logo-horizontal-positiva.png';
import logoSimboloNegativa from '../../assets/marca/logo-simbolo-negativa.png';
import logoSimboloPositiva from '../../assets/marca/logo-simbolo-positiva.png';
import logoVerticalNegativa from '../../assets/marca/logo-vertical-negativa.png';
import logoVerticalPositiva from '../../assets/marca/logo-vertical-positiva.png';

interface Props {
  /** Vertical empilha símbolo acima do nome (versão prioritária do manual); horizontal
   * põe os dois lado a lado (versão secundária). Ignorado quando `somenteSimbolo`. */
  variante?: 'vertical' | 'horizontal';
  /** Positiva: arte colorida, para fundo claro. Negativa: arte toda branca, para fundo
   * escuro/colorido — as duas variações que o manual define. */
  tom?: 'positiva' | 'negativa';
  /** Renderiza só o círculo+seta, sem o nome — para o topo estreito do celular. */
  somenteSimbolo?: boolean;
  /** Controla o tamanho (ex.: `h-7`): a imagem mantém a proporção original sozinha,
   * então só a altura precisa ser passada — nunca `size-*`, que a distorceria. */
  className?: string;
}

/**
 * Logo oficial da Cestacorp, recortado diretamente das artes do Manual de Identidade
 * Visual (páginas 5, 6, 8 e 9 — PNGs com transparência, extraídos do PDF e aparados).
 * Nenhum traço foi redesenhado à mão: é a arte original da agência (Moonflag), por isso
 * é fiel ao manual em vez de uma reconstrução aproximada.
 */
const FONTES = {
  vertical: { positiva: logoVerticalPositiva, negativa: logoVerticalNegativa },
  horizontal: { positiva: logoHorizontalPositiva, negativa: logoHorizontalNegativa },
  simbolo: { positiva: logoSimboloPositiva, negativa: logoSimboloNegativa },
} as const;

export function Logo({
  variante = 'horizontal',
  tom = 'positiva',
  somenteSimbolo = false,
  className,
}: Props) {
  const src = somenteSimbolo ? FONTES.simbolo[tom] : FONTES[variante][tom];

  return (
    <img
      src={src}
      alt={somenteSimbolo ? '' : 'Cestacorp'}
      aria-hidden={somenteSimbolo ? true : undefined}
      className={className}
    />
  );
}
