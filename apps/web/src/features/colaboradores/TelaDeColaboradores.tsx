import {
  listarColaboradoresQuerySchema,
  papeis,
  type Colaborador,
  type ListarColaboradoresQuery,
  type Papel,
} from '@gincana/contracts';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AvisoDeSucesso } from '../../components/ui/Avisos.js';
import { CabecalhoDePagina } from '../../components/ui/CabecalhoDePagina.js';
import { CampoDeSelecao } from '../../components/ui/CampoDeSelecao.js';
import {
  botaoContorno,
  botaoDeLinha,
  botaoPrimario,
} from '../../components/ui/estilos-de-botao.js';
import { EstadoCarregando, EstadoDeErro, EstadoVazio } from '../../components/ui/Estados.js';
import { Etiqueta } from '../../components/ui/Etiqueta.js';
import { ListaResponsiva, type ColunaDaLista } from '../../components/ui/ListaResponsiva.js';
import { mensagemDeErro } from '../../lib/api.js';
import { useEquipes } from '../equipes/equipes-api.js';
import { SeletorDeGincana } from '../gincanas/SeletorDeGincana.js';
import { useGincanaSelecionada } from '../gincanas/useGincanaSelecionada.js';
import { useColaboradores } from './colaboradores-api.js';
import { DialogoDeColaborador } from './DialogoDeColaborador.js';
import { rotulosDePapel, tonsDePapel } from './papeis.js';

type DialogoAberto = { tipo: 'novo' } | { tipo: 'editar'; id: string };

/**
 * US03 — a administradora cadastra colaboradores e acompanha quem está em cada equipe.
 *
 * Os filtros ficam na barra de endereço (`?equipeId=&papel=`): o link da lista filtrada
 * pode ser compartilhado e o botão voltar desfaz o filtro. Valores que não passam no
 * schema do contrato são ignorados, em vez de quebrar a tela.
 */
export function TelaDeColaboradores() {
  const { gincanas, escolhida, escolher } = useGincanaSelecionada();
  const [parametros, definirParametros] = useSearchParams();

  const lidos = listarColaboradoresQuerySchema.safeParse(Object.fromEntries(parametros));
  const filtros: ListarColaboradoresQuery = lidos.success ? lidos.data : {};
  const temFiltro = filtros.equipeId !== undefined || filtros.papel !== undefined;

  const consulta = useColaboradores(filtros);
  const equipesConsulta = useEquipes(escolhida?.id ?? null);
  const [dialogo, setDialogo] = useState<DialogoAberto | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const colaboradores = consulta.data ?? [];
  const equipes = equipesConsulta.data ?? [];
  const emEdicao =
    dialogo?.tipo === 'editar'
      ? colaboradores.find((pessoa) => pessoa.id === dialogo.id)
      : undefined;

  function mudarFiltro(nome: 'equipeId' | 'papel', valor: string) {
    definirParametros(
      (atuais) => {
        const novos = new URLSearchParams(atuais);
        if (valor === '') {
          novos.delete(nome);
        } else {
          novos.set(nome, valor);
        }
        return novos;
      },
      { replace: true },
    );
  }

  function limparFiltros() {
    definirParametros(
      (atuais) => {
        const novos = new URLSearchParams(atuais);
        novos.delete('equipeId');
        novos.delete('papel');
        return novos;
      },
      { replace: true },
    );
  }

  const colunas: ColunaDaLista<Colaborador>[] = [
    {
      chave: 'nome',
      titulo: 'Colaborador',
      semRotuloNoCelular: true,
      renderizar: (pessoa) => (
        <div>
          <p className="font-bold lg:font-semibold">{pessoa.nome}</p>
          <p className="text-sm break-words text-texto-suave">{pessoa.email}</p>
        </div>
      ),
    },
    {
      chave: 'papel',
      titulo: 'Papel',
      renderizar: (pessoa) => (
        <Etiqueta tom={tonsDePapel[pessoa.papel]}>{rotulosDePapel[pessoa.papel]}</Etiqueta>
      ),
    },
    {
      chave: 'equipe',
      titulo: 'Equipe',
      renderizar: (pessoa) =>
        pessoa.equipe === null ? (
          <span className="text-texto-suave">Sem equipe</span>
        ) : (
          <span>{pessoa.equipe.nome}</span>
        ),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      renderizar: (pessoa) =>
        pessoa.ativo ? (
          <Etiqueta tom="sucesso">Ativo</Etiqueta>
        ) : (
          <Etiqueta tom="neutro">Desativado</Etiqueta>
        ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      acoes: true,
      renderizar: (pessoa) => (
        <button
          type="button"
          aria-label={`Editar ${pessoa.nome}`}
          onClick={() => {
            setSucesso(null);
            setDialogo({ tipo: 'editar', id: pessoa.id });
          }}
          className={`${botaoDeLinha} w-full lg:w-auto`}
        >
          Editar
        </button>
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

  const descricao = consulta.isSuccess
    ? `${colaboradores.length} ${colaboradores.length === 1 ? 'colaborador' : 'colaboradores'}${temFiltro ? ' neste filtro' : ' cadastrados'}.`
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        sobretitulo={escolhida === null ? 'Cestacorp' : `Gincana ${escolhida.ano}`}
        titulo="Colaboradores"
        descricao={descricao}
        acao={
          <button type="button" onClick={abrirNovo} className={`${botaoPrimario} lg:w-auto`}>
            + Novo colaborador
          </button>
        }
      />

      {escolhida !== null && (
        <SeletorDeGincana gincanas={gincanas} escolhida={escolhida} aoEscolher={escolher} />
      )}

      <form
        aria-label="Filtros da lista"
        onSubmit={(evento) => {
          evento.preventDefault();
        }}
        className="grid gap-4 sm:grid-cols-2 lg:max-w-xl"
      >
        <CampoDeSelecao
          rotulo="Equipe"
          value={filtros.equipeId ?? ''}
          onChange={(evento) => {
            mudarFiltro('equipeId', evento.target.value);
          }}
        >
          <option value="">Todas as equipes</option>
          {equipes.map((equipe) => (
            <option key={equipe.id} value={equipe.id}>
              {equipe.nome}
            </option>
          ))}
        </CampoDeSelecao>
        <CampoDeSelecao
          rotulo="Papel"
          value={filtros.papel ?? ''}
          onChange={(evento) => {
            mudarFiltro('papel', evento.target.value);
          }}
        >
          <option value="">Todos os papéis</option>
          {papeis.map((papel: Papel) => (
            <option key={papel} value={papel}>
              {rotulosDePapel[papel]}
            </option>
          ))}
        </CampoDeSelecao>
      </form>

      {sucesso !== null && (
        <AvisoDeSucesso
          aoDispensar={() => {
            setSucesso(null);
          }}
        >
          {sucesso}
        </AvisoDeSucesso>
      )}

      {consulta.isPending && <EstadoCarregando mensagem="Carregando os colaboradores…" />}

      {consulta.isError && (
        <EstadoDeErro
          mensagem={mensagemDeErro(consulta.error)}
          aoTentarDeNovo={() => {
            void consulta.refetch();
          }}
        />
      )}

      {consulta.isSuccess && colaboradores.length === 0 && !temFiltro && (
        <EstadoVazio
          titulo="Nenhum colaborador cadastrado ainda"
          descricao="Cadastre os colaboradores da gincana. Depois, vincule cada um à sua equipe na tela de Equipes."
        >
          <button type="button" onClick={abrirNovo} className={botaoPrimario}>
            Cadastrar o primeiro colaborador
          </button>
        </EstadoVazio>
      )}

      {consulta.isSuccess && colaboradores.length === 0 && temFiltro && (
        <EstadoVazio
          titulo="Nenhum colaborador neste filtro"
          descricao="Ninguém corresponde à equipe e ao papel escolhidos. Limpe os filtros para ver todos."
        >
          <button type="button" onClick={limparFiltros} className={botaoContorno}>
            Limpar filtros
          </button>
        </EstadoVazio>
      )}

      {consulta.isSuccess && colaboradores.length > 0 && (
        <ListaResponsiva
          rotulo="Colaboradores cadastrados"
          colunas={colunas}
          itens={colaboradores}
          chaveDoItem={(pessoa) => pessoa.id}
          modeloDeColunas="minmax(0,2fr) 10rem minmax(0,1fr) 8rem 6rem"
        />
      )}

      {dialogo?.tipo === 'novo' && (
        <DialogoDeColaborador
          gincanaId={escolhida?.id ?? null}
          aoFechar={fechar}
          aoConcluir={concluir}
        />
      )}

      {emEdicao !== undefined && (
        <DialogoDeColaborador
          colaborador={emEdicao}
          gincanaId={escolhida?.id ?? null}
          aoFechar={fechar}
          aoConcluir={concluir}
        />
      )}
    </div>
  );
}
