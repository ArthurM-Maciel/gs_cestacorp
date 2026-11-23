import type {
  AtualizarTipoAcao,
  ListarTiposAcaoQuery,
  UsuarioAutenticado,
} from '@gincana/contracts';

/**
 * Decisões de autorização de leitura dos tipos de ação, como funções puras.
 *
 * O resultado é o `where` que vai para o Prisma, nunca um filtro aplicado depois da
 * consulta: é isso que impede alguém de alcançar um tipo pausado trocando o parâmetro na
 * barra de endereço.
 *
 * A regra de fundo é a do protótipo: pausar um tipo o tira do formulário de quem registra
 * ação, mas não apaga nem esconde nada de quem administra a gincana — que precisa
 * reativar, conferir o histórico de pontuação e explicar a apuração.
 */
export interface EscopoDeTiposAcao {
  gincanaId?: string;
  id?: string;
  ativo?: boolean;
}

/**
 * Quem enxerga tipo pausado: a administradora e o líder.
 *
 * O líder entrou aqui junto da permissão de pausar — reativar um tipo que ele não
 * consegue nem listar seria um caminho sem volta. O colaborador continua de fora: para
 * quem registra ação, tipo pausado simplesmente não existe.
 */
export function enxergaTipoPausado(usuario: UsuarioAutenticado): boolean {
  return usuario.papel === 'ADMIN' || usuario.papel === 'LIDER';
}

/**
 * Os campos que o líder pode mexer no cadastro do tipo de ação.
 *
 * Pausar e reativar é só `ativo`. A identidade do tipo — nome, descrição, exigência de
 * comprovante — continua sendo decisão da administradora, porque mexe no que a gincana
 * promete a quem participa.
 */
const CAMPOS_DO_LIDER_NO_TIPO: readonly string[] = ['ativo'];

/**
 * Autorização por campo do corpo: o papel abre a porta no router, aqui decide-se o que
 * aquele papel tem direito de alterar.
 *
 * Mandar `{ ativo, nome }` numa mesma chamada é recusado de propósito: senão a mudança de
 * identidade pegaria carona na permissão de pausar.
 */
export function podeAtualizarTipoAcao(
  usuario: UsuarioAutenticado,
  dados: AtualizarTipoAcao,
): boolean {
  if (usuario.papel === 'ADMIN') {
    return true;
  }

  if (usuario.papel !== 'LIDER') {
    return false;
  }

  return Object.keys(dados).every((campo) => CAMPOS_DO_LIDER_NO_TIPO.includes(campo));
}

/**
 * Escopo da listagem de uma gincana.
 *
 * Para quem enxerga tipo pausado, o filtro `ativo` da consulta vale como pedido. Para o
 * colaborador, `ativo: true` é imposto — pedir `ativo=false` devolve lista vazia, e não a
 * lista do que está pausado.
 */
export function escopoDaListaDeTiposAcao(
  usuario: UsuarioAutenticado,
  gincanaId: string,
  filtros: ListarTiposAcaoQuery,
): EscopoDeTiposAcao {
  if (!enxergaTipoPausado(usuario)) {
    return { gincanaId, ativo: true };
  }

  return filtros.ativo === undefined ? { gincanaId } : { gincanaId, ativo: filtros.ativo };
}

/** Escopo da consulta de um tipo específico, pelo identificador da rota. */
export function escopoDoTipoAcao(usuario: UsuarioAutenticado, id: string): EscopoDeTiposAcao {
  return enxergaTipoPausado(usuario) ? { id } : { id, ativo: true };
}
