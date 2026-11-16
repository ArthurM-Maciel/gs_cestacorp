import {
  criarTipoAcaoSchema,
  rotulosDeUnidade,
  unidades,
  type AtualizarTipoAcao,
  type TipoAcao,
} from '@gincana/contracts';
import { useRef, useState, type FormEvent } from 'react';

import { AreaDeTexto } from '../../components/ui/AreaDeTexto.js';
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
import { useAtualizarTipoAcao, useCriarTipoAcao } from './tipos-acao-api.js';

const CAMPOS = ['nome', 'descricao', 'unidade', 'pontosPorUnidade'] as const;
type Campo = (typeof CAMPOS)[number];
type Erros = Partial<Record<Campo, string>>;

/** O que a administradora pode alterar de um tipo já cadastrado: nunca a pontuação. */
const edicaoSchema = criarTipoAcaoSchema.pick({
  nome: true,
  descricao: true,
  exigeEvidencia: true,
});

interface Props {
  gincanaId: string;
  /** Presente quando é uma edição; ausente quando é um tipo de ação novo. */
  tipo?: TipoAcao;
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}

/**
 * Cria o tipo de ação com a primeira regra, ou edita a identidade do que já existe.
 *
 * A unidade e os pontos por unidade só aparecem na criação: o `PATCH` da API recusa os
 * dois, porque trocar a pontuação é uma vigência nova (`DialogoDeNovaRegra`), nunca uma
 * edição do que já está cadastrado.
 */
export function DialogoDeTipoAcao({ gincanaId, tipo, aoFechar, aoConcluir }: Props) {
  const editando = tipo !== undefined;

  const [nome, setNome] = useState(tipo?.nome ?? '');
  const [descricao, setDescricao] = useState(tipo?.descricao ?? '');
  const [unidade, setUnidade] = useState(tipo?.unidade ?? unidades[0]);
  const [exigeEvidencia, setExigeEvidencia] = useState(tipo?.exigeEvidencia ?? true);
  const [pontosTexto, setPontosTexto] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [erroDaSituacao, setErroDaSituacao] = useState<string | null>(null);

  const formulario = useRef<HTMLFormElement>(null);
  const criar = useCriarTipoAcao(gincanaId);
  const atualizar = useAtualizarTipoAcao(tipo?.id ?? '');
  const pendente = criar.isPending || atualizar.isPending;

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
    setErroDaSituacao(null);

    if (tipo === undefined) {
      const pontosNumero = pontosTexto.trim() === '' ? Number.NaN : Number(pontosTexto);
      const resultado = criarTipoAcaoSchema.safeParse({
        nome,
        descricao: descricao.trim() === '' ? null : descricao,
        unidade,
        exigeEvidencia,
        pontosPorUnidade: pontosNumero,
      });

      if (!resultado.success) {
        mostrarErros(errosDoSchema(resultado.error.issues, CAMPOS));
        return;
      }

      try {
        await criar.mutateAsync(resultado.data);
        aoConcluir(`Tipo de ação "${resultado.data.nome}" cadastrado.`);
      } catch (erro) {
        const traduzido = traduzirErroDoFormulario(erro, CAMPOS, {
          NOME_DE_TIPO_DUPLICADO: { campo: 'nome', orientacao: 'Escolha outro nome.' },
        });
        setErroGeral(traduzido.geral);
        mostrarErros(traduzido.campos);
      }
      return;
    }

    const resultado = edicaoSchema.safeParse({
      nome,
      descricao: descricao.trim() === '' ? null : descricao,
      exigeEvidencia,
    });

    if (!resultado.success) {
      mostrarErros(errosDoSchema(resultado.error.issues, CAMPOS));
      return;
    }

    // Só o que mudou vai para a API: a auditoria só registra o que muda de fato.
    const valores = resultado.data;
    const dados: AtualizarTipoAcao = {};
    if (valores.nome !== tipo.nome) dados.nome = valores.nome;
    const novaDescricao = valores.descricao ?? null;
    if (novaDescricao !== tipo.descricao) dados.descricao = novaDescricao;
    if (valores.exigeEvidencia !== tipo.exigeEvidencia) {
      dados.exigeEvidencia = valores.exigeEvidencia;
    }

    if (Object.keys(dados).length === 0) {
      aoFechar();
      return;
    }

    try {
      await atualizar.mutateAsync(dados);
      aoConcluir(`Dados do tipo de ação "${valores.nome}" atualizados.`);
    } catch (erro) {
      const traduzido = traduzirErroDoFormulario(erro, CAMPOS, {
        NOME_DE_TIPO_DUPLICADO: { campo: 'nome', orientacao: 'Escolha outro nome.' },
      });
      setErroGeral(traduzido.geral);
      mostrarErros(traduzido.campos);
    }
  }

  async function alternarSituacao(ativo: boolean) {
    if (tipo === undefined) {
      return;
    }
    setErroDaSituacao(null);
    setErroGeral(null);

    try {
      await atualizar.mutateAsync({ ativo });
      aoConcluir(
        ativo
          ? `O tipo de ação "${tipo.nome}" voltou a aceitar novos lançamentos.`
          : `O tipo de ação "${tipo.nome}" foi pausado e não aceita mais novos lançamentos.`,
      );
    } catch (erro) {
      setErroDaSituacao(mensagemDeErro(erro));
    }
  }

  return (
    <Dialogo
      titulo={editando ? `Editar tipo de ação ${tipo.nome}` : 'Novo tipo de ação'}
      descricao={
        editando
          ? 'Altere o nome, a descrição ou a exigência de comprovante. A pontuação muda em "Nova pontuação".'
          : 'Defina como essa ação vira pontos.'
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
          {erroGeral !== null && <AvisoDeErro>{erroGeral}</AvisoDeErro>}

          <CampoDeTexto
            name="nome"
            rotulo="Nome da ação"
            maxLength={80}
            autoComplete="off"
            placeholder="Doação de tampinhas"
            value={nome}
            onChange={(evento) => {
              setNome(evento.target.value);
              limpar('nome');
            }}
            erro={erros.nome}
            data-foco-inicial
          />

          <AreaDeTexto
            name="descricao"
            rotulo="Descrição (opcional)"
            maxLength={500}
            value={descricao}
            onChange={(evento) => {
              setDescricao(evento.target.value);
              limpar('descricao');
            }}
            erro={erros.descricao}
          />

          {!editando && (
            <CampoDeSelecao
              name="unidade"
              rotulo="Unidade"
              value={unidade}
              onChange={(evento) => {
                setUnidade(evento.target.value as (typeof unidades)[number]);
                limpar('unidade');
              }}
              erro={erros.unidade}
            >
              {unidades.map((item) => (
                <option key={item} value={item}>
                  {rotulosDeUnidade[item].plural}
                </option>
              ))}
            </CampoDeSelecao>
          )}

          <label className="flex min-h-14 items-center gap-3 rounded-xl bg-fundo px-4 py-2">
            <input
              type="checkbox"
              checked={exigeEvidencia}
              onChange={(evento) => {
                setExigeEvidencia(evento.target.checked);
              }}
              className="size-5 shrink-0 accent-marca-600"
            />
            <span className="min-w-0">
              <span className="block font-semibold">Exige comprovante</span>
              <span className="block text-sm text-texto-suave">
                Foto, PDF ou certificado enviado junto do lançamento.
              </span>
            </span>
          </label>

          {!editando && (
            <CampoDeTexto
              name="pontosPorUnidade"
              rotulo="Pontos por unidade"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="10"
              value={pontosTexto}
              onChange={(evento) => {
                setPontosTexto(evento.target.value);
                limpar('pontosPorUnidade');
              }}
              erro={erros.pontosPorUnidade}
              dica='Quantos pontos cada unidade vale. Para trocar depois, use "Nova pontuação" — isso aqui não muda a pontuação já apurada.'
            />
          )}

          {editando && (
            <section aria-labelledby="situacao-do-tipo-de-acao" className="rounded-xl bg-fundo p-4">
              <h3 id="situacao-do-tipo-de-acao" className="font-semibold">
                Situação
              </h3>
              {tipo.ativo ? (
                <>
                  <p className="mt-1 text-sm text-texto-suave">
                    Pausar tira esta ação do formulário de quem registra lançamento. O que já foi
                    aprovado continua valendo e o histórico não muda.
                  </p>
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={pendente}
                      onClick={() => {
                        void alternarSituacao(false);
                      }}
                      className={botaoContorno}
                    >
                      Pausar tipo de ação
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-texto-suave">
                    Este tipo está pausado: não aparece no formulário de quem registra ação.
                  </p>
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={pendente}
                      onClick={() => {
                        void alternarSituacao(true);
                      }}
                      className={botaoContorno}
                    >
                      Reativar tipo de ação
                    </button>
                  </div>
                </>
              )}
              {erroDaSituacao !== null && (
                <p role="alert" className="mt-3 text-sm font-medium text-recusado">
                  {erroDaSituacao}
                </p>
              )}
            </section>
          )}
        </CorpoDoDialogo>

        <RodapeDoDialogo>
          <button type="button" disabled={pendente} onClick={aoFechar} className={botaoContorno}>
            Cancelar
          </button>
          <button type="submit" disabled={pendente} className={botaoPrimario}>
            {pendente ? 'Salvando…' : editando ? 'Salvar' : 'Criar tipo de ação'}
          </button>
        </RodapeDoDialogo>
      </form>
    </Dialogo>
  );
}
