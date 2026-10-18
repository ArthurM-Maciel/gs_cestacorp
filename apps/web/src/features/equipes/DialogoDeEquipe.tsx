import {
  criarEquipeSchema,
  type AtualizarEquipe,
  type Equipe,
  type Gincana,
} from '@gincana/contracts';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { AvisoDeErro } from '../../components/ui/Avisos.js';
import { CampoDeSelecao } from '../../components/ui/CampoDeSelecao.js';
import { CampoDeTexto } from '../../components/ui/CampoDeTexto.js';
import { CorpoDoDialogo, Dialogo, RodapeDoDialogo } from '../../components/ui/Dialogo.js';
import { botaoContorno, botaoPrimario } from '../../components/ui/estilos-de-botao.js';
import { mensagemDeErro } from '../../lib/api.js';
import {
  errosDoSchema,
  focarPrimeiroComErro,
  traduzirErroDoFormulario,
} from '../../lib/erro-da-api.js';
import { useColaboradores } from '../colaboradores/colaboradores-api.js';
import { useAtualizarEquipe, useCriarEquipe } from './equipes-api.js';

const CAMPOS = ['nome', 'liderId'] as const;
type Campo = (typeof CAMPOS)[number];
type Erros = Partial<Record<Campo, string>>;

interface Props {
  gincana: Gincana;
  /** Presente quando é uma edição; ausente quando é uma equipe nova. */
  equipe?: Equipe;
  /** Todas as equipes da gincana, para avisar quem já lidera outra. */
  equipes: readonly Equipe[];
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}

/** Cria a equipe ou edita o nome e o líder dela. Quem entra e sai fica em outro diálogo. */
export function DialogoDeEquipe({ gincana, equipe, equipes, aoFechar, aoConcluir }: Props) {
  const editando = equipe !== undefined;

  const [nome, setNome] = useState(equipe?.nome ?? '');
  const [liderId, setLiderId] = useState(equipe?.lider?.id ?? '');
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const formulario = useRef<HTMLFormElement>(null);
  const colaboradores = useColaboradores();
  const criar = useCriarEquipe(gincana.id);
  const atualizar = useAtualizarEquipe(equipe?.id ?? '');
  const pendente = criar.isPending || atualizar.isPending;

  // Só quem está ativo pode liderar: a API recusa o resto.
  const candidatos = (colaboradores.data ?? []).filter((pessoa) => pessoa.ativo);

  /** A equipe que a pessoa já lidera, se não for esta: a API não deixa liderar duas. */
  const equipeLideradaPor = (pessoaId: string) =>
    equipes.find((outra) => outra.lider?.id === pessoaId && outra.id !== equipe?.id);

  const escolhida = candidatos.find((pessoa) => pessoa.id === liderId);
  const jaEhDestaEquipe = equipe !== undefined && escolhida?.equipe?.id === equipe.id;
  const explicacoes: string[] = [];

  // O que muda para as pessoas envolvidas, antes de a administradora confirmar. A regra é
  // do servidor; aqui só se avisa, para a mudança não ser uma surpresa.
  if (escolhida !== undefined && !jaEhDestaEquipe) {
    explicacoes.push(
      escolhida.equipe === null
        ? `${escolhida.nome} passa a integrar esta equipe ao virar líder.`
        : `${escolhida.nome} hoje está na equipe ${escolhida.equipe.nome} e passa para esta ao virar líder.`,
    );
  }
  if (equipe?.lider != null && equipe.lider.id !== liderId) {
    explicacoes.push(`${equipe.lider.nome} deixa de liderar e continua na equipe.`);
  }
  const dicaDoLider = explicacoes.length === 0 ? undefined : explicacoes.join(' ');

  function limpar(campo: Campo) {
    setErros((atuais) => ({ ...atuais, [campo]: undefined }));
  }

  function mostrarErros(novos: Erros) {
    setErros(novos);
    focarPrimeiroComErro(formulario.current, CAMPOS, novos);
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral(null);

    const resultado = criarEquipeSchema.safeParse({
      nome,
      liderId: liderId === '' ? null : liderId,
    });

    if (!resultado.success) {
      mostrarErros(errosDoSchema(resultado.error.issues, CAMPOS));
      return;
    }

    const valores = resultado.data;
    const lider = candidatos.find((pessoa) => pessoa.id === liderId);

    try {
      if (equipe === undefined) {
        await criar.mutateAsync(valores);
        aoConcluir(
          lider === undefined
            ? `Equipe ${valores.nome} criada.`
            : `Equipe ${valores.nome} criada. Líder: ${lider.nome}.`,
        );
        return;
      }

      // Só o que mudou vai para a API. `liderId: null` tira o líder; ausente não mexe nele.
      const dados: AtualizarEquipe = {};
      if (valores.nome !== equipe.nome) dados.nome = valores.nome;
      if (liderId !== (equipe.lider?.id ?? '')) dados.liderId = liderId === '' ? null : liderId;

      if (Object.keys(dados).length === 0) {
        aoFechar();
        return;
      }

      await atualizar.mutateAsync(dados);

      const resumo: string[] = [];
      if (dados.nome !== undefined) {
        resumo.push(`Equipe renomeada para ${valores.nome}.`);
      }
      if ('liderId' in dados) {
        resumo.push(
          lider === undefined
            ? `A equipe ${valores.nome} ficou sem líder.`
            : `${lider.nome} agora lidera a equipe ${valores.nome}.`,
        );
      }
      aoConcluir(resumo.join(' '));
    } catch (erro) {
      const traduzido = traduzirErroDoFormulario(erro, CAMPOS, {
        NOME_DE_EQUIPE_DUPLICADO: { campo: 'nome', orientacao: 'Escolha outro nome.' },
        JA_LIDERA_OUTRA_EQUIPE: { campo: 'liderId' },
        COLABORADOR_INATIVO: {
          campo: 'liderId',
          orientacao: 'Reative a pessoa em Colaboradores ou escolha outra.',
        },
      });
      setErroGeral(traduzido.geral);
      mostrarErros(traduzido.campos);
    }
  }

  return (
    <Dialogo
      titulo={editando ? `Editar equipe ${equipe.nome}` : 'Nova equipe'}
      descricao="Cada equipe tem um líder, que aprova os lançamentos da própria equipe."
      aoFechar={aoFechar}
      ocupado={pendente}
    >
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

          <CampoDeTexto
            name="nome"
            rotulo="Nome da equipe"
            maxLength={80}
            autoComplete="off"
            placeholder="Ipê"
            value={nome}
            onChange={(evento) => {
              setNome(evento.target.value);
              limpar('nome');
            }}
            erro={erros.nome}
            data-foco-inicial
          />

          <CampoDeSelecao
            name="liderId"
            rotulo="Líder da equipe"
            value={liderId}
            disabled={colaboradores.isPending}
            onChange={(evento) => {
              setLiderId(evento.target.value);
              limpar('liderId');
            }}
            erro={erros.liderId}
            dica={dicaDoLider}
          >
            <option value="">
              {colaboradores.isPending ? 'Carregando colaboradores…' : 'Sem líder'}
            </option>
            {candidatos.map((pessoa) => {
              const outra = equipeLideradaPor(pessoa.id);
              return (
                <option key={pessoa.id} value={pessoa.id} disabled={outra !== undefined}>
                  {outra === undefined
                    ? pessoa.nome
                    : `${pessoa.nome} (já lidera a equipe ${outra.nome})`}
                </option>
              );
            })}
          </CampoDeSelecao>

          {colaboradores.isError && (
            <AvisoDeErro
              acoes={
                <button
                  type="button"
                  onClick={() => {
                    void colaboradores.refetch();
                  }}
                  className="min-h-11 rounded-xl border-2 border-recusado px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-recusado"
                >
                  Tentar de novo
                </button>
              }
            >
              Não foi possível carregar a lista de colaboradores.{' '}
              {mensagemDeErro(colaboradores.error)}
            </AvisoDeErro>
          )}

          {colaboradores.isSuccess && candidatos.length === 0 && (
            <p className="text-sm text-texto-suave">
              Ainda não há colaboradores ativos para liderar a equipe.{' '}
              <Link to="/colaboradores" className="font-semibold text-marca-600 underline">
                Cadastre os colaboradores
              </Link>{' '}
              e volte para escolher o líder.
            </p>
          )}
        </CorpoDoDialogo>

        <RodapeDoDialogo>
          <button type="button" disabled={pendente} onClick={aoFechar} className={botaoContorno}>
            Cancelar
          </button>
          <button type="submit" disabled={pendente} className={botaoPrimario}>
            {pendente ? 'Salvando…' : editando ? 'Salvar' : 'Criar equipe'}
          </button>
        </RodapeDoDialogo>
      </form>
    </Dialogo>
  );
}
