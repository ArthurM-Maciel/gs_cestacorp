import type { RespostaLogin, UsuarioAutenticado } from '@gincana/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { aoExpirarSessao } from './api.js';
import { buscarUsuarioAtual } from './autenticacao.js';
import { gravarToken, lerToken, limparToken } from './token.js';

/**
 * - `carregando`: há token guardado e o servidor ainda não confirmou quem é a pessoa.
 * - `anonima`: sem token (ou o servidor recusou o que havia).
 * - `indisponivel`: há token, mas não deu para confirmar (rede ou servidor fora).
 *   O token NÃO é descartado: o problema pode ser passageiro.
 * - `autenticada`: o servidor confirmou o usuário.
 */
export type SituacaoDaSessao = 'carregando' | 'anonima' | 'indisponivel' | 'autenticada';

export interface Sessao {
  situacao: SituacaoDaSessao;
  usuario: UsuarioAutenticado | null;
  /** O servidor recusou um token que existia; a tela de login explica por que voltou. */
  sessaoExpirada: boolean;
  entrar: (resposta: RespostaLogin) => void;
  sair: () => void;
  tentarDeNovo: () => void;
}

const SessaoContexto = createContext<Sessao | null>(null);

export const chaveDoUsuarioAtual = ['sessao', 'usuario'] as const;

export function SessaoProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [temToken, setTemToken] = useState(() => lerToken() !== null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);

  // Revalida ao carregar a página: o papel pode ter mudado desde que o token foi emitido.
  // `staleTime` infinito faz a revalidação acontecer uma vez por carregamento, e o login
  // já grava o usuário no cache, então não há segunda chamada logo depois de entrar.
  const consulta = useQuery({
    queryKey: chaveDoUsuarioAtual,
    queryFn: buscarUsuarioAtual,
    enabled: temToken,
    staleTime: Infinity,
    retry: false,
  });
  const { refetch } = consulta;

  useEffect(
    () =>
      aoExpirarSessao(() => {
        setTemToken(false);
        setSessaoExpirada(true);
        // Dado em cache é dado da pessoa que saiu.
        queryClient.clear();
      }),
    [queryClient],
  );

  const entrar = useCallback(
    (resposta: RespostaLogin) => {
      gravarToken(resposta.token);
      queryClient.setQueryData(chaveDoUsuarioAtual, resposta.usuario);
      setSessaoExpirada(false);
      setTemToken(true);
    },
    [queryClient],
  );

  const sair = useCallback(() => {
    limparToken();
    setSessaoExpirada(false);
    setTemToken(false);
    queryClient.clear();
  }, [queryClient]);

  const tentarDeNovo = useCallback(() => {
    void refetch();
  }, [refetch]);

  const usuario = temToken ? (consulta.data ?? null) : null;

  let situacao: SituacaoDaSessao;
  if (!temToken) {
    situacao = 'anonima';
  } else if (usuario !== null) {
    situacao = 'autenticada';
  } else if (consulta.isError) {
    situacao = 'indisponivel';
  } else {
    situacao = 'carregando';
  }

  const valor = useMemo<Sessao>(
    () => ({ situacao, usuario, sessaoExpirada, entrar, sair, tentarDeNovo }),
    [situacao, usuario, sessaoExpirada, entrar, sair, tentarDeNovo],
  );

  return <SessaoContexto.Provider value={valor}>{children}</SessaoContexto.Provider>;
}

export function useSessao(): Sessao {
  const contexto = useContext(SessaoContexto);
  if (contexto === null) {
    throw new Error('useSessao precisa ser usado dentro de <SessaoProvider>.');
  }
  return contexto;
}
