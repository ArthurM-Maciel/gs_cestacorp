import type { Equipe } from '@gincana/contracts';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { AvisoDeSucesso } from '../../components/ui/Avisos.js';
import { CabecalhoDePagina } from '../../components/ui/CabecalhoDePagina.js';
import { botaoDeLinha, botaoPrimario } from '../../components/ui/estilos-de-botao.js';
import { EstadoCarregando, EstadoDeErro, EstadoVazio } from '../../components/ui/Estados.js';
import { Etiqueta } from '../../components/ui/Etiqueta.js';
import { ListaResponsiva, type ColunaDaLista } from '../../components/ui/ListaResponsiva.js';
import { mensagemDeErro } from '../../lib/api.js';
import { SeletorDeGincana } from '../gincanas/SeletorDeGincana.js';
import { useGincanaSelecionada } from '../gincanas/useGincanaSelecionada.js';
import { DialogoDeEquipe } from './DialogoDeEquipe.js';
import { DialogoDeMembros } from './DialogoDeMembros.js';
import { useEquipes } from './equipes-api.js';

type DialogoAberto =
  { tipo: 'nova' } | { tipo: 'editar'; id: string } | { tipo: 'colaboradores'; id: string };

/**
 * US03 — a administradora cadastra equipes, define o líder e vincula colaboradores.
 *
 * As colunas "ações aprovadas" e "pontos" do protótipo ficam de fora: dependem do placar
 * (US11) e não há número real para mostrar. Inventar um valor aqui enganaria a cliente.
 */
export function TelaDeEquipes() {
  const { consulta: consultaDeGincanas, gincanas, escolhida, escolher } = useGincanaSelecionada();
  const consulta = useEquipes(escolhida?.id ?? null);
  const [dialogo, setDialogo] = useState<DialogoAberto | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const equipes = consulta.data ?? [];
  // Procuradas na lista a cada render: o diálogo reflete o que a API devolveu por último.
  const emEdicao =
    dialogo?.tipo === 'editar' ? equipes.find((equipe) => equipe.id === dialogo.id) : undefined;
  const nosColaboradores =
    dialogo?.tipo === 'colaboradores'
      ? equipes.find((equipe) => equipe.id === dialogo.id)
      : undefined;

  const colunas: ColunaDaLista<Equipe>[] = [
    {
      chave: 'equipe',
      titulo: 'Equipe',
      semRotuloNoCelular: true,
      renderizar: (equipe) => <span className="text-lg font-bold lg:text-base">{equipe.nome}</span>,
    },
    {
      chave: 'lider',
      titulo: 'Líder',
      renderizar: (equipe) =>
        equipe.lider === null ? (
          <Etiqueta tom="atencao">Sem líder</Etiqueta>
        ) : (
          <span>{equipe.lider.nome}</span>
        ),
    },
    {
      chave: 'colaboradores',
      titulo: 'Colaboradores',
      renderizar: (equipe) => <span className="font-semibold">{equipe.totalMembros}</span>,
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      acoes: true,
      renderizar: (equipe) => (
        <div className="grid grid-cols-2 gap-2 lg:flex lg:justify-end lg:gap-1">
          <button
            type="button"
            aria-label={`Editar equipe ${equipe.nome}`}
            onClick={() => {
              setSucesso(null);
              setDialogo({ tipo: 'editar', id: equipe.id });
            }}
            className={`${botaoDeLinha} w-full lg:w-auto`}
          >
            Editar
          </button>
          <button
            type="button"
            aria-label={`Colaboradores da equipe ${equipe.nome}`}
            onClick={() => {
              setSucesso(null);
              setDialogo({ tipo: 'colaboradores', id: equipe.id });
            }}
            className={`${botaoDeLinha} w-full lg:w-auto`}
          >
            Colaboradores
          </button>
        </div>
      ),
    },
  ];

  function abrirNova() {
    setSucesso(null);
    setDialogo({ tipo: 'nova' });
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
      ? equipes.length === 1
        ? '1 equipe cadastrada.'
        : `${equipes.length} equipes cadastradas.`
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        sobretitulo={escolhida === null ? 'Gincana' : `Gincana ${escolhida.ano}`}
        titulo="Equipes"
        descricao={descricao}
        acao={
          escolhida === null ? undefined : (
            <button type="button" onClick={abrirNova} className={`${botaoPrimario} lg:w-auto`}>
              + Nova equipe
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
          titulo="Cadastre a gincana antes das equipes"
          descricao="As equipes pertencem a uma gincana. Cadastre a gincana do ano e volte aqui para criar a primeira equipe."
        >
          <Link to="/gincanas" className={botaoPrimario}>
            Ir para Gincanas
          </Link>
        </EstadoVazio>
      )}

      {escolhida !== null && consulta.isPending && (
        <EstadoCarregando mensagem="Carregando as equipes…" />
      )}

      {escolhida !== null && consulta.isError && (
        <EstadoDeErro
          mensagem={mensagemDeErro(consulta.error)}
          aoTentarDeNovo={() => {
            void consulta.refetch();
          }}
        />
      )}

      {escolhida !== null && consulta.isSuccess && equipes.length === 0 && (
        <EstadoVazio
          titulo="Nenhuma equipe ainda"
          descricao={`Crie a primeira equipe da gincana ${escolhida.ano}. Depois, escolha o líder e vincule os colaboradores.`}
        >
          <button type="button" onClick={abrirNova} className={botaoPrimario}>
            Criar a primeira equipe
          </button>
        </EstadoVazio>
      )}

      {escolhida !== null && consulta.isSuccess && equipes.length > 0 && (
        <>
          <ListaResponsiva
            rotulo="Equipes da gincana"
            colunas={colunas}
            itens={equipes}
            chaveDoItem={(equipe) => equipe.id}
            modeloDeColunas="minmax(0,1.5fr) minmax(0,1.5fr) 9rem 15rem"
          />
          <p className="text-sm text-texto-suave">
            Cada equipe tem um líder, que aprova os lançamentos da própria equipe. O total de
            colaboradores não conta o líder.
          </p>
        </>
      )}

      {dialogo?.tipo === 'nova' && escolhida !== null && (
        <DialogoDeEquipe
          gincana={escolhida}
          equipes={equipes}
          aoFechar={fechar}
          aoConcluir={concluir}
        />
      )}

      {emEdicao !== undefined && escolhida !== null && (
        <DialogoDeEquipe
          gincana={escolhida}
          equipe={emEdicao}
          equipes={equipes}
          aoFechar={fechar}
          aoConcluir={concluir}
        />
      )}

      {nosColaboradores !== undefined && (
        <DialogoDeMembros equipe={nosColaboradores} equipes={equipes} aoFechar={fechar} />
      )}
    </div>
  );
}
