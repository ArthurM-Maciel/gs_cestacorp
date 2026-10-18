import type { Gincana, StatusGincana } from '@gincana/contracts';
import { useState } from 'react';

import { AvisoDeSucesso } from '../../components/ui/Avisos.js';
import { CabecalhoDePagina } from '../../components/ui/CabecalhoDePagina.js';
import { botaoDeLinha, botaoPrimario } from '../../components/ui/estilos-de-botao.js';
import { EstadoCarregando, EstadoDeErro, EstadoVazio } from '../../components/ui/Estados.js';
import { Etiqueta } from '../../components/ui/Etiqueta.js';
import { ListaResponsiva, type ColunaDaLista } from '../../components/ui/ListaResponsiva.js';
import { mensagemDeErro } from '../../lib/api.js';
import { formatarData } from '../../lib/formatar-data.js';
import { DialogoDeGincana } from './DialogoDeGincana.js';
import { useGincanas } from './gincanas-api.js';

const situacoes: Record<StatusGincana, { rotulo: string; tom: 'sucesso' | 'atencao' | 'neutro' }> =
  {
    PLANEJADA: { rotulo: 'Planejada', tom: 'atencao' },
    ATIVA: { rotulo: 'Ativa', tom: 'sucesso' },
    ENCERRADA: { rotulo: 'Encerrada', tom: 'neutro' },
  };

type DialogoAberto = { tipo: 'nova' } | { tipo: 'editar'; id: string };

/** US02 — a administradora cadastra a gincana do ano com o seu período. */
export function TelaDeGincanas() {
  const consulta = useGincanas();
  const [dialogo, setDialogo] = useState<DialogoAberto | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const gincanas = consulta.data ?? [];
  // Procurada na lista a cada render: depois de salvar, o formulário nunca mostra dado velho.
  const emEdicao =
    dialogo?.tipo === 'editar' ? gincanas.find((gincana) => gincana.id === dialogo.id) : undefined;

  const colunas: ColunaDaLista<Gincana>[] = [
    {
      chave: 'ano',
      titulo: 'Ano',
      renderizar: (gincana) => <span className="font-bold">{gincana.ano}</span>,
    },
    {
      chave: 'nome',
      titulo: 'Nome',
      renderizar: (gincana) => <span className="font-semibold">{gincana.nome}</span>,
    },
    {
      chave: 'periodo',
      titulo: 'Período',
      renderizar: (gincana) => (
        <span>
          {formatarData(gincana.dataInicio)} a {formatarData(gincana.dataFim)}
        </span>
      ),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      renderizar: (gincana) => (
        <Etiqueta tom={situacoes[gincana.status].tom}>{situacoes[gincana.status].rotulo}</Etiqueta>
      ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      acoes: true,
      renderizar: (gincana) => (
        <button
          type="button"
          aria-label={`Editar gincana ${gincana.ano}`}
          onClick={() => {
            setSucesso(null);
            setDialogo({ tipo: 'editar', id: gincana.id });
          }}
          className={`${botaoDeLinha} w-full lg:w-auto`}
        >
          Editar
        </button>
      ),
    },
  ];

  function abrirNova() {
    setSucesso(null);
    setDialogo({ tipo: 'nova' });
  }

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        sobretitulo="Cestacorp"
        titulo="Gincanas"
        descricao="Uma gincana por ano, com o período em que os lançamentos valem."
        acao={
          <button type="button" onClick={abrirNova} className={`${botaoPrimario} lg:w-auto`}>
            + Nova gincana
          </button>
        }
      />

      {sucesso !== null && (
        <AvisoDeSucesso
          aoDispensar={() => {
            setSucesso(null);
          }}
        >
          {sucesso}
        </AvisoDeSucesso>
      )}

      {consulta.isPending && <EstadoCarregando mensagem="Carregando as gincanas…" />}

      {consulta.isError && (
        <EstadoDeErro
          mensagem={mensagemDeErro(consulta.error)}
          aoTentarDeNovo={() => {
            void consulta.refetch();
          }}
        />
      )}

      {consulta.isSuccess && gincanas.length === 0 && (
        <EstadoVazio
          titulo="Nenhuma gincana cadastrada ainda"
          descricao="Cadastre a gincana do ano com o período em que ela vale. É a partir dela que você cria as equipes."
        >
          <button type="button" onClick={abrirNova} className={botaoPrimario}>
            Cadastrar a primeira gincana
          </button>
        </EstadoVazio>
      )}

      {consulta.isSuccess && gincanas.length > 0 && (
        <ListaResponsiva
          rotulo="Gincanas cadastradas"
          colunas={colunas}
          itens={gincanas}
          chaveDoItem={(gincana) => gincana.id}
          modeloDeColunas="5rem minmax(0,1fr) 14rem 8rem 6rem"
        />
      )}

      {dialogo?.tipo === 'nova' && (
        <DialogoDeGincana
          aoFechar={() => {
            setDialogo(null);
          }}
          aoConcluir={(mensagem) => {
            setDialogo(null);
            setSucesso(mensagem);
          }}
        />
      )}

      {emEdicao !== undefined && (
        <DialogoDeGincana
          gincana={emEdicao}
          aoFechar={() => {
            setDialogo(null);
          }}
          aoConcluir={(mensagem) => {
            setDialogo(null);
            setSucesso(mensagem);
          }}
        />
      )}
    </div>
  );
}
