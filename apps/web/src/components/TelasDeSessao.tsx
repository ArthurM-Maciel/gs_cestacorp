import type { Papel } from '@gincana/contracts';
import { Link } from 'react-router-dom';

import { caminhoInicial } from '../lib/destinos.js';
import { CartaoDeMensagem } from './CartaoDeMensagem.js';
import { botaoContorno, botaoPrimario } from './ui/estilos-de-botao.js';

export function TelaDeCarregamento({ mensagem }: { mensagem: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-fundo px-4">
      <div role="status" className="flex flex-col items-center gap-3 text-texto-suave">
        <span
          aria-hidden="true"
          className="size-8 animate-spin rounded-full border-4 border-marca-100 border-t-marca-600 motion-reduce:animate-none"
        />
        <p>{mensagem}</p>
      </div>
    </main>
  );
}

interface PropsDaFalha {
  aoTentarDeNovo: () => void;
  aoSair: () => void;
}

/** Há token, mas o servidor não respondeu: a pessoa decide entre insistir e entrar de novo. */
export function TelaDeFalhaNaSessao({ aoTentarDeNovo, aoSair }: PropsDaFalha) {
  return (
    <CartaoDeMensagem
      alerta
      titulo="Não conseguimos confirmar o seu acesso"
      descricao="Verifique sua internet e tente de novo. Se o problema continuar, saia e entre outra vez."
    >
      <button type="button" onClick={aoTentarDeNovo} className={botaoPrimario}>
        Tentar de novo
      </button>
      <button type="button" onClick={aoSair} className={botaoContorno}>
        Sair
      </button>
    </CartaoDeMensagem>
  );
}

/** A pessoa está autenticada, mas a área é de outro perfil. */
export function TelaSemPermissao({ papel }: { papel: Papel }) {
  return (
    <CartaoDeMensagem
      titulo="Você não tem acesso a esta página"
      descricao="Esta área é de outro perfil. Volte para o seu início para continuar."
    >
      <Link to={caminhoInicial(papel)} replace className={botaoPrimario}>
        Ir para o meu início
      </Link>
    </CartaoDeMensagem>
  );
}
