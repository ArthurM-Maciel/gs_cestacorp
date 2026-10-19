import type { ListarColaboradoresQuery, Papel, UsuarioAutenticado } from '@gincana/contracts';

/**
 * Decisões de autorização da listagem de colaboradores, como função pura.
 *
 * O resultado é o `where` que vai para o Prisma — e não um filtro aplicado depois da
 * consulta. É essa diferença que impede alguém de alcançar gente de outra equipe trocando
 * o parâmetro na barra de endereço: o escopo entra na consulta.
 *
 * A rota de listagem hoje exige ADMIN no middleware. As outras faixas existem porque a
 * mesma função serve às telas de equipe e porque autorização que só mora no middleware
 * some no dia em que alguém reusa o serviço em outra rota.
 */
export interface FiltroDeColaboradores {
  id?: string;
  equipeId?: string;
  papel?: Papel;
}

export function montarFiltroDeColaboradores(
  usuario: UsuarioAutenticado,
  filtros: ListarColaboradoresQuery,
): FiltroDeColaboradores {
  const filtro: FiltroDeColaboradores = {};

  if (filtros.papel) {
    filtro.papel = filtros.papel;
  }

  if (usuario.papel === 'ADMIN') {
    if (filtros.equipeId) {
      filtro.equipeId = filtros.equipeId;
    }
    return filtro;
  }

  // Líder enxerga a própria equipe, independentemente do que vier na consulta.
  if (usuario.papel === 'LIDER' && usuario.equipeLideradaId) {
    filtro.equipeId = usuario.equipeLideradaId;
    return filtro;
  }

  if (usuario.equipeId) {
    filtro.equipeId = usuario.equipeId;
    return filtro;
  }

  // Sem equipe, a pessoa só alcança o próprio cadastro.
  filtro.id = usuario.id;
  return filtro;
}
