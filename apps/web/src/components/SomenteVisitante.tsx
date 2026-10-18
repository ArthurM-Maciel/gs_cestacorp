import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { destinoAposEntrar } from '../lib/destinos.js';
import { useSessao } from '../lib/sessao.js';
import { TelaDeCarregamento, TelaDeFalhaNaSessao } from './TelasDeSessao.js';

/**
 * Guarda das telas de acesso (boas-vindas, login, criar conta): quem já está autenticado
 * não vê o login, vai direto para onde estava indo ou para o início do seu perfil.
 *
 * É este guarda, e não o formulário, que faz a navegação depois do login: ao entrar, a
 * sessão muda e a rota se resolve sozinha.
 */
export function SomenteVisitante() {
  const { situacao, usuario, sair, tentarDeNovo } = useSessao();
  const local = useLocation();

  if (situacao === 'carregando') {
    return <TelaDeCarregamento mensagem="Verificando sua sessão…" />;
  }

  if (situacao === 'indisponivel') {
    return <TelaDeFalhaNaSessao aoTentarDeNovo={tentarDeNovo} aoSair={sair} />;
  }

  if (usuario !== null) {
    return <Navigate to={destinoAposEntrar(local.state, usuario.papel)} replace />;
  }

  return <Outlet />;
}
