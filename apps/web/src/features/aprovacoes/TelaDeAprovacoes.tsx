import type { Lancamento, UsuarioAutenticado } from '@gincana/contracts';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AvisoDeErro, AvisoDeSucesso } from '../../components/ui/Avisos.js';
import { CabecalhoDePagina } from '../../components/ui/CabecalhoDePagina.js';
import { botaoContorno, botaoPrimario } from '../../components/ui/estilos-de-botao.js';
import { EstadoCarregando, EstadoDeErro, EstadoVazio } from '../../components/ui/Estados.js';
import { ListaResponsiva, type ColunaDaLista } from '../../components/ui/ListaResponsiva.js';
import { mensagemDeErro } from '../../lib/api.js';
import { descreverDia } from '../../lib/dia-relativo.js';
import { formatarPontos, formatarQuantidade } from '../../lib/formatar-numero.js';
import { useSessao } from '../../lib/sessao.js';
import { useGincanaAtiva } from '../colaborador/useGincanaAtiva.js';
import { useEquipes } from '../equipes/equipes-api.js';
import { CelulaDaAcao } from '../lancamentos/CelulaDaAcao.js';
import { EtiquetaDeStatus } from '../lancamentos/EtiquetaDeStatus.js';
import { traduzirFalhaDeLancamento } from '../lancamentos/mensagens-de-lancamento.js';
import { AbasDaFila, idDaAba, idDoPainelDaFila, type Aba } from './AbasDaFila.js';
import {
  paraAvaliar,
  useAprovarLancamento,
  useDecididos,
  usePendentes,
  useRecusarLancamento,
} from './aprovacoes-api.js';
import { ComprovantesDoLancamento } from './ComprovantesDoLancamento.js';
import { DialogoDeRecusa } from './DialogoDeRecusa.js';

const botaoRecusar =
  'inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-recusado-fundo px-4 font-semibold text-recusado transition-colors hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-recusado disabled:cursor-not-allowed disabled:opacity-60 xl:w-auto';

const abasValidas: readonly Aba[] = ['pendentes', 'aprovados', 'recusados'];

function lerAba(valor: string | null): Aba {
  return abasValidas.find((aba) => aba === valor) ?? 'pendentes';
}

const vazioPorAba: Record<Aba, { titulo: string; descricao: string }> = {
  pendentes: {
    titulo: 'Nenhuma aprovação pendente',
    descricao:
      'Quando alguém da equipe registrar uma ação, ela aparece aqui para você aprovar ou recusar.',
  },
  aprovados: {
    titulo: 'Nenhum lançamento aprovado ainda',
    descricao: 'Os lançamentos que você aprovar ficam nesta lista, com a data da decisão.',
  },
  recusados: {
    titulo: 'Nenhum lançamento recusado',
    descricao: 'Os lançamentos que você recusar ficam nesta lista, com o motivo que você deu.',
  },
};

interface AcoesDaLista {
  usuario: UsuarioAutenticado;
  aba: Aba;
  ocupado: boolean;
  aprovando: string | null;
  aoAprovar: (lancamento: Lancamento) => void;
  aoRecusar: (lancamento: Lancamento) => void;
}

function montarColunas({
  usuario,
  aba,
  ocupado,
  aprovando,
  aoAprovar,
  aoRecusar,
}: AcoesDaLista): ColunaDaLista<Lancamento>[] {
  return [
    {
      chave: 'acao',
      titulo: 'Ação',
      semRotuloNoCelular: true,
      renderizar: (lancamento) => <CelulaDaAcao lancamento={lancamento} />,
    },
    {
      chave: 'colaborador',
      titulo: 'Colaborador',
      renderizar: (lancamento) => (
        <>
          <span>
            {lancamento.colaborador.nome} · {descreverDia(lancamento.dataAcao)}
          </span>
          {/* A administradora vê todas as equipes: sem o nome da equipe, não dá para saber de onde veio. */}
          {usuario.papel === 'ADMIN' && (
            <span className="block text-sm text-texto-suave">Equipe {lancamento.equipe.nome}</span>
          )}
        </>
      ),
    },
    {
      chave: 'quantidade',
      titulo: 'Quantidade',
      renderizar: (lancamento) => (
        <span>{formatarQuantidade(lancamento.quantidade, lancamento.tipoAcao.unidade)}</span>
      ),
    },
    {
      chave: 'pontos',
      titulo: 'Pontos',
      renderizar: (lancamento) => (
        <span className="font-semibold text-aprovado">
          +{formatarPontos(lancamento.pontosCalculados)}
        </span>
      ),
    },
    {
      chave: 'comprovante',
      titulo: 'Comprovante',
      renderizar: (lancamento) => <ComprovantesDoLancamento lancamento={lancamento} />,
    },
    {
      chave: 'decisao',
      titulo: 'Decisão',
      acoes: true,
      renderizar: (lancamento) => {
        if (aba === 'pendentes') {
          const descricao = `${lancamento.tipoAcao.nome} de ${lancamento.colaborador.nome}`;
          return (
            <div className="grid grid-cols-2 gap-2 xl:flex xl:justify-end">
              <button
                type="button"
                aria-label={`Recusar ${descricao}`}
                disabled={ocupado}
                onClick={() => {
                  aoRecusar(lancamento);
                }}
                className={botaoRecusar}
              >
                Recusar
              </button>
              <button
                type="button"
                aria-label={`Aprovar ${descricao}`}
                disabled={ocupado}
                onClick={() => {
                  aoAprovar(lancamento);
                }}
                className={`${botaoPrimario} xl:w-auto xl:px-4`}
              >
                {aprovando === lancamento.id ? 'Aprovando…' : 'Aprovar'}
              </button>
            </div>
          );
        }

        return (
          <div className="text-left xl:text-right">
            <EtiquetaDeStatus status={lancamento.status} />
            {lancamento.avaliadoPor !== null && (
              <p className="mt-1 text-sm text-texto-suave">por {lancamento.avaliadoPor.nome}</p>
            )}
            {lancamento.status === 'RECUSADO' && lancamento.motivoRecusa !== null && (
              <p className="mt-1 text-sm font-semibold text-recusado">
                Motivo: {lancamento.motivoRecusa}
              </p>
            )}
          </div>
        );
      },
    },
  ];
}

function titulo(quantas: number | null): string {
  if (quantas === null) {
    return 'Aprovações';
  }
  if (quantas === 0) {
    return 'Nenhuma aprovação pendente';
  }
  return `Você tem ${String(quantas)} ${quantas === 1 ? 'aprovação' : 'aprovações'}`;
}

function Fila({ usuario }: { usuario: UsuarioAutenticado }) {
  const [parametros, definirParametros] = useSearchParams();
  const aba = lerAba(parametros.get('aba'));

  const pendentes = usePendentes();
  const aprovados = useDecididos('APROVADO', aba === 'aprovados');
  const recusados = useDecididos('RECUSADO', aba === 'recusados');
  const aprovar = useAprovarLancamento();
  const recusar = useRecusarLancamento();

  const { ativa } = useGincanaAtiva();
  const equipes = useEquipes(ativa?.id ?? null);
  const equipeLiderada = equipes.data?.find((equipe) => equipe.id === usuario.equipeLideradaId);

  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erroDaDecisao, setErroDaDecisao] = useState<string | null>(null);
  const [recusando, setRecusando] = useState<Lancamento | null>(null);
  const [erroDoDialogo, setErroDoDialogo] = useState<string | null>(null);
  const [erroDoMotivo, setErroDoMotivo] = useState<string | undefined>(undefined);

  const aguardando = pendentes.isSuccess ? paraAvaliar(pendentes.data, usuario) : [];
  const quantasPendentes = pendentes.isSuccess ? aguardando.length : null;

  const decididos = aba === 'aprovados' ? aprovados : recusados;
  const itensDecididos = decididos.data?.pages.flatMap((pagina) => pagina.itens) ?? [];

  const consulta = aba === 'pendentes' ? pendentes : decididos;
  const itens = aba === 'pendentes' ? aguardando : itensDecididos;

  // Um clique de cada vez: duas decisões em voo sobre a mesma fila embaralhariam as mensagens.
  const decidindo = aprovar.isPending || recusar.isPending;

  function escolherAba(nova: Aba) {
    setSucesso(null);
    setErroDaDecisao(null);
    definirParametros(nova === 'pendentes' ? {} : { aba: nova }, { replace: true });
  }

  function aprovarItem(lancamento: Lancamento) {
    setSucesso(null);
    setErroDaDecisao(null);
    aprovar.mutate(lancamento.id, {
      onSuccess: (aprovado) => {
        setSucesso(
          `${aprovado.tipoAcao.nome} de ${aprovado.colaborador.nome} aprovada: +${formatarPontos(aprovado.pontosCalculados)} para a equipe ${aprovado.equipe.nome}.`,
        );
      },
      onError: (erro) => {
        setErroDaDecisao(traduzirFalhaDeLancamento(erro, 'aprovar').geral);
      },
    });
  }

  function abrirRecusa(lancamento: Lancamento) {
    setSucesso(null);
    setErroDaDecisao(null);
    setErroDoDialogo(null);
    setErroDoMotivo(undefined);
    setRecusando(lancamento);
  }

  function recusarItem(lancamento: Lancamento, motivoRecusa: string) {
    setErroDoDialogo(null);
    setErroDoMotivo(undefined);
    recusar.mutate(
      { id: lancamento.id, motivoRecusa },
      {
        onSuccess: (recusado) => {
          setRecusando(null);
          setSucesso(
            `${recusado.tipoAcao.nome} de ${recusado.colaborador.nome} recusada. O motivo já está com o colaborador, que pode corrigir e reenviar.`,
          );
        },
        onError: (erro) => {
          const falha = traduzirFalhaDeLancamento<'motivoRecusa'>(erro, 'recusar', {
            camposDoFormulario: ['motivoRecusa'],
          });
          setErroDoDialogo(falha.geral);
          setErroDoMotivo(falha.campos.motivoRecusa);
        },
      },
    );
  }

  const colunas = montarColunas({
    usuario,
    aba,
    ocupado: decidindo,
    aprovando: aprovar.isPending ? aprovar.variables : null,
    aoAprovar: aprovarItem,
    aoRecusar: abrirRecusa,
  });

  const abas = [
    {
      chave: 'pendentes',
      rotulo: quantasPendentes === null ? 'Pendentes' : `Pendentes · ${String(quantasPendentes)}`,
    },
    { chave: 'aprovados', rotulo: 'Aprovados' },
    { chave: 'recusados', rotulo: 'Recusados' },
  ] as const satisfies readonly { chave: Aba; rotulo: string }[];

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        sobretitulo={
          usuario.papel === 'ADMIN'
            ? 'Todas as equipes'
            : equipeLiderada === undefined
              ? 'Sua equipe'
              : `Equipe ${equipeLiderada.nome}`
        }
        titulo={titulo(quantasPendentes)}
        descricao="Abra o comprovante antes de aprovar. Cada decisão fica no histórico."
      />

      <AbasDaFila abas={abas} ativa={aba} aoEscolher={escolherAba} />

      {sucesso !== null && (
        <AvisoDeSucesso
          aoDispensar={() => {
            setSucesso(null);
          }}
        >
          {sucesso}
        </AvisoDeSucesso>
      )}
      {erroDaDecisao !== null && <AvisoDeErro>{erroDaDecisao}</AvisoDeErro>}

      <div
        role="tabpanel"
        id={idDoPainelDaFila}
        aria-labelledby={idDaAba(aba)}
        className="flex flex-col gap-3"
      >
        {consulta.isPending && <EstadoCarregando mensagem="Carregando os lançamentos…" />}

        {consulta.isError &&
          !('isFetchNextPageError' in consulta && consulta.isFetchNextPageError) && (
            <EstadoDeErro
              mensagem={mensagemDeErro(consulta.error)}
              aoTentarDeNovo={() => {
                void consulta.refetch();
              }}
            />
          )}

        {consulta.isSuccess && itens.length === 0 && (
          <EstadoVazio titulo={vazioPorAba[aba].titulo} descricao={vazioPorAba[aba].descricao} />
        )}

        {itens.length > 0 && (
          <ListaResponsiva
            rotulo={
              aba === 'pendentes' ? 'Lançamentos pendentes de aprovação' : `Lançamentos ${aba}`
            }
            colunas={colunas}
            itens={itens}
            chaveDoItem={(lancamento) => lancamento.id}
            modeloDeColunas="minmax(0,1.7fr) minmax(0,1.7fr) minmax(0,0.9fr) minmax(0,0.9fr) minmax(0,1.6fr) minmax(0,2.4fr)"
            tabelaA="xl"
          />
        )}

        {aba !== 'pendentes' && decididos.hasNextPage && (
          <button
            type="button"
            disabled={decididos.isFetchingNextPage}
            onClick={() => {
              void decididos.fetchNextPage();
            }}
            className={botaoContorno}
          >
            {decididos.isFetchingNextPage ? 'Carregando…' : 'Ver mais lançamentos'}
          </button>
        )}
      </div>

      {recusando !== null && (
        <DialogoDeRecusa
          lancamento={recusando}
          pendente={recusar.isPending}
          erro={erroDoDialogo}
          erroDoMotivo={erroDoMotivo}
          aoConfirmar={(motivo) => {
            recusarItem(recusando, motivo);
          }}
          aoCancelar={() => {
            setRecusando(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * US08 — o líder aprova ou recusa os lançamentos da própria equipe; a administradora, os
 * de qualquer equipe. Quem vê o quê é decisão da API (o escopo entra na consulta): esta tela
 * só mostra o que ela devolve.
 */
export function TelaDeAprovacoes() {
  const { usuario } = useSessao();
  if (usuario === null) {
    return null;
  }
  return <Fila usuario={usuario} />;
}
