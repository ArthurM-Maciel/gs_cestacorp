import type { ListarTiposAcaoQuery, UsuarioAutenticado } from '@gincana/contracts';

/**
 * Decisões de autorização de leitura dos tipos de ação, como funções puras.
 *
 * O resultado é o `where` que vai para o Prisma, nunca um filtro aplicado depois da
 * consulta: é isso que impede alguém de alcançar um tipo pausado trocando o parâmetro na
 * barra de endereço.
 *
 * A regra de fundo é a do protótipo: pausar um tipo o tira do formulário de quem registra
 * ação, mas não apaga nem esconde nada da administradora — que precisa reativar, conferir
 * o histórico de pontuação e explicar a apuração.
 */
export interface EscopoDeTiposAcao {
  gincanaId?: string;
  id?: string;
  ativo?: boolean;
}

/** Só a administradora enxerga tipo pausado. */
export function enxergaTipoPausado(usuario: UsuarioAutenticado): boolean {
  return usuario.papel === 'ADMIN';
}

/**
 * Escopo da listagem de uma gincana.
 *
 * Para a administradora, o filtro `ativo` da consulta vale como ela pediu. Para os demais
 * perfis, `ativo: true` é imposto — pedir `ativo=false` devolve lista vazia, e não a lista
 * do que está pausado.
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
