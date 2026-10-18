import { recusarLancamentoSchema, type Lancamento } from '@gincana/contracts';
import { useRef, useState, type FormEvent } from 'react';

import { AreaDeTexto } from '../../components/ui/AreaDeTexto.js';
import { AvisoDeErro } from '../../components/ui/Avisos.js';
import { CorpoDoDialogo, Dialogo, RodapeDoDialogo } from '../../components/ui/Dialogo.js';
import { botaoContorno, botaoPerigo } from '../../components/ui/estilos-de-botao.js';
import { errosDoSchema } from '../../lib/erro-da-api.js';

interface Props {
  lancamento: Lancamento;
  pendente: boolean;
  /** Mensagem geral da última tentativa. A janela fica aberta para a pessoa decidir. */
  erro: string | null;
  /** Erro do motivo apontado pela API (`DADOS_INVALIDOS` com `detalhes`). */
  erroDoMotivo: string | undefined;
  aoConfirmar: (motivo: string) => void;
  aoCancelar: () => void;
}

/**
 * Recusar exige motivo: sem ele o colaborador não sabe o que corrigir e lança a mesma coisa
 * de novo. A mesma regra do contrato (`recusarLancamentoSchema`) vale aqui e na API.
 * O `<dialog>` modal prende o foco, fecha com Esc e devolve o foco ao botão "Recusar".
 */
export function DialogoDeRecusa({
  lancamento,
  pendente,
  erro,
  erroDoMotivo,
  aoConfirmar,
  aoCancelar,
}: Props) {
  const [motivo, setMotivo] = useState('');
  const [erroLocal, setErroLocal] = useState<string | undefined>(undefined);
  const formulario = useRef<HTMLFormElement>(null);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const resultado = recusarLancamentoSchema.safeParse({ motivoRecusa: motivo });

    if (!resultado.success) {
      setErroLocal(errosDoSchema(resultado.error.issues, ['motivoRecusa']).motivoRecusa);
      formulario.current?.querySelector('textarea')?.focus();
      return;
    }

    setErroLocal(undefined);
    aoConfirmar(resultado.data.motivoRecusa);
  }

  return (
    <Dialogo
      variante="confirmacao"
      titulo="Recusar lançamento"
      descricao={`${lancamento.tipoAcao.nome} de ${lancamento.colaborador.nome}. O colaborador vai ler o motivo e poderá corrigir e reenviar.`}
      aoFechar={aoCancelar}
      ocupado={pendente}
    >
      <form ref={formulario} noValidate onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
        <CorpoDoDialogo>
          {erro !== null && <AvisoDeErro>{erro}</AvisoDeErro>}
          <AreaDeTexto
            rotulo="Motivo da recusa"
            name="motivoRecusa"
            rows={4}
            maxLength={500}
            value={motivo}
            onChange={(evento) => {
              setMotivo(evento.target.value);
              setErroLocal(undefined);
            }}
            erro={erroLocal ?? erroDoMotivo}
            dica="Diga o que precisa ser corrigido, por exemplo: foto sem a etiqueta da ONG."
            data-foco-inicial
          />
        </CorpoDoDialogo>
        <RodapeDoDialogo>
          <button type="button" disabled={pendente} onClick={aoCancelar} className={botaoContorno}>
            Cancelar
          </button>
          <button type="submit" disabled={pendente} className={botaoPerigo}>
            {pendente ? 'Recusando…' : 'Recusar'}
          </button>
        </RodapeDoDialogo>
      </form>
    </Dialogo>
  );
}
