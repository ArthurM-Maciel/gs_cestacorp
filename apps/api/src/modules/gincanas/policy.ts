import type { AtualizarGincana, UsuarioAutenticado } from '@gincana/contracts';

/**
 * Decisões de autorização do cadastro da gincana, como funções puras.
 *
 * Nada aqui conhece Express nem Prisma: entra o usuário autenticado (sempre recarregado do
 * banco pelo middleware, nunca lido do corpo) e os campos que a requisição quer alterar,
 * sai um sim/não. Dá para cobrir "o líder não muda a data da gincana" sem subir HTTP.
 */

/**
 * O único campo que o líder pode alterar na gincana.
 *
 * Esconder o placar é uma decisão de condução da gincana, que o líder toma junto da
 * administradora — por exemplo para não revelar o pódio antes da apuração fechar. O resto
 * do cadastro (nome, período, situação) continua só da administradora: mexer nisso muda o
 * que vale como gincana e o que os lançamentos podem informar.
 */
const CAMPOS_DO_LIDER_NA_GINCANA: readonly string[] = ['placarVisivel'];

/**
 * Autorização por campo do corpo.
 *
 * O router libera o papel; aqui decide-se o que aquele papel tem direito de alterar.
 * Mandar `{ placarVisivel, status }` junto é recusado de propósito: senão a mudança de
 * situação pegaria carona na permissão de ocultar o placar.
 */
export function podeAtualizarGincana(
  usuario: UsuarioAutenticado,
  dados: AtualizarGincana,
): boolean {
  if (usuario.papel === 'ADMIN') {
    return true;
  }

  if (usuario.papel !== 'LIDER') {
    return false;
  }

  return Object.keys(dados).every((campo) => CAMPOS_DO_LIDER_NA_GINCANA.includes(campo));
}
