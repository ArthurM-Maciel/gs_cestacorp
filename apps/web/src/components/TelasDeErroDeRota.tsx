import { Link } from 'react-router-dom';

import { CartaoDeMensagem } from './CartaoDeMensagem.js';
import { botaoPrimario } from './ui/estilos-de-botao.js';

export function PaginaNaoEncontrada() {
  return (
    <CartaoDeMensagem
      titulo="Página não encontrada"
      descricao="O endereço pode estar errado ou a página mudou de lugar."
    >
      <Link to="/" className={botaoPrimario}>
        Voltar ao início
      </Link>
    </CartaoDeMensagem>
  );
}

/** Rede de segurança: falha inesperada ao desenhar uma tela nunca mostra erro técnico. */
export function ErroInesperado() {
  return (
    <CartaoDeMensagem
      alerta
      titulo="Algo deu errado"
      descricao="Não foi possível abrir esta tela. Recarregue a página e tente de novo."
    >
      <button
        type="button"
        onClick={() => {
          window.location.reload();
        }}
        className={botaoPrimario}
      >
        Recarregar a página
      </button>
    </CartaoDeMensagem>
  );
}
