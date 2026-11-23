import type { UsuarioAutenticado } from '@gincana/contracts';

/**
 * Decisão de autorização do placar, como função pura.
 *
 * O placar não é dado de ninguém em particular — são totais por equipe — então ele nunca
 * teve `exigePapel` na rota. O que existe agora é um interruptor por gincana: a
 * administradora e o líder podem ocultar a tela da visão de quem participa, por exemplo
 * para não revelar o pódio antes de a apuração fechar.
 *
 * Quem ocultou continua vendo. Esconder o placar de quem o escondeu só obrigaria a pessoa
 * a reativar para conferir, e aí o efeito seria o contrário do pretendido.
 */

/** Os campos da gincana de que a autorização precisa — e só eles. */
export interface GincanaParaPolicy {
  readonly placarVisivel: boolean;
}

export function podeVerPlacar(usuario: UsuarioAutenticado, gincana: GincanaParaPolicy): boolean {
  if (usuario.papel === 'ADMIN' || usuario.papel === 'LIDER') {
    return true;
  }

  return gincana.placarVisivel;
}
