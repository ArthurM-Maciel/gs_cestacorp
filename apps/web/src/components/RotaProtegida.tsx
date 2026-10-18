import type { Papel } from '@gincana/contracts';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useSessao } from '../lib/sessao.js';
import { TelaDeCarregamento, TelaDeFalhaNaSessao, TelaSemPermissao } from './TelasDeSessao.js';

interface Props {
  /** Perfis que podem abrir as rotas filhas. Sem a lista, basta estar autenticado. */
  papeis?: readonly Papel[];
}

/**
 * Guarda de rota: exige sessão e, opcionalmente, um dos perfis informados.
 *
 * Isto é conveniência de interface. Quem protege o dado de verdade é a API, que confere
 * o perfil e o escopo em cada chamada: abrir esta tela por outro meio não devolve dado
 * nenhum.
 */
export function RotaProtegida({ papeis }: Props) {
  const { situacao, usuario, sair, tentarDeNovo } = useSessao();
  const local = useLocation();

  // Enquanto o servidor confirma o token não decidimos nada, para não piscar a tela de
  // login diante de quem já está autenticado.
  if (situacao === 'carregando') {
    return <TelaDeCarregamento mensagem="Verificando sua sessão…" />;
  }

  if (situacao === 'indisponivel') {
    return <TelaDeFalhaNaSessao aoTentarDeNovo={tentarDeNovo} aoSair={sair} />;
  }

  if (usuario === null) {
    return (
      <Navigate
        to="/entrar"
        replace
        state={{ de: `${local.pathname}${local.search}${local.hash}` }}
      />
    );
  }

  if (papeis !== undefined && !papeis.includes(usuario.papel)) {
    return <TelaSemPermissao papel={usuario.papel} />;
  }

  return <Outlet />;
}
