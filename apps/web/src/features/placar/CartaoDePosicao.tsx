import type { UsuarioAutenticado } from '@gincana/contracts';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { EstadoCarregando } from '../../components/ui/Estados.js';
import { botaoContorno } from '../../components/ui/estilos-de-botao.js';
import { mensagemDeErro } from '../../lib/api.js';
import { formatarPontos } from '../../lib/formatar-numero.js';
import { useGincanaAtiva } from '../colaborador/useGincanaAtiva.js';
import { useRanking } from './placar-api.js';
import {
  fraseDaDistancia,
  fraseDoEmpate,
  posicaoDaEquipe,
  tituloDaPosicao,
} from './posicao-da-equipe.js';

/** Sem equipe, sem gincana ativa ou sem placar: o cartão explica em vez de sumir. */
function CartaoSimples({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <section
      aria-labelledby="posicao-da-equipe"
      className="rounded-cartao bg-marca-900 p-5 text-superficie shadow-sm lg:max-w-xl"
    >
      <h2 id="posicao-da-equipe" className="text-xl font-bold text-balance">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

const linkDoCartao =
  'inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-superficie px-6 text-base font-semibold text-marca-900 hover:bg-marca-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-300';

/**
 * A posição da equipe no placar geral, no início do colaborador (e do líder, que também
 * participa): "Sua equipe está em segundo lugar!", o total de pontos e a distância para a
 * equipe da frente.
 *
 * Usa a mesma consulta do placar "Geral", então abrir o placar em seguida não pede nada
 * de novo. Se a consulta falhar, só o cartão avisa: "Meus lançamentos", logo abaixo,
 * continua funcionando.
 */
export function CartaoDePosicao({ usuario }: { usuario: UsuarioAutenticado }) {
  const { consulta: gincanas, ativa } = useGincanaAtiva();
  const ranking = useRanking(ativa?.id ?? null, {});

  if (usuario.equipeId === null) {
    return (
      <CartaoSimples titulo="Você ainda não está em uma equipe">
        <p className="mt-2 text-marca-100">
          A administradora vincula você a uma equipe. Depois disso, a posição dela no placar aparece
          aqui.
        </p>
      </CartaoSimples>
    );
  }

  if (gincanas.isPending || (ativa !== null && ranking.isPending)) {
    return (
      <div className="rounded-cartao bg-superficie p-2 shadow-sm lg:max-w-xl">
        <EstadoCarregando mensagem="Carregando a posição da sua equipe…" />
      </div>
    );
  }

  if (gincanas.isError || ranking.isError) {
    const erro = gincanas.isError ? gincanas.error : ranking.error;
    return (
      <CartaoSimples titulo="Não foi possível carregar a posição da sua equipe">
        <p role="alert" className="mt-2 text-marca-100">
          {mensagemDeErro(erro)}
        </p>
        <button
          type="button"
          onClick={() => {
            void (gincanas.isError ? gincanas.refetch() : ranking.refetch());
          }}
          className={`${botaoContorno} mt-4`}
        >
          Tentar de novo
        </button>
      </CartaoSimples>
    );
  }

  if (ativa === null) {
    return (
      <CartaoSimples titulo="Não há gincana ativa no momento">
        <p className="mt-2 text-marca-100">
          Quando a administradora ativar a gincana, a posição da sua equipe aparece aqui.
        </p>
      </CartaoSimples>
    );
  }

  const posicao =
    ranking.data === undefined ? null : posicaoDaEquipe(ranking.data.linhas, usuario.equipeId);

  if (posicao === null) {
    return (
      <CartaoSimples titulo="Sua equipe ainda não aparece no placar">
        <p className="mt-2 text-marca-100">
          Se você acabou de entrar numa equipe, atualize a página em instantes.
        </p>
        <Link to="/placar" className={`${linkDoCartao} mt-4`}>
          Ver o placar completo
        </Link>
      </CartaoSimples>
    );
  }

  const { linha, aFrente } = posicao;
  const empate = fraseDoEmpate(posicao);
  // A barra mostra o quanto da distância até a equipe da frente a equipe já andou. Quem está
  // na frente, ou quem ainda não pontuou, não tem o que medir: fica cheia ou vazia.
  const naFrente = aFrente[0];
  const preenchimento =
    naFrente === undefined
      ? linha.pontos === 0
        ? 0
        : 100
      : Math.round((linha.pontos / naFrente.pontos) * 100);

  return (
    <section
      aria-labelledby="posicao-da-equipe"
      className="rounded-cartao bg-marca-900 p-5 text-superficie shadow-sm lg:max-w-xl"
    >
      <p className="text-xs font-semibold tracking-wide text-marca-300 uppercase">
        Equipe {linha.equipe.nome}
      </p>
      <h2 id="posicao-da-equipe" className="mt-1 text-2xl leading-tight font-bold text-balance">
        {tituloDaPosicao(posicao)}
      </h2>
      {empate !== null && <p className="mt-1 text-marca-100">{empate}</p>}

      <p className="mt-4 text-4xl font-bold">{formatarPontos(linha.pontos)}</p>
      <p className="mt-1 text-marca-100">{fraseDaDistancia(posicao)}</p>

      {/* Só desenho: o texto acima já diz tudo o que a barra mostra. */}
      <div aria-hidden="true" className="mt-4 h-2 overflow-hidden rounded-full bg-marca-700">
        <div
          className="h-full rounded-full bg-marca-300"
          style={{ width: `${String(preenchimento)}%` }}
        />
      </div>

      <Link to="/placar" className={`${linkDoCartao} mt-5`}>
        Ver o placar completo
      </Link>
    </section>
  );
}
