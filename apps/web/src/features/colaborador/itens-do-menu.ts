import type { ItemDoMenu } from '../../components/ui/MoldeDeNavegacao.js';
import { IconeAprovacoes, IconePlacar } from '../administracao/IconesDoMenu.js';
import { IconeInicio, IconeRegistrar } from './IconesDoMenu.js';

const inicio: ItemDoMenu = {
  chave: 'inicio',
  rotulo: 'Início',
  Icone: IconeInicio,
  caminho: '/inicio',
};

const registrar: ItemDoMenu = {
  chave: 'registrar',
  rotulo: 'Registrar ação',
  rotuloCurto: 'Registrar',
  Icone: IconeRegistrar,
  caminho: '/registrar',
};

const placar: ItemDoMenu = {
  chave: 'placar',
  rotulo: 'Placar',
  Icone: IconePlacar,
  caminho: '/placar',
};

export function itensDoColaborador(): readonly ItemDoMenu[] {
  return [inicio, registrar, placar];
}

/** O líder ganha a fila de aprovações, com o contador de pendentes no selo. */
export function itensDoLider(pendentes: number): readonly ItemDoMenu[] {
  return [
    inicio,
    {
      chave: 'aprovacoes',
      rotulo: 'Aprovações',
      rotuloCurto: 'Aprovar',
      Icone: IconeAprovacoes,
      caminho: '/aprovacoes',
      selo: pendentes,
    },
    registrar,
    placar,
  ];
}
