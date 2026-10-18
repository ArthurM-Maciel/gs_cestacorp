import { vincularMembrosSchema, type Colaborador, type Equipe } from '@gincana/contracts';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { AvisoDeErro, AvisoDeSucesso } from '../../components/ui/Avisos.js';
import { CorpoDoDialogo, Dialogo, RodapeDoDialogo } from '../../components/ui/Dialogo.js';
import { DialogoDeConfirmacao } from '../../components/ui/DialogoDeConfirmacao.js';
import {
  botaoContorno,
  botaoDeLinhaPerigo,
  botaoPrimario,
} from '../../components/ui/estilos-de-botao.js';
import { EstadoCarregando } from '../../components/ui/Estados.js';
import { Etiqueta } from '../../components/ui/Etiqueta.js';
import { mensagemDeErro } from '../../lib/api.js';
import { codigoDoErro } from '../../lib/erro-da-api.js';
import { useColaboradores } from '../colaboradores/colaboradores-api.js';
import { useRemoverDaEquipe, useVincularColaboradores } from './equipes-api.js';

interface Props {
  equipe: Equipe;
  /** Todas as equipes da gincana, para avisar quem lidera outra equipe. */
  equipes: readonly Equipe[];
  aoFechar: () => void;
}

type Visao = 'lista' | 'vincular';

/**
 * Quem está na equipe, com a saída de cada pessoa, e a escolha de quem entra. As duas
 * visões vivem na mesma janela para a administradora não perder o contexto da equipe.
 */
export function DialogoDeMembros({ equipe, equipes, aoFechar }: Props) {
  const [visao, setVisao] = useState<Visao>('lista');
  const [sucesso, setSucesso] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  // Trocar de visão desmonta o botão que estava com o foco, e o foco cairia no <body>.
  // A cada visão o foco vai para o controle marcado como inicial dela.
  useEffect(() => {
    raiz.current?.querySelector<HTMLElement>('[data-foco-inicial]')?.focus();
  }, [visao]);

  return (
    <Dialogo
      titulo={`Colaboradores da equipe ${equipe.nome}`}
      descricao={
        visao === 'lista'
          ? 'Quem faz parte da equipe. O líder aprova os lançamentos de todos.'
          : 'Marque quem passa a fazer parte da equipe.'
      }
      aoFechar={aoFechar}
    >
      <div ref={raiz} className="flex min-h-0 flex-1 flex-col">
        {visao === 'lista' ? (
          <VisaoDaLista
            equipe={equipe}
            sucesso={sucesso}
            aoDispensarSucesso={() => {
              setSucesso(null);
            }}
            aoRemovido={setSucesso}
            aoVincular={() => {
              setSucesso(null);
              setVisao('vincular');
            }}
            aoFechar={aoFechar}
          />
        ) : (
          <VisaoDeVinculo
            equipe={equipe}
            equipes={equipes}
            aoVoltar={() => {
              setVisao('lista');
            }}
            aoVinculado={(mensagem) => {
              setSucesso(mensagem);
              setVisao('lista');
            }}
          />
        )}
      </div>
    </Dialogo>
  );
}

interface PropsDaLista {
  equipe: Equipe;
  sucesso: string | null;
  aoDispensarSucesso: () => void;
  aoRemovido: (mensagem: string) => void;
  aoVincular: () => void;
  aoFechar: () => void;
}

function VisaoDaLista({
  equipe,
  sucesso,
  aoDispensarSucesso,
  aoRemovido,
  aoVincular,
  aoFechar,
}: PropsDaLista) {
  const membros = useColaboradores({ equipeId: equipe.id });
  const remover = useRemoverDaEquipe(equipe.id);
  const [paraRemover, setParaRemover] = useState<Colaborador | null>(null);
  const [erroDaRemocao, setErroDaRemocao] = useState<string | null>(null);

  function cancelarRemocao() {
    setParaRemover(null);
    setErroDaRemocao(null);
  }

  async function confirmarRemocao(pessoa: Colaborador) {
    setErroDaRemocao(null);
    try {
      await remover.mutateAsync(pessoa.id);
      setParaRemover(null);
      aoRemovido(`${pessoa.nome} saiu da equipe ${equipe.nome}.`);
    } catch (erro) {
      // O líder não sai pelo botão: a tela já não o oferece, mas o servidor decide.
      const doLider = codigoDoErro(erro) === 'LIDER_DA_EQUIPE';
      setErroDaRemocao(
        doLider
          ? `${mensagemDeErro(erro)} Feche esta janela, use Editar na equipe e escolha outro líder.`
          : mensagemDeErro(erro),
      );
    }
  }

  const lista = membros.data ?? [];

  return (
    <>
      <CorpoDoDialogo>
        {sucesso !== null && (
          <AvisoDeSucesso aoDispensar={aoDispensarSucesso}>{sucesso}</AvisoDeSucesso>
        )}

        {membros.isPending && <EstadoCarregando mensagem="Carregando os colaboradores…" />}

        {membros.isError && (
          <AvisoDeErro
            acoes={
              <button
                type="button"
                onClick={() => {
                  void membros.refetch();
                }}
                className="min-h-11 rounded-xl border-2 border-recusado px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-recusado"
              >
                Tentar de novo
              </button>
            }
          >
            {mensagemDeErro(membros.error)}
          </AvisoDeErro>
        )}

        {membros.isSuccess && lista.length === 0 && (
          <div className="rounded-xl bg-fundo p-4 text-center">
            <p className="font-semibold">Nenhum colaborador nesta equipe ainda</p>
            <p className="mt-1 text-sm text-texto-suave">
              Use “Vincular colaboradores” para escolher quem entra na equipe {equipe.nome}.
            </p>
          </div>
        )}

        {membros.isSuccess && lista.length > 0 && (
          <ul aria-label={`Colaboradores da equipe ${equipe.nome}`} className="flex flex-col gap-2">
            {lista.map((pessoa) => {
              const ehLider = equipe.lider?.id === pessoa.id;
              return (
                <li
                  key={pessoa.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-fundo px-4 py-2"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      <span className="truncate">{pessoa.nome}</span>
                      {ehLider && <Etiqueta tom="sucesso">Líder</Etiqueta>}
                      {!pessoa.ativo && <Etiqueta tom="neutro">Desativado</Etiqueta>}
                    </p>
                    <p className="truncate text-sm text-texto-suave">{pessoa.email}</p>
                    {ehLider && (
                      <p className="text-sm text-texto-suave">
                        Para tirar da equipe, troque antes o líder.
                      </p>
                    )}
                  </div>
                  {!ehLider && (
                    <button
                      type="button"
                      aria-label={`Remover ${pessoa.nome} da equipe`}
                      onClick={() => {
                        setErroDaRemocao(null);
                        setParaRemover(pessoa);
                      }}
                      className={botaoDeLinhaPerigo}
                    >
                      Remover
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CorpoDoDialogo>

      <RodapeDoDialogo>
        <button type="button" onClick={aoFechar} className={botaoContorno}>
          Fechar
        </button>
        <button type="button" data-foco-inicial onClick={aoVincular} className={botaoPrimario}>
          Vincular colaboradores
        </button>
      </RodapeDoDialogo>

      {paraRemover !== null && (
        <DialogoDeConfirmacao
          titulo={`Remover ${paraRemover.nome} da equipe?`}
          descricao={`${paraRemover.nome} continua cadastrado, mas deixa de fazer parte da equipe ${equipe.nome}. Você pode vincular de novo quando quiser.`}
          rotuloDeConfirmar="Remover da equipe"
          perigosa
          pendente={remover.isPending}
          erro={erroDaRemocao}
          aoConfirmar={() => {
            void confirmarRemocao(paraRemover);
          }}
          aoCancelar={cancelarRemocao}
        />
      )}
    </>
  );
}

interface PropsDoVinculo {
  equipe: Equipe;
  equipes: readonly Equipe[];
  aoVoltar: () => void;
  aoVinculado: (mensagem: string) => void;
}

function VisaoDeVinculo({ equipe, equipes, aoVoltar, aoVinculado }: PropsDoVinculo) {
  const todos = useColaboradores();
  const vincular = useVincularColaboradores(equipe.id);
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const [erroDeSelecao, setErroDeSelecao] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const idDoErro = useId();

  // Quem está desativado não entra (a API recusa) e quem já está na equipe não precisa.
  const candidatos = (todos.data ?? []).filter(
    (pessoa) => pessoa.ativo && pessoa.equipe?.id !== equipe.id,
  );

  const equipeLideradaPor = (pessoaId: string) =>
    equipes.find((outra) => outra.lider?.id === pessoaId && outra.id !== equipe.id);

  const primeiroLivre = candidatos.find((pessoa) => equipeLideradaPor(pessoa.id) === undefined);
  const formulario = useRef<HTMLFormElement>(null);

  // A lista pode chegar depois de a visão abrir: quando chega, o foco vai para a primeira
  // caixa que dá para marcar.
  useEffect(() => {
    if (todos.isSuccess) {
      formulario.current?.querySelector<HTMLElement>('[data-foco-inicial]')?.focus();
    }
  }, [todos.isSuccess]);

  function alternar(id: string) {
    setErroDeSelecao(null);
    setMarcados((atuais) => {
      const novos = new Set(atuais);
      if (novos.has(id)) {
        novos.delete(id);
      } else {
        novos.add(id);
      }
      return novos;
    });
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral(null);

    const resultado = vincularMembrosSchema.safeParse({ colaboradorIds: [...marcados] });
    if (!resultado.success) {
      setErroDeSelecao(resultado.error.issues[0]?.message ?? 'Selecione ao menos um colaborador.');
      return;
    }

    try {
      await vincular.mutateAsync(resultado.data.colaboradorIds);
      const total = resultado.data.colaboradorIds.length;
      aoVinculado(
        total === 1
          ? `1 colaborador vinculado à equipe ${equipe.nome}.`
          : `${total} colaboradores vinculados à equipe ${equipe.nome}.`,
      );
    } catch (erro) {
      const orientacao =
        codigoDoErro(erro) === 'LIDERA_OUTRA_EQUIPE'
          ? ' Desmarque essa pessoa ou troque o líder da equipe dela antes.'
          : '';
      setErroGeral(`${mensagemDeErro(erro)}${orientacao}`);
    }
  }

  return (
    <form
      ref={formulario}
      noValidate
      onSubmit={(evento) => {
        void enviar(evento);
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <CorpoDoDialogo>
        {erroGeral !== null && <AvisoDeErro>{erroGeral}</AvisoDeErro>}

        {todos.isPending && <EstadoCarregando mensagem="Carregando os colaboradores…" />}

        {todos.isError && (
          <AvisoDeErro
            acoes={
              <button
                type="button"
                onClick={() => {
                  void todos.refetch();
                }}
                className="min-h-11 rounded-xl border-2 border-recusado px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-recusado"
              >
                Tentar de novo
              </button>
            }
          >
            {mensagemDeErro(todos.error)}
          </AvisoDeErro>
        )}

        {todos.isSuccess && candidatos.length === 0 && (
          <div className="rounded-xl bg-fundo p-4 text-center">
            <p className="font-semibold">Não há colaboradores para vincular</p>
            <p className="mt-1 text-sm text-texto-suave">
              Todos os colaboradores ativos já estão nesta equipe. Cadastre novos em Colaboradores.
            </p>
          </div>
        )}

        {todos.isSuccess && candidatos.length > 0 && (
          <fieldset
            aria-describedby={erroDeSelecao === null ? undefined : idDoErro}
            className="flex flex-col gap-2"
          >
            <legend className="mb-2 text-sm font-semibold">
              Quem entra na equipe {equipe.nome}
            </legend>
            {candidatos.map((pessoa) => {
              const outra = equipeLideradaPor(pessoa.id);
              const idDaDica = `${idDoErro}-${pessoa.id}`;
              const idDoNome = `${idDoErro}-nome-${pessoa.id}`;
              const dica =
                outra !== undefined
                  ? `Lidera a equipe ${outra.nome}. Troque o líder de lá antes de mover.`
                  : pessoa.equipe !== null
                    ? `Hoje na equipe ${pessoa.equipe.nome}; será movido para esta.`
                    : 'Sem equipe.';
              return (
                <label
                  key={pessoa.id}
                  className="flex min-h-14 items-center gap-3 rounded-xl bg-fundo px-4 py-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-marca-600 has-disabled:text-texto-suave"
                >
                  <input
                    type="checkbox"
                    checked={marcados.has(pessoa.id)}
                    disabled={outra !== undefined}
                    onChange={() => {
                      alternar(pessoa.id);
                    }}
                    data-foco-inicial={pessoa.id === primeiroLivre?.id ? true : undefined}
                    aria-labelledby={idDoNome}
                    aria-describedby={idDaDica}
                    className="size-5 shrink-0 accent-marca-600"
                  />
                  <span className="min-w-0">
                    <span id={idDoNome} className="block font-semibold">
                      {pessoa.nome}
                    </span>
                    <span id={idDaDica} className="block text-sm text-texto-suave">
                      {dica}
                    </span>
                  </span>
                </label>
              );
            })}
            {erroDeSelecao !== null && (
              <p id={idDoErro} className="text-sm font-medium text-recusado">
                {erroDeSelecao}
              </p>
            )}
          </fieldset>
        )}
      </CorpoDoDialogo>

      <RodapeDoDialogo>
        <button
          type="button"
          disabled={vincular.isPending}
          onClick={aoVoltar}
          className={botaoContorno}
        >
          Voltar
        </button>
        <button type="submit" disabled={vincular.isPending} className={botaoPrimario}>
          {vincular.isPending
            ? 'Vinculando…'
            : marcados.size === 0
              ? 'Vincular'
              : `Vincular ${marcados.size}`}
        </button>
      </RodapeDoDialogo>
    </form>
  );
}
