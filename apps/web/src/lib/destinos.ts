import type { Papel } from '@gincana/contracts';

/**
 * Primeira tela de cada perfil depois de entrar. As próximas histórias trocam o conteúdo
 * da rota, não o caminho.
 */
const inicioPorPapel: Record<Papel, string> = {
  COLABORADOR: '/inicio',
  LIDER: '/aprovacoes',
  ADMIN: '/painel',
};

export function caminhoInicial(papel: Papel): string {
  return inicioPorPapel[papel];
}

/**
 * Para onde ir depois de entrar: de volta à página que a pessoa tentou abrir, se o guarda
 * a guardou, ou ao início do perfil. Só aceita caminho interno, para que um estado de
 * navegação adulterado nunca leve para outro site.
 */
export function destinoAposEntrar(estadoDaNavegacao: unknown, papel: Papel): string {
  if (
    typeof estadoDaNavegacao === 'object' &&
    estadoDaNavegacao !== null &&
    'de' in estadoDaNavegacao &&
    typeof estadoDaNavegacao.de === 'string' &&
    estadoDaNavegacao.de.startsWith('/') &&
    !estadoDaNavegacao.de.startsWith('//')
  ) {
    return estadoDaNavegacao.de;
  }
  return caminhoInicial(papel);
}
