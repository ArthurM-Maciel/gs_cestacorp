import {
  criarColaboradorSchema,
  papeis,
  type AtualizarColaborador,
  type Colaborador,
  type Papel,
} from '@gincana/contracts';
import { useRef, useState, type FormEvent } from 'react';

import { AvisoDeErro } from '../../components/ui/Avisos.js';
import { CampoDeSelecao } from '../../components/ui/CampoDeSelecao.js';
import { CampoDeTexto } from '../../components/ui/CampoDeTexto.js';
import { CorpoDoDialogo, Dialogo, RodapeDoDialogo } from '../../components/ui/Dialogo.js';
import { DialogoDeConfirmacao } from '../../components/ui/DialogoDeConfirmacao.js';
import {
  botaoContorno,
  botaoContornoPerigo,
  botaoPrimario,
} from '../../components/ui/estilos-de-botao.js';
import { mensagemDeErro } from '../../lib/api.js';
import {
  codigoDoErro,
  errosDoSchema,
  focarPrimeiroComErro,
  traduzirErroDoFormulario,
} from '../../lib/erro-da-api.js';
import { IconeOlho, IconeOlhoCortado } from '../acesso/Icones.js';
import { useEquipes } from '../equipes/equipes-api.js';
import { LinkParaEquipes, OrientacaoDeLideranca } from './AvisoDeLideranca.js';
import { useAtualizarColaborador, useCriarColaborador } from './colaboradores-api.js';
import { rotulosDePapel } from './papeis.js';

const CAMPOS = ['nome', 'email', 'senha', 'papel', 'equipeId'] as const;
type Campo = (typeof CAMPOS)[number];
type Erros = Partial<Record<Campo, string>>;

/** O que a administradora pode alterar de quem já está cadastrado. */
const edicaoSchema = criarColaboradorSchema.pick({ nome: true, papel: true, equipeId: true });

interface Props {
  /** Presente quando é uma edição; ausente quando é um colaborador novo. */
  colaborador?: Colaborador;
  /** A gincana cujas equipes aparecem para escolha. */
  gincanaId: string | null;
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}

export function DialogoDeColaborador({ colaborador, gincanaId, aoFechar, aoConcluir }: Props) {
  const editando = colaborador !== undefined;

  const [nome, setNome] = useState(colaborador?.nome ?? '');
  const [email, setEmail] = useState(colaborador?.email ?? '');
  const [senha, setSenha] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [papel, setPapel] = useState<Papel>(colaborador?.papel ?? 'COLABORADOR');
  const [equipeId, setEquipeId] = useState(colaborador?.equipe?.id ?? '');
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [desativando, setDesativando] = useState(false);
  const [erroDaDesativacao, setErroDaDesativacao] = useState<string | null>(null);
  const [liderancaNoErro, setLiderancaNoErro] = useState(false);

  const formulario = useRef<HTMLFormElement>(null);
  const equipesConsulta = useEquipes(gincanaId);
  const criar = useCriarColaborador();
  const atualizar = useAtualizarColaborador();
  const pendente = criar.isPending || atualizar.isPending;

  const equipes = equipesConsulta.data ?? [];
  const carregandoEquipes = gincanaId !== null && equipesConsulta.isPending;

  // A equipe atual pode ser de outra gincana. Sem esta opção o seletor mostraria "Sem
  // equipe" e salvar tiraria a pessoa da equipe sem ninguém ter pedido.
  const equipeAtual = colaborador?.equipe ?? null;
  const equipeAtualForaDaLista =
    equipeAtual !== null && !equipes.some((equipe) => equipe.id === equipeAtual.id);

  /** A equipe que esta pessoa lidera, quando a tela já a conhece. */
  const equipeLiderada = equipes.find((equipe) => equipe.lider?.id === colaborador?.id);

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
    setLiderancaNoErro(false);

    try {
      if (colaborador === undefined) {
        const resultado = criarColaboradorSchema.safeParse({
          nome,
          email: email.trim(),
          senha,
          papel,
          equipeId: equipeId === '' ? null : equipeId,
        });

        if (!resultado.success) {
          mostrarErros(errosDoSchema(resultado.error.issues, CAMPOS));
          return;
        }

        await criar.mutateAsync(resultado.data);
        aoConcluir(`Cadastro de ${resultado.data.nome} concluído.`);
        return;
      }

      // Na edição o e-mail e a senha não mudam: só se confere o que a tela deixa alterar.
      const resultado = edicaoSchema.safeParse({
        nome,
        papel,
        equipeId: equipeId === '' ? null : equipeId,
      });

      if (!resultado.success) {
        mostrarErros(errosDoSchema(resultado.error.issues, CAMPOS));
        return;
      }

      // Só o que mudou vai para a API: a auditoria só registra o que muda de fato.
      const valores = resultado.data;
      const dados: AtualizarColaborador = {};
      if (valores.nome !== colaborador.nome) dados.nome = valores.nome;
      if (valores.papel !== colaborador.papel) dados.papel = valores.papel;
      if (equipeId !== (colaborador.equipe?.id ?? '')) {
        dados.equipeId = equipeId === '' ? null : equipeId;
      }

      if (Object.keys(dados).length === 0) {
        aoFechar();
        return;
      }

      await atualizar.mutateAsync({ id: colaborador.id, dados });
      aoConcluir(`Dados de ${valores.nome} atualizados.`);
    } catch (erro) {
      // Mudar equipe ou papel de quem lidera é recusado pelo servidor: a tela explica o
      // caminho (trocar o líder) em vez de repetir a recusa.
      if (codigoDoErro(erro) === 'LIDERA_EQUIPE') {
        setLiderancaNoErro(true);
        setErroGeral(mensagemDeErro(erro));
        return;
      }

      const traduzido = traduzirErroDoFormulario(erro, CAMPOS, {
        EMAIL_JA_CADASTRADO: {
          campo: 'email',
          orientacao: 'Procure essa pessoa na lista de colaboradores.',
        },
        COLABORADOR_INATIVO: { campo: 'equipeId', orientacao: 'Reative a pessoa antes.' },
      });
      setErroGeral(traduzido.geral);
      mostrarErros(traduzido.campos);
    }
  }

  async function alterarSituacao(ativo: boolean) {
    if (colaborador === undefined) {
      return;
    }
    setErroDaDesativacao(null);
    setErroGeral(null);

    try {
      await atualizar.mutateAsync({ id: colaborador.id, dados: { ativo } });
      setDesativando(false);
      aoConcluir(
        ativo
          ? `${colaborador.nome}: cadastro reativado.`
          : `${colaborador.nome}: cadastro desativado.`,
      );
    } catch (erro) {
      if (codigoDoErro(erro) === 'LIDERA_EQUIPE') {
        setLiderancaNoErro(true);
      }
      const mensagem = mensagemDeErro(erro);
      if (ativo) {
        setErroGeral(mensagem);
      } else {
        setErroDaDesativacao(mensagem);
      }
    }
  }

  return (
    <Dialogo
      titulo={editando ? `Editar ${colaborador.nome}` : 'Novo colaborador'}
      descricao={
        editando
          ? 'Altere o nome, o papel ou a equipe. O e-mail não pode ser alterado.'
          : 'Cadastre a pessoa e informe a senha do primeiro acesso.'
      }
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
          {erroGeral !== null && (
            <AvisoDeErro
              acoes={liderancaNoErro ? <LinkParaEquipes gincanaId={gincanaId} /> : undefined}
            >
              {erroGeral}
              {liderancaNoErro && <OrientacaoDeLideranca equipeNome={equipeLiderada?.nome} />}
            </AvisoDeErro>
          )}

          <CampoDeTexto
            name="nome"
            rotulo="Nome completo"
            maxLength={120}
            autoComplete="off"
            value={nome}
            onChange={(evento) => {
              setNome(evento.target.value);
              limpar('nome');
            }}
            erro={erros.nome}
            data-foco-inicial
          />
          <CampoDeTexto
            name="email"
            rotulo="E-mail"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            disabled={editando}
            onChange={(evento) => {
              setEmail(evento.target.value);
              limpar('email');
            }}
            erro={erros.email}
          />
          {!editando && (
            <CampoDeTexto
              name="senha"
              rotulo="Senha do primeiro acesso"
              type={senhaVisivel ? 'text' : 'password'}
              autoComplete="new-password"
              value={senha}
              onChange={(evento) => {
                setSenha(evento.target.value);
                limpar('senha');
              }}
              erro={erros.senha}
              dica="Mínimo de 8 caracteres, com pelo menos um número."
              acaoFinal={
                <button
                  type="button"
                  aria-label="Mostrar senha"
                  aria-pressed={senhaVisivel}
                  onClick={() => {
                    setSenhaVisivel((visivel) => !visivel);
                  }}
                  className="grid size-11 place-items-center rounded-xl text-texto-suave focus-visible:outline-2 focus-visible:outline-marca-600"
                >
                  {senhaVisivel ? (
                    <IconeOlhoCortado className="size-5" />
                  ) : (
                    <IconeOlho className="size-5" />
                  )}
                </button>
              }
            />
          )}
          <CampoDeSelecao
            name="papel"
            rotulo="Papel"
            value={papel}
            onChange={(evento) => {
              setPapel(papeis.find((item) => item === evento.target.value) ?? 'COLABORADOR');
              limpar('papel');
            }}
            erro={erros.papel}
            dica="Quem lidera uma equipe tem o papel de líder: ele é definido ao escolher o líder na tela de Equipes."
          >
            {papeis.map((item) => (
              <option key={item} value={item}>
                {rotulosDePapel[item]}
              </option>
            ))}
          </CampoDeSelecao>
          <CampoDeSelecao
            name="equipeId"
            rotulo="Equipe"
            value={equipeId}
            disabled={carregandoEquipes}
            onChange={(evento) => {
              setEquipeId(evento.target.value);
              limpar('equipeId');
            }}
            erro={erros.equipeId}
            dica={
              equipesConsulta.isError
                ? 'Não foi possível carregar as equipes. Feche e abra de novo para tentar outra vez.'
                : gincanaId !== null && equipesConsulta.isSuccess && equipes.length === 0
                  ? 'Ainda não há equipes nesta gincana. Crie em Equipes e volte para vincular.'
                  : undefined
            }
          >
            <option value="">{carregandoEquipes ? 'Carregando equipes…' : 'Sem equipe'}</option>
            {equipeAtualForaDaLista && <option value={equipeAtual.id}>{equipeAtual.nome}</option>}
            {equipes.map((equipe) => (
              <option key={equipe.id} value={equipe.id}>
                {equipe.nome}
              </option>
            ))}
          </CampoDeSelecao>

          {editando && (
            <section aria-labelledby="situacao-do-cadastro" className="rounded-xl bg-fundo p-4">
              <h3 id="situacao-do-cadastro" className="font-semibold">
                Situação do cadastro
              </h3>
              {colaborador.ativo ? (
                <>
                  <p className="mt-1 text-sm text-texto-suave">
                    Quem sai da gincana é desativado, não apagado: o histórico de lançamentos
                    continua guardado.
                  </p>
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={pendente}
                      onClick={() => {
                        setErroDaDesativacao(null);
                        setLiderancaNoErro(false);
                        setDesativando(true);
                      }}
                      className={botaoContornoPerigo}
                    >
                      Desativar cadastro
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-texto-suave">
                    Este cadastro está desativado: a pessoa não entra no sistema nem pode ser
                    vinculada a uma equipe.
                  </p>
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={pendente}
                      onClick={() => {
                        void alterarSituacao(true);
                      }}
                      className={botaoContorno}
                    >
                      Reativar cadastro
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </CorpoDoDialogo>

        <RodapeDoDialogo>
          <button type="button" disabled={pendente} onClick={aoFechar} className={botaoContorno}>
            Cancelar
          </button>
          <button type="submit" disabled={pendente} className={botaoPrimario}>
            {pendente ? 'Salvando…' : editando ? 'Salvar' : 'Cadastrar'}
          </button>
        </RodapeDoDialogo>
      </form>

      {desativando && editando && (
        <DialogoDeConfirmacao
          titulo={`Desativar ${colaborador.nome}?`}
          descricao="A pessoa deixa de entrar no sistema e não aparece mais para vincular a equipes. Os lançamentos que ela já fez continuam registrados. Você pode reativar depois."
          rotuloDeConfirmar="Desativar"
          perigosa
          pendente={atualizar.isPending}
          erro={
            erroDaDesativacao === null ? undefined : (
              <>
                {erroDaDesativacao}
                {liderancaNoErro && <OrientacaoDeLideranca equipeNome={equipeLiderada?.nome} />}
              </>
            )
          }
          acoesDoErro={liderancaNoErro ? <LinkParaEquipes gincanaId={gincanaId} /> : undefined}
          aoConfirmar={() => {
            void alterarSituacao(false);
          }}
          aoCancelar={() => {
            setDesativando(false);
            setErroDaDesativacao(null);
            setLiderancaNoErro(false);
          }}
        />
      )}
    </Dialogo>
  );
}
