import type { ReactNode } from 'react';

import { AvisoDeErro } from './Avisos.js';
import { CorpoDoDialogo, Dialogo, RodapeDoDialogo } from './Dialogo.js';
import { botaoContorno, botaoPerigo, botaoPrimario } from './estilos-de-botao.js';

interface Props {
  titulo: string;
  descricao: string;
  rotuloDeConfirmar: string;
  /** Ações que se desfazem com dificuldade (desativar, remover) pedem o botão vermelho. */
  perigosa?: boolean;
  pendente?: boolean;
  /** Mensagem de falha da última tentativa. A janela fica aberta para a pessoa decidir. */
  erro?: ReactNode;
  /** Link ou botão que resolve o problema descrito em `erro`. */
  acoesDoErro?: ReactNode;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

/**
 * Pergunta de sim ou não antes de uma ação difícil de desfazer. O foco inicial fica em
 * "Cancelar": confirmar por engano com Enter nunca é o caminho mais curto.
 */
export function DialogoDeConfirmacao({
  titulo,
  descricao,
  rotuloDeConfirmar,
  perigosa = false,
  pendente = false,
  erro,
  acoesDoErro,
  aoConfirmar,
  aoCancelar,
}: Props) {
  return (
    <Dialogo
      variante="confirmacao"
      titulo={titulo}
      descricao={descricao}
      aoFechar={aoCancelar}
      ocupado={pendente}
    >
      <CorpoDoDialogo>
        {erro !== undefined && erro !== null && erro !== '' && (
          <AvisoDeErro acoes={acoesDoErro}>{erro}</AvisoDeErro>
        )}
      </CorpoDoDialogo>
      <RodapeDoDialogo>
        <button
          type="button"
          data-foco-inicial
          disabled={pendente}
          onClick={aoCancelar}
          className={botaoContorno}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={aoConfirmar}
          className={perigosa ? botaoPerigo : botaoPrimario}
        >
          {pendente ? 'Aguarde…' : rotuloDeConfirmar}
        </button>
      </RodapeDoDialogo>
    </Dialogo>
  );
}
