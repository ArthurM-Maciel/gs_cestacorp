import type { Papel } from '@gincana/contracts';

export const rotulosDePapel: Record<Papel, string> = {
  COLABORADOR: 'Colaborador',
  LIDER: 'Líder de equipe',
  ADMIN: 'Administradora',
};

export const tonsDePapel: Record<Papel, 'neutro' | 'sucesso'> = {
  COLABORADOR: 'neutro',
  LIDER: 'sucesso',
  ADMIN: 'sucesso',
};
