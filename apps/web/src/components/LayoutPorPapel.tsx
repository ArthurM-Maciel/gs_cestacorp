import { LayoutDaAdministradora } from '../features/administracao/LayoutDaAdministradora.js';
import { LayoutDoColaborador } from '../features/colaborador/LayoutDoColaborador.js';
import { useSessao } from '../lib/sessao.js';

/**
 * Telas que mais de um perfil abre (a fila de aprovações é do líder e da administradora)
 * aparecem dentro da moldura de quem as abriu: a administradora não pode perder o menu dela.
 */
export function LayoutPorPapel() {
  const { usuario } = useSessao();
  return usuario?.papel === 'ADMIN' ? <LayoutDaAdministradora /> : <LayoutDoColaborador />;
}
