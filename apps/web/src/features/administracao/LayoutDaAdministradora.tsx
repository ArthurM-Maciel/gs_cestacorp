import { MoldeDeNavegacao } from '../../components/ui/MoldeDeNavegacao.js';
import { itensDoMenu } from './itens-do-menu.js';

/**
 * Moldura das telas da administradora. O molde (menu lateral no computador, barra inferior
 * no celular) é o mesmo do colaborador e do líder; aqui só mudam os itens do menu.
 */
export function LayoutDaAdministradora() {
  return <MoldeDeNavegacao itens={itensDoMenu} descricaoDoPerfil="Administradora" />;
}
