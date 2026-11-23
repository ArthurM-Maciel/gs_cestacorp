import { rotulosDeUnidade, type TipoAcao } from '@gincana/contracts';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { AvisoDeSucesso } from '../../components/ui/Avisos.js';
import { CabecalhoDePagina } from '../../components/ui/CabecalhoDePagina.js';
import { botaoDeLinha, botaoPrimario } from '../../components/ui/estilos-de-botao.js';
import { EstadoCarregando, EstadoDeErro, EstadoVazio } from '../../components/ui/Estados.js';
import { Etiqueta } from '../../components/ui/Etiqueta.js';
import { ListaResponsiva, type ColunaDaLista } from '../../components/ui/ListaResponsiva.js';
import { mensagemDeErro } from '../../lib/api.js';
import { formatarPontos } from '../../lib/formatar-numero.js';
import { useSessao } from '../../lib/sessao.js';
import { SeletorDeGincana } from '../gincanas/SeletorDeGincana.js';
import { useGincanaSelecionada } from '../gincanas/useGincanaSelecionada.js';
import { DialogoDeNovaRegra } from './DialogoDeNovaRegra.js';
import { DialogoDeTipoAcao } from './DialogoDeTipoAcao.js';
import { useTiposDeAcao } from './tipos-acao-api.js';

type DialogoAberto =
  { tipo: 'novo' } | { tipo: 'editar'; id: string } | { tipo: 'nova-pontuacao'; id: string };

/**
 * US04 — a administradora cadastra tipos de ação com a regra de pontos, inclusive as
 * atividades extras criadas no meio da gincana.
 *
 * "Mudanças valem só para lançamentos novos e ficam registradas no histórico" é a frase do
 * protótipo que molda esta tela: trocar a pontuação vive num diálogo separado
 * (`DialogoDeNovaRegra`) do que edita a identidade do tipo (`DialogoDeTipoAcao`), porque são
 * duas operações diferentes para a API.
 */
export function TelaDeTiposDeAcao() {
  const { usuario } = useSessao();
  const ehAdmin = usuario?.papel === 'ADMIN';
  // O líder só pausa/reativa: criar tipo de ação e abrir nova pontuação continuam
  // exclusivos da administradora.
  const ehLider = usuario?.papel === 'LIDER';
  const { consulta: consultaDeGincanas, gincanas, escolhida, escolher } = useGincanaSelecionada();
  const consulta = useTiposDeAcao(escolhida?.id ?? null);
  const [dialogo, setDialogo] = useState<DialogoAberto | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const tipos = consulta.data ?? [];
  // Procurado na lista a cada render: o diálogo reflete o que a API devolveu por último.
  const emEdicao =
    dialogo?.tipo === 'editar' ? tipos.find((tipo) => tipo.id === dialogo.id) : undefined;
  const naNovaPontuacao =
    dialogo?.tipo === 'nova-pontuacao' ? tipos.find((tipo) => tipo.id === dialogo.id) : undefined;

  const colunas: ColunaDaLista<TipoAcao>[] = [
    {
      chave: 'acao',
      titulo: 'Ação',
      semRotuloNoCelular: true,
      renderizar: (item) => <span className="text-lg font-bold lg:text-base">{item.nome}</span>,
    },
    {
      chave: 'unidade',
      titulo: 'Unidade',
      renderizar: (item) => <span>{rotulosDeUnidade[item.unidade].singular}</span>,
    },
    {
      chave: 'pontos',
      titulo: 'Pontos por unidade',
      renderizar: (item) =>
        item.regraVigente === null ? (
          <span className="text-texto-suave">Sem regra vigente</span>
        ) : (
          <span className="font-semibold">
            {formatarPontos(item.regraVigente.pontosPorUnidade)}
          </span>
        ),
    },
    {
      chave: 'comprovante',
      titulo: 'Comprovante',
      renderizar: (item) => <span>{item.exigeEvidencia ? 'Sim' : 'Não'}</span>,
    },
    {
      chave: 'status',
      titulo: 'Status',
      renderizar: (item) =>
        item.ativo ? (
          <Etiqueta tom="sucesso">Ativa</Etiqueta>
        ) : (
          <Etiqueta tom="neutro">Pausada</Etiqueta>
        ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      acoes: true,
      renderizar: (item) => (
        <div
          className={`grid gap-2 lg:flex lg:justify-end lg:gap-1 ${
            ehLider ? 'grid-cols-1' : 'grid-cols-2'
          }`}
        >
          <button
            type="button"
            aria-label={
              ehLider
                ? `Ver situação do tipo de ação ${item.nome}`
                : `Editar tipo de ação ${item.nome}`
            }
            onClick={() => {
              setSucesso(null);
              setDialogo({ tipo: 'editar', id: item.id });
            }}
            className={`${botaoDeLinha} w-full lg:w-auto`}
          >
            {ehLider ? 'Situação' : 'Editar'}
          </button>
          {!ehLider && (
            <button
              type="button"
              aria-label={`Nova pontuação de ${item.nome}`}
              onClick={() => {
                setSucesso(null);
                setDialogo({ tipo: 'nova-pontuacao', id: item.id });
              }}
              className={`${botaoDeLinha} w-full lg:w-auto`}
            >
              Nova pontuação
            </button>
          )}
        </div>
      ),
    },
  ];

  function abrirNovo() {
    setSucesso(null);
    setDialogo({ tipo: 'novo' });
  }

  function fechar() {
    setDialogo(null);
  }

  function concluir(mensagem: string) {
    setDialogo(null);
    setSucesso(mensagem);
  }

  const descricao =
    consulta.isSuccess && escolhida !== null
      ? tipos.length === 1
        ? '1 tipo de ação cadastrado.'
        : `${tipos.length} tipos de ação cadastrados.`
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        sobretitulo={escolhida === null ? 'Gincana' : `Gincana ${escolhida.ano}`}
        titulo="Regras de pontuação"
        descricao={descricao}
        acao={
          escolhida === null || ehLider ? undefined : (
            <button type="button" onClick={abrirNovo} className={`${botaoPrimario} lg:w-auto`}>
              + Novo tipo de ação
            </button>
          )
        }
      />

      {escolhida !== null && (
        <SeletorDeGincana gincanas={gincanas} escolhida={escolhida} aoEscolher={escolher} />
      )}

      {sucesso !== null && (
        <AvisoDeSucesso
          aoDispensar={() => {
            setSucesso(null);
          }}
        >
          {sucesso}
        </AvisoDeSucesso>
      )}

      {consultaDeGincanas.isPending && <EstadoCarregando mensagem="Carregando a gincana…" />}

      {consultaDeGincanas.isError && (
        <EstadoDeErro
          mensagem={mensagemDeErro(consultaDeGincanas.error)}
          aoTentarDeNovo={() => {
            void consultaDeGincanas.refetch();
          }}
        />
      )}

      {consultaDeGincanas.isSuccess && escolhida === null && (
        <EstadoVazio
          titulo="Cadastre a gincana antes dos tipos de ação"
          descricao="Os tipos de ação pertencem a uma gincana. Cadastre a gincana do ano e volte aqui para criar o primeiro."
        >
          {ehAdmin && (
            <Link to="/gincanas" className={botaoPrimario}>
              Ir para Gincanas
            </Link>
          )}
        </EstadoVazio>
      )}

      {escolhida !== null && consulta.isPending && (
        <EstadoCarregando mensagem="Carregando os tipos de ação…" />
      )}

      {escolhida !== null && consulta.isError && (
        <EstadoDeErro
          mensagem={mensagemDeErro(consulta.error)}
          aoTentarDeNovo={() => {
            void consulta.refetch();
          }}
        />
      )}

      {escolhida !== null && consulta.isSuccess && tipos.length === 0 && (
        <EstadoVazio
          titulo="Nenhum tipo de ação ainda"
          descricao={
            ehLider
              ? `A administradora ainda não cadastrou um tipo de ação na gincana ${escolhida.ano}.`
              : `Cadastre o primeiro tipo de ação da gincana ${escolhida.ano}, com a regra de pontos que ele vale. Uma atividade extra criada no meio da gincana é só mais um tipo de ação.`
          }
        >
          {ehLider ? undefined : (
            <button type="button" onClick={abrirNovo} className={botaoPrimario}>
              Criar o primeiro tipo de ação
            </button>
          )}
        </EstadoVazio>
      )}

      {escolhida !== null && consulta.isSuccess && tipos.length > 0 && (
        <>
          <ListaResponsiva
            rotulo="Tipos de ação da gincana"
            colunas={colunas}
            itens={tipos}
            chaveDoItem={(item) => item.id}
            modeloDeColunas="minmax(0,1.5fr) 7rem 10rem 8rem 7rem 14rem"
          />
          <p className="text-sm text-texto-suave">
            Mudanças valem só para lançamentos novos e ficam registradas no histórico.
          </p>
        </>
      )}

      {dialogo?.tipo === 'novo' && escolhida !== null && (
        <DialogoDeTipoAcao gincanaId={escolhida.id} aoFechar={fechar} aoConcluir={concluir} />
      )}

      {emEdicao !== undefined && escolhida !== null && (
        <DialogoDeTipoAcao
          gincanaId={escolhida.id}
          tipo={emEdicao}
          aoFechar={fechar}
          aoConcluir={concluir}
        />
      )}

      {naNovaPontuacao !== undefined && (
        <DialogoDeNovaRegra tipo={naNovaPontuacao} aoFechar={fechar} aoConcluir={concluir} />
      )}
    </div>
  );
}
