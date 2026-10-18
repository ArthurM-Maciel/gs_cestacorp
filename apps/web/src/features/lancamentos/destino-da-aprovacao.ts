import type { Equipe, UsuarioAutenticado } from '@gincana/contracts';

/**
 * Para quem o lançamento vai depois de enviado ("Vai para aprovação de Arthur, líder da
 * equipe"). Segue a regra da API: o líder da equipe aprova, ninguém aprova o próprio
 * lançamento, e a administradora aprova qualquer um. Por isso quem lidera a equipe, ou a
 * equipe sem líder, cai na administradora.
 */
export function descreverDestinoDaAprovacao(
  usuario: UsuarioAutenticado,
  equipe: Equipe | null,
): string {
  if (usuario.equipeLideradaId !== null) {
    return 'Como você lidera a equipe, quem aprova é a administradora.';
  }
  if (equipe === null) {
    return 'Vai para aprovação do líder da sua equipe.';
  }
  if (equipe.lider === null) {
    return 'A sua equipe ainda não tem líder: quem aprova é a administradora.';
  }
  return `Vai para aprovação de ${equipe.lider.nome}, líder da equipe.`;
}
