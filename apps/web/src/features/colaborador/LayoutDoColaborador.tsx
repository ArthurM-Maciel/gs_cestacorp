import { MoldeDeNavegacao } from '../../components/ui/MoldeDeNavegacao.js';
import { useSessao } from '../../lib/sessao.js';
import { paraAvaliar, usePendentes } from '../aprovacoes/aprovacoes-api.js';
import { itensDoColaborador, itensDoLider } from './itens-do-menu.js';
import { useMinhaEquipe } from './useMinhaEquipe.js';

/**
 * Moldura das telas do colaborador e do líder: barra inferior no celular, menu lateral no
 * computador. O líder ganha "Aprovar", com o número de pendentes no selo.
 *
 * O selo vem da mesma consulta da fila de aprovações, então o número da barra e o da tela
 * nunca divergem, e uma decisão atualiza os dois juntos.
 */
export function LayoutDoColaborador() {
  const { usuario } = useSessao();
  const equipe = useMinhaEquipe();
  const ehLider = usuario?.papel === 'LIDER';
  const pendentes = usePendentes(ehLider);

  if (usuario === null) {
    return null;
  }

  const quantas = pendentes.isSuccess ? paraAvaliar(pendentes.data, usuario).length : 0;
  const itens = ehLider ? itensDoLider(quantas) : itensDoColaborador();

  let descricao: string;
  if (equipe === null) {
    descricao = ehLider ? 'Líder de equipe' : 'Colaborador';
  } else {
    descricao = ehLider ? `Líder da equipe ${equipe.nome}` : `Equipe ${equipe.nome}`;
  }

  return <MoldeDeNavegacao itens={itens} descricaoDoPerfil={descricao} />;
}
