import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';

import { CabecalhoDePagina } from '../../components/ui/CabecalhoDePagina.js';
import { botaoContorno } from '../../components/ui/estilos-de-botao.js';
import { EstadoCarregando, EstadoDeErro, EstadoVazio } from '../../components/ui/Estados.js';
import { mensagemDeErro } from '../../lib/api.js';
import { useSessao } from '../../lib/sessao.js';
import { FormularioDeCorrecao } from './FormularioDeCorrecao.js';
import { useLancamento } from './lancamentos-api.js';

function VoltarAoInicio() {
  return (
    <Link to="/inicio" className={botaoContorno}>
      Voltar para o início
    </Link>
  );
}

/**
 * US06 + US10 — corrigir e reenviar o lançamento recusado (ou ajustar um pendente).
 * Quem chega aqui pelo "Corrigir e reenviar" da lista vê o motivo da recusa primeiro, antes
 * de mexer em qualquer campo.
 */
export function TelaDeCorrigir() {
  const { id = '' } = useParams();
  const { usuario } = useSessao();
  const consulta = useLancamento(id);

  if (consulta.isPending) {
    return <EstadoCarregando mensagem="Carregando o lançamento…" />;
  }

  if (consulta.isError) {
    if (isAxiosError(consulta.error) && consulta.error.response?.status === 404) {
      return (
        <EstadoVazio
          titulo="Lançamento não encontrado"
          descricao="Ele não existe ou não é seu. Volte ao início para ver os seus lançamentos."
        >
          <VoltarAoInicio />
        </EstadoVazio>
      );
    }
    return (
      <EstadoDeErro
        mensagem={mensagemDeErro(consulta.error)}
        aoTentarDeNovo={() => {
          void consulta.refetch();
        }}
      />
    );
  }

  const lancamento = consulta.data;

  if (usuario === null || lancamento.colaboradorId !== usuario.id) {
    return (
      <EstadoVazio
        titulo="Este lançamento não é seu"
        descricao="Só quem registrou a ação pode corrigi-la."
      >
        <VoltarAoInicio />
      </EstadoVazio>
    );
  }

  if (lancamento.status === 'APROVADO') {
    return (
      <EstadoVazio
        titulo="Este lançamento já foi aprovado"
        descricao="Depois de aprovado, ele não muda mais. Se algo estiver errado, fale com a administradora."
      >
        <VoltarAoInicio />
      </EstadoVazio>
    );
  }

  const recusado = lancamento.status === 'RECUSADO';

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <CabecalhoDePagina
        sobretitulo={recusado ? 'Corrigir e reenviar' : 'Corrigir lançamento'}
        titulo={lancamento.tipoAcao.nome}
        descricao={
          recusado
            ? 'Ajuste o que o líder apontou e reenvie: o lançamento volta para a fila de aprovação.'
            : 'Ajuste os dados ou anexe o comprovante. O lançamento continua na fila de aprovação.'
        }
      />

      {recusado && lancamento.motivoRecusa !== null && (
        <section
          aria-labelledby="motivo-da-recusa"
          className="rounded-cartao border-2 border-recusado bg-recusado-fundo p-4 text-recusado"
        >
          <h2 id="motivo-da-recusa" className="text-sm font-semibold tracking-wide uppercase">
            Motivo da recusa
            {lancamento.avaliadoPor !== null && ` · ${lancamento.avaliadoPor.nome}`}
          </h2>
          <p className="mt-1 font-semibold">{lancamento.motivoRecusa}</p>
        </section>
      )}

      <div className="rounded-cartao bg-superficie p-5 shadow-sm">
        <FormularioDeCorrecao lancamento={lancamento} />
      </div>
    </div>
  );
}
