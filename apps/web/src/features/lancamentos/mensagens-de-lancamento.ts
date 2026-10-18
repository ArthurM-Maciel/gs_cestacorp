import { codigoDoErro, traduzirErroDoFormulario } from '../../lib/erro-da-api.js';
import { ErroDeEnvioDoArquivo } from '../evidencias/evidencias-api.js';

/**
 * O que a tela diz quando a API recusa uma operação de lançamento.
 *
 * Cada conflito de negócio vira uma frase que diz o que fazer, não o código. Os textos são
 * daqui (e não só da API) porque a mesma recusa pede conselhos diferentes para quem registra
 * e para quem aprova.
 */
export type Operacao = 'registrar' | 'corrigir' | 'aprovar' | 'recusar';

type TextosDoConflito = { padrao: string } & Partial<Record<Operacao, string>>;

const JA_AVALIADO =
  'Outra pessoa já avaliou este lançamento. A lista foi atualizada com o resultado.';

const conflitos: Record<string, TextosDoConflito> = {
  EVIDENCIA_OBRIGATORIA: {
    padrao:
      'Esta ação exige comprovante e o lançamento não tem nenhum. Anexe um comprovante e tente de novo.',
    aprovar:
      'Esta ação exige comprovante e o lançamento ainda não tem nenhum. Peça o comprovante ao colaborador ou recuse explicando o que falta.',
  },
  NAO_PODE_AVALIAR_PROPRIO_LANCAMENTO: {
    padrao:
      'Você não pode avaliar um lançamento seu. Peça a outra pessoa com permissão: a administradora avalia o de quem lidera a equipe.',
  },
  LANCAMENTO_JA_AVALIADO: {
    padrao: 'Este lançamento já foi avaliado e não pode mais mudar por aqui.',
    aprovar: JA_AVALIADO,
    recusar: JA_AVALIADO,
  },
  LIMITE_DE_COMPROVANTES: {
    padrao: 'Este lançamento já tem o máximo de 10 comprovantes. Remova um antes de anexar outro.',
  },
  GINCANA_NAO_ESTA_ATIVA: {
    padrao:
      'A gincana não está ativa, então não dá para registrar ações agora. Fale com a administradora.',
  },
  TIPO_DE_ACAO_INATIVO: {
    padrao: 'Esta ação foi pausada e não aceita novos lançamentos. Escolha outra ação na lista.',
  },
};

export interface FalhaDeLancamento<C extends string> {
  /** Erro por campo (vindo de `detalhes` ou de um conflito que a tela amarra a um campo). */
  campos: Partial<Record<C, string>>;
  /** Aviso geral, quando o problema não é de um campo só. */
  geral: string | null;
}

interface OpcoesDaTraducao<C extends string> {
  camposDoFormulario?: readonly C[];
  /** O campo da data, quando o formulário tem um: o conflito de período aparece nele. */
  campoDaData?: C;
}

/**
 * Ordem de decisão:
 *
 * 1. falha do envio do arquivo (já vem em português);
 * 2. conflito de negócio conhecido → frase com o que fazer;
 * 3. `DADOS_INVALIDOS` com `detalhes` → no campo que a API apontou;
 * 4. qualquer outra coisa → a mensagem traduzida por `mensagemDeErro`.
 */
export function traduzirFalhaDeLancamento<C extends string = never>(
  erro: unknown,
  operacao: Operacao,
  opcoes: OpcoesDaTraducao<C> = {},
): FalhaDeLancamento<C> {
  if (erro instanceof ErroDeEnvioDoArquivo) {
    return { campos: {}, geral: erro.message };
  }

  const codigo = codigoDoErro(erro);
  const conflito = codigo === null ? undefined : conflitos[codigo];
  if (conflito !== undefined) {
    return { campos: {}, geral: conflito[operacao] ?? conflito.padrao };
  }

  const { camposDoFormulario = [], campoDaData } = opcoes;
  return traduzirErroDoFormulario(
    erro,
    camposDoFormulario,
    campoDaData === undefined
      ? {}
      : {
          DATA_FORA_DO_PERIODO_DA_GINCANA: {
            campo: campoDaData,
            orientacao: 'Escolha um dia dentro desse período.',
          },
        },
  );
}
