import type { ComponentType, SVGProps } from 'react';

import {
  IconeAprovacoes,
  IconeColaboradores,
  IconeEquipes,
  IconeGincanas,
  IconePainel,
  IconePlacar,
  IconeRegras,
} from './IconesDoMenu.js';

export interface ItemDoMenu {
  chave: string;
  rotulo: string;
  Icone: ComponentType<SVGProps<SVGSVGElement>>;
  /** Telas que existem têm caminho. Sem caminho, a tela é de uma história futura. */
  caminho: string | null;
}

/**
 * O menu da administradora. Os itens sem caminho aparecem desabilitados no computador,
 * com "Em breve", e ficam de fora da barra do celular: link para uma tela que não existe
 * só ensina a pessoa a não confiar no menu.
 *
 * "Gincanas" e "Colaboradores" não estão no protótipo (o menu dele tem cinco itens), mas
 * as histórias US02 e US03 precisam de um lugar para viver.
 */
export const itensDoMenu: readonly ItemDoMenu[] = [
  { chave: 'painel', rotulo: 'Painel', Icone: IconePainel, caminho: '/painel' },
  { chave: 'gincanas', rotulo: 'Gincanas', Icone: IconeGincanas, caminho: '/gincanas' },
  { chave: 'equipes', rotulo: 'Equipes', Icone: IconeEquipes, caminho: '/equipes' },
  {
    chave: 'colaboradores',
    rotulo: 'Colaboradores',
    Icone: IconeColaboradores,
    caminho: '/colaboradores',
  },
  { chave: 'regras', rotulo: 'Regras', Icone: IconeRegras, caminho: null },
  { chave: 'aprovacoes', rotulo: 'Aprovações', Icone: IconeAprovacoes, caminho: null },
  { chave: 'placar', rotulo: 'Placar', Icone: IconePlacar, caminho: null },
];
