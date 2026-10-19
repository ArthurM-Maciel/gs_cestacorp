import type { Lancamento, StatusLancamento, UsuarioAutenticado } from '@gincana/contracts';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { AvisoDeErro, AvisoDeSucesso } from '../../components/ui/Avisos.js';
import { CabecalhoDePagina } from '../../components/ui/CabecalhoDePagina.js';
import {
  botaoContorno,
  botaoDeLinha,
  botaoPrimario,
} from '../../components/ui/estilos-de-botao.js';
import { EstadoCarregando, EstadoDeErro, EstadoVazio } from '../../components/ui/Estados.js';
import { ListaResponsiva, type ColunaDaLista } from '../../components/ui/ListaResponsiva.js';
import { mensagemDeErro } from '../../lib/api.js';
import { descreverDia } from '../../lib/dia-relativo.js';
import { formatarPontos, formatarQuantidade } from '../../lib/formatar-numero.js';
import { useSessao } from '../../lib/sessao.js';
import { CelulaDaAcao } from '../lancamentos/CelulaDaAcao.js';
import { EtiquetaDeStatus } from '../lancamentos/EtiquetaDeStatus.js';
import { useMeusLancamentos, useTotalDeMeusLancamentos } from '../lancamentos/lancamentos-api.js';
import { CartaoDePosicao } from '../placar/CartaoDePosicao.js';
import { lerAvisoDaNavegacao } from './aviso-da-navegacao.js';

function Total({
  rotulo,
  status,
  colaboradorId,
  cor,
}: {
  rotulo: string;
  status: StatusLancamento;
  colaboradorId: string;
  cor: string;
}) {
  const total = useTotalDeMeusLancamentos(colaboradorId, status);
  return (
    <div className="rounded-cartao bg-superficie p-4 shadow-sm">
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className={`mt-1 text-3xl font-bold ${cor}`}>{total.isSuccess ? total.data : '—'}</dd>
    </div>
  );
}

/** Falta o comprovante que a ação exige: o líder não conseguiria aprovar. */
function faltaComprovante(lancamento: Lancamento): boolean {
  return (
    lancamento.status === 'PENDENTE' &&
    lancamento.tipoAcao.exigeEvidencia &&
    lancamento.evidencias.length === 0
  );
}

const colunas: ColunaDaLista<Lancamento>[] = [
  {
    chave: 'acao',
    titulo: 'Ação',
    semRotuloNoCelular: true,
    renderizar: (lancamento) => <CelulaDaAcao lancamento={lancamento} />,
  },
  {
    chave: 'detalhe',
    titulo: 'Detalhe',
    semRotuloNoCelular: true,
    renderizar: (lancamento) => (
      <>
        <p className="text-texto-suave">
          {formatarQuantidade(lancamento.quantidade, lancamento.tipoAcao.unidade)} ·{' '}
          {descreverDia(lancamento.dataAcao)}
        </p>
        {lancamento.status === 'RECUSADO' && lancamento.motivoRecusa !== null && (
          <p className="mt-1 text-sm font-semibold text-recusado">
            Motivo da recusa: {lancamento.motivoRecusa}
          </p>
        )}
        {faltaComprovante(lancamento) && (
          <p className="mt-1 text-sm font-semibold text-pendente">
            Falta o comprovante que esta ação exige.
          </p>
        )}
      </>
    ),
  },
  {
    chave: 'pontos',
    titulo: 'Pontos',
    renderizar: (lancamento) =>
      lancamento.status === 'RECUSADO' ? (
        <span>
          <span aria-hidden="true">—</span>
          <span className="sr-only">Sem pontos: lançamento recusado</span>
        </span>
      ) : (
        <span className="font-semibold text-aprovado">
          +{formatarPontos(lancamento.pontosCalculados)}
        </span>
      ),
  },
  {
    chave: 'status',
    titulo: 'Status',
    renderizar: (lancamento) => <EtiquetaDeStatus status={lancamento.status} />,
  },
  {
    chave: 'acoes',
    titulo: 'Ações',
    acoes: true,
    renderizar: (lancamento) => {
      const nome = lancamento.tipoAcao.nome;
      if (lancamento.status === 'RECUSADO') {
        return (
          <Link
            to={`/lancamentos/${lancamento.id}/corrigir`}
            aria-label={`Corrigir e reenviar ${nome}`}
            className={`${botaoDeLinha} w-full lg:w-auto`}
          >
            Corrigir e reenviar
          </Link>
        );
      }
      if (lancamento.status === 'PENDENTE') {
        return (
          <Link
            to={`/lancamentos/${lancamento.id}/corrigir`}
            aria-label={`${faltaComprovante(lancamento) ? 'Anexar comprovante a' : 'Corrigir'} ${nome}`}
            className={`${botaoDeLinha} w-full lg:w-auto`}
          >
            {faltaComprovante(lancamento) ? 'Anexar comprovante' : 'Corrigir'}
          </Link>
        );
      }
      return null;
    },
  },
];

function MeusLancamentos({ usuario }: { usuario: UsuarioAutenticado }) {
  const consulta = useMeusLancamentos(usuario.id);
  const lancamentos = consulta.data?.pages.flatMap((pagina) => pagina.itens) ?? [];

  return (
    <section aria-labelledby="meus-lancamentos" className="flex flex-col gap-3">
      <h2 id="meus-lancamentos" className="text-xl font-bold">
        Meus lançamentos
      </h2>

      {consulta.isPending && <EstadoCarregando mensagem="Carregando os seus lançamentos…" />}

      {consulta.isError && !consulta.isFetchNextPageError && (
        <EstadoDeErro
          mensagem={mensagemDeErro(consulta.error)}
          aoTentarDeNovo={() => {
            void consulta.refetch();
          }}
        />
      )}

      {consulta.isSuccess && lancamentos.length === 0 && (
        <EstadoVazio
          titulo="Você ainda não registrou nenhuma ação"
          descricao="Registre a primeira: escolha o tipo da ação, informe a quantidade e anexe o comprovante. O líder da equipe aprova e os pontos entram no placar."
        >
          <Link to="/registrar" className={botaoPrimario}>
            Registrar a primeira ação
          </Link>
        </EstadoVazio>
      )}

      {lancamentos.length > 0 && (
        <ListaResponsiva
          rotulo="Meus lançamentos"
          colunas={colunas}
          itens={lancamentos}
          chaveDoItem={(lancamento) => lancamento.id}
          modeloDeColunas="minmax(0,2fr) minmax(0,2.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.6fr)"
        />
      )}

      {consulta.isFetchNextPageError && (
        <AvisoDeErro>
          Não foi possível carregar mais lançamentos. {mensagemDeErro(consulta.error)}
        </AvisoDeErro>
      )}

      {consulta.hasNextPage && (
        <button
          type="button"
          disabled={consulta.isFetchingNextPage}
          onClick={() => {
            void consulta.fetchNextPage();
          }}
          className={botaoContorno}
        >
          {consulta.isFetchingNextPage ? 'Carregando…' : 'Ver mais lançamentos'}
        </button>
      )}
    </section>
  );
}

function Inicio({ usuario }: { usuario: UsuarioAutenticado }) {
  const local = useLocation();
  const navegar = useNavigate();
  const [dispensado, setDispensado] = useState(false);
  const aviso = dispensado ? null : lerAvisoDaNavegacao(local.state);

  function dispensar() {
    setDispensado(true);
    // Sem isto, recarregar a página mostraria o recado de novo.
    void navegar(local.pathname, { replace: true, state: null });
  }

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        sobretitulo="Início"
        titulo={`Olá, ${usuario.nome}!`}
        descricao="Registre as suas ações e acompanhe a aprovação de cada uma."
        acao={
          <Link to="/registrar" className={`${botaoPrimario} lg:w-auto`}>
            + Registrar ação
          </Link>
        }
      />

      {aviso?.tipo === 'sucesso' && (
        <AvisoDeSucesso aoDispensar={dispensar}>{aviso.texto}</AvisoDeSucesso>
      )}
      {aviso?.tipo === 'erro' && (
        <AvisoDeErro
          acoes={
            <button type="button" onClick={dispensar} className={botaoDeLinha}>
              Dispensar
            </button>
          }
        >
          {aviso.texto}
        </AvisoDeErro>
      )}

      <CartaoDePosicao usuario={usuario} />

      <dl aria-label="Resumo dos meus lançamentos" className="grid grid-cols-2 gap-3 lg:max-w-md">
        <Total
          rotulo="Aguardando aprovação"
          status="PENDENTE"
          colaboradorId={usuario.id}
          cor="text-pendente"
        />
        <Total
          rotulo="Aprovados"
          status="APROVADO"
          colaboradorId={usuario.id}
          cor="text-aprovado"
        />
      </dl>

      <MeusLancamentos usuario={usuario} />
    </div>
  );
}

/**
 * US10 — o colaborador acompanha o status dos próprios lançamentos.
 * US11 — e a posição da equipe dele no placar, no cartão do topo.
 */
export function TelaDeInicio() {
  const { usuario } = useSessao();
  if (usuario === null) {
    return null;
  }
  return <Inicio usuario={usuario} />;
}
